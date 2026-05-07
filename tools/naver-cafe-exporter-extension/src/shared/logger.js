(function attachCafeExporterLogger(global) {
  "use strict";

  const LOGGER_NAME = "NaverCafeExporter";

  function createLogEntry(step, data) {
    return {
      time: new Date().toISOString(),
      step,
      data: data || {}
    };
  }

  function logStep(step, data) {
    const entry = createLogEntry(step, data);

    // 확장 프로그램 실행 단계가 DevTools Console에도 남도록 구성한다.
    console.log(`[${LOGGER_NAME}] ${step}`, entry.data);

    return entry;
  }

  global.NaverCafeExporterLogger = {
    logStep
  };
})(globalThis);
