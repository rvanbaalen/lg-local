export interface Device {
  id: string;
  remoteAddress: string;
  remotePort: number;
  connectedAt: string;
  setupPhase: string;
}

export interface CloudDevice {
  id: string;
  deviceUuid: string;
  status: string;
  lastSeen: string;
}

export interface TLVSegment {
  type: number;
  length: number;
  value: Buffer;
  valueHex: string;
  valueString: string | null;
  offset: number;
}

export interface TLVResult {
  success: boolean;
  segments?: TLVSegment[];
  totalLength?: number;
  remainingBytes?: number;
  error?: string;
}

export interface JSONResult {
  success: boolean;
  type?: string;
  command?: string;
  data?: any;
  commandInfo?: {
    description: string;
    parameters: any;
  };
  valid?: boolean;
  timestamp?: string;
  error?: string;
}

export interface MQTTMessage {
  timestamp: string;
  topic: string;
  deviceUuid?: string;
  messageType?: string;
  data?: {
    raw: string;
    deliveryMode: number;
    messageData: string;
    messageLength: number;
    reliable: boolean;
  };
  segments?: TLVSegment[];
}

export interface MQTTStatus {
  connected: boolean;
  monitoring: boolean;
  broker: string | null;
}

export interface Config {
  mqtt: {
    url: string;
    username: string;
    password: string;
    discovery_prefix: string;
    rethink_prefix: string;
    port: number;
    mqtts_port: number;
  };
  server: {
    port: number;
    host: string;
  };
  monitoring: {
    auto_start: boolean;
    buffer_size: number;
    log_level: string;
  };
  wifi: {
    ssid: string;
    password: string;
    security: string;
  };
}