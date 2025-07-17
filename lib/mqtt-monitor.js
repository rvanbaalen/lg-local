// MQTT monitoring capabilities for LG ThinQ devices
// Based on rethink project patterns

import mqtt from 'mqtt';
import { CloudProtocolParser } from './protocol.js';
import { TLVParser } from './tlv.js';

class MQTTMonitor {
    constructor(socketServer) {
        this.io = socketServer;
        this.client = null;
        this.isConnected = false;
        this.isMonitoring = false;
        this.cloudParser = new CloudProtocolParser();
        this.tlvParser = new TLVParser();
        
        // Default MQTT configuration
        this.config = {
            host: 'localhost',
            port: 1883,
            clientId: `lg-debug-tool-${Math.random().toString(16).substr(2, 8)}`,
            username: null,
            password: null,
            topics: {
                deviceMessage: 'topic_message',
                deviceTopic: 'device_topic/+' // Subscribe to all device topics
            }
        };
    }

    // Connect to MQTT broker
    async connect(config = {}) {
        try {
            // Merge provided config with defaults
            this.config = { ...this.config, ...config };
            
            // Validate configuration
            if (!this.config.host) {
                throw new Error('MQTT host is required');
            }
            
            const connectOptions = {
                clientId: this.config.clientId,
                clean: true,
                connectTimeout: 5000,
                reconnectPeriod: 0 // Disable auto-reconnect to prevent endless loops
            };

            if (this.config.username) {
                connectOptions.username = this.config.username;
                connectOptions.password = this.config.password;
            }

            const brokerUrl = `mqtt://${this.config.host}:${this.config.port}`;
            this.client = mqtt.connect(brokerUrl, connectOptions);

            this.client.on('connect', () => {
                console.log('Connected to MQTT broker');
                this.isConnected = true;
                this.io.emit('mqtt-connected', { 
                    status: 'connected', 
                    broker: brokerUrl 
                });
            });

            this.client.on('error', (error) => {
                console.error('MQTT connection error:', error);
                this.isConnected = false;
                this.io.emit('mqtt-error', { 
                    error: error.message 
                });
            });

            this.client.on('close', () => {
                console.log('MQTT connection closed');
                this.isConnected = false;
                this.io.emit('mqtt-disconnected', { 
                    status: 'disconnected' 
                });
            });

            this.client.on('message', (topic, message) => {
                this.handleMessage(topic, message);
            });

            return true;
        } catch (error) {
            console.error('Failed to connect to MQTT broker:', error);
            return false;
        }
    }

    // Disconnect from MQTT broker
    disconnect() {
        if (this.client) {
            this.client.end();
            this.client = null;
        }
        this.isConnected = false;
        this.isMonitoring = false;
    }

    // Start monitoring MQTT messages
    startMonitoring() {
        if (!this.isConnected) {
            throw new Error('Not connected to MQTT broker');
        }

        if (this.isMonitoring) {
            return;
        }

        // Subscribe to relevant topics
        this.client.subscribe(this.config.topics.deviceMessage, (error) => {
            if (error) {
                console.error('Failed to subscribe to device messages:', error);
                return;
            }
            console.log('Subscribed to device messages');
        });

        this.client.subscribe(this.config.topics.deviceTopic, (error) => {
            if (error) {
                console.error('Failed to subscribe to device topics:', error);
                return;
            }
            console.log('Subscribed to device topics');
        });

        this.isMonitoring = true;
        this.io.emit('mqtt-monitoring-started', { 
            status: 'monitoring' 
        });
    }

    // Stop monitoring MQTT messages
    stopMonitoring() {
        if (!this.isConnected || !this.isMonitoring) {
            return;
        }

        // Unsubscribe from topics
        this.client.unsubscribe(this.config.topics.deviceMessage);
        this.client.unsubscribe(this.config.topics.deviceTopic);

        this.isMonitoring = false;
        this.io.emit('mqtt-monitoring-stopped', { 
            status: 'stopped' 
        });
    }

    // Handle incoming MQTT messages
    handleMessage(topic, message) {
        if (!this.isMonitoring) {
            return;
        }

        try {
            const timestamp = new Date().toISOString();
            const messageString = message.toString();

            // Parse cloud protocol message
            const cloudMessage = this.cloudParser.parseMessage(topic, messageString);
            
            // Emit cloud message to clients
            this.io.emit('cloud-message', {
                ...cloudMessage,
                timestamp
            });

            // If message contains hex data, try to parse as TLV
            if (cloudMessage.data && cloudMessage.data.messageData) {
                try {
                    const tlvResult = this.tlvParser.parseHex(cloudMessage.data.messageData);
                    
                    this.io.emit('tlv-message', {
                        hex: cloudMessage.data.messageData,
                        segments: tlvResult.segments,
                        totalLength: tlvResult.totalLength,
                        remainingBytes: tlvResult.remainingBytes,
                        timestamp,
                        source: 'mqtt'
                    });
                } catch (tlvError) {
                    // TLV parsing failed, but that's okay
                    console.log('TLV parsing failed for message:', tlvError.message);
                }
            }

        } catch (error) {
            console.error('Error handling MQTT message:', error);
            this.io.emit('mqtt-error', {
                error: `Message handling error: ${error.message}`,
                topic,
                message: message.toString()
            });
        }
    }

    // Publish a message to MQTT broker
    publish(topic, message) {
        if (!this.isConnected) {
            throw new Error('Not connected to MQTT broker');
        }

        return new Promise((resolve, reject) => {
            this.client.publish(topic, message, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    // Get connection status
    getStatus() {
        return {
            connected: this.isConnected,
            monitoring: this.isMonitoring,
            broker: this.isConnected ? `${this.config.host}:${this.config.port}` : null
        };
    }
}

export { MQTTMonitor };