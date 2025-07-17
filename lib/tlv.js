// TLV (Type-Length-Value) parser implementation
// Based on rethink project patterns

import { crc16, validateCrc16 } from './crc16.js';

class TLVParser {
    constructor() {
        this.buffer = Buffer.alloc(0);
    }

    // Parse TLV data from hex string
    parseHex(hexString) {
        try {
            const buffer = Buffer.from(hexString.replace(/\s+/g, ''), 'hex');
            return this.parseBuffer(buffer);
        } catch (error) {
            throw new Error(`Invalid hex string: ${error.message}`);
        }
    }

    // Parse TLV data from buffer
    parseBuffer(buffer) {
        const segments = [];
        let offset = 0;

        while (offset < buffer.length) {
            if (offset + 2 >= buffer.length) {
                break; // Not enough data for type and length
            }

            const type = buffer.readUInt8(offset);
            const length = buffer.readUInt8(offset + 1);
            
            if (offset + 2 + length > buffer.length) {
                break; // Not enough data for value
            }

            const value = buffer.slice(offset + 2, offset + 2 + length);
            
            segments.push({
                type,
                length,
                value,
                valueHex: value.toString('hex'),
                valueString: this.tryDecodeString(value),
                offset
            });

            offset += 2 + length;
        }

        return {
            segments,
            totalLength: offset,
            remainingBytes: buffer.length - offset
        };
    }

    // Try to decode value as string if it contains printable characters
    tryDecodeString(buffer) {
        try {
            const str = buffer.toString('utf8');
            // Check if string contains only printable ASCII characters
            if (/^[\x20-\x7E]*$/.test(str)) {
                return str;
            }
        } catch (error) {
            // Ignore decode errors
        }
        return null;
    }

    // Create TLV buffer from segments
    createTLV(segments) {
        const buffers = [];
        
        for (const segment of segments) {
            const typeBuffer = Buffer.from([segment.type]);
            const valueBuffer = Buffer.isBuffer(segment.value) 
                ? segment.value 
                : Buffer.from(segment.value, 'hex');
            const lengthBuffer = Buffer.from([valueBuffer.length]);
            
            buffers.push(typeBuffer, lengthBuffer, valueBuffer);
        }

        return Buffer.concat(buffers);
    }

    // Validate TLV message with CRC16
    validateMessage(buffer) {
        if (buffer.length < 2) {
            return { valid: false, error: 'Message too short for CRC' };
        }

        const dataLength = buffer.length - 2;
        const data = buffer.slice(0, dataLength);
        const crcBytes = buffer.slice(dataLength);
        const expectedCrc = crcBytes.readUInt16LE(0);

        const valid = validateCrc16(data, expectedCrc);
        
        return {
            valid,
            calculatedCrc: crc16(data),
            expectedCrc,
            error: valid ? null : 'CRC validation failed'
        };
    }
}

export { TLVParser };