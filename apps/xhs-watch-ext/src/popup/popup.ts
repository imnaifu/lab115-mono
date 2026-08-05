import { MIN_INTERVAL_MINUTES, TIME_FILTER_OPTIONS, newWatchId } from "../shared/config";
import {
  getLatest,
  getLog,
  getPendingRun,
  loadConfig,
  loadState,
  saveConfig,
} from "../shared/store";
import type { Config, Note, Watch } from "../shared/types";

const ALARM_TICK = "xhs-watch-tick";

let config: Config;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少元素 #${id}`);
  return node as T;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 把配置写回存储，并让 worker 重建定时器 / 同步防休眠开关。 */
async function persist() {
  config = await saveConfig(config);
  await chrome.runtime.sendMessage({ type: "CONFIG_SAVED" }).catch(() => undefined);
  await renderStatus();
}

// ── 状态栏 ───────────────────────────────────────────────────────────────────

async function renderStatus() {
  const status = el<HTMLSpanElement>("status");
  const [state, pending, alarm] = await Promise.all([
    loadState(),
    getPendingRun(),
    chrome.alarms.get(ALARM_TICK),
  ]);

  status.className = "status";
  if (pending) {
    status.textContent = "正在检查…";
    return;
  }
  if (state.backoffUntil && Date.now() < state.backoffUntil) {
    status.classList.add("err");
    status.textContent = `连续失败已退避，${formatTime(state.backoffUntil)} 后重试 · ${
      state.lastError ?? ""
    }`;
    return;
  }

  const nextRun = alarm ? `下次 ${formatTime(alarm.scheduledTime)}` : "未排期";
  const lastRun = state.lastOkAt ? `上次成功 ${formatTime(state.lastOkAt)}` : "还没跑过";
  if (state.lastError) {
    status.classList.add("warn");
    status.textContent = `${nextRun} · ${state.lastError}`;
    return;
  }
  status.classList.add("ok");
  status.textContent = `${nextRun} · ${lastRun}`;
}

// ── 监控目标 ─────────────────────────────────────────────────────────────────

function renderWatches() {
  const container = el<HTMLDivElement>("watches");
  container.replaceChildren();

  if (config.watches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没有监控目标。打开小红书搜索页后点「用当前标签页 URL」最省事。";
    container.append(empty);
    return;
  }

  for (const watch of config.watches) {
    container.append(renderWatchCard(watch));
  }
}

function renderWatchCard(watch: Watch): HTMLElement {
  const card = document.createElement("div");
  card.className = "watch";

  const head = document.createElement("div");
  head.className = "watch-head";

  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.checked = watch.enabled;
  enabled.title = "启用";
  enabled.addEventListener("change", () => {
    watch.enabled = enabled.checked;
    void persist();
  });

  const name = document.createElement("input");
  name.type = "text";
  name.value = watch.name;
  name.placeholder = "名称";
  name.addEventListener("change", () => {
    watch.name = name.value.trim() || "未命名";
    void persist();
  });

  const remove = document.createElement("button");
  remove.className = "icon";
  remove.textContent = "删除";
  remove.addEventListener("click", () => {
    config.watches = config.watches.filter((candidate) => candidate.id !== watch.id);
    void chrome.runtime.sendMessage({ type: "RESET_SEEN", watchId: watch.id });
    void persist().then(() => {
      renderWatches();
      void renderLatest();
    });
  });

  head.append(enabled, name, remove);

  const url = document.createElement("input");
  url.type = "url";
  url.className = "watch-url";
  url.value = watch.url;
  url.placeholder = "https://www.xiaohongshu.com/search_result?keyword=…";
  url.addEventListener("change", () => {
    watch.url = url.value.trim();
    void persist();
  });

  const grid = document.createElement("div");
  grid.className = "watch-grid";

  grid.append(
    labelled("排序依据", (() => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = watch.sortTabLabel ?? "";
      input.placeholder = "最新";
      input.title = "筛选面板「排序依据」里的文案；留空则不动它";
      input.addEventListener("change", () => {
        watch.sortTabLabel = input.value.trim() || null;
        void persist();
      });
      return input;
    })()),
    labelled("发布时间", (() => {
      const select = document.createElement("select");
      select.title = "筛选面板「发布时间」里的选项 —— 服务端过滤，比客户端筛强";
      const options: Array<[string, string]> = [
        ["", "不设置"],
        ...TIME_FILTER_OPTIONS.map((option) => [option, option] as [string, string]),
      ];
      for (const [value, text] of options) {
        const item = document.createElement("option");
        item.value = value;
        item.textContent = text;
        select.append(item);
      }
      select.value = watch.timeFilterLabel ?? "";
      select.addEventListener("change", () => {
        watch.timeFilterLabel = select.value || null;
        void persist();
      });
      return select;
    })()),
    labelled("最低赞", (() => {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.value = String(watch.minLike);
      input.addEventListener("change", () => {
        watch.minLike = Math.max(0, Number(input.value) || 0);
        void persist();
      });
      return input;
    })()),
  );

  const actions = document.createElement("div");
  actions.className = "watch-actions";
  const reset = document.createElement("button");
  reset.textContent = "重置已见";
  reset.title = "清空历史记录，下一轮重新建立基线";
  reset.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "RESET_SEEN", watchId: watch.id }).then(() => {
      void renderLatest();
    });
  });
  actions.append(reset);

  card.append(head, url, grid, actions);
  return card;
}

