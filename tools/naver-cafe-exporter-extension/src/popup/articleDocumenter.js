(function attachArticleDocumenter(global) {
  "use strict";

  const logger = global.NaverCafeExporterLogger;

  const STOP_WORDS = new Set([
    "그리고",
    "그래서",
    "하지만",
    "이번",
    "저는",
    "제가",
    "있는",
    "없는",
    "합니다",
    "했습니다",
    "것",
    "수",
    "등",
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from"
  ]);

  function splitSentences(text) {
    return (text || "")
      .split(/(?<=[.!?。！？]|다\.|요\.)\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
  }

  function createSummary(bodyText) {
    const sentences = splitSentences(bodyText);
    const summary = sentences.slice(0, 3).join(" ");

    // Keep summaries readable in exported files while preserving the original body separately.
    return summary.length > 500 ? `${summary.slice(0, 497)}...` : summary;
  }

  function extractWords(text) {
    const matches = (text || "").match(/[A-Za-z0-9가-힣]{2,}/g) || [];

    return matches
      .map((word) => word.toLowerCase())
      .filter((word) => !STOP_WORDS.has(word));
  }

  function extractKeyConcepts(title, bodyText) {
    const counts = new Map();

    extractWords(`${title} ${bodyText}`).forEach((word) => {
      counts.set(word, (counts.get(word) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 8)
      .map(([word]) => word);
  }

  function inferTopic(title, keyConcepts) {
    if (keyConcepts.length === 0) {
      return title || "Unclassified";
    }

    return keyConcepts.slice(0, 3).join(" / ");
  }

  function createQuestionsToVerify(documentedPost) {
    const questions = [
      "본문 추출 길이가 실제 게시글 본문과 충분히 일치하는가?",
      "요약이 첫 문장 중심으로 치우쳐 핵심 결론을 놓치지 않았는가?",
      "핵심 개념이 단순 반복 단어가 아니라 글의 주제를 설명하는가?"
    ];

    if (!documentedPost.category) {
      questions.push("카테고리를 페이지에서 찾지 못했는데 수동 분류가 필요한가?");
    }

    return questions;
  }

  function documentArticle(postWithBody) {
    const keyConcepts = extractKeyConcepts(postWithBody.title, postWithBody.bodyText);
    const documentedPost = {
      title: postWithBody.title,
      url: postWithBody.url,
      articleId: postWithBody.articleId,
      clubId: postWithBody.clubId,
      category: postWithBody.category || "",
      topic: inferTopic(postWithBody.title, keyConcepts),
      summary: createSummary(postWithBody.bodyText),
      keyConcepts,
      questionsToVerify: []
    };

    documentedPost.questionsToVerify = createQuestionsToVerify(documentedPost);

    logger.logStep("Document article", {
      articleId: documentedPost.articleId,
      keyConceptCount: documentedPost.keyConcepts.length,
      hasSummary: Boolean(documentedPost.summary)
    });

    return documentedPost;
  }

  global.NaverCafeArticleDocumenter = {
    createSummary,
    documentArticle,
    extractKeyConcepts,
    splitSentences
  };
})(globalThis);
