interface WSMessage {
  type: 'auth' | 'subscribe' | 'unsubscribe' | 'ping';
  data?: any;
  token?: string;
  channel?: string;
}

interface WSResponse {
  type: 'auth_success' | 'auth_error' | 'progress' | 'scan_status' | 'booking_created' | 'booking_updated' | 'error' | 'pong';
  data?: any;
  channel?: string;
  message?: string;
}

type WSEventHandler = (data: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private authenticated: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: number = 1000; // Start with 1 second
  private maxReconnectInterval: number = 30000; // Max 30 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Set<WSEventHandler>> = new Map();
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'authenticated' = 'disconnected';

  constructor(url: string) {
    this.url = url;
    console.log('🔌 WebSocket client initialized for:', url);
  }

  // Public methods
  public connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connectionState === 'connected' || this.connectionState === 'authenticated') {
        console.log('🔌 WebSocket already connected');
        resolve();
        return;
      }

      console.log('🔑 WebSocket connect called with token:', token ? 'Present' : 'Missing');
      this.token = token;
      this.connectionState = 'connecting';
      
      try {
        console.log('🔌 Connecting to WebSocket server...');
        this.ws = new WebSocket(this.url);
        this.setupEventListeners(resolve, reject);
      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        this.connectionState = 'disconnected';
        reject(error);
      }
    });
  }

  public disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    this.authenticated = false;
    this.connectionState = 'disconnected';
    this.stopHeartbeat();
    this.clearReconnectTimeout();
    
    if (this.ws) {
      this.ws.close(1000, 'User initiated disconnect');
      this.ws = null;
    }
  }

  public on(eventType: string, handler: WSEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
    console.log(`📡 Registered handler for event: ${eventType}`);
  }

  public off(eventType: string, handler: WSEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
  }

  public isConnected(): boolean {
    return this.connectionState === 'authenticated';
  }

  public getConnectionState(): string {
    return this.connectionState;
  }

  // Private methods
  private setupEventListeners(resolve: () => void, reject: (error: any) => void): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('🔌 WebSocket connection opened');
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      this.reconnectInterval = 1000; // Reset interval
      
      // Authenticate immediately with a small delay to ensure connection is stable
      setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.authenticate()
            .then(() => {
              this.startHeartbeat();
              resolve();
            })
            .catch(reject);
        } else {
          reject(new Error('WebSocket closed before authentication'));
        }
      }, 100);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WSResponse = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.emit('error', { error: 'Connection error' });
      
      if (this.connectionState === 'connecting') {
        reject(new Error('Failed to connect to WebSocket'));
      }
    };

    this.ws.onclose = (event) => {
      console.log(`🔌 WebSocket connection closed:`, { code: event.code, reason: event.reason });
      const wasAuthenticated = this.authenticated;
      
      this.authenticated = false;
      this.connectionState = 'disconnected';
      this.ws = null;
      this.stopHeartbeat();
      
      this.emit('disconnected', { code: event.code, reason: event.reason });
      
      // Auto-reconnect if it wasn't a user-initiated disconnect
      if (event.code !== 1000 && wasAuthenticated) {
        this.attemptReconnect();
      }
    };
  }

  private async authenticate(): Promise<void> {
    if (!this.token || !this.ws) {
      console.error('❌ Authentication failed: token =', this.token ? 'Present' : 'Missing', 'ws =', this.ws ? 'Present' : 'Missing');
      throw new Error('No token or connection available for authentication');
    }

    console.log('🔑 Starting WebSocket authentication...');
    
    return new Promise((resolve, reject) => {
      const authTimeout = setTimeout(() => {
        console.error('❌ WebSocket authentication timeout after 5 seconds');
        reject(new Error('Authentication timeout'));
      }, 5000);

      // Listen for auth response
      const handleAuthResponse = (data: any) => {
        clearTimeout(authTimeout);
        this.off('auth_success', handleAuthResponse);
        this.off('auth_error', handleAuthError);
        
        this.authenticated = true;
        this.connectionState = 'authenticated';
        console.log('✅ WebSocket authenticated successfully');
        resolve();
      };

      const handleAuthError = (data: any) => {
        clearTimeout(authTimeout);
        this.off('auth_success', handleAuthResponse);
        this.off('auth_error', handleAuthError);
        
        console.error('❌ WebSocket authentication failed:', data.message);
        reject(new Error(data.message || 'Authentication failed'));
      };

      this.on('auth_success', handleAuthResponse);
      this.on('auth_error', handleAuthError);

      // Send auth message
      console.log('📤 Sending auth message with token...');
      this.send({
        type: 'auth',
        token: this.token
      });
    });
  }

  private handleMessage(message: WSResponse): void {
    console.log('📨 WebSocket message received:', message.type);
    
    // Special handling for pong messages
    if (message.type === 'pong') {
      return; // Heartbeat handled automatically
    }

    this.emit(message.type, message.data || message);
  }

  private emit(eventType: string, data: any): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`❌ Error in WebSocket event handler for ${eventType}:`, error);
        }
      });
    }
  }

  private send(message: WSMessage): void {
    console.log('📤 Attempting to send WebSocket message:', message.type, 'readyState:', this.ws?.readyState);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      console.log('📤 Sending WebSocket message:', messageStr);
      this.ws.send(messageStr);
    } else {
      console.warn('⚠️ Attempted to send message but WebSocket is not open:', message.type, 'readyState:', this.ws?.readyState);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.authenticated) {
        this.send({ type: 'ping' });
      }
    }, 25000); // Ping every 25 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Giving up.');
      this.emit('max_reconnect_attempts_reached', { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.emit('reconnecting', { 
      attempt: this.reconnectAttempts, 
      maxAttempts: this.maxReconnectAttempts,
      delay: this.reconnectInterval
    });

    this.clearReconnectTimeout();
    this.reconnectTimeout = setTimeout(() => {
      if (this.token) {
        this.connect(this.token)
          .then(() => {
            console.log('✅ WebSocket reconnected successfully');
            this.emit('reconnected', { attempts: this.reconnectAttempts });
          })
          .catch((error) => {
            console.error('❌ Reconnection failed:', error);
            // Exponential backoff
            this.reconnectInterval = Math.min(this.reconnectInterval * 2, this.maxReconnectInterval);
            this.attemptReconnect();
          });
      }
    }, this.reconnectInterval);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

// Global WebSocket client instance
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://localhost:3000/ws`;
    wsClient = new WebSocketClient(wsUrl);
  }
  return wsClient;
}

// Cleanup function for when component unmounts
export function cleanupWebSocket(): void {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
}