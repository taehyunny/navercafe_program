const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const sandbox = {
  console,
  globalThis: {}
};

sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const loggerCode = fs.readFileSync("src/shared/logger.js", "utf8");
const documenterCode = fs.readFileSync("src/popup/articleDocumenter.js", "utf8");
const exporterCode = fs.readFileSync("src/popup/exporter.js", "utf8");

vm.runInContext(loggerCode, sandbox);
vm.runInContext(documenterCode, sandbox);
vm.runInContext(exporterCode, sandbox);

const documentedPost = sandbox.NaverCafeArticleDocumenter.documentArticle({
  title: "JavaScript async logging pattern",
  url: "https://cafe.naver.com/example/1",
  articleId: "1",
  clubId: "10",
  category: "Development",
  bodyText: "Async code needs visible logs. Logs make failures easier to verify. Summary should stay short."
});

assert.strictEqual(documentedPost.category, "Development");
assert.strictEqual(documentedPost.articleId, "1");
assert.ok(documentedPost.summary.includes("Async code"));
assert.ok(documentedPost.keyConcepts.includes("logs"));
assert.ok(documentedPost.questionsToVerify.length >= 3);

const markdown = sandbox.NaverCafePopupExporter.postsToMarkdown([documentedPost]);

assert.ok(markdown.includes("# Naver Cafe Article Bodies"));
assert.ok(markdown.includes("### Body"));

const rawMarkdown = sandbox.NaverCafePopupExporter.createArticleMarkdown({
  title: "Raw body",
  url: "https://cafe.naver.com/example/2",
  articleId: "2",
  clubId: "10",
  category: "Development",
  bodyText: "Original body should be preserved for NotebookLM.",
  sourceType: "rendered-tab",
  extractedAt: "2026-05-07T00:00:00.000Z"
});

assert.ok(rawMarkdown.includes("# Original Body"));
assert.ok(rawMarkdown.includes("Original body should be preserved"));

console.log("article-documenter-test passed", documentedPost);
