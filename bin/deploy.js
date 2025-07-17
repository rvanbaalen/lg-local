#!/usr/bin/env node

// Deployment utility for distributed LG ThinQ Local Server
// Shows how to deploy services on different machines

import { ConfigManager } from '../lib/config.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configManager = new ConfigManager();
const config = configManager.getConfig();

function printDeploymentGuide() {
  console.log('\n=== LG ThinQ Local Server - Deployment Guide ===\n');
  
  console.log('This system can be deployed in different configurations:\n');
  
  console.log('1. Single Machine (Default):');
  console.log('   npm run dev-distributed');
  console.log('   - Runs all services on localhost with different ports\n');
  
  console.log('2. Distributed Deployment:');
  console.log('   Deploy each service on different machines:\n');
  
  console.log('   Machine 1 (Web UI):');
  console.log('   - Copy this project to the machine');
  console.log('   - Configure services in config.json');
  console.log('   - Run: npm run web-ui');
  console.log('   - Access: http://machine1-ip:3001\n');
  
  console.log('   Machine 2 (Setup Server):');
  console.log('   - Copy this project to the machine');
  console.log('   - Configure services in config.json');
  console.log('   - Run: npm run setup-server');
  console.log('   - Listens on port 5501 (API) and 5500 (TLS)\n');
  
  console.log('   Machine 3 (LG Cloud):');
  console.log('   - Copy this project to the machine');
  console.log('   - Configure services in config.json with MQTT settings');
  console.log('   - Run: npm run lg-cloud');
  console.log('   - Listens on port 8080\n');
  
  console.log('3. Configuration:');
  console.log('   Run: node bin/configure.js');
  console.log('   - Sets up service endpoints and MQTT configuration\n');
  
  console.log('4. Current Configuration:');
  console.log(`   Web UI: http://${config.services.webui.host}:${config.services.webui.port}`);
  console.log(`   Setup Server: http://${config.services.setupServer.host}:${config.services.setupServer.port}`);
  console.log(`   LG Cloud: http://${config.services.lgCloud.host}:${config.services.lgCloud.port}`);
  console.log(`   MQTT: ${config.mqtt.url || 'Not configured'}\n`);
  
  console.log('5. Network Requirements:');
  console.log('   - All services need to communicate via TCP');
  console.log('   - Web UI needs to reach Setup Server and LG Cloud');
  console.log('   - LG devices connect to Setup Server on port 5500 (TLS)');
  console.log('   - MQTT broker should be accessible from LG Cloud service\n');
  
  console.log('6. Firewall/Security:');
  console.log('   - Web UI: Port 3001 (HTTP)');
  console.log('   - Setup Server: Port 5501 (API), Port 5500 (TLS for devices)');
  console.log('   - LG Cloud: Port 8080 (HTTP)');
  console.log('   - MQTT: Port 1883 (or as configured)\n');
  
  console.log('For more details, see the README.md file.');
}

function generateDockerCompose() {
  console.log('\n=== Docker Compose Example ===\n');
  
  const dockerCompose = `
version: '3.8'

services:
  web-ui:
    build: .
    command: npm run web-ui
    ports:
      - "3001:3001"
    environment:
      - WEB_UI_PORT=3001
    volumes:
      - ./config.json:/app/config.json
    depends_on:
      - setup-server
      - lg-cloud
    
  setup-server:
    build: .
    command: npm run setup-server
    ports:
      - "5501:5501"
      - "5500:5500"
    environment:
      - SETUP_SERVER_PORT=5501
    volumes:
      - ./config.json:/app/config.json
    
  lg-cloud:
    build: .
    command: npm run lg-cloud
    ports:
      - "8080:8080"
    environment:
      - LG_CLOUD_PORT=8080
    volumes:
      - ./config.json:/app/config.json
    depends_on:
      - mqtt
      
  mqtt:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
    volumes:
      - ./mqtt-config:/mosquitto/config
      - ./mqtt-data:/mosquitto/data
      - ./mqtt-log:/mosquitto/log
`;
  
  console.log(dockerCompose);
}

const args = process.argv.slice(2);

if (args.includes('--docker')) {
  generateDockerCompose();
} else {
  printDeploymentGuide();
}

if (args.includes('--help')) {
  console.log('\nUsage:');
  console.log('  node bin/deploy.js          # Show deployment guide');
  console.log('  node bin/deploy.js --docker # Generate Docker Compose example');
}