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
        // This is a minimal certificate for testing
        // In production, you would use proper certificates
        this.tlsOptions = {
            key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC4f+4+7kSvGKrv
8VTpTOIkYgXhE5gNqP/oSZzUQlONzj7bKdqQ0J4aKzxCjY2BvJXOY2lXmLQ0O4sG
bJlZbXnKHJBjRqt/mRGaIEMqnVOKrfZ6kJiOmOTFmJ7LnLOCNdXC3PNWzBCbKzBl
8sMoKLLQ6JgwFHOdFcRJ2gDrXXPzXJOiOKoJrJCmLkJLKLQaJBFGxlOt2JkzpJKl
J7HfJ6cNjKYUbmBQLKKLKRp6J5WEKOj/ZLmFUYJNZgDuGWkqMlBb6bGGfq6+4ZhZ
J6KGjNzXhZGNzg7nMQJ5lkJwNhXQgMGdKJHi2KhgXzM3PmNyGkRJjLZmk+hcFTjg
X4pBbKYvAgMBAAECggEBAKLJHWPGFGaZGjcmYBQIhpgvVAjdyZJgJZmhCEuLgzqH
7QaJ5KqM8MjJjbWxcPmjKJCDVRQaOFcgOQhEoVJvhyJgNjWVgJrLfJ2PjGvQGdTY
YzXmLQkYqEb0zFrPQbQJsEqJ5m8GYcCqJhJ2JoZMgvZYJdBzRLXzMFEgJjgwlULv
LDgqJlMYZoOZBjyKZcLnzTVjjOyMBELT3qHkYNJrTnOWNlTpCyLNKYJ2k5OGdFJd
LkJfBQTfGQmLpL4sUWwbKnqQ8xbZcGvfYwJVfgaUVEVJYZjGJJdm2dIcNEYoUJHQ
RJsYBJgdPfEWDfDOj8gEjfS7JwJbLT5xKNqGZqwFJWECgYEA4WLdOHUvbD6cGCJ+
2mP2GqJBJ4YM3YoLqG6MJGNXMjlKqEWZHnWGkMvJNgUZQCpJFJMDpRVfCKJZZZYc
4dOvMFJUkOcGH3GnmBHtYMJUyJ8WdFJqzN9e7LCdkHLB1vOLxEQ1jrH+vEhgZeFC
5+QrJqwTDdPvUgHLwGfzNtf1X9sCgYEA0WZZlKvmFJ3XQkIKKOJYJUhQQtCCuQkx
HqbIbgqhJL5WBwJoGqgwMmGZbOJFgXvKwlj5lJGGpJKcZpEGgFDnqCUFgQMhHCOG
tGNhzP6rVvYoLCKGDdJLcgMQnLKOlqUKJEqZKFJ3kgVYLkJ3gYjlzfJ2GqYhwJrT
6LhQ5hxJZCECgYEA3DXZJVfpOqE3gVwOLjZQ2sJvqwMJZXKqBJJQJCdGQKlQ2EjJ
1AqKOJdGkLkpZN8yoEAJb4mUQULU3HT0SJYJqjf8fBvnXgNGEZNYQpQ4EDwQZPnz
JQJrVfGJCkYEOdH3PEMdL6ZbZNBqC1XP0kJQkEFEJkgOzJDfCFuJI3pDYmECgYEA
zLJfCTpNGqQ4QjmAjzBjYNQIhwJQNZf8U5QOOEZPuP7jJJJQKXwJXXWjMKJHKLGL
nJVhgzQKYjHCbO6vfOWEfJDJKrLdZLJqJMjNnMOOB2GgQKrJXkWEKEfgqAyLzJ/8
9hCfnS+hXXYgkVQKdNy6J5tLJAFJFgIcMGqRgpJPuAECgYEA2SQcPlJYmJQpPRJ1
WNqPWMQ0vJhqJ8HkJKdYhHjLDjYJgGNJNzBYeRJzqhgPEJgYOJYuEBgbHZGqKHKJ
OLW1yJ3YMFCHKm3wVYJKvbOJLJqVhZqIoLgNLGONMJQNZqGdnQJTRJJjZqIUJGZO
YqJzYhMFJpqgJEOJqUJlJrQFJt0=
-----END PRIVATE KEY-----`,
            cert: `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAL9fYHZZXzKaMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjQwMTAxMDAwMDAwWhcNMjUwMTAxMDAwMDAwWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAuH/uPu5ErxBq7/FU6UziJGIF4ROYDaj/6Emc1EJTjc4+2ynaFNCeGis8
Qo2NgbyVzmNpV5i0NDuLBmyZWW15yhyQY0arf5kRmiBDKp1Tiq32epCYjpjkxZie
y5yzgjXVwtzZVswQmyswZfLDKCiy0OiYMBRznRXESdoA611z81yTojiqCayQpi5C
Syi0GiQRRsZTrdiZM6SSpSex3yenDYymFG5gUCyiiykaeieVhCjo/2S5hVGCTWYA
7hlpKjJQW+mxhn6uvuGYWSeihozc14WRjc4O5zECeZZCcDYV0IDBnSiR4tioYF8z
Nz5jchpESYy2ZpPoXBU44F+KQWymLwIDAQABo1AwTjAdBgNVHQ4EFgQUXbCQGvRj
gHHmKGxXZwi/5cTr5QQwHwYDVR0jBBgwFoAUXbCQGvRjgHHmKGxXZwi/5cTr5QQw
DAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAYDuBCQNfPB7qWjMZbZ7F
kRBGlQlFvYmqJvJLPmfJoSLjdT0NhLTXLcGKCbmJ7BnSJ4OjJjX9eL9LMHkpJ6H7
VLkRwWq9NRj1NvfGzHzKUlVXd0G4A0vFjCMwmWJaJJKsLm9nSQ+qhHUOLJvYJrHJ
3VqnhDUDFUvKQO1mYH7W5jP9EzKJhMKUQVqTdJCZqJGzRU8cUvMUzBPqtgTb8tYD
HmNWzKuaJPJkzCGsYhU1JFGvKJKBkJzCnCq/VzrBGCvVmN/MvjVQ1qJGjYaD3hfO
gLdVKOJGJsN6FXgfhOtCdKkzQCnXJOlnGwP7GnBqMmz8XQu7mE4lJYLmyKfKKgmq
IuDqaIH8XgJhHRqOSfaYJg==
-----END CERTIFICATE-----`,
            requestCert: false,
            rejectUnauthorized: false
        };
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