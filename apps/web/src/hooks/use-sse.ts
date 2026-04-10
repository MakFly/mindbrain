import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';

type EventCallback = (data: unknown) => void;

export interface SSEHandle {
  connected: boolean;
  on: (event: string, callback: EventCallback) => void;
  off: (event: string, callback: EventCallback) => void;
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export function useSSE(): SSEHandle {
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const esRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const apiKey = localStorage.getItem('mindbrain-api-key') ?? '';
    const url = `/api/events${apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : ''}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      if (unmountedRef.current) return;
      retryCountRef.current = 0;
      setConnected(true);
    };

    es.onerror = () => {
      if (unmountedRef.current) return;
      setConnected(false);
      es.close();
      esRef.current = null;

      const backoff = Math.min(
        BASE_BACKOFF_MS * 2 ** retryCountRef.current,
        MAX_BACKOFF_MS,
      );
      retryCountRef.current += 1;

      timeoutRef.current = setTimeout(() => {
        if (!unmountedRef.current) connectRef.current?.();
      }, backoff);
    };

    es.onmessage = (ev) => {
      if (unmountedRef.current) return;
      try {
        const { event, data } = JSON.parse(ev.data) as { event: string; data: unknown };
        const cbs = listenersRef.current.get(event);
        cbs?.forEach((cb) => cb(data));
      } catch {
        // ignore malformed messages
      }
    };

    // Named event types from the backend
    const namedEvents = [
      'note:created',
      'note:updated',
      'note:deleted',
      'edge:created',
      'import:completed',
      'mining:completed',
    ];

    for (const eventName of namedEvents) {
      es.addEventListener(eventName, (ev: MessageEvent) => {
        if (unmountedRef.current) return;
        try {
          const data: unknown = JSON.parse((ev as MessageEvent).data);
          const cbs = listenersRef.current.get(eventName);
          cbs?.forEach((cb) => cb(data));
        } catch {
          // ignore malformed messages
        }
      });
    }
  }, []);

  useLayoutEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  const on = useCallback((event: string, callback: EventCallback) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);
  }, []);

  const off = useCallback((event: string, callback: EventCallback) => {
    listenersRef.current.get(event)?.delete(callback);
  }, []);

  return { connected, on, off };
}
