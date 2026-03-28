export const ABORT = 'ABORT' as const
export const USAGE = 'USAGE' as const
export const ON_ABORT_OUTSIDE_HANDLER = 'ON_ABORT_OUTSIDE_HANDLER' as const
export const ON_ABORT_ALREADY_REGISTERED = 'ON_ABORT_ALREADY_REGISTERED' as const

export type ConcurrentUsageErrorReason =
  | typeof ON_ABORT_OUTSIDE_HANDLER
  | typeof ON_ABORT_ALREADY_REGISTERED

export class ConcurrentAbortError extends Error {
  readonly code = ABORT

  constructor(message = 'Request was cancelled due to concurrency policy') {
    super(message)
    this.name = 'ConcurrentAbortError'
  }
}

export class ConcurrentUsageError extends Error {
  readonly code = USAGE
  readonly reason: ConcurrentUsageErrorReason

  constructor(reason: ConcurrentUsageErrorReason, message: string) {
    super(message)
    this.name = 'ConcurrentUsageError'
    this.reason = reason
  }
}

export function abortError(): ConcurrentAbortError {
  return new ConcurrentAbortError()
}

export function usageError(reason: ConcurrentUsageErrorReason): ConcurrentUsageError {
  switch (reason) {
    case ON_ABORT_OUTSIDE_HANDLER:
      return new ConcurrentUsageError(
        reason,
        'onAbort can be called only inside a handler before the first async boundary',
      )
    case ON_ABORT_ALREADY_REGISTERED:
      return new ConcurrentUsageError(reason, 'onAbort can be called only once per operation')
  }
}
