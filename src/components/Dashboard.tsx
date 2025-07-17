import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

interface ServiceConfig {
  mode: 'local' | 'remote';
  host: string;
  port: number;
  autoStart?: boolean;
}

interface MQTTConfig extends ServiceConfig {
  url?: string;
  username?: string;
  password?: string;
}

export default function Dashboard() {
  const socket = useSocket();
  const [serverStatus, setServerStatus] = useState('disconnected');
  const [mqttStatus, setMqttStatus] = useState('disconnected');
  const [setupServerStatus, setSetupServerStatus] = useState('stopped');
  const [lgCloudStatus, setLgCloudStatus] = useState('stopped');
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  
  // Service configurations
  const [mqttConfig, setMqttConfig] = useState<MQTTConfig>({
    mode: 'local',
    host: 'localhost',
    port: 1883,
    url: '',
    username: '',
    password: ''
  });
  
  const [setupConfig, setSetupConfig] = useState<ServiceConfig>({
    mode: 'local',
    host: 'localhost',
    port: 5501
  });
  
  const [lgCloudConfig, setLgCloudConfig] = useState<ServiceConfig>({
    mode: 'local',
    host: 'localhost',
    port: 8080
  });

  const [showMqttConfig, setShowMqttConfig] = useState(false);
  const [showSetupConfig, setShowSetupConfig] = useState(false);
  const [showLgCloudConfig, setShowLgCloudConfig] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Get initial status
    socket.emit('get-mqtt-status', (status) => {
      setMqttStatus(status.connected ? 'connected' : 'disconnected');
    });

    socket.emit('get-setup-server-status', (status) => {
      setSetupServerStatus(status.running ? 'running' : 'stopped');
    });

    socket.emit('get-lg-cloud-status', (status) => {
      setLgCloudStatus(status.running ? 'running' : 'stopped');
    });

    socket.emit('get-connected-devices', (devices) => {
      setConnectedDevices(devices);
    });

    // Load service configurations
    socket.emit('get-config', (config) => {
      if (config.mqtt) {
        setMqttConfig({
          mode: config.mqtt.mode || 'local',
          host: config.mqtt.host || 'localhost',
          port: config.mqtt.port || 1883,
          url: config.mqtt.url || '',
          username: config.mqtt.username || '',
          password: config.mqtt.password || ''
        });
      }
      if (config.services?.setupServer) {
        setSetupConfig({
          mode: config.services.setupServer.mode || 'local',
          host: config.services.setupServer.host || 'localhost',
          port: config.services.setupServer.port || 5501
        });
      }
      if (config.services?.lgCloud) {
        setLgCloudConfig({
          mode: config.services.lgCloud.mode || 'local',
          host: config.services.lgCloud.host || 'localhost',
          port: config.services.lgCloud.port || 8080
        });
      }
    });

    // Listen for status updates
    socket.on('mqtt-connected', () => setMqttStatus('connected'));
    socket.on('mqtt-disconnected', () => setMqttStatus('disconnected'));
    
    socket.on('setup-server-started', () => setSetupServerStatus('running'));
    socket.on('setup-server-stopped', () => setSetupServerStatus('stopped'));
    
    socket.on('lg-cloud-started', () => setLgCloudStatus('running'));
    socket.on('lg-cloud-stopped', () => setLgCloudStatus('stopped'));

    socket.on('appliance-connected', (device) => {
      setConnectedDevices(prev => [...prev, device]);
    });

    socket.on('appliance-disconnected', (device) => {
      setConnectedDevices(prev => prev.filter(d => d.id !== device.deviceId));
    });

    socket.on('setup-message', (message) => {
      setRecentMessages(prev => [message, ...prev.slice(0, 9)]);
    });

    socket.on('cloud-message', (message) => {
      setRecentMessages(prev => [message, ...prev.slice(0, 9)]);
    });

    socket.on('lg-cloud-error', (error) => {
      console.error('LG Cloud error:', error);
      alert(`LG Cloud Server Error: ${error.error}`);
    });

    return () => {
      socket.off('mqtt-connected');
      socket.off('mqtt-disconnected');
      socket.off('setup-server-started');
      socket.off('setup-server-stopped');
      socket.off('lg-cloud-started');
      socket.off('lg-cloud-stopped');
      socket.off('appliance-connected');
      socket.off('appliance-disconnected');
      socket.off('setup-message');
      socket.off('cloud-message');
      socket.off('lg-cloud-error');
    };
  }, [socket]);

  useEffect(() => {
    if (socket) {
      setServerStatus('connected');
    } else {
      setServerStatus('disconnected');
    }
  }, [socket]);

  // MQTT handlers
  const handleStartMqttLocal = () => {
    const config = {
      url: `mqtt://${mqttConfig.host}:${mqttConfig.port}`,
      username: mqttConfig.username,
      password: mqttConfig.password
    };
    
    socket?.emit('update-config', {
      section: 'mqtt',
      config: { ...config, mode: 'local' }
    }, (response) => {
      if (response.success) {
        socket?.emit('start-monitoring', {}, (response) => {
          if (!response?.success) {
            alert('Failed to start MQTT monitoring');
          }
        });
      }
    });
  };

  const handleConnectMqttRemote = () => {
    const config = {
      url: `mqtt://${mqttConfig.host}:${mqttConfig.port}`,
      username: mqttConfig.username,
      password: mqttConfig.password,
      mode: 'remote'
    };
    
    socket?.emit('update-config', {
      section: 'mqtt',
      config
    }, (response) => {
      if (response.success) {
        socket?.emit('configure-mqtt', config, (response) => {
          if (response.success) {
            setShowMqttConfig(false);
          } else {
            alert('Failed to connect to MQTT broker: ' + response.error);
          }
        });
      }
    });
  };

  const handleStopMqtt = () => {
    socket?.emit('stop-monitoring');
  };

  // Setup Server handlers
  const handleStartSetupLocal = () => {
    socket?.emit('start-setup-server', (response) => {
      if (!response.success) {
        alert('Failed to start setup server: ' + response.error);
      } else {
        setShowSetupConfig(false);
      }
    });
  };

  const handleConnectSetupRemote = () => {
    socket?.emit('connect-remote-service', {
      serviceType: 'setupServer',
      host: setupConfig.host,
      port: setupConfig.port
    }, (response) => {
      if (response.success) {
        setShowSetupConfig(false);
      } else {
        alert('Failed to connect to remote setup server: ' + response.error);
      }
    });
  };

  const handleStopSetup = () => {
    if (setupConfig.mode === 'local') {
      socket?.emit('stop-setup-server', (response) => {
        if (response && !response.success) {
          alert('Failed to stop setup server: ' + response.error);
        }
      });
    } else {
      socket?.emit('disconnect-remote-service', { serviceType: 'setupServer' });
    }
  };

  // LG Cloud handlers
  const handleStartLgCloudLocal = () => {
    socket?.emit('start-lg-cloud', (response) => {
      if (!response.success) {
        alert('Failed to start LG Cloud server: ' + response.error);
      } else {
        setShowLgCloudConfig(false);
      }
    });
  };

  const handleConnectLgCloudRemote = () => {
    socket?.emit('connect-remote-service', {
      serviceType: 'lgCloud',
      host: lgCloudConfig.host,
      port: lgCloudConfig.port
    }, (response) => {
      if (response.success) {
        setShowLgCloudConfig(false);
      } else {
        alert('Failed to connect to remote LG Cloud server: ' + response.error);
      }
    });
  };

  const handleStopLgCloud = () => {
    if (lgCloudConfig.mode === 'local') {
      socket?.emit('stop-lg-cloud', (response) => {
        if (response && !response.success) {
          alert('Failed to stop LG Cloud server: ' + response.error);
        }
      });
    } else {
      socket?.emit('disconnect-remote-service', { serviceType: 'lgCloud' });
    }
  };

  return (
    <div>
      <h1>Dashboard</h1>
      
      <div className="dashboard">
        <div className="card">
          <h2>Web Server Status</h2>
          <div>
            <span className={`status-indicator ${serverStatus}`}></span>
            Status: {serverStatus}
          </div>
        </div>

        {/* MQTT Server Card */}
        <div className="card">
          <h2>MQTT Server</h2>
          <div>
            <span className={`status-indicator ${mqttStatus}`}></span>
            Status: {mqttStatus}
          </div>
          <div>Mode: {mqttConfig.mode}</div>
          {mqttConfig.mode === 'remote' && (
            <div>Remote: {mqttConfig.host}:{mqttConfig.port}</div>
          )}
          
          {!showMqttConfig ? (
            <div style={{ marginTop: '1rem' }}>
              {mqttStatus === 'connected' ? (
                <button className="btn danger" onClick={handleStopMqtt}>
                  Stop MQTT
                </button>
              ) : (
                <>
                  <button className="btn success" onClick={() => setShowMqttConfig(true)}>
                    Configure
                  </button>
                  <button 
                    className="btn" 
                    onClick={handleStartMqttLocal}
                    style={{ marginLeft: '0.5rem' }}
                  >
                    Start Local
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="config-form" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label>Host:</label>
                <input
                  type="text"
                  value={mqttConfig.host}
                  onChange={(e) => setMqttConfig({...mqttConfig, host: e.target.value})}
                  placeholder="localhost"
                />
              </div>
              <div className="form-group">
                <label>Port:</label>
                <input
                  type="number"
                  value={mqttConfig.port}
                  onChange={(e) => setMqttConfig({...mqttConfig, port: parseInt(e.target.value)})}
                  placeholder="1883"
                />
              </div>
              <div className="form-group">
                <label>Username (optional):</label>
                <input
                  type="text"
                  value={mqttConfig.username}
                  onChange={(e) => setMqttConfig({...mqttConfig, username: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Password (optional):</label>
                <input
                  type="password"
                  value={mqttConfig.password}
                  onChange={(e) => setMqttConfig({...mqttConfig, password: e.target.value})}
                />
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button className="btn success" onClick={handleStartMqttLocal}>
                  Start Local
                </button>
                <button 
                  className="btn" 
                  onClick={handleConnectMqttRemote}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Connect Remote
                </button>
                <button 
                  className="btn" 
                  onClick={() => setShowMqttConfig(false)}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Setup Server Card */}
        <div className="card">
          <h2>Setup Server</h2>
          <div>
            <span className={`status-indicator ${setupServerStatus === 'running' ? 'connected' : 'disconnected'}`}></span>
            Status: {setupServerStatus}
          </div>
          <div>Mode: {setupConfig.mode}</div>
          {setupConfig.mode === 'remote' && (
            <div>Remote: {setupConfig.host}:{setupConfig.port}</div>
          )}
          
          {!showSetupConfig ? (
            <div style={{ marginTop: '1rem' }}>
              {setupServerStatus === 'running' ? (
                <button className="btn danger" onClick={handleStopSetup}>
                  Stop Setup Server
                </button>
              ) : (
                <>
                  <button className="btn success" onClick={() => setShowSetupConfig(true)}>
                    Configure
                  </button>
                  <button 
                    className="btn" 
                    onClick={handleStartSetupLocal}
                    style={{ marginLeft: '0.5rem' }}
                  >
                    Start Local
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="config-form" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label>Host:</label>
                <input
                  type="text"
                  value={setupConfig.host}
                  onChange={(e) => setSetupConfig({...setupConfig, host: e.target.value})}
                  placeholder="localhost"
                />
              </div>
              <div className="form-group">
                <label>API Port:</label>
                <input
                  type="number"
                  value={setupConfig.port}
                  onChange={(e) => setSetupConfig({...setupConfig, port: parseInt(e.target.value)})}
                  placeholder="5501"
                />
              </div>
              <div className="form-text">TLS Port: {setupConfig.port - 1} (auto-configured)</div>
              <div style={{ marginTop: '1rem' }}>
                <button className="btn success" onClick={handleStartSetupLocal}>
                  Start Local
                </button>
                <button 
                  className="btn" 
                  onClick={handleConnectSetupRemote}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Connect Remote
                </button>
                <button 
                  className="btn" 
                  onClick={() => setShowSetupConfig(false)}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LG Cloud Server Card */}
        <div className="card">
          <h2>LG Cloud Server</h2>
          <div>
            <span className={`status-indicator ${lgCloudStatus === 'running' ? 'connected' : 'disconnected'}`}></span>
            Status: {lgCloudStatus}
          </div>
          <div>Mode: {lgCloudConfig.mode}</div>
          {lgCloudConfig.mode === 'remote' && (
            <div>Remote: {lgCloudConfig.host}:{lgCloudConfig.port}</div>
          )}
          
          {!showLgCloudConfig ? (
            <div style={{ marginTop: '1rem' }}>
              {lgCloudStatus === 'running' ? (
                <button className="btn danger" onClick={handleStopLgCloud}>
                  Stop LG Cloud
                </button>
              ) : (
                <>
                  <button className="btn success" onClick={() => setShowLgCloudConfig(true)}>
                    Configure
                  </button>
                  <button 
                    className="btn" 
                    onClick={handleStartLgCloudLocal}
                    style={{ marginLeft: '0.5rem' }}
                  >
                    Start Local
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="config-form" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label>Host:</label>
                <input
                  type="text"
                  value={lgCloudConfig.host}
                  onChange={(e) => setLgCloudConfig({...lgCloudConfig, host: e.target.value})}
                  placeholder="localhost"
                />
              </div>
              <div className="form-group">
                <label>API Port:</label>
                <input
                  type="number"
                  value={lgCloudConfig.port}
                  onChange={(e) => setLgCloudConfig({...lgCloudConfig, port: parseInt(e.target.value)})}
                  placeholder="8080"
                />
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button className="btn success" onClick={handleStartLgCloudLocal}>
                  Start Local
                </button>
                <button 
                  className="btn" 
                  onClick={handleConnectLgCloudRemote}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Connect Remote
                </button>
                <button 
                  className="btn" 
                  onClick={() => setShowLgCloudConfig(false)}
                  style={{ marginLeft: '0.5rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Connected Devices</h2>
          <div>
            {connectedDevices.length === 0 ? (
              <p>No devices connected</p>
            ) : (
              <ul>
                {connectedDevices.map(device => (
                  <li key={device.id}>
                    {device.remoteAddress}:{device.remotePort} - {device.setupPhase}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Recent Messages</h2>
          <div className="message-log">
            {recentMessages.length === 0 ? (
              <p>No recent messages</p>
            ) : (
              recentMessages.map((message, index) => (
                <div key={index} className="message-item">
                  <div><strong>{message.command || message.messageType || 'Unknown'}</strong></div>
                  <div>{new Date(message.timestamp).toLocaleTimeString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}