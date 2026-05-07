const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

function createElementFromHtml(html) {
  const hrefMatch = html.match(/href="([^"]+)"/);
  const classMatch = html.match(/class="([^"]+)"/);
  const text = html.replace(/<[^>]+>/g, "").trim();

  return {
    innerText: text,
    textContent: text,
    getAttribute(name) {
      if (name === "href") {
        return hrefMatch ? hrefMatch[1].replace(/&amp;/g, "&") : "";
      }

      if (name === "class") {
        return classMatch ? classMatch[1] : "";
      }

      return "";
    }
  };
}

const sandbox = {
  console,
  URL,
  globalThis: {}
};

sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const loggerCode = fs.readFileSync("src/shared/logger.js", "utf8");
const extractorCode = fs.readFileSync("src/content/postExtractor.js", "utf8");

vm.runInContext(loggerCode, sandbox);
vm.runInContext(extractorCode, sandbox);

const sampleElement = createElementFromHtml(
  '<a href="/ArticleRead.nhn?clubid=28969626&amp;articleid=62100" target="_blank" class="article"><!----> 2026. 04. 13 개발일지 [ 카메라의 본질 ] </a>'
);

const post = sandbox.NaverCafePostExtractor.extractPostSummary(
  sampleElement,
  "https://cafe.naver.com/startdev"
);

assert.strictEqual(post.title, "2026. 04. 13 개발일지 [ 카메라의 본질 ]");
assert.strictEqual(post.url, "https://cafe.naver.com/ArticleRead.nhn?clubid=28969626&articleid=62100");
assert.strictEqual(post.articleId, "62100");
assert.strictEqual(post.clubId, "28969626");

console.log("sample-extractor-test passed", post);
