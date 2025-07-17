#!/usr/bin/env node

// Setup Server Service - Handles LG ThinQ device setup protocol
// Can be run independently on any machine

import { SetupServer } from '../lib/setup-server.js';
import { ConfigManager } from '../lib/config.js';
import { ServiceConnector } from '../lib/service-connector.js';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import express from 'express';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize configuration and service connector
const configManager = new ConfigManager();
const config = configManager.getConfig();
const serviceConnector = new ServiceConnector(io, config);

// Initialize setup server
const setupServer = new SetupServer(io, configManager);

const PORT = process.env.SETUP_SERVER_PORT || config.services?.setupServer?.port || 5501;

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ 
    service: 'setup-server',
    status: 'running', 
    timestamp: new Date().toISOString(),
    setupServer: setupServer.getStatus()
  });
});

app.get('/api/devices', (req, res) => {
  res.json(setupServer.getConnectedDevices());
});

app.post('/api/start', (req, res) => {
  try {
    setupServer.start();
    res.json({ success: true, status: 'started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stop', (req, res) => {
  try {
    setupServer.stop();
    res.json({ success: true, status: 'stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected to Setup Server:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from Setup Server:', socket.id);
  });
  
  // Setup server control
  socket.on('start-setup-server', (callback) => {
    try {
      setupServer.start();
      callback({ success: true });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  socket.on('stop-setup-server', (callback) => {
    try {
      setupServer.stop();
      callback({ success: true });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  socket.on('get-setup-server-status', (callback) => {
    callback(setupServer.getStatus());
  });
  
  socket.on('get-connected-devices', (callback) => {
    callback(setupServer.getConnectedDevices());
  });
  
  // Configuration updates from Web UI
  socket.on('config-update', (data) => {
    const { section, config } = data;
    configManager.updateSection(section, config);
    console.log(`Configuration updated for section: ${section}`);
  });
});

// Forward setup server events to connected services
setupServer.on = (event, data) => {
  serviceConnector.broadcastEvent('setup-server', event, data);
};

// Initialize service connections
serviceConnector.initialize();

// Start server
server.listen(PORT, () => {
  console.log(`Setup Server Service running on port ${PORT}`);
  console.log(`TLS Setup Protocol listening on port ${config.services?.setupServer?.tlsPort || 5500}`);
  console.log(`Web UI Service: ${config.services?.webui?.host || 'localhost'}:${config.services?.webui?.port || 3001}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  setupServer.stop();
  server.close(() => {
    serviceConnector.shutdown();
    process.exit(0);
  });
});