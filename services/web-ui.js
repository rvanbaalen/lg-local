#!/usr/bin/env node

// Web UI Service - Serves the React frontend and provides API endpoints
// Can be run independently on any machine

import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { TLVParser } from '../lib/tlv.js';
import { SetupProtocolParser, CloudProtocolParser } from '../lib/protocol.js';
import { ConfigManager } from '../lib/config.js';
import { ServiceConnector } from '../lib/service-connector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // Allow connections from any origin for distributed setup
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize configuration and service connector
const configManager = new ConfigManager();
const config = configManager.getConfig();
const serviceConnector = new ServiceConnector(io, config);

// Initialize parsers (for local parsing functionality)
const tlvParser = new TLVParser();
const setupParser = new SetupProtocolParser();
const cloudParser = new CloudProtocolParser();

const PORT = process.env.WEB_UI_PORT || config.webui?.port || 3001;

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ 
    service: 'web-ui',
    status: 'running', 
    timestamp: new Date().toISOString(),
    connectedServices: serviceConnector.getConnectedServices()
  });
});

// Configuration API endpoints
app.get('/api/config', (req, res) => {
  res.json(configManager.getConfig());
});

app.get('/api/config/:section', (req, res) => {
  const section = configManager.getSection(req.params.section);
  res.json(section);
});

app.post('/api/config/:section', (req, res) => {
  const section = req.params.section;
  
  if (section === 'mqtt') {
    const errors = configManager.validateMQTTConfig(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
  }
  
  const success = configManager.updateSection(section, req.body);
  if (success) {
    // Notify connected services of configuration change
    serviceConnector.broadcastConfigUpdate(section, req.body);
    res.json({ success: true, config: configManager.getSection(section) });
  } else {
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected to Web UI:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from Web UI:', socket.id);
  });
  
  // Local parsing functionality
  socket.on('parse-tlv', (data, callback) => {
    try {
      const result = tlvParser.parseHex(data.data);
      callback({
        success: true,
        segments: result.segments,
        totalLength: result.totalLength,
        remainingBytes: result.remainingBytes
      });
    } catch (error) {
      callback({
        success: false,
        error: error.message
      });
    }
  });
  
  socket.on('parse-json', (data, callback) => {
    try {
      const result = setupParser.parseMessage(data.data);
      callback({
        success: true,
        type: result.type,
        command: result.command,
        data: result.data,
        commandInfo: result.commandInfo,
        valid: result.valid,
        timestamp: result.timestamp
      });
    } catch (error) {
      callback({
        success: false,
        error: error.message
      });
    }
  });
  
  // Configuration management
  socket.on('get-config', (callback) => {
    callback(configManager.getConfig());
  });
  
  socket.on('update-config', (data, callback) => {
    try {
      const { section, config } = data;
      
      if (section === 'mqtt') {
        const errors = configManager.validateMQTTConfig(config);
        if (errors.length > 0) {
          return callback({ success: false, error: 'Validation failed', details: errors });
        }
      }
      
      const success = configManager.updateSection(section, config);
      if (success) {
        serviceConnector.broadcastConfigUpdate(section, config);
        callback({ success: true, config: configManager.getSection(section) });
      } else {
        callback({ success: false, error: 'Failed to save configuration' });
      }
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  // Proxy requests to other services
  socket.on('setup-server-request', (data, callback) => {
    serviceConnector.forwardToSetupServer(data.action, data.payload, callback);
  });
  
  socket.on('lg-cloud-request', (data, callback) => {
    serviceConnector.forwardToLgCloud(data.action, data.payload, callback);
  });
  
  // Service status requests
  socket.on('get-setup-server-status', (callback) => {
    serviceConnector.getSetupServerStatus(callback);
  });
  
  socket.on('get-lg-cloud-status', (callback) => {
    serviceConnector.getLgCloudStatus(callback);
  });
});

// Initialize service connections
serviceConnector.initialize();

// Start server
server.listen(PORT, () => {
  console.log(`Web UI Service running on port ${PORT}`);
  console.log(`Configured to connect to:`);
  console.log(`  Setup Server: ${config.services?.setupServer?.host || 'localhost'}:${config.services?.setupServer?.port || 5500}`);
  console.log(`  LG Cloud Server: ${config.services?.lgCloud?.host || 'localhost'}:${config.services?.lgCloud?.port || 8080}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    serviceConnector.shutdown();
    process.exit(0);
  });
});