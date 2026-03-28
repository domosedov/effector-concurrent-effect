import { allSettled, createEffect, createEvent, createWatch, fork, scopeBind } from 'effector'
import { describe, expect, test, vi } from 'vite-plus/test'
import { setTimeout as delay } from 'timers/promises'

import { applyEffectConcurrency } from './apply_concurrency'
import { createConcurrentEffect } from './create_concurrent_effect'
import { createDefer } from './defer'
import {
  ABORT,
  USAGE,
  ConcurrentUsageError,
  ON_ABORT_ALREADY_REGISTERED,
  ON_ABORT_OUTSIDE_HANDLER,
} from './errors'
import { onAbort } from './on_abort'
import { getCallObjectEvent } from './with_call_object'

describe('createConcurrentEffect', () => {
  test('abortAll aborts all pending calls', async () => {
    const abortAll = createEvent()

    const fx = createConcurrentEffect({
      name: 'hang',
      abortAll,
      handler: async () => {
        const defer = createDefer<string>()
        onAbort(() => defer.reject())
        return defer.promise
      },
    })

    const failures = vi.fn()
    const scope = fork()

    createWatch({ unit: fx.failData, fn: failures, scope })

    void allSettled(fx, { scope, params: undefined })
    void allSettled(fx, { scope, params: undefined })
    await allSettled(abortAll, { scope })

    expect(failures).toHaveBeenCalledTimes(2)
  })

  test('TAKE_LATEST aborts previous pending call', async () => {
    const fx = createConcurrentEffect({
      name: 'latest',
      strategy: 'TAKE_LATEST',
      handler: async (id: string) => {
        const defer = createDefer<string>()
        onAbort(() => defer.reject())
        await delay(1)
        defer.resolve(id)
        return defer.promise
      },
    })

    const failures = vi.fn()
    const scope = fork()

    createWatch({ unit: fx.failData, fn: failures, scope })

    await Promise.all([
      allSettled(fx, { scope, params: '1' }),
      allSettled(fx, { scope, params: '2' }),
    ])

    expect(failures).toHaveBeenCalledTimes(1)
    expect(failures.mock.calls[0]?.[0]).toMatchObject({ code: ABORT })
  })

  test('TAKE_FIRST rejects second start while first is in flight', async () => {
    const fx = createConcurrentEffect({
      name: 'first',
      strategy: 'TAKE_FIRST',
      handler: async (id: string) => {
        await delay(5)
        return id
      },
    })

    const failures = vi.fn()
    const scope = fork()

    createWatch({ unit: fx.failData, fn: failures, scope })

    const a = allSettled(fx, { scope, params: '1' })
    await allSettled(fx, { scope, params: '2' })

    expect(failures).toHaveBeenCalledTimes(1)
    expect(failures.mock.calls[0]?.[0]).toMatchObject({ code: ABORT })

    await a
  })

  test('TAKE_FIRST lock is isolated per scope', async () => {
    const defers: Array<{ resolve: (value: string) => void }> = []
    const fx = createConcurrentEffect({
      name: 'first-per-scope',
      strategy: 'TAKE_FIRST',
      handler: async (id: string) => {
        const defer = createDefer<string>()
        defers.push(defer)
        return defer.promise.then(() => id)
      },
    })

    const scopeA = fork()
    const scopeB = fork()
    const failuresA = vi.fn()
    const failuresB = vi.fn()

    createWatch({ unit: fx.failData, fn: failuresA, scope: scopeA })
    createWatch({ unit: fx.failData, fn: failuresB, scope: scopeB })

    const callA = scopeBind(fx, { scope: scopeA })('A')
    const callB = scopeBind(fx, { scope: scopeB })('B')

    await Promise.resolve()

    expect(defers).toHaveLength(2)
    expect(failuresA).not.toHaveBeenCalled()
    expect(failuresB).not.toHaveBeenCalled()

    defers[0]!.resolve('done')
    defers[1]!.resolve('done')

    await expect(callA).resolves.toBe('A')
    await expect(callB).resolves.toBe('B')
  })

  test('TAKE_FIRST preserves params for fx.use', async () => {
    const fx = createConcurrentEffect({
      strategy: 'TAKE_FIRST',
      handler: async (value: string) => value,
    })

    fx.use(async (value) => value)

    await expect(fx('payload')).resolves.toBe('payload')
  })

  test('TAKE_FIRST preserves params for fork handlers', async () => {
    const fx = createConcurrentEffect({
      strategy: 'TAKE_FIRST',
      handler: async (value: string) => value,
    })

    const scope = fork({
      handlers: [[fx, async (value: string) => value]],
    })

    await expect(allSettled(fx, { scope, params: 'payload' })).resolves.toEqual({
      status: 'done',
      value: 'payload',
    })
  })

  test('onAbort runs when callObject.abort()', async () => {
    const onAbortFn = vi.fn()

    const fx = createConcurrentEffect({
      name: 'co',
      handler: async () => {
        const defer = createDefer()
        onAbort(() => {
          onAbortFn()
          defer.reject()
        })
        return defer.promise
      },
    })

    const scope = fork()
    const calls: { abort: () => void }[] = []

    createWatch({
      unit: fx.callObjectCreated,
      fn: (co) => {
        if (co.status === 'pending') calls.push(co)
      },
      scope,
    })

    const run = allSettled(fx, { scope, params: undefined })
    await new Promise<void>((r) => globalThis.setTimeout(r, 0))
    expect(calls).toHaveLength(1)
    calls[0]!.abort()
    await run

    expect(onAbortFn).toHaveBeenCalledTimes(1)
  })

  test('nested concurrent effect does not steal outer onAbort callback', async () => {
    const outerAbort = vi.fn()

    const innerFx = createConcurrentEffect({
      handler: async () => 'inner',
    })

    const outerFx = createConcurrentEffect({
      handler: async () => {
        const defer = createDefer<string>()
        onAbort(() => {
          outerAbort()
          defer.reject()
        })

        await innerFx()

        return defer.promise
      },
    })

    const calls: Array<{ abort: () => void }> = []
    outerFx.callObjectCreated.watch((call) => {
      if (call.status === 'pending') {
        calls.push(call)
      }
    })

    const run = outerFx().catch(() => undefined)
    await Promise.resolve()
    calls[0]!.abort()
    await run

    expect(outerAbort).toHaveBeenCalledTimes(1)
  })

  test('sync throw does not leak onAbort state', async () => {
    const syncThrowFx = createConcurrentEffect({
      handler: () => {
        onAbort(() => undefined)
        throw new Error('boom')
      },
    })

    await expect(syncThrowFx()).rejects.toThrow('boom')
    expect(() => onAbort(() => undefined)).toThrowError(
      new ConcurrentUsageError(
        ON_ABORT_OUTSIDE_HANDLER,
        'onAbort can be called only inside a handler before the first async boundary',
      ),
    )
  })

  test('onAbort throws a usage error when called twice', async () => {
    const fx = createConcurrentEffect({
      handler: async () => {
        onAbort(() => undefined)
        onAbort(() => undefined)
      },
    })

    await expect(fx()).rejects.toMatchObject({
      code: USAGE,
      reason: ON_ABORT_ALREADY_REGISTERED,
    })
  })

  test('onAbort throws a usage error when called after an async boundary', async () => {
    const fx = createConcurrentEffect({
      handler: async () => {
        await Promise.resolve()
        onAbort(() => undefined)
      },
    })

    await expect(fx()).rejects.toMatchObject({
      code: USAGE,
      reason: ON_ABORT_OUTSIDE_HANDLER,
    })
  })

  test('applyEffectConcurrency supports TAKE_FIRST for plain effects', async () => {
    const fx = createEffect(async (value: string) => {
      await delay(5)
      return value
    })

    applyEffectConcurrency(fx, getCallObjectEvent(fx), {
      strategy: 'TAKE_FIRST',
    })

    const failures = vi.fn()
    fx.failData.watch(failures)

    const first = fx('1')
    await fx('2').catch(() => undefined)

    expect(failures).toHaveBeenCalledTimes(1)
    expect(failures.mock.calls[0]?.[0]).toMatchObject({ code: ABORT })

    await first
  })
})
