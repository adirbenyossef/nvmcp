/**
 * Input Validation Framework for NVMCP
 * Provides comprehensive validation, sanitization, and schema checking
 * @author Claude (Refactored)
 * @version 2.0.0
 */

const { ValidationError } = require('./errors');
const { VALIDATION } = require('../constants');

/**
 * Built-in validator functions
 */
const Validators = {
  /**
   * Check if value is required (not null, undefined, or empty string)
   */
  required(value, message = 'This field is required') {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(message);
    }
    return true;
  },

  /**
   * Validate string type and optional constraints
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
      throw new ValidationError(`String does not match required pattern`);
    }
    
    return true;
  },

  /**
   * Validate tag name format
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
   */
  boolean(value) {
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== true && value !== false) {
      throw new ValidationError('Value must be a boolean');
    }
    return true;
  },

  /**
   * Validate numeric values
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
   * Validate array values
   */
  array(value, options = {}) {
    const { minLength, maxLength, itemValidator } = options;
    
    if (!Array.isArray(value)) {
      throw new ValidationError('Value must be an array');
    }
    
    if (minLength !== undefined && value.length < minLength) {
      throw new ValidationError(`Array must have at least ${minLength} items`);
    }
    
    if (maxLength !== undefined && value.length > maxLength) {
      throw new ValidationError(`Array must have no more than ${maxLength} items`);
    }
    
    if (itemValidator) {
      value.forEach((item, index) => {
        try {
          itemValidator(item);
        } catch (error) {
          throw new ValidationError(`Item at index ${index}: ${error.message}`);
        }
      });
    }
    
    return true;
  },

  /**
   * Validate email format
   */
  email(value) {
    Validators.string(value);
    if (!VALIDATION.EMAIL.PATTERN.test(value)) {
      throw new ValidationError('Invalid email format');
    }
    return true;
  },

  /**
   * Validate URL format
   */
  url(value) {
    Validators.string(value);
    try {
      new URL(value);
    } catch (error) {
      throw new ValidationError('Invalid URL format');
    }
    return true;
  },

  /**
   * Validate file path
   */
  path(value, options = {}) {
    const { mustExist = false, mustBeFile = false, mustBeDirectory = false } = options;
    
    Validators.string(value);
    
    if (mustExist || mustBeFile || mustBeDirectory) {
      const fs = require('fs');
      const path = require('path');
      
      if (!fs.existsSync(value)) {
        throw new ValidationError('Path does not exist');
      }
      
      const stats = fs.statSync(value);
      
      if (mustBeFile && !stats.isFile()) {
        throw new ValidationError('Path must be a file');
      }
      
      if (mustBeDirectory && !stats.isDirectory()) {
        throw new ValidationError('Path must be a directory');
      }
    }
    
    return true;
  },

  /**
   * Custom validator wrapper
   */
  custom(validator, message = 'Validation failed') {
    return (value) => {
      try {
        const result = validator(value);
        if (result !== true && result !== undefined) {
          throw new ValidationError(message);
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new ValidationError(message);
      }
      return true;
    };
  }
};

/**
 * Schema validation class
 */
class Schema {
  constructor(definition) {
    this.definition = definition;
  }

  /**
   * Validate an object against the schema
   */
  validate(data, path = '') {
    const errors = [];
    
    for (const [key, rules] of Object.entries(this.definition)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const value = data[key];
      
      try {
        if (Array.isArray(rules)) {
          // Array of validators
          for (const rule of rules) {
            if (typeof rule === 'function') {
              rule(value);
            } else if (typeof rule === 'object' && rule.validator) {
              rule.validator(value);
            }
          }
        } else if (typeof rules === 'function') {
          // Single validator function
          rules(value);
        } else if (typeof rules === 'object') {
          if (rules.validator) {
            // Validator with options
            rules.validator(value);
          } else if (rules.type === 'object' && rules.properties) {
            // Nested object schema
            if (value && typeof value === 'object') {
              const nestedSchema = new Schema(rules.properties);
              nestedSchema.validate(value, fieldPath);
            }
          }
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          error.field = fieldPath;
          error.value = value;
          errors.push(error);
        } else {
          errors.push(new ValidationError(`Validation error in ${fieldPath}: ${error.message}`, fieldPath, value));
        }
      }
    }
    
    if (errors.length > 0) {
      const combinedMessage = errors.map(e => `${e.field || 'field'}: ${e.message}`).join('; ');
      const mainError = new ValidationError(`Validation failed: ${combinedMessage}`);
      mainError.errors = errors;
      throw mainError;
    }
    
    return true;
  }

  /**
   * Validate and sanitize data
   */
  validateAndSanitize(data) {
    this.validate(data);
    return this.sanitize(data);
  }

  /**
   * Sanitize data according to schema
   */
  sanitize(data) {
    const sanitized = { ...data };
    
    for (const [key, rules] of Object.entries(this.definition)) {
      const value = sanitized[key];
      
      if (rules.sanitize && typeof rules.sanitize === 'function') {
        sanitized[key] = rules.sanitize(value);
      }
    }
    
    return sanitized;
  }
}

/**
 * Pre-defined schemas for common NVMCP operations
 */
const Schemas = {
  tagCreation: new Schema({
    name: Validators.tagName,
    description: (value) => value ? Validators.string(value, { maxLength: VALIDATION.DESCRIPTION.MAX_LENGTH }) : true
  }),

  mcpAddition: new Schema({
    source: Validators.mcpSource,
    name: (value) => value ? Validators.tagName(value) : true
  }),

  processKill: new Schema({
    processId: Validators.processId
  }),

  tagConfig: new Schema({
    name: Validators.tagName,
    description: (value) => value ? Validators.string(value, { maxLength: 200 }) : true,
    mcps: (value) => {
      if (value) {
        Validators.array(Object.keys(value));
        Object.values(value).forEach(source => Validators.mcpSource(source));
      }
      return true;
    }
  })
};

/**
 * Sanitization utilities
 */
const Sanitizers = {
  /**
   * Trim whitespace
   */
  trim: (value) => typeof value === 'string' ? value.trim() : value,

  /**
   * Convert to lowercase
   */
  lowercase: (value) => typeof value === 'string' ? value.toLowerCase() : value,

  /**
   * Remove special characters except allowed ones
   */
  alphanumeric: (value) => typeof value === 'string' ? value.replace(/[^a-zA-Z0-9-_]/g, '') : value,

  /**
   * Escape HTML entities
   */
  escapeHtml: (value) => {
    if (typeof value !== 'string') return value;
    
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
};

/**
 * Validation middleware for commands
 */
function validateCommand(schema) {
  return (args, options) => {
    const data = { args, options };
    schema.validate(data);
    return data;
  };
}

/**
 * Quick validation helper functions
 */
function validate(condition, message, field, value) {
  if (!condition) {
    throw new ValidationError(message, field, value);
  }
}

function validateArgs(args, minLength, message = 'Insufficient arguments') {
  if (args.length < minLength) {
    throw new ValidationError(`${message} (expected ${minLength}, got ${args.length})`);
  }
}

function validateOptions(options, required = []) {
  for (const key of required) {
    if (!(key in options) || options[key] === undefined) {
      throw new ValidationError(`Required option --${key} is missing`);
    }
  }
}

module.exports = {
  Validators,
  Schema,
  Schemas,
  Sanitizers,
  validateCommand,
  validate,
  validateArgs,
  validateOptions,
  ValidationError
};