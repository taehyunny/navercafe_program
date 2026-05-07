(function attachPostExtractor(global) {
  "use strict";

  const logger = global.NaverCafeExporterLogger;

  function toAbsoluteUrl(href, baseUrl) {
    if (!href) {
      return "";
    }

    return new URL(href, baseUrl).href;
  }

  function parseArticleUrl(urlText) {
    const url = new URL(urlText);

    return {
      articleId: url.searchParams.get("articleid") || "",
      clubId: url.searchParams.get("clubid") || ""
    };
  }

  function normalizeTitle(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function detectVisiblePostElements(rootDocument) {
    const elements = Array.from(rootDocument.querySelectorAll("a.article"));

    logger.logStep("게시글 링크 요소 탐지", {
      count: elements.length,
      frameUrl: rootDocument.location.href
    });

    return elements;
  }

  function extractPostSummary(element, baseUrl) {
    const absoluteUrl = toAbsoluteUrl(element.getAttribute("href"), baseUrl);
    const parsedUrl = parseArticleUrl(absoluteUrl);

    // 목록 화면에서 안정적으로 확인 가능한 값만 먼저 추출한다.
    return {
      title: normalizeTitle(element.innerText || element.textContent),
      url: absoluteUrl,
      articleId: parsedUrl.articleId,
      clubId: parsedUrl.clubId
    };
  }

  function removeDuplicatePosts(posts) {
    const seenArticleIds = new Set();

    return posts.filter((post) => {
      const key = post.articleId || post.url;

      if (seenArticleIds.has(key)) {
        return false;
      }

      seenArticleIds.add(key);
      return true;
    });
  }

  function collectVisiblePosts(rootDocument) {
    const elements = detectVisiblePostElements(rootDocument);
    const posts = elements.map((element) => extractPostSummary(element, rootDocument.location.href));
    const uniquePosts = removeDuplicatePosts(posts);

    logger.logStep("현재 프레임 게시글 수집 완료", {
      rawCount: posts.length,
      uniqueCount: uniquePosts.length,
      frameUrl: rootDocument.location.href
    });

    return uniquePosts;
  }

  global.NaverCafePostExtractor = {
    collectVisiblePosts,
    detectVisiblePostElements,
    extractPostSummary,
    normalizeTitle,
    removeDuplicatePosts
  };
})(globalThis);
