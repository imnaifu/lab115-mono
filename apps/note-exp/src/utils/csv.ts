/**
 * CSV Utility Functions
 * Converts data objects to CSV format for download
 */

export interface PostData {
  title: string;
  authorName: string;
  publishTime: string;
  likeCount: string;
  collectCount: string;
  commentCount: string;
  sharedCount: string;
  coverUrl: string;
  authorUrl: string;
  imageUrls: string[]; // each element will be its own column
  // Link to the note's detail page (with xsec_token). Used by the popup UI
  // (note row link); exported as the "Note URL" column without the token.
  noteUrl: string;
}

/**
 * Escapes a field value for CSV format
 * Handles commas, quotes, and newlines
 */
function escapeCSVField(field: string): string {
  let safe = field;
  // Guard against CSV/formula injection: spreadsheet apps execute a cell whose
  // value starts with = + - @ (or tab/CR). Note titles are user-controlled, so
  // prefix a single quote to neutralize the formula while keeping the text.
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    // Escape quotes by doubling them, then wrap entire field in quotes
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function postToCSVRow(data: PostData): string {
  return [
    escapeCSVField(data.title),
    escapeCSVField(data.authorName),
    escapeCSVField(data.publishTime),
    escapeCSVField(data.likeCount),
    escapeCSVField(data.collectCount),
    escapeCSVField(data.commentCount),
    escapeCSVField(data.sharedCount),
    escapeCSVField(data.coverUrl),
    escapeCSVField(data.authorUrl),
    // Export the bare note link: the xsec_token query is session-scoped noise
    // in a spreadsheet. The popup still opens the tokenized noteUrl.
    escapeCSVField((data.noteUrl ?? "").split("?")[0]),
    // All image URLs in a single cell, one per line (escapeCSVField quotes it)
    escapeCSVField((data.imageUrls ?? []).join("\n")),
  ].join(",");
}

/**
 * Converts post data to CSV format
 * Returns a CSV string with header row and data row(s)
 */
export function convertToCSV(listData: PostData[]): string {
  const headers = [
    "Title",
    "Author Name",
    "Publish Time",
    "Like Count",
    "Collect Count",
    "Comment Count",
    "Shared Count",
    "Cover URL",
    "Author URL",
    // Added after the existing URL columns (not next to Title) so sheets
    // built on the old column order keep lining up; Image URLs stays last
    // because its cell is multi-line.
    "Note URL",
    "Image URLs",
  ];

  const rows = listData.map((post) => postToCSVRow(post));
  return [headers.join(","), ...rows].join("\n");
}
