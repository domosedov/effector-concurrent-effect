import {
  type Effect,
  type Event,
  createEffect,
  createStore,
  sample,
  step,
  type Node,
} from "effector";

import { abortError } from "./errors";
import type { CallObject } from "./with_call_object";

const abortManyFx = createEffect((callObjects: CallObject[]) => {
  for (const callObject of callObjects) {
    callObject.abort();
  }
});

const effectCallObjects = new WeakMap<
  Effect<any, any, any>,
  ReturnType<typeof createStore<CallObject[]>>
>();
const takeFirstPatchedEffects = new WeakSet<Effect<any, any, any>>();

export type ConcurrencyStrategy = "TAKE_EVERY" | "TAKE_LATEST" | "TAKE_FIRST";

export function applyEffectConcurrency(
  effect: Effect<any, any, any>,
  callObjectCreated: Event<CallObject>,
  options: {
    strategy: ConcurrencyStrategy;
    abortAll?: Event<unknown>;
  },
) {
  if (options.strategy === "TAKE_FIRST") {
    patchTakeFirst(effect);
  }

  const needsStore = options.strategy === "TAKE_LATEST" || options.abortAll !== undefined;

  if (!needsStore) {
    return;
  }

  const $callObjects = getOrCreateCallObjectsStore(effect, callObjectCreated);

  if (options.strategy === "TAKE_LATEST") {
    sample({
      clock: callObjectCreated,
      source: $callObjects,
      fn: (callObjects, currentCallObject) =>
        callObjects.filter((obj) => obj !== currentCallObject),
      target: abortManyFx,
    });
  }

  if (options.abortAll) {
    sample({
      clock: options.abortAll,
      source: $callObjects,
      target: abortManyFx,
    });
  }
}

function getOrCreateCallObjectsStore(
  effect: Effect<any, any, any>,
  callObjectCreated: Event<CallObject>,
) {
  const existing = effectCallObjects.get(effect);
  if (existing) {
    return existing;
  }

  const $callObjects = createStore<CallObject[]>([], { serialize: "ignore" });

  sample({
    clock: callObjectCreated,
    source: $callObjects,
    fn: (callObjects, callObject) =>
      callObjects.filter((obj) => obj.status === "pending").concat(callObject),
    target: $callObjects,
  });

  sample({
    clock: abortManyFx.done,
    source: $callObjects,
    fn: (callObjects, { params: abortedCallObjects }) =>
      callObjects.filter((obj) => !abortedCallObjects.includes(obj)),
    target: $callObjects,
  });

  effectCallObjects.set(effect, $callObjects);
  return $callObjects;
}

function patchTakeFirst(effect: Effect<any, any, any>) {
  if (takeFirstPatchedEffects.has(effect)) {
    return;
  }

  const takeFirstStep = step.compute({
    fn: (run) => {
      const originalHandler = run.handler;

      run.handler = (...params: unknown[]) => {
        if (effect.inFlight.getState() > 1) {
          throw abortError();
        }

        return originalHandler(...params);
      };

      return run;
    },
  });

  getEffectRunnerNode(effect).seq.splice(1, 0, takeFirstStep);
  takeFirstPatchedEffects.add(effect);
}

function getEffectRunnerNode(effect: Effect<any, any, any>): Node {
  return (
    (effect as unknown as { graphite: Node }).graphite.scope as {
      runner: Node;
    }
  ).runner;
}
