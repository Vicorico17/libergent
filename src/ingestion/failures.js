export const INGESTION_ACTIONS = {
  retry: "retry",
  deadLetter: "dead-letter",
  ignore: "ignore"
};

export class IngestionFailure extends Error {
  constructor(message, {
    code = "INGESTION_FAILURE",
    action = INGESTION_ACTIONS.deadLetter,
    retriable = false,
    backoffMs = null,
    details = null
  } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.action = action;
    this.retriable = retriable;
    this.backoffMs = backoffMs;
    this.details = details;
  }
}

export class RetriableIngestionError extends IngestionFailure {
  constructor(message, options = {}) {
    super(message, {
      code: "RETRIABLE_ERROR",
      action: INGESTION_ACTIONS.retry,
      retriable: true,
      backoffMs: 1_000,
      ...options
    });
  }
}

export class RateLimitedIngestionError extends IngestionFailure {
  constructor(message, options = {}) {
    super(message, {
      code: "RATE_LIMITED",
      action: INGESTION_ACTIONS.retry,
      retriable: true,
      backoffMs: 5_000,
      ...options
    });
  }
}

export class NonRetriableIngestionError extends IngestionFailure {
  constructor(message, details = null, options = {}) {
    super(message, {
      code: "NON_RETRIABLE",
      action: INGESTION_ACTIONS.deadLetter,
      retriable: false,
      details,
      ...options
    });
  }
}

export class IgnoreRecordIngestionError extends IngestionFailure {
  constructor(message, options = {}) {
    super(message, {
      code: "IGNORE_RECORD",
      action: INGESTION_ACTIONS.ignore,
      retriable: false,
      ...options
    });
  }
}

export function mapFailureToAction(error) {
  if (error instanceof IngestionFailure) {
    return {
      action: error.action,
      retriable: error.retriable,
      backoffMs: error.backoffMs
    };
  }

  return {
    action: INGESTION_ACTIONS.retry,
    retriable: true,
    backoffMs: 1_000
  };
}

export function isNonRetriableError(error) {
  return mapFailureToAction(error).action === INGESTION_ACTIONS.deadLetter;
}
