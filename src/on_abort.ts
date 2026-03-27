import { configurationError } from './errors';

type AbortContext = {
  callback: (() => void) | null;
  canSetCallback: boolean;
};

const abortContextStack: AbortContext[] = [];

export function allowCancelSetting() {
  abortContextStack.push({
    callback: null,
    canSetCallback: true,
  });
}

export function disallowCancelSetting() {
  abortContextStack.pop();
}

/**
 * Register a callback to run when the current effect call is aborted (via CallObject.abort or concurrency).
 * Must be called synchronously in the handler before the first `await`.
 */
export function onAbort(callback: () => void) {
  const currentContext = abortContextStack.at(-1);

  if (!currentContext?.canSetCallback) {
    throw configurationError({
      reason: 'onAbort call is not allowed',
      validationErrors: [
        'onAbort can be called only in the context of a handler before any async operation is performed',
      ],
    });
  }

  if (currentContext.callback) {
    throw configurationError({
      reason: 'onAbort call is not allowed',
      validationErrors: ['onAbort can be called only once per operation'],
    });
  }
  currentContext.callback = callback;
}

export function occupyCurrentCancelCallback() {
  const currentContext = abortContextStack.at(-1);
  if (!currentContext) {
    return null;
  }

  const toReturn = currentContext.callback;
  currentContext.callback = null;
  currentContext.canSetCallback = false;

  return toReturn;
}
