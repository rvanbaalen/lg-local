#!/usr/bin/env node

// LG Cloud Service - Handles LG ThinQ cloud protocol and MQTT
// Can be run independently on any machine

import { LGCloudServer } from '../lib/lg-cloud-server.js';
import { ConfigManager } from '../lib/config.js';
import { ServiceConnector } from '../lib/service-connector.js';
import { MQTTMonitor } from '../lib/mqtt-monitor.js';
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

// Initialize LG Cloud server and MQTT monitor
const lgCloudServer = new LGCloudServer(io, configManager);
const mqttMonitor = new MQTTMonitor(io);

const PORT = process.env.LG_CLOUD_PORT || config.services?.lgCloud?.port || 8080;

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ 
    service: 'lg-cloud',
    status: 'running', 
    timestamp: new Date().toISOString(),
    lgCloud: lgCloudServer.getStatus(),
    mqtt: mqttMonitor.getStatus()
  });
});

app.get('/api/devices', (req, res) => {
  res.json(lgCloudServer.getConnectedDevices());
});

app.get('/api/messages', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(lgCloudServer.getMessageHistory(limit));
});

app.post('/api/start', (req, res) => {
  try {
    lgCloudServer.start();
    res.json({ success: true, status: 'started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stop', (req, res) => {
  try {
    lgCloudServer.stop();
    res.json({ success: true, status: 'stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mqtt/start', (req, res) => {
  try {
    const mqttConfig = configManager.getMQTTConfig();
    mqttMonitor.connect(mqttConfig);
    mqttMonitor.startMonitoring();
    res.json({ success: true, status: 'monitoring' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mqtt/stop', (req, res) => {
  try {
    mqttMonitor.stopMonitoring();
    res.json({ success: true, status: 'stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected to LG Cloud Service:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from LG Cloud Service:', socket.id);
  });
  
  // LG Cloud server control
  socket.on('start-lg-cloud', async (callback) => {
    try {
      await lgCloudServer.start();
      callback({ success: true });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  socket.on('stop-lg-cloud', async (callback) => {
    try {
      await lgCloudServer.stop();
      callback({ success: true });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  socket.on('get-lg-cloud-status', (callback) => {
    callback(lgCloudServer.getStatus());
  });
  
  socket.on('get-lg-cloud-devices', (callback) => {
    callback(lgCloudServer.getConnectedDevices());
  });
  
  socket.on('get-lg-cloud-messages', (data, callback) => {
    const limit = data?.limit || 100;
    callback(lgCloudServer.getMessageHistory(limit));
  });
  
  socket.on('send-device-message', (data, callback) => {
    try {
      lgCloudServer.sendMessageToDevice(data.deviceId, data.message);
      callback({ success: true });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  // MQTT monitoring control
  socket.on('start-monitoring', async (data, callback) => {
    try {
      const mqttConfig = configManager.getMQTTConfig();
      if (mqttConfig.host && mqttConfig.port && !mqttMonitor.isConnected) {
        await mqttMonitor.connect(mqttConfig);
      }
      
      if (mqttMonitor.isConnected) {
        mqttMonitor.startMonitoring();
      }
      
      callback({ success: true, status: 'active' });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  socket.on('stop-monitoring', (callback) => {
    try {
      mqttMonitor.stopMonitoring();
      callback({ success: true, status: 'inactive' });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  socket.on('get-mqtt-status', (callback) => {
    callback(mqttMonitor.getStatus());
  });
  
  socket.on('configure-mqtt', async (config, callback) => {
    try {
      await mqttMonitor.connect(config);
      callback({ success: true, status: mqttMonitor.getStatus() });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  // Configuration updates from Web UI
  socket.on('config-update', (data) => {
    const { section, config } = data;
    configManager.updateSection(section, config);
    console.log(`Configuration updated for section: ${section}`);
    
    // Restart MQTT connection if MQTT config changed
    if (section === 'mqtt' && mqttMonitor.isConnected) {
      mqttMonitor.disconnect();
      const mqttConfig = configManager.getMQTTConfig();
      if (mqttConfig.host && mqttConfig.port) {
        mqttMonitor.connect(mqttConfig);
      }
    }
  });
});

// Forward events to connected services
const forwardEvent = (event, data) => {
  serviceConnector.broadcastEvent('lg-cloud', event, data);
};

// Initialize service connections
serviceConnector.initialize();

// Start server
server.listen(PORT, () => {
  console.log(`LG Cloud Service running on port ${PORT}`);
  console.log(`MQTT Config: ${config.mqtt?.url || 'Not configured'}`);
  console.log(`Web UI Service: ${config.services?.webui?.host || 'localhost'}:${config.services?.webui?.port || 3001}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  lgCloudServer.stop();
  mqttMonitor.disconnect();
  server.close(() => {
    serviceConnector.shutdown();
    process.exit(0);
  });
});