// LG ThinQ Debug Tool - Frontend JavaScript

class DebugTool {
    constructor() {
        this.socket = null;
        this.monitoring = false;
        this.messageCount = 0;
        this.filters = {
            setup: true,
            cloud: true,
            tlv: true
        };
        
        this.init();
    }

    init() {
        this.initSocket();
        this.initEventListeners();
        this.updateConnectionStatus(false);
    }

    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
            this.addMessage('info', 'Connected to debug tool server');
        });
        
        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
            this.addMessage('error', 'Disconnected from server');
        });
        
        this.socket.on('monitoring-started', (data) => {
            this.monitoring = true;
            this.updateMonitoringControls();
            this.addMessage('info', 'Protocol monitoring started');
        });
        
        this.socket.on('monitoring-stopped', (data) => {
            this.monitoring = false;
            this.updateMonitoringControls();
            this.addMessage('info', 'Protocol monitoring stopped');
        });
        
        this.socket.on('setup-message', (data) => {
            this.handleSetupMessage(data);
        });
        
        this.socket.on('cloud-message', (data) => {
            this.handleCloudMessage(data);
        });
        
        this.socket.on('tlv-message', (data) => {
            this.handleTLVMessage(data);
        });
    }

    initEventListeners() {
        // Monitoring controls
        document.getElementById('start-monitoring').addEventListener('click', () => {
            this.startMonitoring();
        });
        
        document.getElementById('stop-monitoring').addEventListener('click', () => {
            this.stopMonitoring();
        });
        
        document.getElementById('clear-messages').addEventListener('click', () => {
            this.clearMessages();
        });
        
        // Filter controls
        document.getElementById('filter-setup').addEventListener('change', (e) => {
            this.filters.setup = e.target.checked;
            this.applyFilters();
        });
        
        document.getElementById('filter-cloud').addEventListener('change', (e) => {
            this.filters.cloud = e.target.checked;
            this.applyFilters();
        });
        
        document.getElementById('filter-tlv').addEventListener('change', (e) => {
            this.filters.tlv = e.target.checked;
            this.applyFilters();
        });
        
        // Parser controls
        document.getElementById('parse-tlv').addEventListener('click', () => {
            this.parseTLV();
        });
        
        document.getElementById('parse-json').addEventListener('click', () => {
            this.parseJSON();
        });
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        statusElement.textContent = connected ? 'Connected' : 'Disconnected';
        statusElement.className = connected ? 'connected' : '';
    }

    updateMonitoringControls() {
        const startBtn = document.getElementById('start-monitoring');
        const stopBtn = document.getElementById('stop-monitoring');
        
        startBtn.disabled = this.monitoring;
        stopBtn.disabled = !this.monitoring;
    }

    startMonitoring() {
        if (this.socket) {
            this.socket.emit('start-monitoring', {
                filters: this.filters
            });
        }
    }

    stopMonitoring() {
        if (this.socket) {
            this.socket.emit('stop-monitoring');
        }
    }

    clearMessages() {
        const container = document.getElementById('message-container');
        container.innerHTML = '<div class="message info"><span class="timestamp">Ready</span><span class="content">Messages cleared</span></div>';
        this.messageCount = 0;
    }

    addMessage(type, content, timestamp = null) {
        const container = document.getElementById('message-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const time = timestamp || new Date().toLocaleTimeString();
        messageDiv.innerHTML = `
            <span class="timestamp">${time}</span>
            <span class="content">${this.escapeHtml(content)}</span>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
        
        this.messageCount++;
        
        // Limit messages to prevent memory issues
        if (this.messageCount > 1000) {
            const firstMessage = container.firstChild;
            if (firstMessage) {
                container.removeChild(firstMessage);
            }
        }
    }

    handleSetupMessage(data) {
        if (!this.filters.setup) return;
        
        const content = `[SETUP] ${data.type} ${data.command}: ${JSON.stringify(data.data)}`;
        this.addMessage('setup', content, data.timestamp);
        
        this.updateDeviceState('setup-phase', data.command);
        this.updateDeviceState('last-message', data.timestamp);
    }

    handleCloudMessage(data) {
        if (!this.filters.cloud) return;
        
        const content = `[CLOUD] ${data.topic}: ${JSON.stringify(data.payload)}`;
        this.addMessage('cloud', content, data.timestamp);
        
        this.updateDeviceState('last-message', data.timestamp);
    }

    handleTLVMessage(data) {
        if (!this.filters.tlv) return;
        
        const content = `[TLV] Segments: ${data.segments.length}, Data: ${data.hex}`;
        this.addMessage('tlv', content, data.timestamp);
        
        this.updateDeviceState('last-message', data.timestamp);
    }

    updateDeviceState(key, value) {
        const element = document.getElementById(key);
        if (element) {
            element.textContent = value;
        }
    }

    parseTLV() {
        const input = document.getElementById('tlv-input').value.trim();
        const output = document.getElementById('tlv-output');
        
        if (!input) {
            output.textContent = 'Please enter hex data to parse';
            return;
        }
        
        // Send to server for parsing
        if (this.socket) {
            this.socket.emit('parse-tlv', { data: input }, (response) => {
                if (response.error) {
                    output.textContent = `Error: ${response.error}`;
                } else {
                    output.textContent = this.formatTLVOutput(response);
                }
            });
        }
    }

    parseJSON() {
        const input = document.getElementById('json-input').value.trim();
        const output = document.getElementById('json-output');
        
        if (!input) {
            output.textContent = 'Please enter JSON data to parse';
            return;
        }
        
        // Send to server for parsing
        if (this.socket) {
            this.socket.emit('parse-json', { data: input }, (response) => {
                if (response.error) {
                    output.textContent = `Error: ${response.error}`;
                } else {
                    output.textContent = this.formatJSONOutput(response);
                }
            });
        }
    }

    formatTLVOutput(data) {
        let output = `TLV Segments (${data.segments.length}):\\n`;
        
        data.segments.forEach((segment, index) => {
            output += `\\n${index + 1}. Type: ${segment.type} (0x${segment.type.toString(16).padStart(2, '0')})\\n`;
            output += `   Length: ${segment.length}\\n`;
            output += `   Value (hex): ${segment.valueHex}\\n`;
            if (segment.valueString) {
                output += `   Value (string): "${segment.valueString}"\\n`;
            }
        });
        
        if (data.remainingBytes > 0) {
            output += `\\nRemaining bytes: ${data.remainingBytes}`;
        }
        
        return output;
    }

    formatJSONOutput(data) {
        let output = `Message Type: ${data.type}\\n`;
        output += `Command: ${data.command}\\n`;
        output += `Valid: ${data.valid}\\n`;
        output += `Timestamp: ${data.timestamp}\\n`;
        
        if (data.commandInfo) {
            output += `\\nCommand Info:\\n`;
            output += `Description: ${data.commandInfo.description}\\n`;
            output += `Parameters: ${JSON.stringify(data.commandInfo.parameters, null, 2)}`;
        }
        
        return output;
    }

    applyFilters() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            const isSetup = message.classList.contains('setup');
            const isCloud = message.classList.contains('cloud');
            const isTLV = message.classList.contains('tlv');
            const isOther = !isSetup && !isCloud && !isTLV;
            
            let show = isOther; // Always show info/error messages
            
            if (isSetup) show = this.filters.setup;
            if (isCloud) show = this.filters.cloud;
            if (isTLV) show = this.filters.tlv;
            
            message.style.display = show ? 'flex' : 'none';
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the debug tool when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DebugTool();
});