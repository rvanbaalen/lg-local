// Protocol parsers for LG ThinQ setup and cloud communication
// Based on rethink project patterns

class SetupProtocolParser {
    constructor() {
        this.commands = [
            'setDeviceInit',
            'getDeviceInfo', 
            'setCertInfo',
            'setApInfo',
            'releaseDev'
        ];
    }

    // Parse JSON setup message
    parseMessage(jsonString) {
        try {
            const message = JSON.parse(jsonString);
            
            const parsed = {
                raw: jsonString,
                type: message.type,
                command: message.cmd,
                data: message.data,
                timestamp: new Date().toISOString(),
                valid: this.validateMessage(message)
            };

            // Add command-specific parsing
            if (parsed.command) {
                parsed.commandInfo = this.parseCommandData(parsed.command, parsed.data);
            }

            return parsed;
        } catch (error) {
            return {
                raw: jsonString,
                error: error.message,
                valid: false,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Validate message structure
    validateMessage(message) {
        if (!message.type || !message.cmd) {
            return false;
        }

        if (!['request', 'response'].includes(message.type)) {
            return false;
        }

        return true;
    }

    // Parse command-specific data
    parseCommandData(command, data) {
        const info = {
            command,
            description: this.getCommandDescription(command),
            parameters: {}
        };

        if (!data) return info;

        switch (command) {
            case 'getDeviceInfo':
                info.parameters = {
                    deviceType: data.deviceType,
                    deviceId: data.deviceId,
                    modelName: data.modelName
                };
                break;
            
            case 'setCertInfo':
                info.parameters = {
                    hasKeyPair: !!data.keyPair,
                    hasCertificate: !!data.certificate
                };
                break;
            
            case 'setApInfo':
                info.parameters = {
                    ssid: data.ssid,
                    hasPassword: !!data.password,
                    security: data.security
                };
                break;
            
            default:
                info.parameters = data;
        }

        return info;
    }

    // Get human-readable command description
    getCommandDescription(command) {
        const descriptions = {
            'setDeviceInit': 'Initialize device setup',
            'getDeviceInfo': 'Retrieve device information',
            'setCertInfo': 'Set certificate information',
            'setApInfo': 'Configure access point information',
            'releaseDev': 'Release device from setup mode'
        };

        return descriptions[command] || 'Unknown command';
    }

    // Create setup message
    createMessage(type, command, data = {}) {
        return JSON.stringify({
            type,
            cmd: command,
            data
        });
    }
}

class CloudProtocolParser {
    constructor() {
        this.messageTypes = {
            'topic_message': 'Device to Cloud',
            'device_topic': 'Cloud to Device'
        };
    }

    // Parse MQTT message
    parseMessage(topic, payload) {
        try {
            const message = JSON.parse(payload);
            
            return {
                topic,
                payload: message,
                messageType: this.messageTypes[topic] || 'Unknown',
                timestamp: new Date().toISOString(),
                deviceUuid: message.deviceUuid,
                data: this.parsePayloadData(message.data),
                valid: true
            };
        } catch (error) {
            return {
                topic,
                payload: payload.toString(),
                error: error.message,
                valid: false,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Parse hex-encoded payload data
    parsePayloadData(hexData) {
        if (!hexData || typeof hexData !== 'string') {
            return null;
        }

        try {
            const buffer = Buffer.from(hexData, 'hex');
            
            if (buffer.length < 2) {
                return { raw: hexData, error: 'Data too short' };
            }

            // Extract delivery mode from first two bytes
            const deliveryMode = buffer.readUInt16BE(0);
            const messageData = buffer.slice(2);

            return {
                raw: hexData,
                deliveryMode,
                messageData: messageData.toString('hex'),
                messageLength: messageData.length,
                reliable: (deliveryMode & 0x8000) !== 0
            };
        } catch (error) {
            return {
                raw: hexData,
                error: error.message
            };
        }
    }

    // Create MQTT message
    createMessage(deviceUuid, data, reliable = false) {
        const deliveryMode = reliable ? 0x8000 : 0x0000;
        const buffer = Buffer.alloc(2 + data.length);
        buffer.writeUInt16BE(deliveryMode, 0);
        Buffer.from(data, 'hex').copy(buffer, 2);

        return JSON.stringify({
            deviceUuid,
            data: buffer.toString('hex'),
            timestamp: Date.now()
        });
    }
}

export {
    SetupProtocolParser,
    CloudProtocolParser
};