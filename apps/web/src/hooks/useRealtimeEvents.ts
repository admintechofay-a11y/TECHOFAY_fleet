import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from '../lib/api';

export interface RealtimeEvent {
  id: string;
  eventId: string;
  eventType: string;
  companyId: string;
  timestamp: string;
  payload: any;
}

export type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

export function useRealtimeEvents(onEvent?: (event: RealtimeEvent) => void) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<any>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    // Clean up any existing connection or pending retry
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const rawUrl = (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || '').trim();
    const baseUrl = rawUrl ? `${rawUrl.replace(/\/+$/, '')}/api/v1` : '/api/v1';
    const token = getAccessToken();
    const url = token
      ? `${baseUrl}/events/stream?token=${encodeURIComponent(token)}`
      : `${baseUrl}/events/stream`;

    setConnectionState(retryCountRef.current === 0 ? 'CONNECTING' : 'RECONNECTING');

    try {
      const es = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnectionState('CONNECTED');
        retryCountRef.current = 0;
      };

      const handleIncoming = (evt: MessageEvent) => {
        try {
          const parsed = JSON.parse(evt.data);
          const realtimeEvt: RealtimeEvent = {
            id: evt.lastEventId || parsed.eventId || `evt_${Date.now()}`,
            eventId: parsed.eventId || `evt_${Date.now()}`,
            eventType: parsed.eventType || evt.type,
            companyId: parsed.companyId,
            timestamp: parsed.timestamp || new Date().toISOString(),
            payload: parsed.payload || parsed
          };
          setLastEvent(realtimeEvt);
          setLastEventAt(new Date());
          if (onEventRef.current) {
            onEventRef.current(realtimeEvt);
          }
        } catch (err) {
          console.warn('[SSE] Failed to parse event payload:', err);
        }
      };

      // Listen for connected handshake
      es.addEventListener('connected', (evt) => {
        setConnectionState('CONNECTED');
        retryCountRef.current = 0;
      });

      // Operational Event Types
      const eventTypes = [
        'TRIP_DISPATCHED',
        'TRIP_CLOSED',
        'TRIP_DELIVERED',
        'TRIP_STATUS_UPDATED',
        'STOP_DELIVERED',
        'LOAD_CREATED',
        'LOAD_STATUS_UPDATED',
        'POD_UPLOADED',
        'POD_VERIFIED',
        'TELEMATICS_PING',
        'MAINTENANCE_SCHEDULED',
        'COMPLIANCE_ALERT'
      ];

      eventTypes.forEach((type) => {
        es.addEventListener(type, handleIncoming);
      });

      // Generic message handler
      es.onmessage = handleIncoming;

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setConnectionState('RECONNECTING');

        // Bounded exponential backoff
        const delay = RETRY_DELAYS_MS[Math.min(retryCountRef.current, RETRY_DELAYS_MS.length - 1)];
        retryCountRef.current += 1;

        retryTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      console.warn('[SSE] EventSource initialization failed:', err);
      setConnectionState('DISCONNECTED');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      setConnectionState('DISCONNECTED');
    };
  }, [connect]);

  return {
    isConnected: connectionState === 'CONNECTED',
    connectionState,
    lastEvent,
    lastEventAt,
    reconnect: connect
  };
}