function labelled(text: string, control: HTMLElement): HTMLElement {
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = text;
  label.append(span, control);
  return label;
}

// ── 最近抓到 ─────────────────────────────────────────────────────────────────

async function renderLatest() {
  const container = el<HTMLDivElement>("latest");
  container.replaceChildren();

  let total = 0;
  for (const watch of config.watches) {
    const notes = await getLatest(watch.id);
    if (notes.length === 0) continue;
    total += notes.length;

    const group = document.createElement("div");
    group.className = "latest-group";
    const heading = document.createElement("h3");
    heading.textContent = `${watch.name}（${notes.length}）`;
    group.append(heading);
    for (const note of notes) group.append(renderNote(note));
    container.append(group);
  }

  if (total === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没抓到数据。点「立即检查」跑一轮。";
    container.append(empty);
  }
}

function renderNote(note: Note): HTMLElement {
  const link = document.createElement("a");
  link.className = "note";
  link.href = note.url;
  link.target = "_blank";
  link.rel = "noreferrer";

  if (note.coverUrl) {
    const cover = document.createElement("img");
    cover.src = note.coverUrl;
    cover.alt = "";
    // 封面 CDN 偶尔挂掉，别留一个破图占位。
    cover.addEventListener("error", () => cover.remove());
    link.append(cover);
  }

  const body = document.createElement("div");
  body.className = "note-body";
  const title = document.createElement("div");
  title.className = "note-title";
  title.textContent = note.title || "(无标题)";
  const meta = document.createElement("div");
  meta.className = "note-meta";
  meta.textContent = [note.authorName, `${note.likedCount}赞`, note.publishedLabel]
    .filter(Boolean)
    .join(" · ");
  body.append(title, meta);
  link.append(body);
  return link;
}

// ── 日志 ─────────────────────────────────────────────────────────────────────

async function renderLog() {
  const container = el<HTMLDivElement>("log");
  container.replaceChildren();
  const entries = await getLog();

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没有运行记录。";
    container.append(empty);
    return;
  }

  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = entry.ok ? "log-entry" : "log-entry bad";
    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = `${formatTime(entry.at)} `;
    row.append(time, document.createTextNode(`${entry.watchName}：${entry.message}`));
    container.append(row);
  }
}

// ── 设置表单 ─────────────────────────────────────────────────────────────────

function bindSettings() {
  const interval = el<HTMLInputElement>("interval");
  interval.value = String(config.intervalMinutes);
  interval.min = String(MIN_INTERVAL_MINUTES);
  interval.addEventListener("change", () => {
    config.intervalMinutes = Math.max(MIN_INTERVAL_MINUTES, Number(interval.value) || 10);
    interval.value = String(config.intervalMinutes);
    void persist();
  });

  const captureLimit = el<HTMLInputElement>("capture-limit");
  captureLimit.value = String(config.captureLimit);
  captureLimit.addEventListener("change", () => {
    config.captureLimit = Number(captureLimit.value) || 20;
    void persist().then(() => {
      captureLimit.value = String(config.captureLimit);
    });
  });

  const maxAge = el<HTMLInputElement>("max-age-days");
  maxAge.value = String(config.maxAgeDays);
  maxAge.addEventListener("change", () => {
    config.maxAgeDays = Math.max(0, Number(maxAge.value) || 0);
    void persist();
  });

  bindCheckbox("seed-first-run", "seedOnFirstRun");
  bindCheckbox("notify-desktop", "notifyDesktop");
  bindCheckbox("keep-awake", "keepAwake");

  const barkUrl = el<HTMLInputElement>("bark-url");
  barkUrl.value = config.barkUrl;
  barkUrl.addEventListener("change", () => {
    config.barkUrl = barkUrl.value.trim();
    void persist();
  });

  const barkGroup = el<HTMLInputElement>("bark-group");
  barkGroup.value = config.barkGroup;
  barkGroup.addEventListener("change", () => {
    config.barkGroup = barkGroup.value.trim();
    void persist();
  });
}

