import { createEffect, type Effect, type Event } from "effector";

import { applyEffectConcurrency, type ConcurrencyStrategy } from "./apply_concurrency";
import { getCallObjectEvent, type CallObject } from "./with_call_object";

type EffectHandler<Params, Done> = [Params] extends [void]
  ? () => Done | Promise<Done>
  : (params: Params) => Done | Promise<Done>;

export type CreateConcurrentEffectConfig<Params, Done> = {
  handler: EffectHandler<Params, Done>;
  name?: string;
  sid?: string;
  strategy?: ConcurrencyStrategy;
  abortAll?: Event<unknown>;
};

export type ConcurrentEffect<FX extends Effect<any, any, any>> = FX & {
  callObjectCreated: Event<CallObject>;
};

/**
 * `createEffect` with Farfetched-style {@link onAbort}, {@link getCallObjectEvent},
 * and optional strategy / `abortAll`.
 *
 * @example
 * ```ts
 * const loadFx = createConcurrentEffect({
 *   name: 'load',
 *   strategy: 'TAKE_LATEST',
 *   handler: async (id: string) => {
 *     const ac = new AbortController();
 *     onAbort(() => ac.abort());
 *     return fetch(`/api/${id}`, { signal: ac.signal }).then((r) => r.json());
 *   },
 * });
 * ```
 */
export function createConcurrentEffect<Done>(
  config: CreateConcurrentEffectConfig<void, Done>,
): ConcurrentEffect<Effect<void, Done, unknown>>;
export function createConcurrentEffect<Params, Done>(
  config: CreateConcurrentEffectConfig<Params, Done>,
): ConcurrentEffect<Effect<Params, Done, unknown>>;
export function createConcurrentEffect<Params, Done>(
  config: CreateConcurrentEffectConfig<Params, Done>,
): ConcurrentEffect<Effect<Params, Done, unknown>> {
  const strategy = config.strategy ?? "TAKE_EVERY";

  const baseFx = createEffect<Params, Done, unknown>({
    name: config.name,
    sid: config.sid,
    handler: config.handler as (params: Params) => Done | Promise<Done>,
  });

  const callObjectCreated = getCallObjectEvent(baseFx);

  applyEffectConcurrency(baseFx, callObjectCreated, {
    strategy,
    abortAll: config.abortAll,
  });

  return Object.assign(baseFx, {
    callObjectCreated,
  }) as ConcurrentEffect<Effect<Params, Done, unknown>>;
}
