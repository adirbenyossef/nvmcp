/**
 * Centralized Error Handling System for NVMCP
 * Provides consistent error types, formatting, and logging
 * @author Claude (Refactored)
 * @version 2.0.0
 */

const { colors } = require('./colors');

/**
 * Base error class for all NVMCP errors
 */
class NVMCPError extends Error {
  constructor(message, code = 'NVMCP_ERROR', details = null) {
    super(message);
    this.name = 'NVMCPError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get formatted error message for console output
   */
  getFormattedMessage() {
    return `${colors.red('✗ Error:')} ${this.message}`;
  }

  /**
   * Get detailed error information for debugging
   */
  getDetailedInfo() {
    const info = {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
    };

    if (this.details) {
      info.details = this.details;
    }

    if (process.env.DEBUG || process.env.NVMCP_DEBUG) {
      info.stack = this.stack;
    }

    return info;
  }
}

/**
 * Configuration-related errors
 */
class ConfigurationError extends NVMCPError {
  constructor(message, details = null) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Tag management errors
 */
class TagError extends NVMCPError {
  constructor(message, tagName = null, details = null) {
    super(message, 'TAG_ERROR', { tagName, ...details });
    this.name = 'TagError';
    this.tagName = tagName;
  }
}

/**
 * MCP source errors
 */
class MCPSourceError extends NVMCPError {
  constructor(message, source = null, details = null) {
    super(message, 'MCP_SOURCE_ERROR', { source, ...details });
    this.name = 'MCPSourceError';
    this.source = source;
  }
}

/**
 * Process management errors
 */
class ProcessError extends NVMCPError {
  constructor(message, processId = null, details = null) {
    super(message, 'PROCESS_ERROR', { processId, ...details });
    this.name = 'ProcessError';
    this.processId = processId;
  }
}

/**
 * Network-related errors
 */
class NetworkError extends NVMCPError {
  constructor(message, url = null, details = null) {
    super(message, 'NETWORK_ERROR', { url, ...details });
    this.name = 'NetworkError';
    this.url = url;
  }
}

/**
 * File system errors
 */
class FileSystemError extends NVMCPError {
  constructor(message, path = null, details = null) {
    super(message, 'FILESYSTEM_ERROR', { path, ...details });
    this.name = 'FileSystemError';
    this.path = path;
  }
}

/**
 * Validation errors
 */
class ValidationError extends NVMCPError {
  constructor(message, field = null, value = null, details = null) {
    super(message, 'VALIDATION_ERROR', { field, value, ...details });
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Migration errors
 */
class MigrationError extends NVMCPError {
  constructor(message, details = null) {
    super(message, 'MIGRATION_ERROR', details);
    this.name = 'MigrationError';
  }
}

/**
 * Crypto/Security errors
 */
class CryptoError extends NVMCPError {
  constructor(message, details = null) {
    super(message, 'CRYPTO_ERROR', details);
    this.name = 'CryptoError';
  }
}

/**
 * Command execution errors
 */
class CommandError extends NVMCPError {
  constructor(message, command = null, args = null, details = null) {
    super(message, 'COMMAND_ERROR', { command, args, ...details });
    this.name = 'CommandError';
    this.command = command;
    this.args = args;
  }
}

/**
 * Error handler utility functions
 */
class ErrorHandler {
  /**
   * Handle errors based on type and context
   * @param {Error} error - The error to handle
   * @param {Object} context - Additional context for error handling
   */
  static handle(error, context = {}) {
    const { showStack = false, exit = false, logLevel = 'error' } = context;

    // Format the error message
    let message;
    if (error instanceof NVMCPError) {
      message = error.getFormattedMessage();
    } else {
      message = `${colors.red('✗ Error:')} ${error.message}`;
    }

    // Log the error
    console.error(message);

    // Show additional details if available
    if (error instanceof NVMCPError && error.details) {
      const details = error.details;
      for (const [key, value] of Object.entries(details)) {
        if (value !== null && value !== undefined) {
          console.error(`   ${colors.dim(`${key}:`)} ${value}`);
        }
      }
    }

    // Show stack trace if requested or in debug mode
    if (showStack || process.env.DEBUG || process.env.NVMCP_DEBUG) {
      console.error(colors.dim('\nStack trace:'));
      console.error(colors.dim(error.stack));
    }

    // Exit if requested
    if (exit) {
      process.exit(1);
    }

    return error;
  }

  /**
   * Wrap a function with error handling
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Error handling options
   */
  static wrap(fn, options = {}) {
    return async function(...args) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        return ErrorHandler.handle(error, options);
      }
    };
  }

