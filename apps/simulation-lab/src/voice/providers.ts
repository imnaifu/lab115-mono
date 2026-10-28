// Replaceable TTS providers. Each turns narration clips into audio files; the cache layer then
// normalises and stores them. Adding an online service = one more entry here (mark it `paid`,
// read its key from an environment variable, never from the repo or the browser).

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { NarrationClip, VoiceSpec } from "../core/story.ts";

export interface SynthesisRequest {
  clip: NarrationClip;
  voice: VoiceSpec;
}

export interface TtsProvider {
  id: string;
  /** Paid providers require an explicit --allow-paid on every command that may call them. */
  paid: boolean;
  describe(voice: VoiceSpec): string;
  /** Produce an audio file for the clip and return its path (any format FFmpeg reads). */
  synthesize(request: SynthesisRequest): Promise<string>;
  close(): Promise<void>;
}

/** Local Kokoro-82M via the Python worker in tts/kokoro_worker.py (free, offline after setup). */
class KokoroProvider implements TtsProvider {
  id = "kokoro";
  paid = false;
  private worker: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, { resolve: (value: void) => void; reject: (error: Error) => void }>();
  private ready: Promise<void> | null = null;
  private stderr = "";
  private workDir = mkdtempSync(join(tmpdir(), "simlab-kokoro-"));
  private counter = 0;

  constructor(private projectRoot: string) {}

  describe(voice: VoiceSpec) {
    return `Kokoro-82M ${voice.model ?? "(default model)"} · voice ${voice.voice ?? "af_heart"} · speed ${voice.speed ?? 1} · local, free`;
  }

  private start(): Promise<void> {
    const python = join(this.projectRoot, ".venv-tts", "bin", "python");
    if (!existsSync(python)) return Promise.reject(new Error("Kokoro is not set up. Run `npm run setup:tts` once (needs uv and espeak-ng)."));
    this.worker = spawn(python, [join(this.projectRoot, "tts", "kokoro_worker.py")], { cwd: this.projectRoot, stdio: ["pipe", "pipe", "pipe"] });
    this.worker.stderr.on("data", (chunk: Buffer) => (this.stderr = (this.stderr + chunk.toString()).slice(-4000)));
    return new Promise((resolve, reject) => {
      const lines = createInterface({ input: this.worker!.stdout });
      lines.on("line", (line) => {
        let message: { ready?: boolean; id?: string; ok?: boolean; error?: string };
        try {
          message = JSON.parse(line);
        } catch {
          return; // libraries occasionally print to stdout; ignore non-protocol lines
        }
        if (message.ready) return resolve();
        const waiter = message.id ? this.pending.get(message.id) : undefined;
        if (!waiter) return;
        this.pending.delete(message.id!);
        if (message.ok) waiter.resolve();
        else waiter.reject(new Error(message.error ?? "unknown TTS error"));
      });
      this.worker!.on("exit", (code) => {
        const error = new Error(`Kokoro worker exited (code ${code}). Last output:\n${this.stderr.split("\n").slice(-8).join("\n")}`);
        reject(error);
        for (const waiter of this.pending.values()) waiter.reject(error);
        this.pending.clear();
        this.worker = null;
        this.ready = null;
      });
    });
  }

  async synthesize({ clip, voice }: SynthesisRequest): Promise<string> {
    this.ready ??= this.start();
    await this.ready;
    const id = `${clip.key}-${this.counter++}`;
    const out = join(this.workDir, `${id}.wav`);
    const done = new Promise<void>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.worker!.stdin.write(`${JSON.stringify({ id, text: clip.speech, voice: voice.voice ?? "af_heart", model: voice.model, speed: voice.speed ?? 1, out })}\n`);
    await done;
    return out;
  }

  async close() {
    if (this.worker) {
      this.worker.stdin.end();
      this.worker.kill();
    }
    rmSync(this.workDir, { recursive: true, force: true });
  }
}

const AUDIO_EXTENSIONS = ["wav", "m4a", "mp3", "aiff", "flac", "ogg"];

/**
 * Your own recordings: one file per clip in audio/<story>/<clip-id>.<ext>
 * (`npm run voice -- --story … --list` prints the expected names and texts).
 */
class FilesProvider implements TtsProvider {
  id = "files";
  paid = false;

  constructor(private projectRoot: string, private storyName: string) {}

  describe() {
    return `local recordings from audio/${this.storyName}/`;
  }

  expectedPath(clip: NarrationClip): string {
    return join(this.projectRoot, "audio", this.storyName, `${clip.id}.<${AUDIO_EXTENSIONS.join("|")}>`);
  }

  async synthesize({ clip }: SynthesisRequest): Promise<string> {
    const dir = join(this.projectRoot, "audio", this.storyName);
    const match = existsSync(dir) ? readdirSync(dir).find((file) => AUDIO_EXTENSIONS.some((ext) => file === `${clip.id}.${ext}`)) : undefined;
    if (!match) throw new Error(`missing recording ${this.expectedPath(clip)} for: "${clip.caption}"`);
    return join(dir, match);
  }

  async close() {}
}

export function createProvider(voice: VoiceSpec, projectRoot: string, storyName: string): TtsProvider | null {
  switch (voice.provider) {
    case "kokoro":
      return new KokoroProvider(projectRoot);
    case "files":
      return new FilesProvider(projectRoot, storyName);
    case "none":
      return null;
    default:
      throw new Error(`Unknown voice provider "${voice.provider}". Available: kokoro, files, none`);
  }
}
