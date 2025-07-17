// Configuration management for LG ThinQ Local Server
import fs from 'fs';
import path from 'path';

class ConfigManager {
    constructor(configPath = 'config.json') {
        this.configPath = path.resolve(configPath);
        this.config = this.loadConfig();
    }

    // Load configuration from file
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }

        // Return default configuration if file doesn't exist or is invalid
        return this.getDefaultConfig();
    }

    // Save configuration to file
    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 4));
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    // Get default configuration
    getDefaultConfig() {
        return {
            mqtt: {
                url: '',  // Empty by default - user must configure
                username: '',
                password: '',
                discovery_prefix: 'homeassistant',
                rethink_prefix: 'rethink',
                port: 1884,
                mqtts_port: 8884
            },
            server: {
                port: 3001,
                host: 'localhost'
            },
            monitoring: {
                auto_start: false,
                buffer_size: 1000,
                log_level: 'info'
            },
            wifi: {
                ssid: '',
                password: '',
                security: 'WPA2'
            },
            services: {
                webui: {
                    host: 'localhost',
                    port: 3001
                },
                setupServer: {
                    host: 'localhost',
                    port: 5501,
                    tlsPort: 5500
                },
                lgCloud: {
                    host: 'localhost',
                    port: 8080,
                    apiPort: 8080
                }
            }
        };
    }

    // Get full configuration
    getConfig() {
        return this.config;
    }

    // Get specific configuration section
    getSection(section) {
        return this.config[section] || {};
    }

    // Update configuration section
    updateSection(section, data) {
        if (!this.config[section]) {
            this.config[section] = {};
        }
        
        this.config[section] = { ...this.config[section], ...data };
        return this.saveConfig();
    }

    // Update specific configuration value
    updateValue(section, key, value) {
        if (!this.config[section]) {
            this.config[section] = {};
        }
        
        this.config[section][key] = value;
        return this.saveConfig();
    }

    // Get MQTT configuration for connection
    getMQTTConfig() {
        const mqttConfig = this.getSection('mqtt');
        
        // Return null if no URL configured
        if (!mqttConfig.url) {
            return {
                host: null,
                port: null,
                protocol: null,
                username: mqttConfig.username || null,
                password: mqttConfig.password || null,
                discovery_prefix: mqttConfig.discovery_prefix,
                rethink_prefix: mqttConfig.rethink_prefix,
                mqtts_port: mqttConfig.mqtts_port
            };
        }
        
        try {
            // Parse URL to extract host and port
            const url = new URL(mqttConfig.url);
            
            return {
                host: url.hostname,
                port: parseInt(url.port) || 1883,
                protocol: url.protocol.replace(':', ''),
                username: mqttConfig.username || null,
                password: mqttConfig.password || null,
                discovery_prefix: mqttConfig.discovery_prefix,
                rethink_prefix: mqttConfig.rethink_prefix,
                mqtts_port: mqttConfig.mqtts_port
            };
        } catch (error) {
            console.error('Invalid MQTT URL:', mqttConfig.url);
            return {
                host: null,
                port: null,
                protocol: null,
                username: mqttConfig.username || null,
                password: mqttConfig.password || null,
                discovery_prefix: mqttConfig.discovery_prefix,
                rethink_prefix: mqttConfig.rethink_prefix,
                mqtts_port: mqttConfig.mqtts_port
            };
        }
    }

    // Validate MQTT configuration
    validateMQTTConfig(config) {
        const errors = [];
        
        if (!config.url) {
            errors.push('MQTT URL is required');
        } else {
            try {
                new URL(config.url);
            } catch (error) {
                errors.push('Invalid MQTT URL format');
            }
        }
        
        if (config.port && (config.port < 1 || config.port > 65535)) {
            errors.push('Port must be between 1 and 65535');
        }
        
        if (config.mqtts_port && (config.mqtts_port < 1 || config.mqtts_port > 65535)) {
            errors.push('MQTTS port must be between 1 and 65535');
        }
        
        return errors;
    }

    // Reset configuration to defaults
    resetConfig() {
        this.config = this.getDefaultConfig();
        return this.saveConfig();
    }

    // Get configuration file path
    getConfigPath() {
        return this.configPath;
    }
}

export { ConfigManager };