# Xiaohongshu (RED) Exporter

A Chrome Extension (Manifest V3) that exports Xiaohongshu (RED) note lists to a
CSV file. It works on both **xiaohongshu.com** and **rednote.com**.

The extension does not scrape the DOM or crawl on its own. Instead it observes
the note-list API responses the page itself requests while you browse, then lets
you export the collected notes on demand.

## Supported pages

| Page | Intercepted API | Notes |
| --- | --- | --- |
| Search results | `/api/sns/web/v2/search/notes` (host `so.xiaohongshu.com`; legacy `v1` on `edith` still matched) | Full fields |

## Features

- ✅ Works on `xiaohongshu.com` and `rednote.com`
- ✅ Collects notes from search results pages
- ✅ Automatically de-duplicates notes by id across paginated responses
- ✅ Live count of captured notes (and how many duplicates were skipped)
- ✅ "Clear" button to reset captured notes before a new search
- ✅ Exports to CSV with an author link built for the current site
- ✅ User-initiated export only — nothing is sent to any external server

## Exported columns

`Title`, `Author Name`, `Publish Time`, `Like Count`, `Collect Count`,
`Comment Count`, `Shared Count`, `Cover URL`, `Author URL`, and
`Image URLs` (all image links in one cell, one per line).

Not every source returns every column. Only the search API returns the full
`interact_info` and the `publish_time` corner tag; the homepage feed (`/` and
`/explore`) and profile lists (`user_posted`) return **only the like count**.
Columns the API didn't return are exported **empty**, never `0`, so a blank
cell means "not provided" rather than a real count of zero.

Relative publish times (e.g. `昨天 22:33`, `5天前`, `09-20`) are normalized to
`YYYY-MM-DD` based on the export time.

## Technical Stack

- **Manifest V3** - Latest Chrome Extension manifest format
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server

## Project Structure

```
.
├── src/
│   ├── background/        # Service worker: CSV conversion + download
│   │   └── background.ts
│   ├── content/           # Content script + injected page-context hook
│   │   ├── content.ts      # Relays messages between popup and injected script
│   │   └── injected.ts     # Hooks XHR to capture note-list API responses
│   ├── popup/             # Extension popup UI
│   │   ├── popup.html
│   │   └── popup.ts
│   └── utils/             # Pure helpers
│       ├── csv.ts          # CSV conversion + data URL
│       ├── datetime.ts     # publish_time normalization
│       └── note.ts         # API item → PostData parsing
├── test/                  # Sample API responses for reference
├── icons/                 # Extension icons (16x16, 48x48, 128x128)
├── manifest.json
├── vite.config.ts
└── package.json
```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run build
   ```
   This creates a `dist/` directory with the compiled extension.

3. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist/` directory

## Development

- **Watch mode (auto-rebuild on changes):**
  ```bash
  npm run dev
  ```

- **Production build:**
  ```bash
  npm run build
  ```

## Usage

1. Open a Xiaohongshu / RED search results page.
2. Scroll down so the page loads more notes (each page is captured automatically).
3. Click the extension icon — the popup shows how many notes were captured.
4. Click "Export CSV" to download the collected notes.
5. Use "Clear" before starting a new search to reset the captured notes.

## How It Works

1. **Injected Script** (`injected.ts`): Runs in the page's own JavaScript
   context and hooks `XMLHttpRequest` so it can read the note-list API
   responses the page requests. It de-duplicates notes by id and tracks how
   many raw items were received.

2. **Content Script** (`content.ts`): Bridges the isolated content-script
   context and the page context, relaying messages between the popup and the
   injected script.

3. **Popup** (`popup.html` + `popup.ts`): Shows the live capture count, parses
   the captured items into rows (building the author URL for the current
   site), and on export sends the rows to the background script.

4. **Background Service Worker** (`background.ts`): Converts the rows to CSV and
   triggers a download via `chrome.downloads` (using a base64 data URL, since
   `URL.createObjectURL` is unavailable in MV3 service workers).

## Permissions

- `downloads` - Required to save CSV files
- `https://www.xiaohongshu.com/*`, `https://www.rednote.com/*` - Run the content script
- `https://so.xiaohongshu.com/*`, `https://edith.xiaohongshu.com/*` (and rednote equivalents) - API hosts

## License

MIT
