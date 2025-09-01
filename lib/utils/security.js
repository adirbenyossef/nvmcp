/**
 * Enhanced Security and Cryptography Module for NVMCP
 * Provides secure encryption, key management, and security utilities
 * @author Claude (Refactored)
 * @version 2.0.0
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CRYPTO, FILES, TIME } = require('../constants');
const { ErrorFactory } = require('./errors');

/**
 * Secure random number generation
 */
class SecureRandom {
  /**
   * Generate cryptographically secure random bytes
   * @param {number} length - Number of bytes to generate
   * @returns {Buffer} - Secure random bytes
   */
  static bytes(length) {
    return crypto.randomBytes(length);
  }

  /**
   * Generate secure random string
   * @param {number} length - Length of string
   * @param {string} charset - Character set to use
   * @returns {string} - Secure random string
   */
  static string(length, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    const bytes = SecureRandom.bytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    return result;
  }

  /**
   * Generate secure random integer
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (exclusive)
   * @returns {number} - Secure random integer
   */
  static int(min, max) {
    const range = max - min;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValidValue = Math.floor(256 ** bytesNeeded / range) * range - 1;
    
    let randomValue;
    do {
      randomValue = SecureRandom.bytes(bytesNeeded).readUIntBE(0, bytesNeeded);
    } while (randomValue > maxValidValue);
    
    return min + (randomValue % range);
  }
}

/**
 * Key derivation functions
 */
class KeyDerivation {
  /**
   * Derive key using PBKDF2
   * @param {string} password - Password to derive from
   * @param {Buffer} salt - Salt for key derivation
   * @param {number} iterations - Number of iterations
   * @param {number} keyLength - Length of derived key
   * @param {string} digest - Hash digest to use
   * @returns {Buffer} - Derived key
   */
  static pbkdf2(password, salt, iterations = CRYPTO.PBKDF2_ITERATIONS, keyLength = CRYPTO.KEY_LENGTH, digest = 'sha512') {
    if (!password || !salt) {
      throw ErrorFactory.crypto('Password and salt are required for key derivation');
    }
    
    return crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest);
  }

  /**
   * Derive key using scrypt (more secure but slower)
   * @param {string} password - Password to derive from
   * @param {Buffer} salt - Salt for key derivation
   * @param {number} keyLength - Length of derived key
   * @returns {Buffer} - Derived key
   */
  static scrypt(password, salt, keyLength = CRYPTO.KEY_LENGTH) {
    if (!password || !salt) {
      throw ErrorFactory.crypto('Password and salt are required for key derivation');
    }
    
    // scrypt parameters: N=16384, r=8, p=1 (recommended for interactive use)
    return crypto.scryptSync(password, salt, keyLength, { N: 16384, r: 8, p: 1 });
  }
}

/**
 * Advanced encryption functions
 */
class Encryption {
  /**
   * Encrypt data with authenticated encryption (AES-GCM)
   * @param {string} plaintext - Text to encrypt
   * @param {string} password - Password for encryption
   * @param {Object} options - Encryption options
   * @returns {Object} - Encrypted data with metadata
   */
  static encryptGCM(plaintext, password, options = {}) {
    const {
      algorithm = 'aes-256-gcm',
      keyDerivation = 'scrypt',
      iterations = CRYPTO.PBKDF2_ITERATIONS
    } = options;

    if (!plaintext || !password) {
      throw ErrorFactory.crypto('Plaintext and password are required for encryption');
    }

    const salt = SecureRandom.bytes(CRYPTO.SALT_LENGTH);
    const iv = SecureRandom.bytes(16); // GCM recommends 12 bytes, but 16 is also acceptable
    
    // Use scrypt for better security by default
    const key = keyDerivation === 'scrypt' 
      ? KeyDerivation.scrypt(password, salt)
      : KeyDerivation.pbkdf2(password, salt, iterations);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();

    return {
      algorithm,
      encrypted,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyDerivation,
      iterations: keyDerivation === 'pbkdf2' ? iterations : undefined,
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    };
  }

