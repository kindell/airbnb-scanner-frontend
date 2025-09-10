import { useEffect, useRef, useCallback, useState } from 'react';
import { getWebSocketClient, WebSocketClient } from '../services/websocket';

interface UseWebSocketOptions {
  enabled?: boolean;
  onProgress?: (data: any) => void;
  onScanStatus?: (data: any) => void;
  onBookingCreated?: (data: any) => void;
  onBookingUpdated?: (data: any) => void;
  onError?: (error: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onReconnecting?: (data: any) => void;
  onReconnected?: (data: any) => void;
}

interface WebSocketState {
  isConnected: boolean;
  isReconnecting: boolean;
  connectionState: string;
  error: string | null;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    enabled = true,
    onProgress,
    onScanStatus,
    onBookingCreated,
    onBookingUpdated,
    onError,
    onConnected,
    onDisconnected,
    onReconnecting,
    onReconnected
  } = options;

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isReconnecting: false,
    connectionState: 'disconnected',
    error: null
  });

  const wsClient = useRef<WebSocketClient | null>(null);
  const handlersRegistered = useRef<boolean>(false);

  const updateState = useCallback((updates: Partial<WebSocketState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const connect = useCallback(async () => {
    if (!enabled) return;

    // Prevent multiple concurrent connections
    if (wsClient.current?.isConnected()) {
      console.log('🔌 WebSocket already connected, skipping connect');
      return;
    }

    const token = localStorage.getItem('auth_token');
    console.log('🔑 useWebSocket connect - token from localStorage:', token ? 'Present' : 'Missing');
    if (!token) {
      console.warn('⚠️ No auth token available for WebSocket connection');
      updateState({ error: 'No authentication token available' });
      return;
    }

    try {
      if (!wsClient.current) {
        wsClient.current = getWebSocketClient();
      }
      
      // Register event handlers only once
      if (!handlersRegistered.current) {
        // Connection state handlers
        wsClient.current.on('auth_success', () => {
          console.log('✅ WebSocket authenticated');
          updateState({ 
            isConnected: true, 
            isReconnecting: false, 
            connectionState: 'authenticated',
            error: null 
          });
          onConnected?.();
        });

        wsClient.current.on('auth_error', (data) => {
          console.error('❌ WebSocket auth error:', data.message);
          updateState({ 
            isConnected: false, 
            isReconnecting: false,
            connectionState: 'disconnected',
            error: data.message || 'Authentication failed' 
          });
          onError?.(data);
        });

        wsClient.current.on('disconnected', (data) => {
          console.log('🔌 WebSocket disconnected:', data);
          updateState({ 
            isConnected: false, 
            connectionState: 'disconnected',
            error: data.reason || 'Connection lost' 
          });
          onDisconnected?.();
        });

        wsClient.current.on('reconnecting', (data) => {
          console.log(`🔄 WebSocket reconnecting... (${data.attempt}/${data.maxAttempts})`);
          updateState({ 
            isReconnecting: true,
            connectionState: 'reconnecting',
            error: null 
          });
          onReconnecting?.(data);
        });

        wsClient.current.on('reconnected', (data) => {
          console.log('✅ WebSocket reconnected successfully');
          updateState({ 
            isConnected: true, 
            isReconnecting: false,
            connectionState: 'authenticated',
            error: null 
          });
          onReconnected?.(data);
        });

        wsClient.current.on('max_reconnect_attempts_reached', (data) => {
          console.error('❌ Max WebSocket reconnect attempts reached');
          updateState({ 
            isConnected: false, 
            isReconnecting: false,
            connectionState: 'disconnected',
            error: 'Connection lost - max reconnection attempts reached' 
          });
          onError?.(new Error('Max reconnection attempts reached'));
        });

        // Business logic handlers
        wsClient.current.on('progress', (data) => {
          console.log('📊 Scan progress update:', data);
          onProgress?.(data);
        });

        wsClient.current.on('scan_status', (data) => {
          console.log('📡 Scan status update:', data);
          onScanStatus?.(data);
        });

        wsClient.current.on('booking_created', (data) => {
          console.log('📝 Booking created:', data);
          onBookingCreated?.(data);
        });

        wsClient.current.on('booking_updated', (data) => {
          console.log('📝 Booking updated:', data);
          onBookingUpdated?.(data);
        });

        wsClient.current.on('error', (error) => {
          console.error('❌ WebSocket error:', error);
          updateState({ error: error.message || 'WebSocket error' });
          onError?.(error);
        });

        handlersRegistered.current = true;
      }

      // Update connection state immediately
      updateState({ 
        connectionState: 'connecting',
        error: null 
      });

      await wsClient.current.connect(token);
      
    } catch (error: any) {
      console.error('❌ Failed to connect WebSocket:', error);
      updateState({ 
        isConnected: false, 
        isReconnecting: false,
        connectionState: 'disconnected',
        error: error.message || 'Connection failed' 
      });
      onError?.(error);
    }
  }, [enabled, onProgress, onScanStatus, onBookingCreated, onBookingUpdated, onError, onConnected, onDisconnected, onReconnecting, onReconnected, updateState]);

  const disconnect = useCallback(() => {
    if (wsClient.current) {
      wsClient.current.disconnect();
      updateState({ 
        isConnected: false, 
        isReconnecting: false,
        connectionState: 'disconnected',
        error: null 
      });
    }
  }, [updateState]);

  // Auto-connect on mount and when enabled changes
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup on unmount only
    return () => {
      if (!enabled) {
        disconnect();
      }
    };
  }, [enabled, connect, disconnect]);

  // Update connection state from WebSocket client
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsClient.current) {
        const currentState = wsClient.current.getConnectionState();
        setState(prev => {
          if (prev.connectionState !== currentState) {
            return { 
              ...prev, 
              connectionState: currentState,
              isConnected: currentState === 'authenticated'
            };
          }
          return prev;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    client: wsClient.current
  };
}

export default useWebSocket;