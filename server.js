const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const { TLVParser } = require('./lib/tlv');
const { SetupProtocolParser, CloudProtocolParser } = require('./lib/protocol');
const { MQTTMonitor } = require('./lib/mqtt-monitor');
const { ConfigManager } = require('./lib/config');
const { SetupServer } = require('./lib/setup-server');
const { LGCloudServer } = require('./lib/lg-cloud-server');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Initialize configuration
const configManager = new ConfigManager();
const config = configManager.getConfig();

const PORT = process.env.PORT || config.server.port;

// Initialize parsers and servers
const tlvParser = new TLVParser();
const setupParser = new SetupProtocolParser();
const cloudParser = new CloudProtocolParser();
const mqttMonitor = new MQTTMonitor(io);
const setupServer = new SetupServer(io, configManager);
const lgCloudServer = new LGCloudServer(io, configManager);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
    
    // Handle client requests for protocol monitoring
    socket.on('start-monitoring', async (data) => {
        console.log('Starting monitoring for:', data);
        try {
            // Only connect to MQTT broker if configuration is valid
            const mqttConfig = configManager.getMQTTConfig();
            if (mqttConfig.host && mqttConfig.port && !mqttMonitor.isConnected) {
                await mqttMonitor.connect(mqttConfig);
            }
            
            // Start monitoring MQTT messages
            if (mqttMonitor.isConnected) {
                mqttMonitor.startMonitoring();
            }
            
            socket.emit('monitoring-started', { status: 'active' });
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            socket.emit('monitoring-error', { error: error.message });
        }
    });
    
    socket.on('stop-monitoring', () => {
        console.log('Stopping monitoring');
        mqttMonitor.stopMonitoring();
        socket.emit('monitoring-stopped', { status: 'inactive' });
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
        callback(mqttMonitor.getStatus());
    });
    
    // Setup server controls
    socket.on('start-setup-server', () => {
        setupServer.start();
    });
    
    socket.on('stop-setup-server', () => {
        setupServer.stop();
    });
    
    socket.on('get-setup-server-status', (callback) => {
        callback(setupServer.getStatus());
    });
    
    socket.on('get-connected-devices', (callback) => {
        callback(setupServer.getConnectedDevices());
    });
    
    // LG Cloud server controls
    socket.on('start-lg-cloud', async () => {
        try {
            await lgCloudServer.start();
        } catch (error) {
            console.error('Failed to start LG Cloud Server:', error);
        }
    });
    
    socket.on('stop-lg-cloud', async () => {
        try {
            await lgCloudServer.stop();
        } catch (error) {
            console.error('Failed to stop LG Cloud Server:', error);
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
});

// Start server
server.listen(PORT, () => {
    console.log(`LG ThinQ Debug Tool running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});