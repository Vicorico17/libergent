export const SOURCE_FAILURE_CODE = Object.freeze({
  ADAPTER_NOT_SUPPORTED: "adapter_not_supported",
  RATE_LIMITED: "rate_limited",
  TIMEOUT: "timeout",
  UPSTREAM_UNAVAILABLE: "upstream_unavailable",
  BAD_SOURCE_RESPONSE: "bad_source_response",
  NETWORK: "network",
  UNKNOWN: "unknown"
});

export class SourceAdapterError extends Error {
  constructor(message, { code = SOURCE_FAILURE_CODE.UNKNOWN, retryable = false, details = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "SourceAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

function inferStatusCode(message = "") {
  const matched = String(message).match(/\((\d{3})\)/);
  if (!matched) {
    return null;
  }

  const status = Number.parseInt(matched[1], 10);
  return Number.isFinite(status) ? status : null;
}

function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function classifySourceAdapterFailure(error, context = {}) {
  if (error instanceof SourceAdapterError) {
    return {
      code: error.code,
      retryable: error.retryable,
      message: error.message,
      details: error.details,
      context
    };
  }

  const message = toMessage(error);
  const lowered = message.toLowerCase();
  const status = inferStatusCode(message);

  if (error?.name === "AbortError" || lowered.includes("timed out") || lowered.includes("timeout") || lowered.includes("depășit")) {
    return {
      code: SOURCE_FAILURE_CODE.TIMEOUT,
      retryable: true,
      message,
      details: status ? { status } : null,
      context
    };
  }

  if (lowered.includes("no direct html parser configured")) {
    return {
      code: SOURCE_FAILURE_CODE.ADAPTER_NOT_SUPPORTED,
      retryable: false,
      message,
      details: null,
      context
    };
  }

  if (status === 429) {
    return {
      code: SOURCE_FAILURE_CODE.RATE_LIMITED,
      retryable: true,
      message,
      details: { status },
      context
    };
  }

  if (status && status >= 500) {
    return {
      code: SOURCE_FAILURE_CODE.UPSTREAM_UNAVAILABLE,
      retryable: true,
      message,
      details: { status },
      context
    };
  }

  if (status && status >= 400) {
    return {
      code: SOURCE_FAILURE_CODE.BAD_SOURCE_RESPONSE,
      retryable: false,
      message,
      details: { status },
      context
    };
  }

  if (lowered.includes("fetch") || lowered.includes("network") || lowered.includes("socket")) {
    return {
      code: SOURCE_FAILURE_CODE.NETWORK,
      retryable: true,
      message,
      details: null,
      context
    };
  }

  return {
    code: SOURCE_FAILURE_CODE.UNKNOWN,
    retryable: false,
    message,
    details: null,
    context
  };
}
