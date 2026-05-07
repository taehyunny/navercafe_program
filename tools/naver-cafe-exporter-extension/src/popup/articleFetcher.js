(function attachArticleFetcher(global) {
  "use strict";

  const logger = global.NaverCafeExporterLogger;

  const CONTENT_SELECTORS = [
    ".se-main-container",
    "#tbody",
    ".ContentRenderer",
    ".article_viewer",
    ".ArticleContentBox",
    ".content"
  ];

  const CATEGORY_SELECTORS = [
    ".link_board",
    ".board_name",
    ".ArticleBoard",
    ".cafe-menu-name",
    "[class*='category']"
  ];

  const TEXT_KEYS = new Set([
    "text",
    "plainText",
    "plaintext",
    "content",
    "contents",
    "description",
    "caption",
    "value"
  ]);

  const IGNORED_STRING_KEYS = new Set([
    "url",
    "src",
    "href",
    "domain",
    "type",
    "id",
    "articleId",
    "clubId",
    "imageUrl",
    "thumbnailUrl",
    "originalUrl"
  ]);

  function normalizeWhitespace(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function parseHtml(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  function createExtractionError(message, diagnostics) {
    const error = new Error(message);

    error.diagnostics = diagnostics || {};
    return error;
  }

  function findFirstText(rootDocument, selectors) {
    for (const selector of selectors) {
      const element = rootDocument.querySelector(selector);

      if (element) {
        const text = normalizeWhitespace(element.innerText || element.textContent);

        if (text) {
          return text;
        }
      }
    }

    return "";
  }

  function findArticleFrameUrl(rootDocument, baseUrl) {
    const frame = rootDocument.querySelector("iframe#cafe_main, iframe[name='cafe_main']");

    if (!frame) {
      return "";
    }

    const source = frame.getAttribute("src");
    return source ? new URL(source, baseUrl).href : "";
  }

  function extractBodyText(rootDocument) {
    for (const selector of CONTENT_SELECTORS) {
      const element = rootDocument.querySelector(selector);

      if (element) {
        const text = normalizeWhitespace(element.innerText || element.textContent);

        if (text.length > 20) {
          return text;
        }
      }
    }

    return "";
  }

  function buildArticleApiUrls(post) {
    const query = "fromList=true&useCafeId=true&requestFrom=A";

    return [
      `https://apis.naver.com/cafe-web/cafe-articleapi/cafes/${post.clubId}/articles/${post.articleId}?${query}`,
      `https://apis.naver.com/cafe-web/cafe-articleapi/v2/cafes/${post.clubId}/articles/${post.articleId}?${query}`,
      `https://apis.naver.com/cafe-web/cafe-articleapi/v3/cafes/${post.clubId}/articles/${post.articleId}?${query}`,
      `https://apis.naver.com/cafe-web/cafe-articleapi/v4/cafes/${post.clubId}/articles/${post.articleId}?${query}`
    ];
  }

  function stripHtml(text) {
    if (!/<[a-z][\s\S]*>/i.test(text)) {
      return text;
    }

    const document = parseHtml(text);

    return document.body ? document.body.textContent : text.replace(/<[^>]+>/g, " ");
  }

  function parseJsonString(text) {
    const trimmed = text.trim();

    if (!trimmed || !/^[{[]/.test(trimmed)) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return null;
    }
  }

  function shouldKeepText(key, text) {
    if (!text || text.length < 2) {
      return false;
    }

    if (key && IGNORED_STRING_KEYS.has(key)) {
      return false;
    }

    if (/^https?:\/\//i.test(text)) {
      return false;
    }

    if (/^[A-Z_]+$/.test(text)) {
      return false;
    }

    return true;
  }

  function collectTextValues(value, texts, diagnostics, key) {
    if (typeof value === "string") {
      const parsedValue = parseJsonString(value);

      if (parsedValue) {
        diagnostics.jsonStringCount += 1;
        collectTextValues(parsedValue, texts, diagnostics, key);
        return;
      }

      const text = normalizeWhitespace(stripHtml(value));

      if (shouldKeepText(key, text)) {
        diagnostics.rawTextCount += 1;
        texts.push(text);
      }

      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    Object.entries(value).forEach(([key, nestedValue]) => {
      if (TEXT_KEYS.has(key)) {
        collectTextValues(nestedValue, texts, diagnostics, key);
        return;
      }

      if (!IGNORED_STRING_KEYS.has(key)) {
        collectTextValues(nestedValue, texts, diagnostics, key);
      }
    });
  }

  function findArticlePayload(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    if (Array.isArray(value.contentElements)) {
      return value;
    }

    for (const nestedValue of Object.values(value)) {
      const found = findArticlePayload(nestedValue);

      if (found) {
        return found;
      }
    }

    return null;
  }

  function extractApiBody(article) {
    const payload = findArticlePayload(article) || article;
    const elements = payload.contentElements || [];
    const diagnostics = {
      contentElementCount: elements.length,
      jsonStringCount: 0,
      rawTextCount: 0
    };
    const texts = [];

    elements.forEach((element) => {
      collectTextValues(element.json || element, texts, diagnostics, "");
    });

    return {
      bodyText: normalizeWhitespace(texts.join(" ")),
      diagnostics
    };
  }

  function extractApiBodyText(article) {
    return extractApiBody(article).bodyText;
  }

  function extractApiCategory(article) {
    const candidates = [
      article.menuName,
      article.menu?.name,
      article.boardName,
      article.article?.menuName,
      article.article?.menu?.name
    ];

    return normalizeWhitespace(candidates.find(Boolean) || "");
  }

  async function fetchArticleApi(post) {
    const urls = buildArticleApiUrls(post);
    const diagnostics = {
      apiStatuses: [],
      contentElementCount: 0,
      jsonStringCount: 0,
      rawTextCount: 0
    };

    for (const url of urls) {
      logger.logStep("Fetch article API", {
        articleId: post.articleId,
        url
      });

      const response = await fetch(url, {
        credentials: "include",
        headers: {
          accept: "application/json, text/plain, */*"
        }
      });

      if (!response.ok) {
        diagnostics.apiStatuses.push(response.status);
        logger.logStep("Article API failed", {
          articleId: post.articleId,
          status: response.status
        });
        continue;
      }

      let data;

      try {
        data = await response.json();
      } catch (error) {
        logger.logStep("Article API JSON parse failed", {
          articleId: post.articleId,
          message: error instanceof Error ? error.message : String(error)
        });
        continue;
      }

      const article = data.article || data.message?.result?.article || data.result?.article || data;
      const extracted = extractApiBody(article);
      const bodyText = extracted.bodyText;

      diagnostics.apiStatuses.push(response.status);
      diagnostics.contentElementCount = extracted.diagnostics.contentElementCount;
      diagnostics.jsonStringCount = extracted.diagnostics.jsonStringCount;
      diagnostics.rawTextCount = extracted.diagnostics.rawTextCount;

      logger.logStep("Extract article API body", {
        articleId: post.articleId,
        bodyLength: bodyText.length,
        ...extracted.diagnostics
      });

      if (bodyText) {
        return {
          result: {
            ...post,
            category: extractApiCategory(article),
            bodyText
          },
          diagnostics
        };
      }
    }

    return {
      result: null,
      diagnostics
    };
  }

  async function fetchDocument(url) {
    logger.logStep("Fetch article document", { url });

    const response = await fetch(url, {
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`Article request failed: ${response.status}`);
    }

    return parseHtml(await response.text());
  }

  async function fetchArticleBody(post) {
    const apiResponse = await fetchArticleApi(post);

    if (apiResponse.result) {
      return apiResponse.result;
    }

    const firstDocument = await fetchDocument(post.url);
    const frameUrl = findArticleFrameUrl(firstDocument, post.url);
    const articleDocument = frameUrl ? await fetchDocument(frameUrl) : firstDocument;
    const bodyText = extractBodyText(articleDocument);
    const category = findFirstText(articleDocument, CATEGORY_SELECTORS);

    logger.logStep("Extract article body", {
      articleId: post.articleId,
      title: post.title,
      bodyLength: bodyText.length,
      hasFrame: Boolean(frameUrl)
    });

    if (!bodyText) {
      throw createExtractionError("Article body was not found with API or current selectors.", {
        ...apiResponse.diagnostics,
        htmlBodyLength: bodyText.length,
        hasFrame: Boolean(frameUrl)
      });
    }

    return {
      ...post,
      category,
      bodyText
    };
  }

  global.NaverCafeArticleFetcher = {
    buildArticleApiUrls,
    extractBodyText,
    extractApiBody,
    extractApiBodyText,
    fetchArticleBody,
    findArticleFrameUrl,
    normalizeWhitespace
  };
})(globalThis);
