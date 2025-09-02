/**
 * @fileoverview Input validation utilities for NVMCP
 * @module validation
 */

const { ValidationError } = require('./errors');
const { VALIDATION } = require('../constants');

/**
 * Basic validator functions
 */
const Validators = {
  /**
   * Check if value is required (not null, undefined, or empty string)
   * @param {*} value - Value to validate
   * @param {string} [message='This field is required'] - Error message
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  required(value, message = 'This field is required') {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(message);
    }
    return true;
  },

  /**
   * Validate a string type and constraints
   * @param {*} value - Value to validate
   * @param {Object} [options={}] - Validation options
   * @param {number} [options.minLength] - Minimum length
   * @param {number} [options.maxLength] - Maximum length
   * @param {RegExp} [options.pattern] - Pattern to match
   * @param {boolean} [options.allowEmpty=false] - Allow empty strings
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  string(value, options = {}) {
    const { minLength, maxLength, pattern, allowEmpty = false } = options;

    if (!allowEmpty && (value === '' || value === null || value === undefined)) {
      throw new ValidationError('String value is required');
    }

    if (value !== null && value !== undefined && typeof value !== 'string') {
      throw new ValidationError('Value must be a string');
    }

    if (value && minLength && value.length < minLength) {
      throw new ValidationError(`String must be at least ${minLength} characters long`);
    }

    if (value && maxLength && value.length > maxLength) {
      throw new ValidationError(`String must be no more than ${maxLength} characters long`);
    }

    if (value && pattern && !pattern.test(value)) {
      throw new ValidationError('String does not match required pattern');
    }

    return true;
  },

  /**
   * Validate tag name format
   * @param {string} value - Tag name to validate
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  tagName(value) {
    Validators.required(value, 'Tag name is required');
    Validators.string(value, {
      minLength: VALIDATION.TAG_NAME.MIN_LENGTH,
      maxLength: VALIDATION.TAG_NAME.MAX_LENGTH
    });

    if (!VALIDATION.TAG_NAME.PATTERN.test(value)) {
      throw new ValidationError('Tag name must start and end with alphanumeric characters, and may contain hyphens and underscores');
    }

    if (VALIDATION.TAG_NAME.RESERVED_NAMES.includes(value.toLowerCase())) {
      throw new ValidationError(`'${value}' is a reserved name and cannot be used as a tag name`);
    }

    return true;
  },

  /**
   * Validate MCP source format
   * @param {string} value - MCP source to validate
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  mcpSource(value) {
    Validators.required(value, 'MCP source is required');
    Validators.string(value, { minLength: 1 });

    const isValid = VALIDATION.MCP_SOURCE.PATTERNS.some(pattern => pattern.test(value));
    if (!isValid) {
      throw new ValidationError('Invalid MCP source format. Use npm:package, github:owner/repo, https://url, or package-name');
    }

    return true;
  },

  /**
   * Validate process ID format
   * @param {string} value - Process ID to validate
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  processId(value) {
    Validators.required(value, 'Process ID is required');
    Validators.string(value, { minLength: 1 });

    if (!VALIDATION.PROCESS_ID.PATTERN.test(value)) {
      throw new ValidationError('Invalid process ID format');
    }

    return true;
  },

  /**
   * Validate boolean values
   * @param {*} value - Value to validate
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  boolean(value) {
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== true && value !== false) {
      throw new ValidationError('Value must be a boolean');
    }
    return true;
  },

  /**
   * Validate numeric values
   * @param {*} value - Value to validate
   * @param {Object} [options={}] - Validation options
   * @param {number} [options.min] - Minimum value
   * @param {number} [options.max] - Maximum value
   * @param {boolean} [options.integer=false] - Must be integer
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  number(value, options = {}) {
    const { min, max, integer = false } = options;

    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) {
      throw new ValidationError('Value must be a number');
    }

    if (integer && !Number.isInteger(num)) {
      throw new ValidationError('Value must be an integer');
    }

    if (min !== undefined && num < min) {
      throw new ValidationError(`Value must be at least ${min}`);
    }

    if (max !== undefined && num > max) {
      throw new ValidationError(`Value must be no more than ${max}`);
    }

    return true;
  },

  /**
   * Validate URL format
   * @param {string} value - URL to validate
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  url(value) {
    Validators.string(value);
    try {
      new URL(value);
    } catch (error) {
      throw new ValidationError('Invalid URL format');
    }
    return true;
  }
};

/**
 * Validate condition and throw error if false
 * @param {boolean} condition - Condition to validate
 * @param {string} message - Error message if validation fails
 * @param {string} [field] - Field name for validation errors
 * @param {*} [value] - Field value for validation errors
 * @throws {ValidationError} If condition is false
 */
function validate(condition, message, field = null, value = null) {
  if (!condition) {
    throw new ValidationError(message, field, value);
  }
  return true;
}

/**
 * Validate command line arguments
 * @param {Array} args - Arguments to validate
 * @param {number} minLength - Minimum required arguments
 * @param {string} [message='Insufficient arguments'] - Custom error message
 * @throws {ValidationError} If insufficient arguments
 */
function validateArgs(args, minLength, message = 'Insufficient arguments') {
  if (args.length < minLength) {
    throw new ValidationError(`${message} (expected ${minLength}, got ${args.length})`);
  }
}

/**
 * Validate required options
 * @param {Object} options - Options object to validate
 * @param {Array<string>} required - Required option names
 * @throws {ValidationError} If required options are missing
 */
function validateOptions(options, required = []) {
  for (const key of required) {
    if (!(key in options) || options[key] === undefined) {
      throw new ValidationError(`Required option --${key} is missing`);
    }
  }
}

/**
 * Sanitization utilities
 */
const Sanitizers = {
  /**
   * Trim whitespace
   * @param {*} value - Value to sanitize
   * @returns {*} Sanitized value
   */
  trim: (value) => typeof value === 'string' ? value.trim() : value,

  /**
   * Convert to lowercase
   * @param {*} value - Value to sanitize
   * @returns {*} Sanitized value
   */
  lowercase: (value) => typeof value === 'string' ? value.toLowerCase() : value,

  /**
   * Remove special characters except allowed ones
   * @param {*} value - Value to sanitize
   * @returns {*} Sanitized value
   */
  alphanumeric: (value) => typeof value === 'string' ? value.replace(/[^a-zA-Z0-9-_]/g, '') : value,

  /**
   * Escape HTML entities
   * @param {*} value - Value to sanitize
   * @returns {*} Sanitized value
   */
  escapeHtml: (value) => {
    if (typeof value !== 'string') {return value;}

    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
};

module.exports = {
  Validators,
  Sanitizers,
  validate,
  validateArgs,
  validateOptions,
  ValidationError
};
