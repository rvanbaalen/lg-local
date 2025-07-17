// CRC16 implementation for TLV packet validation
// Based on rethink project patterns

function crc16(data) {
    let crc = 0xFFFF;
    
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc = crc >> 1;
            }
        }
    }
    
    return crc;
}

function validateCrc16(data, expectedCrc) {
    const calculatedCrc = crc16(data);
    return calculatedCrc === expectedCrc;
}

export {
    crc16,
    validateCrc16
};