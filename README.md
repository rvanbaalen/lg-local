# LG ThinQ Local Server

A local server replacement for LG ThinQ device cloud communications, built with Node.js, React, and TypeScript. This server acts as a complete replacement for LG's cloud services, allowing local control of LG ThinQ devices without requiring internet connectivity.

## Features

- **Local Cloud Replacement**: Complete replacement for LG ThinQ cloud services
- **Distributed Architecture**: Run services on different machines with configurable endpoints
- **React TypeScript Frontend**: Modern web interface with real-time updates
- **Protocol Monitoring**: Real-time monitoring of LG ThinQ device communications
- **TLV Parser**: Parse and visualize Type-Length-Value formatted messages
- **JSON Protocol Parser**: Parse setup protocol messages with command analysis
- **MQTT Integration**: Monitor and handle MQTT messages from LG ThinQ devices
- **Service Management**: Start/stop local services or connect to remote instances
- **Real-time Communication**: Socket.io-based real-time updates across all services

## Based on Research

This project is inspired by and aims to serve as a replacement for the [rethink project](https://github.com/anszom/rethink), which reverse-engineered LG ThinQ device communication protocols. Before implementing any protocol features, consult the [rethink project documentation](https://github.com/anszom/rethink/wiki) for detailed protocol specifications.

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd lglocal
```

2. Install dependencies:
```bash
npm install
```

3. Configure services (optional):
```bash
npm run configure
```

## Usage

### Quick Start (Single Machine)

Start the web UI with development server:
```bash
npm run dev
```

Then open your browser to `http://localhost:3000` and use the Dashboard to:
- Start/stop local Setup Server and LG Cloud services
- Configure MQTT connections
- Monitor device communications
- Parse protocol messages

### Distributed Deployment

Run services on different machines:

**Machine 1 (Web UI):**
```bash
npm run dev
# Access at http://machine1-ip:3000
```

**Machine 2 (Setup Server):**
```bash
npm run setup-server
# Listens on port 5501 (API) and 5500 (TLS for devices)
```

**Machine 3 (LG Cloud):**
```bash
npm run lg-cloud
# Listens on port 8080, handles MQTT and cloud protocol
```

Then connect to remote services via the Web UI Dashboard.

## Architecture

### Services

- **Web UI Service**: React frontend + API endpoints (port 3001)
- **Setup Server Service**: TLS server for device setup protocol (port 5500)
- **LG Cloud Service**: MQTT monitoring and cloud protocol handling (port 8080)

### Communication

- **Socket.io**: Real-time communication between services
- **Service Connector**: Inter-service communication with automatic reconnection
- **Configuration Management**: Centralized configuration with validation

### Protocol Support

#### Setup Protocol
- JSON-based communication over TLS (port 5500)
- Commands: `setDeviceInit`, `getDeviceInfo`, `setCertInfo`, `setApInfo`, `releaseDev`
- Real-time parsing with command descriptions

#### Cloud Protocol
- MQTT-based communication with hex-encoded payloads
- Device-to-cloud and cloud-to-device message handling
- Delivery mode detection (reliable/unreliable)

#### TLV Messages
- Type-Length-Value packet parsing
- CRC16 validation
- Automatic string decoding for readable values

## Configuration

### Service Endpoints

Configure service locations in `config.json`:

```json
{
  "services": {
    "webui": { "host": "localhost", "port": 3001 },
    "setupServer": { "host": "192.168.1.100", "port": 5501 },
    "lgCloud": { "host": "192.168.1.101", "port": 8080 }
  },
  "mqtt": {
    "url": "mqtt://192.168.1.102:1883",
    "username": "your-username",
    "password": "your-password"
  }
}
```

Or use the interactive configuration tool:
```bash
npm run configure
```

### Network Requirements

- **Web UI**: Port 3001 (HTTP)
- **Setup Server**: Port 5501 (API), Port 5500 (TLS for devices)
- **LG Cloud**: Port 8080 (HTTP)
- **MQTT Broker**: Port 1883 (or as configured)

## Project Structure

```
├── server.js                    # Main web UI server
├── services/
│   ├── web-ui.js                # Standalone web UI service
│   ├── setup-server.js          # Standalone setup server service
│   └── lg-cloud.js              # Standalone LG cloud service
├── lib/
│   ├── service-connector.js     # Inter-service communication
│   ├── tlv.js                   # TLV parser implementation
│   ├── protocol.js              # Setup and cloud protocol parsers
│   ├── mqtt-monitor.js          # MQTT monitoring capabilities
│   ├── setup-server.js          # Setup protocol server
│   ├── lg-cloud-server.js       # LG cloud server implementation
│   ├── config.js                # Configuration management
│   └── crc16.js                 # CRC16 validation
├── src/                         # React TypeScript frontend
│   ├── components/              # React components
│   ├── routes/                  # TanStack Router routes
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   └── main.tsx                 # Main React entry point
├── bin/
│   ├── configure.js             # Interactive configuration tool
│   └── deploy.js                # Deployment guide and utilities
├── CLAUDE.md                    # Development guidance
└── README.md
```

## Scripts

- `npm start` - Start web UI server (production)
- `npm run dev` - Start web UI with development server
- `npm run build` - Build React frontend for production
- `npm run setup-server` - Start setup server service
- `npm run lg-cloud` - Start LG cloud service
- `npm run configure` - Interactive service configuration
- `npm run deploy` - Show deployment guide

## Development

The project uses modern development tools:
- **React 19** with TypeScript
- **TanStack Router** for routing
- **Vite** for build system and development server
- **Socket.io** for real-time communication
- **ES Modules** throughout

For development with hot reload:
```bash
npm run dev
```

## Contributing

This project is built for educational and research purposes. Contributions are welcome, especially for:
- Additional protocol support based on rethink project findings
- Enhanced visualization features
- Testing with real LG ThinQ devices
- Improved service discovery and management
- Documentation improvements

## License

MIT License