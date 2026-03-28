# Changelog

All notable changes to this project will be documented in this file.

## 0.3.0

### Minor Changes

- Replace the old `configurationError` shape with `ConcurrentUsageError` and explicit usage reasons for invalid `onAbort` calls.
- Represent concurrency aborts as `ConcurrentAbortError` instances instead of plain objects.
- Make `createConcurrentEffect` fail typing honest by returning `Effect<Params, Done, unknown>`.

## 0.2.0

### Minor Changes

- Remove the legacy `concurrency` option from `createConcurrentEffect` and keep `strategy` as the only supported API.

## 0.1.1

### Patch Changes

- Finalize package metadata, build output, release scripts, and publish validation.

## 0.1.0 - 2026-03-27

- Initial release of `@domosedov/effector-concurrent-effect`.
- Added Effector concurrency helpers with Farfetched-style abort handling.
- Added build, test, lint, format, release, and package validation scripts.