  /**
   * Decrypt data encrypted with GCM
   * @param {Object} encryptedData - Encrypted data object
   * @param {string} password - Password for decryption
   * @returns {string} - Decrypted plaintext
   */
  static decryptGCM(encryptedData, password) {
    if (!encryptedData || !password) {
      throw ErrorFactory.crypto('Encrypted data and password are required for decryption');
    }

    const { algorithm, encrypted, salt, iv, authTag, keyDerivation, iterations } = encryptedData;

    if (!algorithm || !encrypted || !salt || !iv || !authTag) {
      throw ErrorFactory.crypto('Incomplete encrypted data structure');
    }

    const saltBuffer = Buffer.from(salt, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');
    
    const key = keyDerivation === 'scrypt' 
      ? KeyDerivation.scrypt(password, saltBuffer)
      : KeyDerivation.pbkdf2(password, saltBuffer, iterations);

    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    let decrypted;
    try {
      decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
    } catch (error) {
      throw ErrorFactory.crypto('Failed to decrypt data: authentication failed or corrupted data');
    }

    return decrypted;
  }

  /**
   * Legacy CBC decryption for backward compatibility
   * @param {Object} encryptedData - Encrypted data object
   * @param {string} password - Password for decryption
   * @returns {string} - Decrypted plaintext
   */
  static decryptCBC(encryptedData, password) {
    if (!encryptedData || !password) {
      throw ErrorFactory.crypto('Encrypted data and password are required for decryption');
    }

    const { encrypted, salt, iv } = encryptedData;
    
    const saltBuffer = Buffer.from(salt, 'base64');
    const key = KeyDerivation.pbkdf2(password, saltBuffer);
    const ivBuffer = Buffer.from(iv, 'base64');

    const decipher = crypto.createDecipheriv(CRYPTO.ALGORITHM, key, ivBuffer);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Auto-detect encryption method and decrypt
   * @param {Object} encryptedData - Encrypted data object
   * @param {string} password - Password for decryption
   * @returns {string} - Decrypted plaintext
   */
  static decrypt(encryptedData, password) {
    if (encryptedData.authTag) {
      return Encryption.decryptGCM(encryptedData, password);
    } else {
      return Encryption.decryptCBC(encryptedData, password);
    }
  }
}

/**
 * Secure key management
 */
class KeyManager {
  constructor() {
    this.keyCache = new Map();
    this.keyRotationInterval = TIME.CACHE_TTL; // Rotate keys every hour
    this.setupKeyRotation();
  }

  /**
   * Get master key with automatic rotation
   * @returns {string} - Master key
   */
  getMasterKey() {
    const keyPath = path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.MASTER_KEY_FILE);
    const keyId = 'master_key';
    
    // Check cache first
    if (this.keyCache.has(keyId)) {
      const cached = this.keyCache.get(keyId);
      if (Date.now() - cached.timestamp < this.keyRotationInterval) {
        return cached.key;
      }
    }

    let masterKey;
    
    if (fs.existsSync(keyPath)) {
      try {
        const keyData = fs.readFileSync(keyPath, 'utf8').trim();
        // Validate key format (should be hex string of correct length)
        if (!/^[0-9a-f]+$/i.test(keyData) || keyData.length !== CRYPTO.MASTER_KEY_LENGTH * 2) {
          console.warn('Warning: Invalid master key format, generating new key');
          masterKey = this.generateNewMasterKey(keyPath);
        } else {
          masterKey = keyData;
        }
      } catch (error) {
        console.warn('Warning: Could not read master key file, generating new key');
        masterKey = this.generateNewMasterKey(keyPath);
      }
    } else {
      masterKey = this.generateNewMasterKey(keyPath);
    }

    // Cache the key
    this.keyCache.set(keyId, {
      key: masterKey,
      timestamp: Date.now()
    });

    return masterKey;
  }

  /**
   * Generate new master key
   * @param {string} keyPath - Path to store the key
   * @returns {string} - New master key
   */
  generateNewMasterKey(keyPath) {
    const newKey = SecureRandom.bytes(CRYPTO.MASTER_KEY_LENGTH).toString('hex');
    
    try {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      
      // Write key with secure permissions
      fs.writeFileSync(keyPath, newKey, { 
        mode: FILES.PERMISSIONS.MASTER_KEY,
        flag: 'w'
      });
      
      console.log('Generated new master key');
      return newKey;
    } catch (error) {
      console.warn('Warning: Could not create master key file, using session key');
      return newKey;
    }
  }

  /**
   * Rotate master key
   */
  rotateMasterKey() {
    const keyPath = path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.MASTER_KEY_FILE);
    
    try {
      // Backup old key
      if (fs.existsSync(keyPath)) {
        const backupPath = `${keyPath}.backup.${Date.now()}`;
        fs.copyFileSync(keyPath, backupPath);
      }
      
      // Generate new key
      const newKey = this.generateNewMasterKey(keyPath);
      
      // Clear cache to force reload
      this.keyCache.clear();
      
      console.log('Master key rotated successfully');
      return newKey;
    } catch (error) {
      throw ErrorFactory.crypto(`Failed to rotate master key: ${error.message}`);
    }
  }

