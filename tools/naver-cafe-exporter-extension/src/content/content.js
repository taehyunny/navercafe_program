(function attachContentBridge(global) {
  "use strict";

  const logger = global.NaverCafeExporterLogger;
  const extractor = global.NaverCafePostExtractor;

  function buildSuccessResponse(posts) {
    return {
      ok: true,
      frameUrl: document.location.href,
      posts
    };
  }

  function buildErrorResponse(error) {
    return {
      ok: false,
      frameUrl: document.location.href,
      message: error instanceof Error ? error.message : String(error)
    };
  }

  function collectCurrentFramePosts() {
    logger.logStep("콘텐츠 스크립트 수집 시작", {
      frameUrl: document.location.href
    });

    const posts = extractor.collectVisiblePosts(document);

    return buildSuccessResponse(posts);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "COLLECT_VISIBLE_POSTS") {
      return false;
    }

    try {
      sendResponse(collectCurrentFramePosts());
    } catch (error) {
      logger.logStep("콘텐츠 스크립트 수집 실패", {
        message: error instanceof Error ? error.message : String(error)
      });
      sendResponse(buildErrorResponse(error));
    }

    return true;
  });
})(globalThis);
