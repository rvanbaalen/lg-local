import { useState } from 'react';
import { useSocket } from '../hooks/useSocket';

export default function ProtocolParsers() {
  const socket = useSocket();
  const [tlvData, setTlvData] = useState('');
  const [jsonData, setJsonData] = useState('');
  const [tlvResult, setTlvResult] = useState(null);
  const [jsonResult, setJsonResult] = useState(null);
  const [loading, setLoading] = useState({ tlv: false, json: false });

  const handleTlvParse = () => {
    if (!socket || !tlvData.trim()) return;
    
    setLoading(prev => ({ ...prev, tlv: true }));
    socket.emit('parse-tlv', { data: tlvData.trim() }, (result) => {
      setTlvResult(result);
      setLoading(prev => ({ ...prev, tlv: false }));
    });
  };

  const handleJsonParse = () => {
    if (!socket || !jsonData.trim()) return;
    
    setLoading(prev => ({ ...prev, json: true }));
    socket.emit('parse-json', { data: jsonData.trim() }, (result) => {
      setJsonResult(result);
      setLoading(prev => ({ ...prev, json: false }));
    });
  };

  return (
    <div>
      <h1>Protocol Parsers</h1>
      
      <div className="dashboard">
        <div className="card">
          <h2>TLV Parser</h2>
          <div className="form-group">
            <label>Hex Data:</label>
            <textarea
              value={tlvData}
              onChange={(e) => setTlvData(e.target.value)}
              placeholder="Enter hex data to parse (e.g., 0102030405)"
              rows="4"
            />
          </div>
          <button 
            className="btn" 
            onClick={handleTlvParse}
            disabled={loading.tlv || !tlvData.trim()}
          >
            {loading.tlv ? 'Parsing...' : 'Parse TLV'}
          </button>
          
          {tlvResult && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Results:</h3>
              {tlvResult.success ? (
                <div className="message-log">
                  <div><strong>Total Length:</strong> {tlvResult.totalLength}</div>
                  <div><strong>Remaining Bytes:</strong> {tlvResult.remainingBytes}</div>
                  <div><strong>Segments:</strong></div>
                  {tlvResult.segments.map((segment, index) => (
                    <div key={index} className="message-item">
                      <div><strong>Type:</strong> {segment.type}</div>
                      <div><strong>Length:</strong> {segment.length}</div>
                      <div><strong>Value (Hex):</strong> {segment.valueHex}</div>
                      {segment.valueString && (
                        <div><strong>Value (String):</strong> {segment.valueString}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="error">
                  Error: {tlvResult.error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2>JSON Parser</h2>
          <div className="form-group">
            <label>JSON Data:</label>
            <textarea
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              placeholder="Enter JSON message to parse"
              rows="4"
            />
          </div>
          <button 
            className="btn" 
            onClick={handleJsonParse}
            disabled={loading.json || !jsonData.trim()}
          >
            {loading.json ? 'Parsing...' : 'Parse JSON'}
          </button>
          
          {jsonResult && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Results:</h3>
              {jsonResult.success ? (
                <div className="message-log">
                  <div><strong>Type:</strong> {jsonResult.type}</div>
                  <div><strong>Command:</strong> {jsonResult.command}</div>
                  <div><strong>Valid:</strong> {jsonResult.valid ? 'Yes' : 'No'}</div>
                  <div><strong>Timestamp:</strong> {jsonResult.timestamp}</div>
                  {jsonResult.commandInfo && (
                    <div className="message-item">
                      <div><strong>Description:</strong> {jsonResult.commandInfo.description}</div>
                      <div><strong>Parameters:</strong></div>
                      <pre>{JSON.stringify(jsonResult.commandInfo.parameters, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="error">
                  Error: {jsonResult.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}