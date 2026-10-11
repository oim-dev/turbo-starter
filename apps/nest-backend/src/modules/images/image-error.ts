export class ImageProcessingError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

export function processingError(error: unknown): ImageProcessingError {
  return error instanceof ImageProcessingError
    ? error
    : new ImageProcessingError(
        'PROCESSING_UNAVAILABLE',
        'Обработка временно недоступна. Попробуйте повторить позже.',
        true,
      );
}
