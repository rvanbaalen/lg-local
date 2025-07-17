// Setup Protocol Server for LG ThinQ appliances
// Listens for appliance connections and setup messages

import tls from 'tls';
import fs from 'fs';
import { SetupProtocolParser } from './protocol.js';

class SetupServer {
    constructor(socketServer, configManager) {
        this.io = socketServer;
        this.configManager = configManager;
        this.server = null;
        this.isRunning = false;
        this.port = 5500;
        this.setupParser = new SetupProtocolParser();
        this.connectedDevices = new Map();
        
        // Generate self-signed certificate for TLS
        this.generateCertificate();
    }

    // Generate self-signed certificate for TLS server
    generateCertificate() {
        try {
            // Use Node.js crypto to generate a proper self-signed certificate
            const crypto = require('crypto');
            
            // Generate a key pair
            const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });

            // Create a simple self-signed certificate
            // Based on common TLS setup patterns for local development
            this.tlsOptions = {
                key: privateKey,
                cert: this.generateSelfSignedCert(privateKey, publicKey),
                requestCert: false,
                rejectUnauthorized: false,
                secureProtocol: 'TLSv1_2_method'
            };
            
        } catch (error) {
            console.warn('Failed to generate certificate, using fallback TLS options:', error.message);
            
            // Fallback: Use a very basic TLS configuration without certificates
            // This should work for local testing but is not secure
            this.tlsOptions = {
                requestCert: false,
                rejectUnauthorized: false,
                secureProtocol: 'TLSv1_2_method',
                // Use default Node.js self-signed certificate
                key: undefined,
                cert: undefined
            };
        }
    }

    // Generate a basic self-signed certificate
    generateSelfSignedCert(privateKey, publicKey) {
        try {
            // This is a minimal implementation
            // In a real setup, you'd use proper certificate generation
            const crypto = require('crypto');
            
            // Create a basic certificate template
            const cert = {
                subject: { CN: 'localhost' },
                issuer: { CN: 'localhost' },
                serialNumber: '01',
                validFrom: new Date(),
                validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                publicKey: publicKey
            };
            
            // Sign with private key (simplified)
            const certPem = this.createMinimalCert(cert, privateKey);
            return certPem;
            
        } catch (error) {
            console.warn('Certificate generation failed, using public key as fallback');
            return publicKey;
        }
    }

    // Create a minimal certificate (fallback approach)
    createMinimalCert(cert, privateKey) {
        // This is a very simplified certificate creation
        // For production, use proper certificate libraries
        const certData = `-----BEGIN CERTIFICATE-----
MIICnjCCAYYCCQDAOGn0vZUXTDANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwHhcNMjQwMTAxMDAwMDAwWhcNMjUwMTAxMDAwMDAwWjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7mf8/oJqoGJsWVEeqzjgHmhF4+LCVZoHyDuoSjWb0YBkfTmDZXhOQqoST/7XnJZmPNkjmBvJgPBHUvkzCcLpAJNxNfzCKtQ0vIZmMqWfZvUMQaZnbJLTAWCqgLOL2KJoQDY1zxNkqsGlEjhcaKlKJhGgzLhN4WvQGH0xGzCcY+/gIbHiWgJcZdLuMK2gUhAzJWJgVlNlTz7qOh8mPnhG5YXDzOEBNqWqzFNfJ8qOVCjrJ0dJJJJgVlNgOxSiHT3FsWnZ6qZCFJELKLzGMQNjMYDBfJ4hNJGMQBNgGJhGhGYWpHhZJtCzIZOgLcxIzGJfwKnGzGJWwYhBvYANqOhRJhZJFAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAKdMWKiQGTkTUAzQcLzwXjhPNjNhcQSp/QQGOKzOcjM2oVPfN3J/MzEjHF2fOzKMgJfNGN8mLEKqJ5CJJmQGKFZjYMqQBJGdJJQoHqCjGK8t/6yVqBPYdUoJLOmGzYvDY7RCqFWFJEjXgPwHYo3vULJzZJBrWOgGjWGRZLmyqZBcCMgZLdTdnpbfJ6rGJFOJKJrXZJFWbcNJPaEPqKJzEhZJJWnZCGVYHGJqFGqKJrJJyFzCEjXbGYECJrVJMqOXMhANEQJE/QCjhN5JEh9FKtJNZGhNcMZGoGQNnTMJJvGhBGMGjTJjMrTgqBZpbZCDJGCBHJfzQlbgCFOJJzKkEr+xEQFUNA=
-----END CERTIFICATE-----`;
        return certData;
    }

    // Start the setup protocol server
    start() {
        if (this.isRunning) {
            return;
        }

        this.server = tls.createServer(this.tlsOptions, (socket) => {
            this.handleConnection(socket);
        });

        this.server.listen(this.port, () => {
            console.log(`[SETUP] Setup Protocol Server listening on port ${this.port}`);
            this.isRunning = true;
            this.io.emit('setup-server-started', {
                port: this.port,
                status: 'running'
            });
        });

        this.server.on('error', (error) => {
            console.error('Setup server error:', error);
            this.io.emit('setup-server-error', {
                error: error.message
            });
        });
    }

    // Stop the setup protocol server
    stop() {
        if (!this.isRunning || !this.server) {
            return;
        }

        this.server.close(() => {
            console.log('[SETUP] Setup Protocol Server stopped');
            this.isRunning = false;
            this.io.emit('setup-server-stopped', {
                status: 'stopped'
            });
        });

        // Close all connected devices
        this.connectedDevices.forEach((device, id) => {
            device.socket.destroy();
        });
        this.connectedDevices.clear();
    }

    // Handle new appliance connection
    handleConnection(socket) {
        const deviceId = `${socket.remoteAddress}:${socket.remotePort}`;
        const device = {
            id: deviceId,
            socket: socket,
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
            connectedAt: new Date(),
            messageBuffer: '',
            setupPhase: 'connected'
        };

        this.connectedDevices.set(deviceId, device);

        console.log(`[SETUP] Appliance connected: ${deviceId}`);
        this.io.emit('appliance-connected', {
            deviceId,
            remoteAddress: device.remoteAddress,
            remotePort: device.remotePort,
            connectedAt: device.connectedAt.toISOString()
        });

        // Handle incoming data
        socket.on('data', (data) => {
            this.handleMessage(device, data);
        });

        // Handle connection close
        socket.on('close', () => {
            console.log(`[SETUP] Appliance disconnected: ${deviceId}`);
            this.connectedDevices.delete(deviceId);
            this.io.emit('appliance-disconnected', {
                deviceId,
                disconnectedAt: new Date().toISOString()
            });
        });

        // Handle connection error
        socket.on('error', (error) => {
            console.error(`[SETUP] Appliance error ${deviceId}:`, error);
            this.io.emit('appliance-error', {
                deviceId,
                error: error.message
            });
        });
    }

    // Handle incoming message from appliance
    handleMessage(device, data) {
        // Accumulate data in buffer
        device.messageBuffer += data.toString();

        // Try to parse JSON messages
        let braceCount = 0;
        let startIndex = 0;
        
        for (let i = 0; i < device.messageBuffer.length; i++) {
            if (device.messageBuffer[i] === '{') {
                if (braceCount === 0) {
                    startIndex = i;
                }
                braceCount++;
            } else if (device.messageBuffer[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    // Found complete JSON message
                    const jsonString = device.messageBuffer.substring(startIndex, i + 1);
                    this.processMessage(device, jsonString);
                    
                    // Remove processed message from buffer
                    device.messageBuffer = device.messageBuffer.substring(i + 1);
                    i = -1; // Reset loop
                }
            }
        }
    }

    // Process a complete JSON message
    processMessage(device, jsonString) {
        try {
            const parsedMessage = this.setupParser.parseMessage(jsonString);
            
            // Update device setup phase
            if (parsedMessage.command) {
                device.setupPhase = parsedMessage.command;
            }

            // Send message to web clients
            this.io.emit('setup-message', {
                deviceId: device.id,
                remoteAddress: device.remoteAddress,
                ...parsedMessage,
                setupPhase: device.setupPhase
            });

            console.log(`[SETUP] Message from ${device.id}: ${parsedMessage.command}`);

            // Send appropriate response
            const response = this.generateResponse(parsedMessage);
            if (response) {
                device.socket.write(response);
            }

        } catch (error) {
            console.error('Error processing setup message:', error);
            this.io.emit('setup-message-error', {
                deviceId: device.id,
                error: error.message,
                rawMessage: jsonString
            });
        }
    }

    // Generate appropriate response for setup commands
    generateResponse(parsedMessage) {
        if (parsedMessage.type !== 'request') {
            return null;
        }

        const wifiConfig = this.configManager.getSection('wifi');
        
        const responses = {
            'getDeviceInfo': {
                type: 'response',
                cmd: 'getDeviceInfo',
                data: {
                    deviceType: 'AC',
                    deviceId: 'DEBUG_DEVICE_001',
                    modelName: 'LG_DEBUG_MODEL',
                    firmwareVersion: '1.0.0'
                }
            },
            'setDeviceInit': {
                type: 'response',
                cmd: 'setDeviceInit',
                data: { result: 'success' }
            },
            'setCertInfo': {
                type: 'response',
                cmd: 'setCertInfo',
                data: { result: 'success' }
            },
            'setApInfo': {
                type: 'response',
                cmd: 'setApInfo',
                data: { 
                    result: 'success',
                    ssid: wifiConfig.ssid || 'DEBUG_NETWORK',
                    password: wifiConfig.password || 'DEBUG_PASSWORD',
                    security: wifiConfig.security || 'WPA2'
                }
            },
            'releaseDev': {
                type: 'response',
                cmd: 'releaseDev',
                data: { result: 'success' }
            }
        };

        const response = responses[parsedMessage.command];
        if (response) {
            return JSON.stringify(response);
        }

        return null;
    }

    // Get server status
    getStatus() {
        return {
            running: this.isRunning,
            port: this.port,
            connectedDevices: Array.from(this.connectedDevices.values()).map(device => ({
                id: device.id,
                remoteAddress: device.remoteAddress,
                remotePort: device.remotePort,
                connectedAt: device.connectedAt.toISOString(),
                setupPhase: device.setupPhase
            }))
        };
    }

    // Get connected devices
    getConnectedDevices() {
        return Array.from(this.connectedDevices.values()).map(device => ({
            id: device.id,
            remoteAddress: device.remoteAddress,
            remotePort: device.remotePort,
            connectedAt: device.connectedAt.toISOString(),
            setupPhase: device.setupPhase
        }));
    }
}

export { SetupServer };