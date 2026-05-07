(function attachPopupController(global) {
  "use strict";

  const logger = global.NaverCafeExporterLogger;
  const exporter = global.NaverCafePopupExporter;
  const articleFetcher = global.NaverCafeArticleFetcher;

  let collectedPosts = [];
  let documentedPosts = [];

  const elements = {
    collectButton: document.getElementById("collectButton"),
    documentButton: document.getElementById("documentButton"),
    downloadJsonButton: document.getElementById("downloadJsonButton"),
    downloadCsvButton: document.getElementById("downloadCsvButton"),
    downloadMarkdownButton: document.getElementById("downloadMarkdownButton"),
    downloadFilesButton: document.getElementById("downloadFilesButton"),
    statusText: document.getElementById("statusText"),
    postCount: document.getElementById("postCount"),
    logList: document.getElementById("logList")
  };

  function addLog(step, data) {
    const entry = logger.logStep(step, data);
    const item = document.createElement("li");
    const stepElement = document.createElement("span");
    const dataElement = document.createElement("span");

    stepElement.className = "log-step";
    stepElement.textContent = entry.step;
    dataElement.className = "log-data";
    dataElement.textContent = formatLogData(entry.data);
    item.append(stepElement, dataElement);
    elements.logList.prepend(item);
  }

  function formatLogData(data) {
    if (!data || Object.keys(data).length === 0) {
      return "";
    }

    const diagnostics = data.diagnostics || {};
    const summary = {
      articleId: data.articleId,
      count: data.count,
      bodyLength: data.bodyLength,
      message: data.message,
      fallback: data.fallback,
      api: diagnostics.apiStatuses,
      elements: diagnostics.contentElementCount,
      texts: diagnostics.rawTextCount,
      html: diagnostics.htmlBodyLength
    };
    const compactSummary = Object.fromEntries(
      Object.entries(summary).filter(([, value]) => value !== undefined && value !== "")
    );

    return JSON.stringify(compactSummary);
  }

  function setStatus(text) {
    elements.statusText.textContent = text;
  }

  function updateResult(posts) {
    collectedPosts = posts;
    documentedPosts = [];
    elements.postCount.textContent = String(posts.length);
    elements.documentButton.disabled = posts.length === 0;
    elements.downloadJsonButton.disabled = posts.length === 0;
    elements.downloadCsvButton.disabled = posts.length === 0;
    elements.downloadMarkdownButton.disabled = true;
    elements.downloadFilesButton.disabled = true;
  }

  function updateDocumentedResult(posts) {
    documentedPosts = posts;
    elements.postCount.textContent = String(posts.length);
    elements.downloadJsonButton.disabled = posts.length === 0;
    elements.downloadCsvButton.disabled = posts.length === 0;
    elements.downloadMarkdownButton.disabled = posts.length === 0;
    elements.downloadFilesButton.disabled = posts.length === 0;
  }

  function mergeFrameResults(results) {
    const postMap = new Map();

    results.forEach((result) => {
      if (!result || !result.ok) {
        return;
      }

      result.posts.forEach((post) => {
        postMap.set(post.articleId || post.url, post);
      });
    });

    return Array.from(postMap.values());
  }

  async function getActiveNaverCafeTab() {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    const tab = tabs[0];

    if (!tab || !tab.id || !tab.url || !tab.url.startsWith("https://cafe.naver.com/")) {
      throw new Error("Run this extension on a Naver Cafe tab.");
    }

    return tab;
  }

  function collectPostsInsideFrame() {
    if (!globalThis.NaverCafePostExtractor) {
      return {
        ok: false,
        frameUrl: document.location.href,
        message: "Post extractor is not loaded in this frame."
      };
    }

    try {
      return {
        ok: true,
        frameUrl: document.location.href,
        posts: globalThis.NaverCafePostExtractor.collectVisiblePosts(document)
      };
    } catch (error) {
      return {
        ok: false,
        frameUrl: document.location.href,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async function collectVisiblePostsFromTab() {
    setStatus("Scanning all frames in the current tab for post links.");
    addLog("Collect request started", {});

    const tab = await getActiveNaverCafeTab();
    const injectionResults = await chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        allFrames: true
      },
      func: collectPostsInsideFrame
    });

    const responses = injectionResults.map((result) => result.result);
    const posts = mergeFrameResults(responses);

    updateResult(posts);
    addLog("Collect completed", {
      count: posts.length
    });
    setStatus(posts.length > 0 ? "Collect completed. You can export the list or document article bodies." : "No posts found. Try again on the list frame.");
  }

  async function handleCollectClick() {
    try {
      elements.collectButton.disabled = true;
      await collectVisiblePostsFromTab();
    } catch (error) {
      updateResult([]);
      addLog("Collect failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      elements.collectButton.disabled = false;
    }
  }

  function extractRenderedArticleInsideFrame(post) {
    const selectors = [
      ".se-main-container",
      "#tbody",
      ".ContentRenderer",
      ".article_viewer",
      ".ArticleContentBox",
      "[class*='ArticleContent']",
      "[class*='article_content']"
    ];
    const categorySelectors = [
      ".link_board",
      ".board_name",
      ".ArticleBoard",
      ".cafe-menu-name",
      "[class*='category']"
    ];

    function normalize(text) {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function findText(candidateSelectors) {
      for (const selector of candidateSelectors) {
        const element = document.querySelector(selector);

        if (element) {
          const text = normalize(element.innerText || element.textContent);

          if (text.length > 20) {
            return text;
          }
        }
      }

      return "";
    }

    function findCategory() {
      for (const selector of categorySelectors) {
        const element = document.querySelector(selector);
        const text = element ? normalize(element.innerText || element.textContent) : "";

        if (text) {
          return text;
        }
      }

      return "";
    }

    const bodyText = findText(selectors);

    return {
      ok: bodyText.length > 0,
      frameUrl: document.location.href,
      articleId: post.articleId,
      category: findCategory(),
      bodyText,
      bodyLength: bodyText.length
    };
  }

  async function waitForTabComplete(tabId) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 12000);

      function listener(updatedTabId, changeInfo) {
        if (updatedTabId === tabId && changeInfo.status === "complete") {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  async function extractRenderedArticleFromTemporaryTab(post) {
    const tab = await chrome.tabs.create({
      url: post.url,
      active: false
    });

    try {
      await waitForTabComplete(tab.id);

      // Give Naver Cafe's client-rendered article body a moment after document complete.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const injectionResults = await chrome.scripting.executeScript({
        target: {
          tabId: tab.id,
          allFrames: true
        },
        func: extractRenderedArticleInsideFrame,
        args: [post]
      });
      const frameResults = injectionResults.map((result) => result.result).filter(Boolean);
      const bestResult = frameResults
        .filter((result) => result.ok)
        .sort((left, right) => right.bodyLength - left.bodyLength)[0];

      if (!bestResult) {
        throw new Error("Rendered article body was not found in the temporary tab.");
      }

      return {
        ...post,
        category: bestResult.category,
        bodyText: bestResult.bodyText,
        fallback: "rendered-tab"
      };
    } finally {
      if (tab && tab.id) {
        chrome.tabs.remove(tab.id);
      }
    }
  }

  async function documentCollectedPosts() {
    const documented = [];

    for (const [index, post] of collectedPosts.entries()) {
      setStatus(`Documenting ${index + 1}/${collectedPosts.length}: ${post.title}`);

      try {
        // Fetching and documenting are kept separate so each failure is visible in logs.
        let postWithBody;

        try {
          postWithBody = await articleFetcher.fetchArticleBody(post);
        } catch (fetchError) {
          addLog("Fetch fallback", {
            articleId: post.articleId,
            message: fetchError instanceof Error ? fetchError.message : String(fetchError),
            diagnostics: fetchError.diagnostics || {}
          });
          postWithBody = await extractRenderedArticleFromTemporaryTab(post);
        }

        const documentedPost = createRawArticleDocument(postWithBody);

        documented.push(documentedPost);
        addLog("Document completed", {
          articleId: post.articleId,
          bodyLength: postWithBody.bodyText.length,
          fallback: postWithBody.fallback || ""
        });
      } catch (error) {
        addLog("Document failed", {
          articleId: post.articleId,
          message: error instanceof Error ? error.message : String(error),
          diagnostics: error.diagnostics || {}
        });
      }
    }

    updateDocumentedResult(documented);
    setStatus(documented.length > 0 ? "Body extraction completed. Export one Markdown file per article with Files." : "No article body was extracted. Check the run log.");
  }

  function createRawArticleDocument(postWithBody) {
    return {
      title: postWithBody.title,
      url: postWithBody.url,
      articleId: postWithBody.articleId,
      clubId: postWithBody.clubId,
      category: postWithBody.category || "",
      bodyText: postWithBody.bodyText,
      sourceType: postWithBody.fallback || "fetch",
      extractedAt: new Date().toISOString()
    };
  }

  async function handleDocumentClick() {
    try {
      elements.collectButton.disabled = true;
      elements.documentButton.disabled = true;
      await documentCollectedPosts();
    } finally {
      elements.collectButton.disabled = false;
      elements.documentButton.disabled = collectedPosts.length === 0;
    }
  }

  function getExportPosts() {
    return documentedPosts.length > 0 ? documentedPosts : collectedPosts;
  }

  elements.collectButton.addEventListener("click", handleCollectClick);
  elements.documentButton.addEventListener("click", handleDocumentClick);
  elements.downloadJsonButton.addEventListener("click", () => exporter.downloadJson(getExportPosts()));
  elements.downloadCsvButton.addEventListener("click", () => exporter.downloadCsv(getExportPosts()));
  elements.downloadMarkdownButton.addEventListener("click", () => exporter.downloadMarkdown(getExportPosts()));
  elements.downloadFilesButton.addEventListener("click", () => exporter.downloadMarkdownFiles(getExportPosts()));
})(globalThis);
