import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

export default function Dashboard() {
  const socket = useSocket();
  const [serverStatus, setServerStatus] = useState('disconnected');
  const [mqttStatus, setMqttStatus] = useState('disconnected');
  const [setupServerStatus, setSetupServerStatus] = useState('stopped');
  const [lgCloudStatus, setLgCloudStatus] = useState('stopped');
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [remoteServices, setRemoteServices] = useState({});
  const [showRemoteConfig, setShowRemoteConfig] = useState(false);
  const [remoteServiceForm, setRemoteServiceForm] = useState({
    serviceType: 'setup-server',
    host: '',
    port: ''
  });

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

    socket.emit('get-remote-services', (services) => {
      setRemoteServices(services);
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
    };
  }, [socket]);

  useEffect(() => {
    if (socket) {
      setServerStatus('connected');
    } else {
      setServerStatus('disconnected');
    }
  }, [socket]);

  const handleStartSetupServer = () => {
    socket?.emit('start-setup-server', (response) => {
      if (response.success) {
        setSetupServerStatus('running');
      } else {
        alert('Failed to start setup server: ' + response.error);
      }
    });
  };

  const handleStopSetupServer = () => {
    socket?.emit('stop-setup-server', (response) => {
      if (response.success) {
        setSetupServerStatus('stopped');
      } else {
        alert('Failed to stop setup server: ' + response.error);
      }
    });
  };

  const handleStartLgCloud = () => {
    socket?.emit('start-lg-cloud', (response) => {
      if (response.success) {
        setLgCloudStatus('running');
      } else {
        alert('Failed to start LG Cloud: ' + response.error);
      }
    });
  };

  const handleStopLgCloud = () => {
    socket?.emit('stop-lg-cloud', (response) => {
      if (response.success) {
        setLgCloudStatus('stopped');
      } else {
        alert('Failed to stop LG Cloud: ' + response.error);
      }
    });
  };

  const handleStartMonitoring = () => {
    socket?.emit('start-monitoring', {});
  };

  const handleStopMonitoring = () => {
    socket?.emit('stop-monitoring');
  };

  const handleConnectRemoteService = () => {
    socket?.emit('connect-remote-service', {
      serviceType: remoteServiceForm.serviceType,
      host: remoteServiceForm.host,
      port: parseInt(remoteServiceForm.port)
    }, (response) => {
      if (response.success) {
        setShowRemoteConfig(false);
        setRemoteServiceForm({ serviceType: 'setup-server', host: '', port: '' });
        // Refresh remote services
        socket?.emit('get-remote-services', (services) => {
          setRemoteServices(services);
        });
      } else {
        alert('Failed to connect to remote service: ' + response.error);
      }
    });
  };

  const handleDisconnectRemoteService = (serviceType) => {
    socket?.emit('disconnect-remote-service', { serviceType }, (response) => {
      if (response.success) {
        // Refresh remote services
        socket?.emit('get-remote-services', (services) => {
          setRemoteServices(services);
        });
      } else {
        alert('Failed to disconnect from remote service: ' + response.error);
      }
    });
  };

  return (
    <div>
      <h1>Dashboard</h1>
      
      <div className="dashboard">
        <div className="card">
          <h2>Server Status</h2>
          <div>
            <span className={`status-indicator ${serverStatus}`}></span>
            Web Server: {serverStatus}
          </div>
          <div>
            <span className={`status-indicator ${mqttStatus}`}></span>
            MQTT: {mqttStatus}
          </div>
        </div>

        <div className="card">
          <h2>Setup Server</h2>
          <div>
            <span className={`status-indicator ${setupServerStatus === 'running' ? 'connected' : 'disconnected'}`}></span>
            Status: {setupServerStatus}
          </div>
          <div style={{ marginTop: '1rem' }}>
            {setupServerStatus === 'running' ? (
              <button className="btn danger" onClick={handleStopSetupServer}>
                Stop Setup Server
              </button>
            ) : (
              <button className="btn success" onClick={handleStartSetupServer}>
                Start Setup Server
              </button>
            )}
          </div>
        </div>

        <div className="card">
          <h2>LG Cloud Server</h2>
          <div>
            <span className={`status-indicator ${lgCloudStatus === 'running' ? 'connected' : 'disconnected'}`}></span>
            Status: {lgCloudStatus}
          </div>
          <div style={{ marginTop: '1rem' }}>
            {lgCloudStatus === 'running' ? (
              <button className="btn danger" onClick={handleStopLgCloud}>
                Stop LG Cloud
              </button>
            ) : (
              <button className="btn success" onClick={handleStartLgCloud}>
                Start LG Cloud
              </button>
            )}
          </div>
        </div>

        <div className="card">
          <h2>MQTT Monitoring</h2>
          <div>
            <span className={`status-indicator ${mqttStatus}`}></span>
            Status: {mqttStatus}
          </div>
          <div style={{ marginTop: '1rem' }}>
            {mqttStatus === 'connected' ? (
              <button className="btn danger" onClick={handleStopMonitoring}>
                Stop Monitoring
              </button>
            ) : (
              <button className="btn success" onClick={handleStartMonitoring}>
                Start Monitoring
              </button>
            )}
          </div>
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

        <div className="card">
          <h2>Remote Services</h2>
          <div>
            {Object.keys(remoteServices).length === 0 ? (
              <p>No remote services connected</p>
            ) : (
              Object.entries(remoteServices).map(([serviceName, service]) => (
                <div key={serviceName} className="message-item">
                  <div><strong>{serviceName}</strong></div>
                  <div>
                    <span className={`status-indicator ${service.connected ? 'connected' : 'disconnected'}`}></span>
                    {service.endpoint}
                  </div>
                  <button 
                    className="btn danger" 
                    onClick={() => handleDisconnectRemoteService(serviceName)}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Disconnect
                  </button>
                </div>
              ))
            )}
          </div>
          <button 
            className="btn success" 
            onClick={() => setShowRemoteConfig(true)}
            style={{ marginTop: '1rem' }}
          >
            Connect Remote Service
          </button>
        </div>
      </div>

      {showRemoteConfig && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h2>Connect Remote Service</h2>
          <div className="form-group">
            <label>Service Type:</label>
            <select
              value={remoteServiceForm.serviceType}
              onChange={(e) => setRemoteServiceForm(prev => ({ ...prev, serviceType: e.target.value }))}
            >
              <option value="setup-server">Setup Server</option>
              <option value="lg-cloud">LG Cloud</option>
            </select>
          </div>
          <div className="form-group">
            <label>Host/IP Address:</label>
            <input
              type="text"
              value={remoteServiceForm.host}
              onChange={(e) => setRemoteServiceForm(prev => ({ ...prev, host: e.target.value }))}
              placeholder="192.168.1.100"
            />
          </div>
          <div className="form-group">
            <label>Port:</label>
            <input
              type="number"
              value={remoteServiceForm.port}
              onChange={(e) => setRemoteServiceForm(prev => ({ ...prev, port: e.target.value }))}
              placeholder="5501"
            />
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button className="btn" onClick={handleConnectRemoteService}>
              Connect
            </button>
            <button 
              className="btn" 
              onClick={() => setShowRemoteConfig(false)}
              style={{ marginLeft: '1rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}