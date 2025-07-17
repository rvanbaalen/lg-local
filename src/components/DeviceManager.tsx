import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

export default function DeviceManager() {
  const socket = useSocket();
  const [setupDevices, setSetupDevices] = useState([]);
  const [cloudDevices, setCloudDevices] = useState([]);
  const [messageHistory, setMessageHistory] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [messageToSend, setMessageToSend] = useState('');

  useEffect(() => {
    if (!socket) return;

    // Get initial device lists
    socket.emit('get-connected-devices', (devices) => {
      setSetupDevices(devices);
    });

    socket.emit('get-lg-cloud-devices', (devices) => {
      setCloudDevices(devices);
    });

    socket.emit('get-lg-cloud-messages', { limit: 50 }, (messages) => {
      setMessageHistory(messages);
    });

    // Listen for device updates
    socket.on('appliance-connected', (device) => {
      setSetupDevices(prev => [...prev, device]);
    });

    socket.on('appliance-disconnected', (device) => {
      setSetupDevices(prev => prev.filter(d => d.id !== device.deviceId));
    });

    socket.on('setup-message', (message) => {
      setMessageHistory(prev => [message, ...prev.slice(0, 49)]);
    });

    socket.on('cloud-message', (message) => {
      setMessageHistory(prev => [message, ...prev.slice(0, 49)]);
    });

    return () => {
      socket.off('appliance-connected');
      socket.off('appliance-disconnected');
      socket.off('setup-message');
      socket.off('cloud-message');
    };
  }, [socket]);

  const handleSendMessage = () => {
    if (!socket || !selectedDevice || !messageToSend.trim()) return;

    socket.emit('send-device-message', {
      deviceId: selectedDevice,
      message: messageToSend.trim()
    }, (result) => {
      if (result.success) {
        setMessageToSend('');
        alert('Message sent successfully');
      } else {
        alert('Failed to send message: ' + result.error);
      }
    });
  };

  return (
    <div>
      <h1>Device Manager</h1>
      
      <div className="dashboard">
        <div className="card">
          <h2>Setup Devices</h2>
          <div>
            {setupDevices.length === 0 ? (
              <p>No devices in setup mode</p>
            ) : (
              <div>
                {setupDevices.map(device => (
                  <div key={device.id} className="message-item">
                    <div><strong>ID:</strong> {device.id}</div>
                    <div><strong>Address:</strong> {device.remoteAddress}:{device.remotePort}</div>
                    <div><strong>Phase:</strong> {device.setupPhase}</div>
                    <div><strong>Connected:</strong> {new Date(device.connectedAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Cloud Devices</h2>
          <div>
            {cloudDevices.length === 0 ? (
              <p>No cloud devices connected</p>
            ) : (
              <div>
                {cloudDevices.map(device => (
                  <div key={device.id} className="message-item">
                    <div><strong>ID:</strong> {device.id}</div>
                    <div><strong>UUID:</strong> {device.deviceUuid}</div>
                    <div><strong>Status:</strong> {device.status}</div>
                    <div><strong>Last Seen:</strong> {new Date(device.lastSeen).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Send Message to Device</h2>
          <div className="form-group">
            <label>Select Device:</label>
            <select
              value={selectedDevice || ''}
              onChange={(e) => setSelectedDevice(e.target.value)}
            >
              <option value="">Select a device...</option>
              {cloudDevices.map(device => (
                <option key={device.id} value={device.id}>
                  {device.deviceUuid} ({device.id})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Message (JSON):</label>
            <textarea
              value={messageToSend}
              onChange={(e) => setMessageToSend(e.target.value)}
              placeholder="Enter JSON message to send"
              rows="4"
            />
          </div>
          <button 
            className="btn" 
            onClick={handleSendMessage}
            disabled={!selectedDevice || !messageToSend.trim()}
          >
            Send Message
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2>Message History</h2>
        <div className="message-log">
          {messageHistory.length === 0 ? (
            <p>No message history</p>
          ) : (
            messageHistory.map((message, index) => (
              <div key={index} className="message-item">
                <div><strong>Time:</strong> {new Date(message.timestamp).toLocaleTimeString()}</div>
                <div><strong>Device:</strong> {message.deviceId || message.deviceUuid}</div>
                <div><strong>Type:</strong> {message.command || message.messageType || 'Unknown'}</div>
                {message.data && (
                  <div>
                    <strong>Data:</strong>
                    <pre>{JSON.stringify(message.data, null, 2)}</pre>
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