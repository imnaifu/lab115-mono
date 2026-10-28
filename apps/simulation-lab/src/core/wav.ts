// Minimal WAV (RIFF) reading and writing for PCM16 / float32. Pure — works in Node and browsers.

export interface Audio {
  sampleRate: number;
  /** One Float32Array per channel, samples in -1..1. */
  channels: Float32Array[];
}

export function decodeWav(bytes: Uint8Array): Audio {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file");
  let offset = 12;
  let format = 0;
  let channelCount = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      format = view.getUint16(body, true);
      channelCount = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
      // WAVE_FORMAT_EXTENSIBLE: the real format code sits in the sub-format GUID.
      if (format === 0xfffe) format = view.getUint16(body + 24, true);
    } else if (id === "data") {
      const frameCount = Math.floor(size / ((bitsPerSample / 8) * channelCount));
      const channels = Array.from({ length: channelCount }, () => new Float32Array(frameCount));
      for (let frame = 0; frame < frameCount; frame++) {
        for (let channel = 0; channel < channelCount; channel++) {
          const position = body + (frame * channelCount + channel) * (bitsPerSample / 8);
          if (format === 1 && bitsPerSample === 16) channels[channel][frame] = view.getInt16(position, true) / 32768;
          else if (format === 3 && bitsPerSample === 32) channels[channel][frame] = view.getFloat32(position, true);
          else throw new Error(`Unsupported WAV encoding (format ${format}, ${bitsPerSample} bit)`);
        }
      }
      return { sampleRate, channels };
    }
    offset = body + size + (size % 2);
  }
  throw new Error("WAV file has no data chunk");
}

/** 16-bit PCM. Samples are clamped; callers should check peaks before encoding. */
export function encodeWav(audio: Audio): Uint8Array {
  const channelCount = audio.channels.length;
  const frameCount = audio.channels[0].length;
  const dataSize = frameCount * channelCount * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const writeTag = (offset: number, text: string) => [...text].forEach((char, i) => (bytes[offset + i] = char.charCodeAt(0)));
  writeTag(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeTag(8, "WAVE");
  writeTag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeTag(36, "data");
  view.setUint32(40, dataSize, true);
  let position = 44;
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = Math.max(-1, Math.min(1, audio.channels[channel][frame]));
      view.setInt16(position, Math.round(sample * 32767), true);
      position += 2;
    }
  }
  return bytes;
}

/** Index range of the audible part: trims leading/trailing silence below `thresholdDb`, keeping `padSeconds`. */
export function audibleRange(samples: Float32Array, sampleRate: number, thresholdDb = -45, padSeconds = 0.03): [number, number] {
  const threshold = 10 ** (thresholdDb / 20);
  let first = 0;
  while (first < samples.length && Math.abs(samples[first]) < threshold) first++;
  let last = samples.length - 1;
  while (last > first && Math.abs(samples[last]) < threshold) last--;
  if (first >= samples.length) return [0, 0];
  const pad = Math.round(padSeconds * sampleRate);
  return [Math.max(0, first - pad), Math.min(samples.length, last + 1 + pad)];
}

export function peak(channels: Float32Array[]): number {
  let max = 0;
  for (const channel of channels) for (const sample of channel) max = Math.max(max, Math.abs(sample));
  return max;
}
