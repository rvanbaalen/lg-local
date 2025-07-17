// Service Connector - Handles communication between distributed services
// Allows services to communicate across different machines

import { io as socketClient } from 'socket.io-client';

export class ServiceConnector {
  constructor(localIo, config) {
    this.localIo = localIo;
    this.config = config;
    this.connections = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
  }

  initialize() {
    // Connect to other services based on configuration
    this.connectToService('setup-server', this.getSetupServerEndpoint());
    this.connectToService('lg-cloud', this.getLgCloudEndpoint());
    this.connectToService('web-ui', this.getWebUIEndpoint());
  }

  getSetupServerEndpoint() {
    const host = this.config.services?.setupServer?.host || 'localhost';
    const port = this.config.services?.setupServer?.port || 5501;
    return `http://${host}:${port}`;
  }

  getLgCloudEndpoint() {
    const host = this.config.services?.lgCloud?.host || 'localhost';
    const port = this.config.services?.lgCloud?.port || 8080;
    return `http://${host}:${port}`;
  }

  getWebUIEndpoint() {
    const host = this.config.services?.webui?.host || 'localhost';
    const port = this.config.services?.webui?.port || 3001;
    return `http://${host}:${port}`;
  }

  connectToService(serviceName, endpoint) {
    if (this.connections.has(serviceName)) {
      this.connections.get(serviceName).disconnect();
    }

    console.log(`Connecting to ${serviceName} at ${endpoint}`);
    
    const socket = socketClient(endpoint, {
      reconnection: false, // We'll handle reconnection manually
      timeout: 5000
    });

    socket.on('connect', () => {
      console.log(`Connected to ${serviceName} service`);
      this.connections.set(serviceName, socket);
      this.reconnectAttempts.set(serviceName, 0);
      
      // Notify local clients about service connection
      this.localIo.emit('service-connected', { service: serviceName, endpoint });
    });

    socket.on('disconnect', () => {
      console.log(`Disconnected from ${serviceName} service`);
      this.connections.delete(serviceName);
      
      // Notify local clients about service disconnection
      this.localIo.emit('service-disconnected', { service: serviceName });
      
      // Attempt to reconnect
      this.scheduleReconnect(serviceName, endpoint);
    });

    socket.on('connect_error', (error) => {
      console.log(`Failed to connect to ${serviceName} service: ${error.message}`);
      this.scheduleReconnect(serviceName, endpoint);
    });

    // Forward events from remote service to local clients
    socket.onAny((event, data) => {
      this.localIo.emit(event, data);
    });

    return socket;
  }

  scheduleReconnect(serviceName, endpoint) {
    const attempts = this.reconnectAttempts.get(serviceName) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.log(`Max reconnection attempts reached for ${serviceName}`);
      return;
    }

    this.reconnectAttempts.set(serviceName, attempts + 1);
    
    setTimeout(() => {
      console.log(`Reconnecting to ${serviceName} (attempt ${attempts + 1})`);
      this.connectToService(serviceName, endpoint);
    }, this.reconnectDelay);
  }

  isServiceConnected(serviceName) {
    return this.connections.has(serviceName) && this.connections.get(serviceName).connected;
  }

  getConnectedServices() {
    const services = {};
    for (const [name, socket] of this.connections) {
      services[name] = {
        connected: socket.connected,
        endpoint: socket.io.uri
      };
    }
    return services;
  }

  // Forward requests to specific services
  forwardToSetupServer(action, payload, callback) {
    const socket = this.connections.get('setup-server');
    if (socket && socket.connected) {
      socket.emit(action, payload, callback);
    } else {
      callback({ success: false, error: 'Setup server not connected' });
    }
  }

  forwardToLgCloud(action, payload, callback) {
    const socket = this.connections.get('lg-cloud');
    if (socket && socket.connected) {
      socket.emit(action, payload, callback);
    } else {
      callback({ success: false, error: 'LG Cloud server not connected' });
    }
  }

  forwardToWebUI(action, payload, callback) {
    const socket = this.connections.get('web-ui');
    if (socket && socket.connected) {
      socket.emit(action, payload, callback);
    } else {
      callback({ success: false, error: 'Web UI not connected' });
    }
  }

  // Get service status
  getSetupServerStatus(callback) {
    this.forwardToSetupServer('get-setup-server-status', {}, callback);
  }

  getLgCloudStatus(callback) {
    this.forwardToLgCloud('get-lg-cloud-status', {}, callback);
  }

  // Broadcast configuration updates to all connected services
  broadcastConfigUpdate(section, config) {
    const update = { section, config };
    
    for (const [serviceName, socket] of this.connections) {
      if (socket.connected) {
        socket.emit('config-update', update);
      }
    }
  }

  // Broadcast events to all connected services
  broadcastEvent(sourceService, event, data) {
    const eventData = { source: sourceService, event, data, timestamp: new Date().toISOString() };
    
    for (const [serviceName, socket] of this.connections) {
      if (socket.connected && serviceName !== sourceService) {
        socket.emit('service-event', eventData);
      }
    }
    
    // Also broadcast to local clients
    this.localIo.emit(event, data);
  }

  disconnectFromService(serviceName) {
    if (this.connections.has(serviceName)) {
      this.connections.get(serviceName).disconnect();
      this.connections.delete(serviceName);
      this.reconnectAttempts.delete(serviceName);
      console.log(`Disconnected from ${serviceName} service`);
    }
  }

  shutdown() {
    console.log('Shutting down service connector');
    
    for (const [serviceName, socket] of this.connections) {
      socket.disconnect();
    }
    
    this.connections.clear();
    this.reconnectAttempts.clear();
  }
}