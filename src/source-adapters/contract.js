import { SourceAdapterError, SOURCE_FAILURE_CODE } from "./failures.js";

function assertAdapterId(adapterId) {
  if (typeof adapterId !== "string" || !adapterId.trim()) {
    throw new TypeError("source adapter requires a non-empty adapterId");
  }
}

function assertExecute(execute) {
  if (typeof execute !== "function") {
    throw new TypeError("source adapter requires an execute(context) function");
  }
}

export function createSourceAdapter({ adapterId, execute, supports }) {
  assertAdapterId(adapterId);
  assertExecute(execute);

  return Object.freeze({
    adapterId,
    supports: typeof supports === "function" ? supports : () => true,
    async execute(context) {
      if (!this.supports(context)) {
        throw new SourceAdapterError(`Source adapter ${adapterId} does not support this context.`, {
          code: SOURCE_FAILURE_CODE.ADAPTER_NOT_SUPPORTED,
          retryable: false,
          details: {
            site: context?.site?.key || null,
            strategy: context?.site?.strategy || null,
            provider: context?.provider || null
          }
        });
      }

      return execute(context);
    }
  });
}
