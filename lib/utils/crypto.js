/**
 * @fileoverview Cryptographic utilities for NVMCP
 * @module crypto
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CRYPTO, FILES } = require('../constants');

/**
 * Generate cryptographically secure random bytes
 * @param {number} length - Number of bytes to generate
 * @returns {Buffer} Secure random bytes
 */
function randomBytes(length) {
  return crypto.randomBytes(length);
}

/**
 * Generate secure random string
 * @param {number} length - Length of string
 * @param {string} [charset='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'] - Character set
 * @returns {string} Secure random string
 */
function randomString(length, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

/**
 * Derive key using PBKDF2
 * @param {string} password - Password to derive from
 * @param {Buffer|string} salt - Salt for key derivation
 * @param {number} [iterations=CRYPTO.PBKDF2_ITERATIONS] - Number of iterations
 * @param {number} [keyLength=CRYPTO.KEY_LENGTH] - Length of derived key
 * @returns {Buffer} Derived key
 */
function deriveKey(password, salt, iterations = CRYPTO.PBKDF2_ITERATIONS, keyLength = CRYPTO.KEY_LENGTH) {
  if (!password || !salt) {
    throw new Error('Password and salt are required for key derivation');
  }

  const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, 'base64');
  return crypto.pbkdf2Sync(password, saltBuffer, iterations, keyLength, 'sha512');
}

/**
 * Encrypt text using AES-256-GCM
 * @param {string} text - Text to encrypt
 * @param {string} password - Password for encryption
 * @returns {Object} Encrypted data with metadata
 */
function encrypt(text, password) {
  if (!text || !password) {
    throw new Error('Text and password are required for encryption');
  }

  const salt = randomBytes(CRYPTO.SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    algorithm: 'aes-256-gcm',
    version: '2.0.0'
  };
}

/**
 * Decrypt data encrypted with encrypt()
 * @param {Object} encryptedData - Encrypted data object
 * @param {string} password - Password for decryption
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedData, password) {
  if (!encryptedData || !password) {
    throw new Error('Encrypted data and password are required for decryption');
  }

  const { encrypted, salt, iv, authTag, algorithm = CRYPTO.ALGORITHM } = encryptedData;

  if (!encrypted || !salt || !iv) {
    throw new Error('Incomplete encrypted data structure');
  }

  const saltBuffer = Buffer.from(salt, 'base64');
  const key = deriveKey(password, saltBuffer);
  const ivBuffer = Buffer.from(iv, 'base64');

  const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);

  // Handle both GCM (with authTag) and CBC (legacy) decryption
  if (authTag) {
    const authTagBuffer = Buffer.from(authTag, 'base64');
    decipher.setAuthTag(authTagBuffer);
  }

  try {
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt data: authentication failed or corrupted data');
  }
}

/**
 * Check if a key name indicates sensitive data
 * @param {string} key - Key name to check
 * @returns {boolean} True if key indicates sensitive data
 */
function isSensitiveKey(key) {
  const sensitivePatterns = [
    /key$/i,
    /token$/i,
    /secret$/i,
    /password$/i,
    /auth$/i,
    /credential$/i,
    /^api/i,
    /session/i,
    /cookie/i
  ];

  return sensitivePatterns.some(pattern => pattern.test(key));
}

/**
 * Sanitize input to prevent injection attacks
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/\0/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

// Memoize master key to avoid repeated disk reads
let _masterKey = null;

/**
 * Get or generate master key for application (cached)
 * @returns {string} Master key as hex string
 */
function getMasterKey() {
  if (_masterKey) {
    return _masterKey;
  }

  const keyPath = path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.MASTER_KEY_FILE);

  if (fs.existsSync(keyPath)) {
    try {
      const keyData = fs.readFileSync(keyPath, 'utf8').trim();
      // Validate key format
      if (!/^[0-9a-f]+$/i.test(keyData) || keyData.length !== CRYPTO.MASTER_KEY_LENGTH * 2) {
        console.warn('Warning: Invalid master key format, generating new key');
        _masterKey = generateMasterKey(keyPath);
        return _masterKey;
      }
      _masterKey = keyData;
      return _masterKey;
    } catch (error) {
      console.warn('Warning: Could not read master key file, generating new key');
      _masterKey = generateMasterKey(keyPath);
      return _masterKey;
    }
  }

  _masterKey = generateMasterKey(keyPath);
  return _masterKey;
}

/**
 * Generate new master key
 * @param {string} keyPath - Path to store the key
 * @returns {string} New master key as hex string
 */
function generateMasterKey(keyPath) {
  const newKey = randomBytes(CRYPTO.MASTER_KEY_LENGTH).toString('hex');

  try {
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    fs.writeFileSync(keyPath, newKey, {
      mode: FILES.PERMISSIONS.MASTER_KEY,
      flag: 'w'
    });
    // Master key generated silently for security
    _masterKey = newKey; // Cache the new key
    return newKey;
  } catch (error) {
    console.warn('Warning: Could not create master key file, using session key');
    _masterKey = newKey; // Cache even session key
    return newKey;
  }
}

/**
 * Encrypt sensitive data automatically
 * @param {*} data - Data to encrypt (objects with sensitive keys will be encrypted)
 * @returns {*} Data with sensitive values encrypted
 */
function encryptSensitiveData(data) {
  if (!data) {return data;}

  const masterKey = getMasterKey();

  if (typeof data === 'string') {
    return encrypt(data, masterKey);
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key) && typeof value === 'string') {
        result[key] = encrypt(value, masterKey);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = encryptSensitiveData(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return data;
}

/**
 * Decrypt sensitive data automatically
 * @param {*} data - Data to decrypt (objects with encrypted values will be decrypted)
 * @returns {*} Data with sensitive values decrypted
 */
function decryptSensitiveData(data) {
  if (!data) {return data;}

  const masterKey = getMasterKey();

  if (typeof data === 'object' && !Array.isArray(data)) {
    if (data.encrypted && (data.authTag || data.salt)) {
      try {
        return decrypt(data, masterKey);
      } catch (error) {
        throw new Error(`Failed to decrypt data: ${error.message}`);
      }
    }

    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key) && typeof value === 'object' && value?.encrypted) {
        try {
          result[key] = decrypt(value, masterKey);
        } catch (error) {
          console.warn(`Warning: Could not decrypt ${key}: ${error.message}`);
          result[key] = '[ENCRYPTED]';
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = decryptSensitiveData(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return data;
}

/**
 * Check if a value is encrypted
 * @param {*} value - Value to check
 * @returns {boolean} True if value is encrypted
 */
function isEncrypted(value) {
  return typeof value === 'object' &&
         value !== null &&
         typeof value.encrypted === 'string' &&
         (typeof value.salt === 'string' || typeof value.authTag === 'string');
}

module.exports = {
  randomBytes,
  randomString,
  deriveKey,
  encrypt,
  decrypt,
  isSensitiveKey,
  sanitizeInput,
  getMasterKey,
  generateMasterKey,
  encryptSensitiveData,
  decryptSensitiveData,
  isEncrypted
};
