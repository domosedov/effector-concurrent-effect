# `@domosedov/effector-concurrent-effect`

Concurrency helpers for plain [`createEffect`](https://effector.dev/en/api/effector/createeffect/) with Farfetched-style cancellation semantics.

The package extracts the core mechanics behind `concurrency` and `onAbort` into a standalone library for Effector:

- `createConcurrentEffect`
- `applyEffectConcurrency`
- `getCallObjectEvent`
- `onAbort`
- `abortError`
- `configurationError`

## Install

```bash
npm install @domosedov/effector-concurrent-effect effector
```

`effector` is a peer dependency.

## Basic usage

```ts
import { createConcurrentEffect, onAbort } from "@domosedov/effector-concurrent-effect";

const requestFx = createConcurrentEffect({
  strategy: "TAKE_LATEST",
  handler: async (url: string) => {
    const abortController = new AbortController();

    onAbort(() => {
      abortController.abort();
    });

    const response = await fetch(url, {
      signal: abortController.signal,
    });

    return response.text();
  },
});
```

## Strategies

- `TAKE_EVERY`: allow all calls to run.
- `TAKE_LATEST`: abort all previous pending calls when a new one starts.
- `TAKE_FIRST`: reject every next call while one is already in flight.

## `abortAll`

```ts
import { createEvent } from "effector";
import { createConcurrentEffect } from "@domosedov/effector-concurrent-effect";

const abortAll = createEvent();

const requestFx = createConcurrentEffect({
  abortAll,
  handler: async () => {
    // ...
  },
});
```

## `onAbort`

`onAbort` must be called synchronously inside the handler before the first `await`. The callback is invoked when the current call is aborted either manually through the call object or automatically by a concurrency strategy.

## Development

```bash
vp install
vp check
vp test run
vp pack
```

## Versioning and release

This package uses [Changesets](https://github.com/changesets/changesets).

```bash
vp exec changeset
vp run version
vp run release
```
