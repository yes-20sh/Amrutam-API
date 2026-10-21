import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextData {
  userId?: string | null;
  ipAddress?: string | null;
}

export const requestContext = new AsyncLocalStorage<RequestContextData>();

export function getRequestContext(): RequestContextData | undefined {
  return requestContext.getStore();
}
