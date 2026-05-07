# Design Document

## Purpose

This Chrome extension collects visible Naver Cafe post links and exports each article body as a raw Markdown source file.

## Object Responsibilities

### Logger

- Creates timestamped run log entries.
- Writes each step to DevTools Console.
- Returns log entries so the popup can render the run history.

### PostExtractor

- Finds visible `a.article` elements in the current frame.
- Normalizes title text.
- Parses `articleId` and `clubId` from each article URL.
- Removes duplicate posts by `articleId` or URL.

### ArticleFetcher

- Fetches an article URL with browser credentials.
- Follows the Naver Cafe `cafe_main` iframe when the first response is a shell page.
- Extracts readable article body text from known content selectors.
- Logs URL, article ID, body length, and iframe usage for verification.

### ArticleDocumenter

- Experimental helper for local summarization.
- Not used by the default popup flow because local heuristic summaries can make weak conclusions look more reliable than they are.
- Summary generation should happen later in NotebookLM or another tool after source files are verified.

### ContentBridge

- Receives collection requests from the popup.
- Collects posts from the current frame.
- Returns success or failure responses.

### PopupController

- Validates the active Naver Cafe tab.
- Collects posts from all frames.
- Runs body extraction sequentially so logs stay easy to read.
- Stores raw article documents with metadata and original body text.
- Enables JSON, CSV, combined Markdown, and per-article Markdown file export buttons based on the available result.

### PopupExporter

- Converts results to JSON, CSV, combined Markdown, or one Markdown file per article.
- Saves files through the Chrome downloads API.

## Verification Procedure

1. Open a Naver Cafe page that shows the user's post list.
2. Click `Collect` and confirm the popup count matches the visible list count.
3. Click `Document` and inspect the run log for each article's `bodyLength`.
4. Treat `bodyLength` below the expected article size as a signal to re-check selectors or permissions.
5. Click `Files` and confirm each article is saved as a separate Markdown file.
6. Open a sample file and confirm `# Original Body` contains the real post body before using NotebookLM.

## Document Shape

```json
{
  "title": "Post title",
  "url": "https://cafe.naver.com/...",
  "articleId": "62100",
  "clubId": "28969626",
  "category": "Board or category name",
  "bodyText": "Original post body",
  "sourceType": "rendered-tab",
  "extractedAt": "2026-05-07T00:00:00.000Z"
}
```
