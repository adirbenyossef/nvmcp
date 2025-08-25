const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');
}

function encrypt(text, password) {
  if (!text || !password) {
    throw new Error('Text and password are required for encryption');
  }
  
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipher(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return {
    encrypted,
    salt: salt.toString('base64'),
    iv: iv.toString('base64')
  };
}

function decrypt(encryptedData, password) {
  if (!encryptedData || !password) {
    throw new Error('Encrypted data and password are required for decryption');
  }
  
  const { encrypted, salt, iv } = encryptedData;
  
  const saltBuffer = Buffer.from(salt, 'base64');
  const key = deriveKey(password, saltBuffer);
  const ivBuffer = Buffer.from(iv, 'base64');
  
  const decipher = crypto.createDecipher(ALGORITHM, key, ivBuffer);
  
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

function getMasterKey() {
  const keyPath = path.join(os.homedir(), '.nvmcp', '.key');
  
  if (fs.existsSync(keyPath)) {
    try {
      return fs.readFileSync(keyPath, 'utf8').trim();
    } catch (error) {
      console.warn('Warning: Could not read master key file');
    }
  }
  
  const newKey = crypto.randomBytes(32).toString('hex');
  
  try {
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    fs.writeFileSync(keyPath, newKey, { mode: 0o600 });
    return newKey;
  } catch (error) {
    console.warn('Warning: Could not create master key file, using session key');
    return newKey;
  }
}

function encryptSensitiveData(data) {
  if (!data) return data;
  
  const masterKey = getMasterKey();
  
  if (typeof data === 'string') {
    return encrypt(data, masterKey);
  }
  
  if (typeof data === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key) && typeof value === 'string') {
        result[key] = encrypt(value, masterKey);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  
  return data;
}

function decryptSensitiveData(data) {
  if (!data) return data;
  
  const masterKey = getMasterKey();
  
  if (typeof data === 'object' && data.encrypted) {
    try {
      return decrypt(data, masterKey);
    } catch (error) {
      throw new Error('Failed to decrypt data: ' + error.message);
    }
  }
  
  if (typeof data === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key) && typeof value === 'object' && value.encrypted) {
        try {
          result[key] = decrypt(value, masterKey);
        } catch (error) {
          console.warn(`Warning: Could not decrypt ${key}`);
          result[key] = '[ENCRYPTED]';
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  
  return data;
}

function isSensitiveKey(key) {
  const sensitivePatterns = [
    /key$/i,
    /token$/i,
    /secret$/i,
    /password$/i,
    /auth$/i,
    /credential$/i,
    /^api/i
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(key));
}

function isEncrypted(value) {
  return typeof value === 'object' && 
         value !== null && 
         typeof value.encrypted === 'string' &&
         typeof value.salt === 'string' &&
         typeof value.iv === 'string';
}

module.exports = {
  encrypt,
  decrypt,
  encryptSensitiveData,
  decryptSensitiveData,
  isSensitiveKey,
  isEncrypted
};