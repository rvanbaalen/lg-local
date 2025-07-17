#!/usr/bin/env node

// Configuration utility for distributed LG ThinQ Local Server
// Sets up service endpoints and configurations

import { ConfigManager } from '../lib/config.js';
import readline from 'readline';

const configManager = new ConfigManager();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function configureServices() {
  console.log('\n=== LG ThinQ Local Server - Service Configuration ===\n');
  
  const config = configManager.getConfig();
  
  // Configure Web UI service
  console.log('1. Web UI Service Configuration:');
  const webuiHost = await askQuestion(`Web UI Host (current: ${config.services.webui.host}): `) || config.services.webui.host;
  const webuiPort = await askQuestion(`Web UI Port (current: ${config.services.webui.port}): `) || config.services.webui.port;
  
  // Configure Setup Server service
  console.log('\n2. Setup Server Service Configuration:');
  const setupHost = await askQuestion(`Setup Server Host (current: ${config.services.setupServer.host}): `) || config.services.setupServer.host;
  const setupPort = await askQuestion(`Setup Server Port (current: ${config.services.setupServer.port}): `) || config.services.setupServer.port;
  const setupTlsPort = await askQuestion(`Setup TLS Port (current: ${config.services.setupServer.tlsPort}): `) || config.services.setupServer.tlsPort;
  
  // Configure LG Cloud service
  console.log('\n3. LG Cloud Service Configuration:');
  const cloudHost = await askQuestion(`LG Cloud Host (current: ${config.services.lgCloud.host}): `) || config.services.lgCloud.host;
  const cloudPort = await askQuestion(`LG Cloud Port (current: ${config.services.lgCloud.port}): `) || config.services.lgCloud.port;
  
  // Configure MQTT if needed
  console.log('\n4. MQTT Configuration (optional):');
  const mqttUrl = await askQuestion(`MQTT URL (current: ${config.mqtt.url || 'not set'}): `) || config.mqtt.url;
  const mqttUsername = await askQuestion(`MQTT Username (current: ${config.mqtt.username || 'not set'}): `) || config.mqtt.username;
  const mqttPassword = await askQuestion(`MQTT Password (current: ${config.mqtt.password ? '***' : 'not set'}): `) || config.mqtt.password;
  
  // Update configuration
  const services = {
    webui: {
      host: webuiHost,
      port: parseInt(webuiPort)
    },
    setupServer: {
      host: setupHost,
      port: parseInt(setupPort),
      tlsPort: parseInt(setupTlsPort)
    },
    lgCloud: {
      host: cloudHost,
      port: parseInt(cloudPort),
      apiPort: parseInt(cloudPort)
    }
  };
  
  const mqtt = {
    url: mqttUrl,
    username: mqttUsername,
    password: mqttPassword,
    discovery_prefix: config.mqtt.discovery_prefix,
    rethink_prefix: config.mqtt.rethink_prefix,
    port: config.mqtt.port,
    mqtts_port: config.mqtt.mqtts_port
  };
  
  configManager.updateSection('services', services);
  configManager.updateSection('mqtt', mqtt);
  
  console.log('\n✅ Configuration updated successfully!');
  console.log('\nService endpoints:');
  console.log(`  Web UI: http://${webuiHost}:${webuiPort}`);
  console.log(`  Setup Server: http://${setupHost}:${setupPort} (TLS: ${setupTlsPort})`);
  console.log(`  LG Cloud: http://${cloudHost}:${cloudPort}`);
  
  console.log('\nTo start services:');
  console.log('  npm run web-ui       # Start Web UI service');
  console.log('  npm run setup-server # Start Setup Server service');
  console.log('  npm run lg-cloud     # Start LG Cloud service');
  console.log('  npm run dev-distributed # Start all services');
  
  rl.close();
}

configureServices().catch(console.error);