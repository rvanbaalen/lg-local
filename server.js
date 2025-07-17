import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { TLVParser } from './lib/tlv.js';
import { SetupProtocolParser, CloudProtocolParser } from './lib/protocol.js';
import { MQTTMonitor } from './lib/mqtt-monitor.js';
import { ConfigManager } from './lib/config.js';
import { SetupServer } from './lib/setup-server.js';
import { LGCloudServer } from './lib/lg-cloud-server.js';
import { ServiceConnector } from './lib/service-connector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",  // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// Initialize configuration
const configManager = new ConfigManager();
const config = configManager.getConfig();

const PORT = process.env.PORT || config.server.port;

// Initialize parsers
const tlvParser = new TLVParser();
const setupParser = new SetupProtocolParser();
const cloudParser = new CloudProtocolParser();

// Initialize optional local services (can be started/stopped from UI)
let mqttMonitor = null;
let setupServer = null;
let lgCloudServer = null;

// Initialize service connector for remote services
const serviceConnector = new ServiceConnector(io, config);

// Middleware - Allow all CORS
app.use(cors({
  origin: "*",  // Allow all origins
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

app.get('/api/status', (req, res) => {
    res.json({ status: 'running', timestamp: new Date().toISOString() });
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
    
    // Validate MQTT configuration if updating MQTT section
    if (section === 'mqtt') {
        const errors = configManager.validateMQTTConfig(req.body);
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }
    }
    
    const success = configManager.updateSection(section, req.body);
    if (success) {
        res.json({ success: true, config: configManager.getSection(section) });
    } else {
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

app.post('/api/config/reset', (req, res) => {
    const success = configManager.resetConfig();
    if (success) {
        res.json({ success: true, config: configManager.getConfig() });
    } else {
        res.status(500).json({ error: 'Failed to reset configuration' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Web interface connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Web interface disconnected:', socket.id);
    });
    
    // Local MQTT monitoring
    socket.on('start-monitoring', async (data, callback) => {
        console.log('Starting local MQTT monitoring');
        try {
            // Save MQTT configuration as local
            configManager.updateSection('mqtt', {
                ...configManager.getSection('mqtt'),
                mode: 'local',
                autoStart: false
            });
            
            if (!mqttMonitor) {
                mqttMonitor = new MQTTMonitor(io);
            }
            
            const mqttConfig = configManager.getMQTTConfig();
            if (mqttConfig.host && mqttConfig.port && !mqttMonitor.isConnected) {
                await mqttMonitor.connect(mqttConfig);
            }
            
            if (mqttMonitor.isConnected) {
                mqttMonitor.startMonitoring();
            }
            
            callback({ success: true, status: 'active' });
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('stop-monitoring', (callback) => {
        console.log('Stopping local MQTT monitoring');
        if (mqttMonitor) {
            mqttMonitor.stopMonitoring();
        }
        callback && callback({ success: true, status: 'inactive' });
    });
    
    // Handle TLV parsing requests
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
    
    // Handle JSON parsing requests
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
    
    // Handle MQTT configuration
    socket.on('configure-mqtt', async (config, callback) => {
        try {
            if (!mqttMonitor) {
                mqttMonitor = new MQTTMonitor(io);
            }
            await mqttMonitor.connect(config);
            callback({ success: true, status: mqttMonitor.getStatus() });
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });
    
    // Handle configuration updates
    socket.on('update-config', (data, callback) => {
        try {
            const { section, config } = data;
            
            // Validate MQTT configuration if updating MQTT section
            if (section === 'mqtt') {
                const errors = configManager.validateMQTTConfig(config);
                if (errors.length > 0) {
                    return callback({ success: false, error: 'Validation failed', details: errors });
                }
            }
            
            const success = configManager.updateSection(section, config);
            if (success) {
                callback({ success: true, config: configManager.getSection(section) });
            } else {
                callback({ success: false, error: 'Failed to save configuration' });
            }
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });
    
    // Get current configuration
    socket.on('get-config', (callback) => {
        callback(configManager.getConfig());
    });
    
    // Get MQTT status
    socket.on('get-mqtt-status', (callback) => {
        if (mqttMonitor) {
            callback(mqttMonitor.getStatus());
        } else {
            callback({ connected: false, status: 'inactive' });
        }
    });
    
    // Local Setup server controls
    socket.on('start-setup-server', (callback) => {
        try {
            // Save service configuration as local
            configManager.updateServiceConfig('setupServer', {
                mode: 'local',
                autoStart: false
            });
            
            if (!setupServer) {
                setupServer = new SetupServer(io, configManager);
            }
            setupServer.start();
            callback({ success: true });
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('stop-setup-server', (callback) => {
        try {
            if (setupServer) {
                setupServer.stop();
            }
            callback({ success: true });
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('get-setup-server-status', (callback) => {
        if (setupServer) {
            callback(setupServer.getStatus());
        } else {
            callback({ running: false, port: null, connectedDevices: [] });
        }
    });
    
    socket.on('get-connected-devices', (callback) => {
        if (setupServer) {
            callback(setupServer.getConnectedDevices());
        } else {
            callback([]);
        }
    });
    
    // Local LG Cloud server controls
    socket.on('start-lg-cloud', async (callback) => {
        try {
            // Save service configuration as local
            configManager.updateServiceConfig('lgCloud', {
                mode: 'local',
                autoStart: false
            });
            
            if (!lgCloudServer) {
                lgCloudServer = new LGCloudServer(io, configManager);
            }
            await lgCloudServer.start();
            callback({ success: true });
        } catch (error) {
            console.error('Failed to start LG Cloud Server:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('stop-lg-cloud', async (callback) => {
        try {
            if (lgCloudServer) {
                await lgCloudServer.stop();
            }
            callback({ success: true });
        } catch (error) {
            console.error('Failed to stop LG Cloud Server:', error);
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('get-lg-cloud-status', (callback) => {
        if (lgCloudServer) {
            callback(lgCloudServer.getStatus());
        } else {
            callback({ running: false });
        }
    });
    
    socket.on('get-lg-cloud-devices', (callback) => {
        if (lgCloudServer) {
            callback(lgCloudServer.getConnectedDevices());
        } else {
            callback([]);
        }
    });
    
    socket.on('get-lg-cloud-messages', (data, callback) => {
        if (lgCloudServer) {
            const limit = data?.limit || 100;
            callback(lgCloudServer.getMessageHistory(limit));
        } else {
            callback([]);
        }
    });
    
    socket.on('send-device-message', (data, callback) => {
        try {
            if (lgCloudServer) {
                lgCloudServer.sendMessageToDevice(data.deviceId, data.message);
                callback({ success: true });
            } else {
                callback({ success: false, error: 'LG Cloud server not running' });
            }
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });
    
    // Remote service connection
    socket.on('connect-remote-service', (data, callback) => {
        const { serviceType, host, port } = data;
        const endpoint = `http://${host}:${port}`;
        
        try {
            // Save service configuration as remote
            configManager.updateServiceConfig(serviceType, {
                mode: 'remote',
                host: host,
                port: port
            });
            
            serviceConnector.connectToService(serviceType, endpoint);
            callback({ success: true, endpoint });
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('disconnect-remote-service', (data, callback) => {
        const { serviceType } = data;
        
        try {
            serviceConnector.disconnectFromService(serviceType);
            callback({ success: true });
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });
    
    socket.on('get-remote-services', (callback) => {
        callback(serviceConnector.getConnectedServices());
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`LG ThinQ Debug Tool running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});