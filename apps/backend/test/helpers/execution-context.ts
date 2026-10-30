import type { ExecutionContext } from '@nestjs/common';

export interface FakeRequest {
  headers: Record<string, string | undefined>;
  user?: unknown;
  body?: unknown;
  ip?: string;
}

/** A minimal HTTP ExecutionContext around a handler/class pair, as guards see it. */
export function httpContext(
  request: FakeRequest,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  handler: Function = () => undefined,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  cls: Function = class {}
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    getType: () => 'http',
    getArgs: () => [request],
    getArgByIndex: (index: number) => (index === 0 ? request : undefined),
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    switchToRpc: () => {
      throw new Error('not an rpc context');
    },
    switchToWs: () => {
      throw new Error('not a ws context');
    },
  } as unknown as ExecutionContext;
}