  /**
   * Create a promise rejection handler
   * @param {string} context - Context for the error
   * @param {Object} options - Error handling options
   */
  static createRejectionHandler(context, options = {}) {
    return (error) => {
      const wrappedError = new NVMCPError(
        `Unhandled rejection in ${context}: ${error.message}`,
        'UNHANDLED_REJECTION',
        { originalError: error.message, context }
      );
      return ErrorHandler.handle(wrappedError, { exit: true, ...options });
    };
  }

  /**
   * Create an exception handler
   * @param {string} context - Context for the error
   * @param {Object} options - Error handling options
   */
  static createExceptionHandler(context, options = {}) {
    return (error) => {
      const wrappedError = new NVMCPError(
        `Uncaught exception in ${context}: ${error.message}`,
        'UNCAUGHT_EXCEPTION',
        { originalError: error.message, context }
      );
      return ErrorHandler.handle(wrappedError, { exit: true, ...options });
    };
  }

  /**
   * Validate and throw validation error if invalid
   * @param {boolean} condition - Validation condition
   * @param {string} message - Error message
   * @param {string} field - Field name
   * @param {any} value - Field value
   */
  static validate(condition, message, field = null, value = null) {
    if (!condition) {
      throw new ValidationError(message, field, value);
    }
  }

  /**
   * Assert a condition and throw error if false
   * @param {boolean} condition - Condition to assert
   * @param {string} message - Error message
   * @param {string} code - Error code
   */
  static assert(condition, message, code = 'ASSERTION_ERROR') {
    if (!condition) {
      throw new NVMCPError(message, code);
    }
  }

  /**
   * Safely execute async operation with retries
   * @param {Function} operation - Async operation to execute
   * @param {Object} options - Retry options
   */
  static async withRetry(operation, options = {}) {
    const {
      retries = 3,
      delay = 1000,
      backoff = 2,
      shouldRetry = () => true
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === retries || !shouldRetry(error)) {
          throw error;
        }
        
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw lastError;
  }

  /**
   * Create a timeout wrapper for promises
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeout - Timeout in milliseconds
   * @param {string} message - Timeout error message
   */
  static withTimeout(promise, timeout, message = 'Operation timed out') {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new NVMCPError(message, 'TIMEOUT')), timeout)
      )
    ]);
  }
}

/**
 * Common error factory functions
 */
const ErrorFactory = {
  /**
   * Create a configuration error
   */
  config: (message, details) => new ConfigurationError(message, details),

  /**
   * Create a tag error
   */
  tag: (message, tagName, details) => new TagError(message, tagName, details),

  /**
   * Create an MCP source error
   */
  mcpSource: (message, source, details) => new MCPSourceError(message, source, details),

  /**
   * Create a process error
   */
  process: (message, processId, details) => new ProcessError(message, processId, details),

  /**
   * Create a network error
   */
  network: (message, url, details) => new NetworkError(message, url, details),

  /**
   * Create a file system error
   */
  filesystem: (message, path, details) => new FileSystemError(message, path, details),

  /**
   * Create a validation error
   */
  validation: (message, field, value, details) => new ValidationError(message, field, value, details),

  /**
   * Create a migration error
   */
  migration: (message, details) => new MigrationError(message, details),

  /**
   * Create a crypto error
   */
  crypto: (message, details) => new CryptoError(message, details),

  /**
   * Create a command error
   */
  command: (message, command, args, details) => new CommandError(message, command, args, details)
};

module.exports = {
  // Error classes
  NVMCPError,
  ConfigurationError,
  TagError,
  MCPSourceError,
  ProcessError,
  NetworkError,
  FileSystemError,
  ValidationError,
  MigrationError,
  CryptoError,
  CommandError,

  // Error handler
  ErrorHandler,

  // Error factory
  ErrorFactory,

  // Convenience exports
  handle: ErrorHandler.handle,
  wrap: ErrorHandler.wrap,
  validate: ErrorHandler.validate,
  assert: ErrorHandler.assert,
  withRetry: ErrorHandler.withRetry,
  withTimeout: ErrorHandler.withTimeout
};