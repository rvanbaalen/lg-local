import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

export default function Configuration() {
  const socket = useSocket();
  const [config, setConfig] = useState({
    mqtt: {
      url: '',
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
    }
  });
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.emit('get-config', (serverConfig) => {
      setConfig(serverConfig);
    });
  }, [socket]);

  const handleSectionUpdate = (section, data) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], ...data }
    }));
  };

  const handleSaveSection = (section) => {
    if (!socket) return;

    setLoading(true);
    socket.emit('update-config', {
      section,
      config: config[section]
    }, (result) => {
      setLoading(false);
      if (result.success) {
        setSaveStatus({ type: 'success', message: `${section} configuration saved successfully` });
      } else {
        setSaveStatus({ type: 'error', message: `Failed to save ${section}: ${result.error}` });
      }
      setTimeout(() => setSaveStatus(null), 3000);
    });
  };

  const handleResetConfig = () => {
    if (!confirm('Are you sure you want to reset all configuration to defaults?')) return;

    fetch('/api/config/reset', { method: 'POST' })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setConfig(result.config);
          setSaveStatus({ type: 'success', message: 'Configuration reset to defaults' });
        } else {
          setSaveStatus({ type: 'error', message: 'Failed to reset configuration' });
        }
        setTimeout(() => setSaveStatus(null), 3000);
      });
  };

  return (
    <div>
      <h1>Configuration</h1>
      
      {saveStatus && (
        <div className={saveStatus.type === 'success' ? 'message-item success' : 'error'}>
          {saveStatus.message}
        </div>
      )}

      <div className="dashboard">
        <div className="card">
          <h2>MQTT Configuration</h2>
          <div className="form-group">
            <label>MQTT URL:</label>
            <input
              type="text"
              value={config.mqtt.url}
              onChange={(e) => handleSectionUpdate('mqtt', { url: e.target.value })}
              placeholder="mqtt://localhost:1883"
            />
          </div>
          <div className="form-group">
            <label>Username:</label>
            <input
              type="text"
              value={config.mqtt.username}
              onChange={(e) => handleSectionUpdate('mqtt', { username: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              value={config.mqtt.password}
              onChange={(e) => handleSectionUpdate('mqtt', { password: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Discovery Prefix:</label>
            <input
              type="text"
              value={config.mqtt.discovery_prefix}
              onChange={(e) => handleSectionUpdate('mqtt', { discovery_prefix: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Rethink Prefix:</label>
            <input
              type="text"
              value={config.mqtt.rethink_prefix}
              onChange={(e) => handleSectionUpdate('mqtt', { rethink_prefix: e.target.value })}
            />
          </div>
          <button 
            className="btn" 
            onClick={() => handleSaveSection('mqtt')}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save MQTT Config'}
          </button>
        </div>

        <div className="card">
          <h2>Server Configuration</h2>
          <div className="form-group">
            <label>Host:</label>
            <input
              type="text"
              value={config.server.host}
              onChange={(e) => handleSectionUpdate('server', { host: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Port:</label>
            <input
              type="number"
              value={config.server.port}
              onChange={(e) => handleSectionUpdate('server', { port: parseInt(e.target.value) })}
            />
          </div>
          <button 
            className="btn" 
            onClick={() => handleSaveSection('server')}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Server Config'}
          </button>
        </div>

        <div className="card">
          <h2>WiFi Configuration</h2>
          <div className="form-group">
            <label>SSID:</label>
            <input
              type="text"
              value={config.wifi.ssid}
              onChange={(e) => handleSectionUpdate('wifi', { ssid: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              value={config.wifi.password}
              onChange={(e) => handleSectionUpdate('wifi', { password: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Security:</label>
            <select
              value={config.wifi.security}
              onChange={(e) => handleSectionUpdate('wifi', { security: e.target.value })}
            >
              <option value="WPA2">WPA2</option>
              <option value="WPA3">WPA3</option>
              <option value="WEP">WEP</option>
              <option value="Open">Open</option>
            </select>
          </div>
          <button 
            className="btn" 
            onClick={() => handleSaveSection('wifi')}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save WiFi Config'}
          </button>
        </div>

        <div className="card">
          <h2>Monitoring Configuration</h2>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={config.monitoring.auto_start}
                onChange={(e) => handleSectionUpdate('monitoring', { auto_start: e.target.checked })}
              />
              Auto-start monitoring
            </label>
          </div>
          <div className="form-group">
            <label>Buffer Size:</label>
            <input
              type="number"
              value={config.monitoring.buffer_size}
              onChange={(e) => handleSectionUpdate('monitoring', { buffer_size: parseInt(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Log Level:</label>
            <select
              value={config.monitoring.log_level}
              onChange={(e) => handleSectionUpdate('monitoring', { log_level: e.target.value })}
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          </div>
          <button 
            className="btn" 
            onClick={() => handleSaveSection('monitoring')}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Monitoring Config'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2>Reset Configuration</h2>
        <p>This will reset all configuration to default values.</p>
        <button className="btn danger" onClick={handleResetConfig}>
          Reset All Configuration
        </button>
      </div>
    </div>
  );
}