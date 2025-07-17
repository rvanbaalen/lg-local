import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

export default function MQTTMonitor() {
  const socket = useSocket();
  const [mqttStatus, setMqttStatus] = useState('disconnected');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [messages, setMessages] = useState([]);
  const [config, setConfig] = useState({
    host: 'localhost',
    port: 1883,
    username: '',
    password: ''
  });

  useEffect(() => {
    if (!socket) return;

    // Load saved configuration from server
    socket.emit('get-config', (serverConfig) => {
      if (serverConfig.mqtt) {
        const mqttConfig = serverConfig.mqtt;
        // Parse URL to extract host and port if URL is provided
        if (mqttConfig.url) {
          try {
            const url = new URL(mqttConfig.url);
            setConfig({
              host: url.hostname,
              port: parseInt(url.port) || 1883,
              username: mqttConfig.username || '',
              password: mqttConfig.password || ''
            });
          } catch (error) {
            console.error('Invalid MQTT URL:', mqttConfig.url);
          }
        }
      }
    });

    socket.emit('get-mqtt-status', (status) => {
      setMqttStatus(status.connected ? 'connected' : 'disconnected');
      setIsMonitoring(status.monitoring);
    });

    socket.on('mqtt-connected', () => setMqttStatus('connected'));
    socket.on('mqtt-disconnected', () => setMqttStatus('disconnected'));
    socket.on('mqtt-monitoring-started', () => setIsMonitoring(true));
    socket.on('mqtt-monitoring-stopped', () => setIsMonitoring(false));

    socket.on('cloud-message', (message) => {
      setMessages(prev => [message, ...prev.slice(0, 99)]);
    });

    socket.on('tlv-message', (message) => {
      setMessages(prev => [{ ...message, type: 'tlv' }, ...prev.slice(0, 99)]);
    });

    return () => {
      socket.off('mqtt-connected');
      socket.off('mqtt-disconnected');
      socket.off('mqtt-monitoring-started');
      socket.off('mqtt-monitoring-stopped');
      socket.off('cloud-message');
      socket.off('tlv-message');
    };
  }, [socket]);

  const handleConnect = () => {
    socket?.emit('configure-mqtt', config, (result) => {
      if (result.success) {
        setMqttStatus('connected');
      } else {
        alert('Failed to connect: ' + result.error);
      }
    });
  };

  const handleStartMonitoring = () => {
    socket?.emit('start-monitoring', {});
  };

  const handleStopMonitoring = () => {
    socket?.emit('stop-monitoring');
  };

  const handleClearMessages = () => {
    setMessages([]);
  };

  return (
    <div>
      <h1>MQTT Monitor</h1>
      
      <div className="dashboard">
        <div className="card">
          <h2>MQTT Configuration</h2>
          <div className="form-group">
            <label>Host:</label>
            <input
              type="text"
              value={config.host}
              onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Port:</label>
            <input
              type="number"
              value={config.port}
              onChange={(e) => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) }))}
            />
          </div>
          <div className="form-group">
            <label>Username (optional):</label>
            <input
              type="text"
              value={config.username}
              onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Password (optional):</label>
            <input
              type="password"
              value={config.password}
              onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
            />
          </div>
          <button className="btn" onClick={handleConnect}>
            Connect to MQTT
          </button>
        </div>

        <div className="card">
          <h2>Monitoring Status</h2>
          <div>
            <span className={`status-indicator ${mqttStatus}`}></span>
            MQTT: {mqttStatus}
          </div>
          <div>
            <span className={`status-indicator ${isMonitoring ? 'connected' : 'disconnected'}`}></span>
            Monitoring: {isMonitoring ? 'active' : 'inactive'}
          </div>
          <div style={{ marginTop: '1rem' }}>
            {isMonitoring ? (
              <button className="btn danger" onClick={handleStopMonitoring}>
                Stop Monitoring
              </button>
            ) : (
              <button 
                className="btn success" 
                onClick={handleStartMonitoring}
                disabled={mqttStatus !== 'connected'}
              >
                Start Monitoring
              </button>
            )}
            <button 
              className="btn" 
              onClick={handleClearMessages}
              style={{ marginLeft: '1rem' }}
            >
              Clear Messages
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2>Message Log ({messages.length})</h2>
        <div className="message-log">
          {messages.length === 0 ? (
            <p>No messages received</p>
          ) : (
            messages.map((message, index) => (
              <div key={index} className="message-item">
                <div><strong>Time:</strong> {new Date(message.timestamp).toLocaleTimeString()}</div>
                <div><strong>Topic:</strong> {message.topic}</div>
                {message.deviceUuid && (
                  <div><strong>Device:</strong> {message.deviceUuid}</div>
                )}
                {message.messageType && (
                  <div><strong>Type:</strong> {message.messageType}</div>
                )}
                {message.data && (
                  <div>
                    <strong>Data:</strong>
                    <pre>{JSON.stringify(message.data, null, 2)}</pre>
                  </div>
                )}
                {message.segments && (
                  <div>
                    <strong>TLV Segments:</strong>
                    {message.segments.map((segment, i) => (
                      <div key={i} style={{ marginLeft: '1rem' }}>
                        Type: {segment.type}, Length: {segment.length}, Value: {segment.valueHex}
                        {segment.valueString && ` (${segment.valueString})`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}