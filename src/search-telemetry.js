function getDurationMs(startTimeMs) {
  return Math.max(0, Date.now() - startTimeMs);
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function createSearchTelemetry({ route, query, condition, provider, site }) {
  const startTimeMs = Date.now();
  const baseMeta = {
    route,
    query,
    condition,
    provider,
    site
  };

  return {
    logSuccess(extra = {}) {
      const durationMs = getDurationMs(startTimeMs);
      console.info("search_latency", {
        event: "search_latency",
        outcome: "success",
        durationMs,
        ...baseMeta,
        ...extra
      });
      return durationMs;
    },
    logError(error, extra = {}) {
      const durationMs = getDurationMs(startTimeMs);
      console.error("search_error", {
        event: "search_error",
        outcome: "error",
        durationMs,
        error: normalizeError(error),
        ...baseMeta,
        ...extra
      });
      return durationMs;
    }
  };
}
