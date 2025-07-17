// LG Local Cloud Server - Replaces LG's cloud services locally
// Acts as MQTT broker and API server for configured appliances

import express from 'express';
import https from 'https';
import mqtt from 'mqtt';
import { CloudProtocolParser } from './protocol.js';
import { TLVParser } from './tlv.js';

class LGCloudServer {
    constructor(socketServer, configManager) {
        this.io = socketServer;
        this.configManager = configManager;
        this.apiServer = null;
        this.mqttServer = null;
        this.isRunning = false;
        
        // Server configuration - get from service config or use defaults
        const serviceConfig = configManager.getServiceConfig('lgCloud');
        console.log('[CLOUD] Service config:', serviceConfig);
        this.config = {
            apiPort: serviceConfig.port || 8080,
            mqttPort: 1883,
            mqttWsPort: 8883
        };
        console.log('[CLOUD] Using config:', this.config);
        
        this.cloudParser = new CloudProtocolParser();
        this.tlvParser = new TLVParser();
        this.connectedDevices = new Map();
        this.messageHistory = [];
        
        // Initialize Express app for API endpoints
        this.app = express();
        this.app.use(express.json());
        this.setupAPIRoutes();
    }

    // Setup API routes that appliances expect
    setupAPIRoutes() {
        // Route discovery endpoint (equivalent to comon.lgthinq.com/route)
        this.app.get('/route', (req, res) => {
            const mqttConfig = this.configManager.getMQTTConfig();
            
            res.json({
                mqtt: {
                    host: mqttConfig.host,
                    port: mqttConfig.port,
                    ssl_port: this.config.mqttWsPort
                },
                api: {
                    host: 'localhost',
                    port: this.config.apiPort
                }
            });
        });

        // Certificate provisioning endpoint
        this.app.post('/cert', (req, res) => {
            const deviceId = req.body.deviceId || 'unknown';
            
            // Generate mock certificate response
            res.json({
                certificate: this.generateMockCertificate(deviceId),
                privateKey: this.generateMockPrivateKey(),
                caCert: this.generateMockCACert(),
                deviceId: deviceId,
                timestamp: Date.now()
            });
            
            console.log(`[CLOUD] Certificate requested for device: ${deviceId}`);
            this.io.emit('cloud-cert-request', {
                deviceId,
                timestamp: new Date().toISOString()
            });
        });

        // Device registration endpoint
        this.app.post('/device/register', (req, res) => {
            const deviceInfo = req.body;
            const deviceId = deviceInfo.deviceId || deviceInfo.uuid;
            
            // Register device
            this.connectedDevices.set(deviceId, {
                ...deviceInfo,
                registeredAt: new Date(),
                lastSeen: new Date(),
                status: 'registered'
            });
            
            res.json({
                success: true,
                deviceId: deviceId,
                mqttTopic: `device/${deviceId}`,
                messageTopic: 'topic_message'
            });
            
            console.log(`[CLOUD] Device registered: ${deviceId}`);
            this.io.emit('device-registered', {
                deviceId,
                deviceInfo,
                timestamp: new Date().toISOString()
            });
        });

        // Device status endpoint
        this.app.get('/device/:deviceId/status', (req, res) => {
            const deviceId = req.params.deviceId;
            const device = this.connectedDevices.get(deviceId);
            
            if (device) {
                res.json({
                    deviceId,
                    status: device.status,
                    lastSeen: device.lastSeen,
                    online: Date.now() - device.lastSeen.getTime() < 60000 // Online if seen within 1 minute
                });
            } else {
                res.status(404).json({ error: 'Device not found' });
            }
        });

        // List all devices
        this.app.get('/devices', (req, res) => {
            const devices = Array.from(this.connectedDevices.values()).map(device => ({
                deviceId: device.deviceId || device.uuid,
                status: device.status,
                registeredAt: device.registeredAt,
                lastSeen: device.lastSeen,
                online: Date.now() - device.lastSeen.getTime() < 60000
            }));
            
            res.json(devices);
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                connectedDevices: this.connectedDevices.size,
                mqttRunning: this.mqttServer !== null
            });
        });
    }

    // Start the LG cloud server
    async start() {
        if (this.isRunning) {
            return;
        }

        try {
            // Start API server
            await this.startAPIServer();
            
            // Only start MQTT monitoring if MQTT configuration is valid
            const mqttConfig = this.configManager.getMQTTConfig();
            if (mqttConfig.host && mqttConfig.port) {
                try {
                    await this.startMQTTMonitoring();
                } catch (mqttError) {
                    console.warn('MQTT monitoring failed to start:', mqttError.message);
                    // Continue without MQTT - API server can still work
                }
            } else {
                console.warn('MQTT configuration invalid, skipping MQTT monitoring');
            }
            
            this.isRunning = true;
            console.log('[CLOUD] LG Cloud Server started');
            
            this.io.emit('lg-cloud-started', {
                apiPort: this.config.apiPort,
                mqttPort: this.config.mqttPort,
                status: 'running',
                mqttConnected: this.mqttClient !== null
            });
            
        } catch (error) {
            console.error('Failed to start LG Cloud Server:', error);
            this.isRunning = false;
            
            // Clean up any partially started services
            if (this.apiServer) {
                this.apiServer.close();
                this.apiServer = null;
            }
            if (this.mqttClient) {
                this.mqttClient.end();
                this.mqttClient = null;
            }
            
            this.io.emit('lg-cloud-error', {
                error: error.message
            });
            this.io.emit('lg-cloud-stopped', {
                status: 'stopped'
            });
            
            throw error; // Re-throw to notify the caller
        }
    }

    // Stop the LG cloud server
    async stop() {
        if (!this.isRunning) {
            return;
        }

        try {
            // Stop API server
            if (this.apiServer) {
                this.apiServer.close();
                this.apiServer = null;
            }
            
            // Disconnect MQTT client
            if (this.mqttClient) {
                this.mqttClient.end();
                this.mqttClient = null;
            }
            
            this.isRunning = false;
            console.log('[CLOUD] LG Cloud Server stopped');
            
            this.io.emit('lg-cloud-stopped', {
                status: 'stopped'
            });
            
        } catch (error) {
            console.error('Error stopping LG Cloud Server:', error);
        }
    }

    // Start API server
    startAPIServer() {
        return new Promise((resolve, reject) => {
            this.apiServer = this.app.listen(this.config.apiPort, () => {
                console.log(`[CLOUD] API server listening on port ${this.config.apiPort}`);
                resolve();
            });
            
            this.apiServer.on('error', (error) => {
                console.error('[CLOUD] API server error:', error);
                if (error.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${this.config.apiPort} is already in use. Please stop any other services using this port.`));
                } else {
                    reject(error);
                }
            });
        });
    }

    // Start MQTT monitoring
    async startMQTTMonitoring() {
        const mqttConfig = this.configManager.getMQTTConfig();
        
        const connectOptions = {
            host: mqttConfig.host,
            port: mqttConfig.port,
            clientId: `lg-cloud-${Math.random().toString(16).substr(2, 8)}`,
            clean: true
        };

        if (mqttConfig.username) {
            connectOptions.username = mqttConfig.username;
            connectOptions.password = mqttConfig.password;
        }

        this.mqttClient = mqtt.connect(connectOptions);

        this.mqttClient.on('connect', () => {
            console.log('[CLOUD] Connected to MQTT broker');
            
            // Subscribe to device topics
            this.mqttClient.subscribe('topic_message', (error) => {
                if (error) {
                    console.error('Failed to subscribe to topic_message:', error);
                }
            });
            
            this.mqttClient.subscribe('device/+', (error) => {
                if (error) {
                    console.error('Failed to subscribe to device topics:', error);
                }
            });
        });

        this.mqttClient.on('message', (topic, message) => {
            this.handleMQTTMessage(topic, message);
        });

        this.mqttClient.on('error', (error) => {
            console.error('MQTT error:', error);
            this.io.emit('lg-cloud-mqtt-error', {
                error: error.message
            });
        });
    }

    // Handle MQTT messages from appliances
    handleMQTTMessage(topic, message) {
        try {
            const parsedMessage = this.cloudParser.parseMessage(topic, message.toString());
            
            // Update device last seen
            if (parsedMessage.deviceUuid) {
                const device = this.connectedDevices.get(parsedMessage.deviceUuid);
                if (device) {
                    device.lastSeen = new Date();
                    device.status = 'online';
                }
            }
            
            // Store message in history
            this.messageHistory.push({
                ...parsedMessage,
                timestamp: new Date().toISOString()
            });
            
            // Limit history size
            if (this.messageHistory.length > 1000) {
                this.messageHistory.shift();
            }
            
            // Emit to web clients
            this.io.emit('lg-cloud-message', parsedMessage);
            
            // Try to parse TLV data if present
            if (parsedMessage.data && parsedMessage.data.messageData) {
                try {
                    const tlvResult = this.tlvParser.parseHex(parsedMessage.data.messageData);
                    this.io.emit('lg-cloud-tlv', {
                        deviceId: parsedMessage.deviceUuid,
                        ...tlvResult,
                        timestamp: new Date().toISOString()
                    });
                } catch (tlvError) {
                    // TLV parsing failed, ignore
                }
            }
            
        } catch (error) {
            console.error('Error handling MQTT message:', error);
        }
    }

    // Generate mock certificate (for testing)
    generateMockCertificate(deviceId) {
        return `-----BEGIN CERTIFICATE-----
MIICertificateFor${deviceId}MockDataForTesting
-----END CERTIFICATE-----`;
    }

    // Generate mock private key (for testing)
    generateMockPrivateKey() {
        return `-----BEGIN PRIVATE KEY-----
MIIPrivateKeyMockDataForTesting
-----END PRIVATE KEY-----`;
    }

    // Generate mock CA certificate (for testing)
    generateMockCACert() {
        return `-----BEGIN CERTIFICATE-----
MIICACertificateMockDataForTesting
-----END CERTIFICATE-----`;
    }

    // Get server status
    getStatus() {
        return {
            running: this.isRunning,
            apiPort: this.config.apiPort,
            mqttPort: this.config.mqttPort,
            connectedDevices: this.connectedDevices.size,
            messageHistory: this.messageHistory.length
        };
    }

    // Get connected devices
    getConnectedDevices() {
        return Array.from(this.connectedDevices.values()).map(device => ({
            deviceId: device.deviceId || device.uuid,
            status: device.status,
            registeredAt: device.registeredAt,
            lastSeen: device.lastSeen,
            online: Date.now() - device.lastSeen.getTime() < 60000
        }));
    }

    // Get message history
    getMessageHistory(limit = 100) {
        return this.messageHistory.slice(-limit);
    }

    // Send message to device
    sendMessageToDevice(deviceId, message) {
        if (!this.mqttClient || !this.isRunning) {
            throw new Error('LG Cloud Server not running');
        }

        const topic = `device/${deviceId}`;
        const payload = JSON.stringify(message);
        
        this.mqttClient.publish(topic, payload, (error) => {
            if (error) {
                console.error('Failed to send message to device:', error);
            } else {
                console.log(`Message sent to device ${deviceId}`);
            }
        });
    }
}

export { LGCloudServer };