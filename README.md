# `@farfetched/effector-concurrent`

Concurrency helpers for plain [`createEffect`](https://effector.dev/en/api/effector/createeffect/).

It extracts the cancellation mechanics used in Farfetched operations into a standalone package:

- `createConcurrentEffect`
- `onAbort`
- `TAKE_EVERY`
- `TAKE_LATEST`
- `TAKE_FIRST`
- `abortAll`

## Install

```bash
pnpm add @farfetched/effector-concurrent effector
```

## Basic usage

```ts
import { createConcurrentEffect, onAbort } from '@farfetched/effector-concurrent';

const requestFx = createConcurrentEffect({
  strategy: 'TAKE_LATEST',
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

## `abortAll`

```ts
import { createEvent } from 'effector';
import { createConcurrentEffect } from '@farfetched/effector-concurrent';

const abortAll = createEvent();

const requestFx = createConcurrentEffect({
  abortAll,
  handler: async () => {
    // ...
  },
});
```

## Notes

- `onAbort` must be called synchronously inside the handler, before the first `await`
- `strategy` is the preferred option name
- `concurrency` is supported as a backwards-compatible alias for `strategy`
