export class CancellationError extends Error {
  override name = 'CancellationError';

  constructor(message = '操作已取消') {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

let cancellationReason: string | null = null;

export function requestCancellation(reason?: string): void {
  cancellationReason = reason || '操作已取消';
}

export function isCancellationRequested(): boolean {
  return cancellationReason !== null;
}

export function throwIfCancellationRequested(): void {
  if (cancellationReason) {
    throw new CancellationError(cancellationReason);
  }
}

export function isCancellationError(error: unknown): boolean {
  return (
    error instanceof CancellationError ||
    (error instanceof Error && error.name === 'CancellationError')
  );
}