  /**
   * Setup automatic key rotation
   */
  setupKeyRotation() {
    // Only setup key rotation in production to avoid issues during development
    if (process.env.NODE_ENV === 'production') {
      const rotationInterval = 24 * 60 * 60 * 1000; // 24 hours
      
      setInterval(() => {
        try {
          this.rotateMasterKey();
        } catch (error) {
          console.error('Failed to rotate master key:', error.message);
        }
      }, rotationInterval);
    }
  }

  /**
   * Clear key cache (for security)
   */
  clearCache() {
    this.keyCache.clear();
  }
}

/**
 * Security utilities
 */
class SecurityUtils {
  /**
   * Secure string comparison to prevent timing attacks
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} - True if strings are equal
   */
  static secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8').subarray(0, Buffer.from(a, 'utf8').length)
    ) && a.length === b.length;
  }

  /**
   * Hash password with salt
   * @param {string} password - Password to hash
   * @param {Buffer} salt - Salt (optional, will generate if not provided)
   * @returns {Object} - Hash result with salt
   */
  static hashPassword(password, salt = null) {
    if (!password) {
      throw ErrorFactory.crypto('Password is required for hashing');
    }
    
    const actualSalt = salt || SecureRandom.bytes(CRYPTO.SALT_LENGTH);
    const hash = KeyDerivation.scrypt(password, actualSalt, 64); // 64 bytes for hash
    
    return {
      hash: hash.toString('base64'),
      salt: actualSalt.toString('base64'),
      algorithm: 'scrypt',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Verify password against hash
   * @param {string} password - Password to verify
   * @param {Object} hashData - Hash data object
   * @returns {boolean} - True if password matches
   */
  static verifyPassword(password, hashData) {
    if (!password || !hashData) {
      return false;
    }
    
    try {
      const salt = Buffer.from(hashData.salt, 'base64');
      const expectedHash = Buffer.from(hashData.hash, 'base64');
      const actualHash = KeyDerivation.scrypt(password, salt, 64);
      
      return crypto.timingSafeEqual(expectedHash, actualHash);
    } catch (error) {
      return false;
    }
  }

  /**
   * Sanitize input to prevent injection attacks
   * @param {string} input - Input to sanitize
   * @returns {string} - Sanitized input
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return '';
    }
    
    // Remove null bytes and control characters
    return input
      .replace(/\0/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
  }

  /**
   * Check if value contains sensitive information
   * @param {string} key - Key name to check
   * @returns {boolean} - True if key indicates sensitive data
   */
  static isSensitiveKey(key) {
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
}

// Global key manager instance
const keyManager = new KeyManager();

/**
 * High-level encryption functions for application use
 */
function encryptSensitiveData(data, options = {}) {
  if (!data) return data;
  
  const masterKey = keyManager.getMasterKey();
  const { useGCM = true } = options;
  
  if (typeof data === 'string') {
    return useGCM 
      ? Encryption.encryptGCM(data, masterKey)
      : require('./crypto').encrypt(data, masterKey); // Legacy fallback
  }
  
  if (typeof data === 'object' && data !== null) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (SecurityUtils.isSensitiveKey(key) && typeof value === 'string') {
        result[key] = useGCM 
          ? Encryption.encryptGCM(value, masterKey)
          : require('./crypto').encrypt(value, masterKey);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = encryptSensitiveData(value, options);
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
  
  const masterKey = keyManager.getMasterKey();
  
  if (typeof data === 'object' && data !== null) {
    if (data.encrypted && (data.authTag || data.salt)) {
      try {
        return Encryption.decrypt(data, masterKey);
      } catch (error) {
        throw ErrorFactory.crypto(`Failed to decrypt data: ${error.message}`);
      }
    }
    
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (SecurityUtils.isSensitiveKey(key) && typeof value === 'object' && value.encrypted) {
        try {
          result[key] = Encryption.decrypt(value, masterKey);
        } catch (error) {
          console.warn(`Warning: Could not decrypt ${key}: ${error.message}`);
          result[key] = '[ENCRYPTED]';
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = decryptSensitiveData(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  
  return data;
}

function isEncrypted(value) {
  return typeof value === 'object' && 
         value !== null && 
         typeof value.encrypted === 'string' &&
         (typeof value.salt === 'string' || typeof value.authTag === 'string');
}

module.exports = {
  // Classes
  SecureRandom,
  KeyDerivation,
  Encryption,
  KeyManager,
  SecurityUtils,
  
  // Global instance
  keyManager,
  
  // High-level functions
  encryptSensitiveData,
  decryptSensitiveData,
  isEncrypted,
  
  // Utilities
  isSensitiveKey: SecurityUtils.isSensitiveKey,
  secureCompare: SecurityUtils.secureCompare,
  sanitizeInput: SecurityUtils.sanitizeInput,
  hashPassword: SecurityUtils.hashPassword,
  verifyPassword: SecurityUtils.verifyPassword
};