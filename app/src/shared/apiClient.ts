import type { DraftRequest, DraftResponse } from './types';
import { DraftResponseSchema } from './draftSchemas';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = 'request_failed',
    readonly canPasteSource = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function postJson(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.any([
        AbortSignal.timeout(100_000),
        ...(signal ? [signal] : []),
      ]),
    });
    payload = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof Error && error.name === 'TimeoutError')
      throw new ApiError(
        'Drafting took too long. Please try again.',
        504,
        'request_timeout',
      );
    if (error instanceof SyntaxError)
      throw new ApiError(
        'The server returned an unreadable response. Refresh the page and try again.',
        502,
        'invalid_response',
      );
    throw new ApiError(
      'Could not reach the app server. Check that it is running and try again.',
      0,
      'network_error',
    );
  }
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status}).`;
    const details =
      typeof payload === 'object' && payload !== null ? payload : {};
    throw new ApiError(
      message,
      response.status,
      'code' in details && typeof details.code === 'string'
        ? details.code
        : 'request_failed',
      'canPasteSource' in details && details.canPasteSource === true,
    );
  }
  return payload;
}

export async function draftPromise(
  request: DraftRequest,
  signal?: AbortSignal,
): Promise<DraftResponse> {
  const payload = await postJson('/api/draft', request, signal);
  const result = DraftResponseSchema.safeParse(payload);
  if (!result.success)
    throw new ApiError(
      'The server returned an invalid draft. Please try again.',
      502,
      'invalid_response',
    );
  return result.data;
}
