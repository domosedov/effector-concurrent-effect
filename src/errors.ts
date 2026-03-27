export const ABORT = 'ABORT' as const;

export type ConcurrentAbortError = {
  errorType: typeof ABORT;
  explanation: string;
};

export const CONFIGURATION = 'CONFIGURATION' as const;

export type ConcurrentConfigurationError = {
  errorType: typeof CONFIGURATION;
  explanation: string;
  reason: string;
  validationErrors: string[];
};

export function abortError(): ConcurrentAbortError {
  return {
    errorType: ABORT,
    explanation: 'Request was cancelled due to concurrency policy',
  };
}

export function configurationError(config: {
  reason: string;
  validationErrors: string[];
}): ConcurrentConfigurationError {
  return {
    ...config,
    errorType: CONFIGURATION,
    explanation: 'Operation is misconfigured',
  };
}
