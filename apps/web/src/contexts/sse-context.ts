import { createContext, useContext } from 'react';
import type { SSEHandle } from '../hooks/use-sse';

export const SSEContext = createContext<SSEHandle>({
  connected: false,
  on: () => undefined,
  off: () => undefined,
});

export function useSSEContext(): SSEHandle {
  return useContext(SSEContext);
}
