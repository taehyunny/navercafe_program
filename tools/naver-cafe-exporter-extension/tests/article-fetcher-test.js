const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const sandbox = {
  console,
  DOMParser: function DOMParser() {},
  globalThis: {}
};

sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const loggerCode = fs.readFileSync("src/shared/logger.js", "utf8");
const fetcherCode = fs.readFileSync("src/popup/articleFetcher.js", "utf8");

vm.runInContext(loggerCode, sandbox);
vm.runInContext(fetcherCode, sandbox);

const apiUrls = sandbox.NaverCafeArticleFetcher.buildArticleApiUrls({
  clubId: "28969626",
  articleId: "62273"
});

assert.ok(apiUrls[0].includes("cafe-articleapi/cafes/28969626/articles/62273"));

const bodyText = sandbox.NaverCafeArticleFetcher.extractApiBodyText({
  contentElements: [
    {
      type: "TEXT",
      json: {
        text: "First paragraph"
      }
    },
    {
      type: "IMAGE",
      json: {
        image: {
          url: "https://example.com/image.png"
        },
        caption: "Diagram caption"
      }
    }
  ]
});

assert.strictEqual(bodyText, "First paragraph Diagram caption");

console.log("article-fetcher-test passed", {
  apiUrl: apiUrls[0],
  bodyText
});
