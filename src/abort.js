export function buildAbortSignal({ timeoutMs, signal } = {}) {
  const signals = [];

  if (signal) {
    signals.push(signal);
  }

  if (Number.isFinite(timeoutMs) && timeoutMs > 0 && typeof AbortSignal.timeout === "function") {
    signals.push(AbortSignal.timeout(timeoutMs));
  }

  if (!signals.length) {
    return undefined;
  }

  if (signals.length === 1) {
    return signals[0];
  }

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }

  const controller = new AbortController();
  const abort = (event) => {
    if (!controller.signal.aborted) {
      controller.abort(event?.target?.reason);
    }
  };

  for (const entry of signals) {
    if (entry.aborted) {
      controller.abort(entry.reason);
      break;
    }
    entry.addEventListener("abort", abort, { once: true });
  }

  return controller.signal;
}
