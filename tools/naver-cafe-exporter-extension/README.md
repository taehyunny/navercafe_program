# Naver Cafe My Post Exporter

Manifest V3 Chrome extension for collecting visible Naver Cafe post links and documenting article bodies.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this folder:

```text
C:\Users\lms\Documents\New project\tools\naver-cafe-exporter-extension
```

## Use

1. Log in to Naver Cafe in Chrome.
2. Open the page that shows your post list.
3. Click the extension icon.
4. Click `Collect` to extract visible `title`, `url`, `articleId`, and `clubId`.
5. Click `Document` to fetch each article body without summarizing it.
6. Click `Files` to export one Markdown file per article for NotebookLM or another reading tool.
7. Use `JSON`, `CSV`, or `MD` only when you want a combined export.

Reload the extension after code changes. This version adds `https://apis.naver.com/*` host permission for article body JSON requests and the `tabs` permission for rendered-page fallback extraction.

## Output Fields

Collected post:

- `title`
- `url`
- `articleId`
- `clubId`

Extracted article:

- `category`
- `bodyText`
- `sourceType`
- `extractedAt`

## Responsibility Split

- `src/shared/logger.js`: Run logs for console and popup UI.
- `src/content/postExtractor.js`: Visible list extraction from `a.article`.
- `src/content/content.js`: Content-script bridge for frame collection.
- `src/popup/articleFetcher.js`: Article URL fetch, iframe follow-up, body extraction.
- `src/popup/articleDocumenter.js`: Experimental local summarization helper, not used by the default popup flow.
- `src/popup/exporter.js`: JSON, CSV, and Markdown export.
- `src/popup/popup.js`: Popup state, button events, frame-result merging, and rendered temporary-tab fallback.

## Verification

The important second-thought check is this: a successful network request does not prove the body was extracted correctly.

After clicking `Document`, inspect the run log:

- `bodyLength` should be greater than a tiny shell-page value.
- Articles with failed body extraction stay out of the documented export.
- `Files` should create one `.md` file per article.
- Each file should contain front matter metadata and `# Original Body`.
