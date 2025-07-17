# LG ThinQ Debug Tool

A web-based debugging and visualization tool for LG ThinQ device communication protocols, built with Node.js and Socket.io.

## Features

- **Protocol Monitoring**: Real-time monitoring of LG ThinQ device communications
- **TLV Parser**: Parse and visualize Type-Length-Value formatted messages
- **JSON Protocol Parser**: Parse setup protocol messages with command analysis
- **MQTT Integration**: Monitor MQTT messages from LG ThinQ devices
- **Web Interface**: Clean, responsive dashboard for protocol analysis
- **Real-time Updates**: Live message feed with filtering capabilities

## Based on Research

This tool is built from the findings of the [rethink project](https://github.com/anszom/rethink), which reverse-engineered LG ThinQ device communication protocols.

## Installation

1. Clone or download this project
2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and go to `http://localhost:3000`

3. Use the web interface to:
   - Parse TLV and JSON messages manually
   - Monitor live MQTT communication (requires MQTT broker)
   - View device state and protocol flow

## Protocol Support

### Setup Protocol
- JSON-based communication over TLS (port 5500)
- Commands: `setDeviceInit`, `getDeviceInfo`, `setCertInfo`, `setApInfo`, `releaseDev`
- Real-time parsing with command descriptions

### Cloud Protocol
- MQTT-based communication with hex-encoded payloads
- Device-to-cloud and cloud-to-device message handling
- Delivery mode detection (reliable/unreliable)

### TLV Messages
- Type-Length-Value packet parsing
- CRC16 validation
- Automatic string decoding for readable values

## Development

For development with auto-reload:
```bash
npm run dev
```

## Configuration

The tool connects to a local MQTT broker by default (`localhost:1883`). You can configure MQTT settings through the web interface.

## Project Structure

```
├── server.js              # Main Express server
├── lib/
│   ├── tlv.js             # TLV parser implementation
│   ├── protocol.js        # Setup and cloud protocol parsers
│   ├── mqtt-monitor.js    # MQTT monitoring capabilities
│   └── crc16.js          # CRC16 validation
├── public/
│   ├── index.html        # Web interface
│   ├── styles.css        # UI styling
│   └── app.js            # Frontend JavaScript
└── README.md
```

## Contributing

This project is built for educational and research purposes. Contributions are welcome, especially for:
- Additional protocol support
- Enhanced visualization features
- Testing with real LG ThinQ devices

## License

MIT License