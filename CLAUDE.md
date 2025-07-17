# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **LG ThinQ Local Server** - a Node.js server/service that acts as a replacement for LG Cloud connected appliance communications. It provides local control and communication with LG ThinQ devices without requiring cloud connectivity.

The web interface is purely for debugging, configuring, and starting/stopping relevant services.

## Critical Research Reference

**IMPORTANT**: This project aims to serve as a replacement for https://github.com/anszom/rethink including a web interface. Before implementing any feature or protocol handling in this project, you MUST consult the rethink project documentation at https://github.com/anszom/rethink/wiki and its subpages for relevant information and findings.

- The rethink project contains crucial documentation about LG ThinQ protocols
- While rethink will never be a dependency, their research is foundational
- Always check the wiki before implementing protocol features
- Reference their findings for protocol specifications and implementation details
- This project is designed to be a complete replacement for the rethink functionality

## Common Commands

### Development
```bash
npm start          # Start the server in production mode
npm run dev        # Start with nodemon for development (auto-reload)
```

### Server Access
- Main interface: http://localhost:3000 (default) or configured port
- API status: http://localhost:3000/api/status
- Configuration API: http://localhost:3000/api/config

### Testing
No test suite is currently configured. The package.json test script outputs an error message.

## Architecture Overview

### Server Structure (server.js)
- **Express server** with Socket.io for real-time communication
- **Configuration management** via ConfigManager (config.json)
- **Protocol parsers** for setup and cloud protocols
- **MQTT monitoring** with automatic TLV parsing
- **Multi-server support** for setup and LG cloud servers

### Core Components

#### Protocol Parsers (`lib/protocol.js`)
- **SetupProtocolParser**: Handles JSON setup messages over TLS (port 5500)
  - Commands: `setDeviceInit`, `getDeviceInfo`, `setCertInfo`, `setApInfo`, `releaseDev`
  - Validates message structure and parses command-specific data
- **CloudProtocolParser**: Handles MQTT messages with hex-encoded payloads
  - Parses delivery mode (reliable/unreliable) from first two bytes
  - Extracts device UUID and message data

#### TLV Parser (`lib/tlv.js`)
- **Type-Length-Value packet parsing** with CRC16 validation
- **Automatic string decoding** for readable values
- **Buffer handling** for both hex strings and binary data

#### MQTT Monitor (`lib/mqtt-monitor.js`)
- **Real-time MQTT message monitoring** with configurable broker connection
- **Automatic TLV parsing** of hex data in cloud messages
- **Socket.io integration** for web interface updates

### Configuration System
- **JSON-based configuration** (config.json) with sections for:
  - MQTT settings (broker, credentials, topics)
  - Server settings (port, host)
  - Monitoring preferences
  - WiFi configuration for device setup

### Socket.io Events
The application uses extensive Socket.io communication:
- Protocol parsing requests (`parse-tlv`, `parse-json`)
- MQTT control (`start-monitoring`, `stop-monitoring`, `configure-mqtt`)
- Server management (`start-setup-server`, `start-lg-cloud`)
- Configuration updates (`update-config`, `get-config`)

## Key Implementation Details

### Protocol Flow
1. **Setup Phase**: JSON messages over TLS for device initialization
2. **Cloud Phase**: MQTT messages with hex-encoded TLV payloads
3. **Real-time Monitoring**: Socket.io streams for live protocol analysis

### Message Structure
- **Setup messages**: JSON with `type`, `cmd`, and `data` fields
- **Cloud messages**: MQTT with `deviceUuid`, hex `data`, and `timestamp`
- **TLV segments**: Binary data with type, length, and value components

### Error Handling
- Comprehensive validation for all protocol parsers
- Graceful error handling for malformed messages
- CRC16 validation for TLV message integrity

## Development Notes

- The application requires an MQTT broker for cloud protocol monitoring
- Default configuration uses localhost:1883 for MQTT
- Web interface provides manual parsing tools and live monitoring
- Based on reverse-engineering research from the rethink project
- Designed to replace LG Cloud connectivity with local control