function bindCheckbox(id: string, key: "seedOnFirstRun" | "notifyDesktop" | "keepAwake") {
  const input = el<HTMLInputElement>(id);
  input.checked = config[key];
  input.addEventListener("change", () => {
    config[key] = input.checked;
    void persist();
  });
}

/**
 * 非 api.day.app 的自建 Bark 服务器需要单独授权域名。
 * chrome.permissions.request 必须在用户手势里调用，所以只在按钮点击时走这条路。
 */
async function ensureBarkPermission(): Promise<boolean> {
  const raw = config.barkUrl.trim();
  if (!raw) return true;
  let origin: string;
  try {
    origin = `${new URL(raw).origin}/*`;
  } catch {
    return false;
  }
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

// ── 按钮 ─────────────────────────────────────────────────────────────────────

function bindActions() {
  const runNow = el<HTMLButtonElement>("run-now");
  runNow.addEventListener("click", () => {
    runNow.disabled = true;
    void chrome.runtime
      .sendMessage({ type: "RUN_NOW" })
      .then(async () => {
        await renderStatus();
        // 一轮要几十秒，等一会儿再刷新列表和日志。
        setTimeout(() => {
          void renderLatest();
          void renderLog();
          void renderStatus();
        }, 8_000);
      })
      .finally(() => {
        runNow.disabled = false;
      });
  });

  el<HTMLButtonElement>("add-watch").addEventListener("click", () => {
    config.watches.push({
      id: newWatchId(),
      name: "新监控",
      url: "",
      sortTabLabel: "最新",
      timeFilterLabel: "一天内",
      minLike: 0,
      enabled: false,
    });
    void persist().then(renderWatches);
  });

  el<HTMLButtonElement>("fill-current-tab").addEventListener("click", () => {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url ?? "";
      if (!url.includes("xiaohongshu.com")) {
        alert("当前标签页不是小红书页面。先打开你想监控的搜索结果页。");
        return;
      }
      // 从 URL 里取 keyword 当名字，省得手动填。
      let name = "新监控";
      try {
        const keyword = new URL(url).searchParams.get("keyword");
        if (keyword) name = decodeURIComponent(keyword);
      } catch {
        // URL 解析失败就用默认名字。
      }
      config.watches.push({
        id: newWatchId(),
        name,
        url,
        sortTabLabel: "最新",
        timeFilterLabel: "一天内",
        minLike: 0,
        enabled: true,
      });
      await persist();
      renderWatches();
    })();
  });

  const testNotify = el<HTMLButtonElement>("test-notify");
  testNotify.addEventListener("click", () => {
    testNotify.disabled = true;
    void (async () => {
      const granted = await ensureBarkPermission();
      if (!granted) {
        alert("没有拿到该域名的访问授权，Bark 推送会失败。");
      }
      const response = (await chrome.runtime.sendMessage({ type: "TEST_NOTIFY" })) as {
        errors?: string[];
      };
      const errors = response?.errors ?? [];
      alert(errors.length > 0 ? errors.join("\n") : "桌面通知和 Bark 都发送成功。");
      testNotify.disabled = false;
    })();
  });
}

// ── 启动 ─────────────────────────────────────────────────────────────────────

async function main() {
  config = await loadConfig();
  renderWatches();
  bindSettings();
  bindActions();
  await Promise.all([renderStatus(), renderLatest(), renderLog()]);
  // 打开过就算读过了，清掉图标上的红点计数。
  await chrome.runtime.sendMessage({ type: "CLEAR_UNREAD" }).catch(() => undefined);
  // popup 开着的时候持续刷新状态，能看到「正在检查…」的变化。
  setInterval(() => void renderStatus(), 2_000);
}

void main();
