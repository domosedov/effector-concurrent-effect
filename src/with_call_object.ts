import {
  step,
  createEvent,
  type Effect,
  type Node,
  type Event,
  type EventCallable,
} from 'effector';

import { type Defer, createDefer } from './defer';
import { abortError } from './errors';
import {
  occupyCurrentCancelCallback,
  allowCancelSetting,
  disallowCancelSetting,
} from './on_abort';

export type CallObject = {
  id: string;
  /**
   * Rejects the outer promise and runs the `onAbort` callback if any.
   * @param customError — defaults to concurrency-style abort error
   */
  abort: (customError?: unknown) => void;
  status: 'pending' | 'finished';
  promise?: Promise<unknown>;
};

/**
 * Patches the effect runner so each async invocation emits a {@link CallObject} with `abort`.
 * Enables {@link onAbort} inside the handler during the synchronous prelude.
 */
export function getCallObjectEvent<E extends Effect<any, any, any>>(
  effect: E
): Event<CallObject> {
  const existing = patchedEffects.get(effect);
  if (existing) {
    return existing;
  }

  const called = createEvent<CallObject>(effect.shortName + '.internalCall');

  const callObjStep = step.compute({
    fn: (run) => {
      const originalHandler = run.handler;

      run.handler = createPatchedHandler(originalHandler, called);

      return run;
    },
  });

  const runner = getEffectRunnerNode(effect);

  /**
   * @see https://github.com/effector/effector/blob/a0f997b3d355c5a9b682e3747f00a1ffe7de8646/src/effector/__tests__/effect/index.test.ts#L432
   */
  runner.seq.splice(1, 0, callObjStep);
  patchedEffects.set(effect, called);

  return called;
}

function createPatchedHandler(
  h: (...p: unknown[]) => unknown,
  calledEvent: EventCallable<CallObject>
) {
  return function patchedHandler(...p: unknown[]): unknown {
    const { result, abortCallback } = runWithExposedAbort(h, ...p);

    if (result instanceof Promise) {
      const def = createDefer();
      const callObj = createCallObject(def, abortCallback);
      calledEvent(callObj);
      result.then(def.resolve, def.reject);

      return def.promise;
    }

    const callObj = createCallObject(undefined, abortCallback);
    calledEvent(callObj);

    return result;
  };
}

function createCallObject(
  def?: Defer<unknown, unknown>,
  onAbortCb?: (() => void) | null
) {
  let callStatus: CallObject['status'] = def ? 'pending' : 'finished';

  function finish() {
    callStatus = 'finished';
    callObj.status = callStatus;
  }

  if (def) {
    def.promise.then(finish, finish);
  }

  const callObj: CallObject = {
    id: getCallId(),
    status: callStatus,
    abort: (error: unknown = abortError()) => {
      onAbortCb?.();
      if (callStatus === 'finished') {
        return;
      }

      if (def) {
        def.reject(error);
      }
    },
    promise: def?.promise,
  };

  return callObj;
}

function getEffectRunnerNode(effect: Effect<any, any, any>): Node {
  const runner = (
    (effect as unknown as { graphite: Node }).graphite.scope as { runner: Node }
  ).runner;
  return runner;
}

let n = 0;
function getCallId(): string {
  return `${n++}`;
}

function runWithExposedAbort(
  h: (...args: unknown[]) => unknown,
  ...p: unknown[]
): {
  result: unknown;
  abortCallback: (() => void) | null;
} {
  flushQueue();

  allowCancelSetting();
  try {
    const result = h(...p);
    const abortCallback = occupyCurrentCancelCallback();

    return {
      result,
      abortCallback,
    };
  } finally {
    disallowCancelSetting();
  }
}

const flushQueue = createEvent();

const patchedEffects = new WeakMap<
  Effect<any, any, any>,
  Event<CallObject>
>();
