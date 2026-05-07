(function attachPopupExporter(global) {
  "use strict";

  function createTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }

  function escapeCsvValue(value) {
    const text = String(value || "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function postsToCsv(posts) {
    const headers = ["title", "url", "articleId", "clubId", "category", "bodyText", "sourceType", "extractedAt"];
    const rows = posts.map((post) => headers.map((key) => escapeCsvValue(post[key])).join(","));

    return [headers.join(","), ...rows].join("\n");
  }

  function sanitizeFilename(text) {
    const filename = String(text || "untitled")
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return filename.slice(0, 90) || "untitled";
  }

  function createArticleMarkdown(post) {
    return [
      "---",
      `title: ${post.title || ""}`,
      `url: ${post.url || ""}`,
      `articleId: ${post.articleId || ""}`,
      `clubId: ${post.clubId || ""}`,
      `category: ${post.category || ""}`,
      `sourceType: ${post.sourceType || ""}`,
      `extractedAt: ${post.extractedAt || ""}`,
      "---",
      "",
      "# Original Body",
      "",
      post.bodyText || ""
    ].join("\n");
  }

  function createMarkdownSection(post) {
    if (post.bodyText) {
      return createArticleMarkdown(post);
    }

    return [
      `## ${post.title}`,
      "",
      `- URL: ${post.url}`,
      `- Article ID: ${post.articleId}`,
      `- Club ID: ${post.clubId}`,
      `- Category: ${post.category || ""}`,
      `- Topic: ${post.topic || ""}`,
      "",
      "### Body",
      "",
      post.summary || ""
    ].join("\n");
  }

  function postsToMarkdown(posts) {
    return ["# Naver Cafe Article Bodies", "", ...posts.map(createMarkdownSection)].join("\n\n");
  }

  function downloadTextFile(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: true
      },
      () => {
        URL.revokeObjectURL(url);
      }
    );
  }

  function downloadJson(posts) {
    const filename = `naver-cafe-posts-${createTimestamp()}.json`;
    const text = JSON.stringify(posts, null, 2);

    downloadTextFile(filename, text, "application/json;charset=utf-8");
  }

  function downloadCsv(posts) {
    const filename = `naver-cafe-posts-${createTimestamp()}.csv`;

    downloadTextFile(filename, postsToCsv(posts), "text/csv;charset=utf-8");
  }

  function downloadMarkdown(posts) {
    const filename = `naver-cafe-posts-${createTimestamp()}.md`;

    downloadTextFile(filename, postsToMarkdown(posts), "text/markdown;charset=utf-8");
  }

  function downloadMarkdownFiles(posts) {
    const folderName = `naver-cafe-articles-${createTimestamp()}`;

    posts.forEach((post, index) => {
      const order = String(index + 1).padStart(2, "0");
      const articleId = post.articleId || "no-id";
      const filename = `${folderName}/${order}-${articleId}-${sanitizeFilename(post.title)}.md`;

      downloadTextFile(filename, createArticleMarkdown(post), "text/markdown;charset=utf-8");
    });
  }

  global.NaverCafePopupExporter = {
    downloadCsv,
    downloadJson,
    downloadMarkdown,
    downloadMarkdownFiles,
    createArticleMarkdown,
    postsToCsv,
    postsToMarkdown
  };
})(globalThis);
