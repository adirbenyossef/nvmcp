/**
 * @fileoverview Error handling utilities for NVMCP
 * @module errors
 */

const { colors } = require('./colors');

/**
 * Base error class for all NVMCP errors
 */
class NVMCPError extends Error {
  /**
   * Create a new NVMCP error
   * @param {string} message - Error message
   * @param {string} [code='NVMCP_ERROR'] - Error code
   * @param {Object} [details=null] - Additional error details
   */
  constructor(message, code = 'NVMCP_ERROR', details = null) {
    super(message);
    this.name = 'NVMCPError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get formatted error message for console output
   * @returns {string} Formatted error message
   */
  getFormattedMessage() {
    return `${colors.red('✗ Error:')} ${this.message}`;
  }

  /**
   * Get detailed error information for debugging
   * @returns {Object} Detailed error information
   */
  getDetailedInfo() {
    const info = {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp
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
 * Validation error for invalid input
 */
class ValidationError extends NVMCPError {
  /**
   * Create a validation error
   * @param {string} message - Error message
   * @param {string} [field] - Field that failed validation
   * @param {*} [value] - Value that failed validation
   */
  constructor(message, field = null, value = null) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Configuration error for config-related issues
 */
class ConfigError extends NVMCPError {
  /**
   * Create a configuration error
   * @param {string} message - Error message
   * @param {Object} [details] - Additional details
   */
  constructor(message, details = null) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

/**
 * Process error for MCP process management issues
 */
class ProcessError extends NVMCPError {
  /**
   * Create a process error
   * @param {string} message - Error message
   * @param {string} [processId] - Process ID that failed
   * @param {Object} [details] - Additional details
   */
  constructor(message, processId = null, details = null) {
    super(message, 'PROCESS_ERROR', { processId, ...details });
    this.name = 'ProcessError';
    this.processId = processId;
  }
}

/**
 * Command error for CLI command issues
 */
class CommandError extends NVMCPError {
  /**
   * Create a command error
   * @param {string} message - Error message
   * @param {string} [command] - Command that failed
   * @param {Array} [args] - Command arguments
   * @param {Object} [details] - Additional details
   */
  constructor(message, command = null, args = null, details = null) {
    super(message, 'COMMAND_ERROR', { command, args, ...details });
    this.name = 'CommandError';
    this.command = command;
    this.args = args;
  }
}

/**
 * Error handler utility class
 */
class ErrorHandler {
  /**
   * Handle errors based on type and context
   * @param {Error} error - The error to handle
   * @param {Object} [context={}] - Additional context for error handling
   * @param {boolean} [context.showStack=false] - Show stack trace
   * @param {boolean} [context.exit=false] - Exit process after handling
   * @returns {Error} The handled error
   */
  static handle(error, context = {}) {
    const { showStack = false, exit = false } = context;

    let message;
    if (error instanceof NVMCPError) {
      message = error.getFormattedMessage();
    } else {
      message = `${colors.red('✗ Error:')} ${error.message}`;
    }

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

    if (exit) {
      process.exit(1);
    }

    return error;
  }

  /**
   * Wrap a function with error handling
   * @param {Function} fn - Function to wrap
   * @param {Object} [options={}] - Error handling options
   * @returns {Function} Wrapped function
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
   * @param {Object} [options={}] - Error handling options
   * @returns {Function} Rejection handler function
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
   * @param {Object} [options={}] - Error handling options
   * @returns {Function} Exception handler function
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
}


/**
 * Assert a condition and throw error if false
 * @param {boolean} condition - Condition to assert
 * @param {string} message - Error message
 * @param {string} [code='ASSERTION_ERROR'] - Error code
 * @throws {NVMCPError} If condition is false
 */
function assert(condition, message, code = 'ASSERTION_ERROR') {
  if (!condition) {
    throw new NVMCPError(message, code);
  }
}

/**
 * Validate command line arguments
 * @param {Array} args - Arguments to validate
 * @param {number} minLength - Minimum required arguments
 * @param {string} [message] - Custom error message
 * @throws {ValidationError} If insufficient arguments
 */
function validateArgs(args, minLength, message = 'Insufficient arguments') {
  if (args.length < minLength) {
    throw new ValidationError(`${message} (expected ${minLength}, got ${args.length})`);
  }
}

/**
 * Error factory functions for common error types
 */
const ErrorFactory = {
  /**
   * Create a validation error
   * @param {string} message - Error message
   * @param {string} [field] - Field name
   * @param {*} [value] - Field value
   * @returns {ValidationError} Validation error instance
   */
  validation: (message, field, value) => new ValidationError(message, field, value),

  /**
   * Create a configuration error
   * @param {string} message - Error message
   * @param {Object} [details] - Additional details
   * @returns {ConfigError} Configuration error instance
   */
  config: (message, details) => new ConfigError(message, details),

  /**
   * Create a process error
   * @param {string} message - Error message
   * @param {string} [processId] - Process ID
   * @param {Object} [details] - Additional details
   * @returns {ProcessError} Process error instance
   */
  process: (message, processId, details) => new ProcessError(message, processId, details),

  /**
   * Create a command error
   * @param {string} message - Error message
   * @param {string} [command] - Command name
   * @param {Array} [args] - Command arguments
   * @param {Object} [details] - Additional details
   * @returns {CommandError} Command error instance
   */
  command: (message, command, args, details) => new CommandError(message, command, args, details),

  /**
   * Create a tag error (alias for config error)
   * @param {string} message - Error message
   * @param {string} [tagName] - Tag name
   * @param {Object} [details] - Additional details
   * @returns {ConfigError} Configuration error instance
   */
  tag: (message, tagName, details) => new ConfigError(message, { tagName, ...details }),

  /**
   * Create an MCP source error (alias for validation error)
   * @param {string} message - Error message
   * @param {string} [source] - MCP source
   * @param {Object} [details] - Additional details
   * @returns {ValidationError} Validation error instance
   */
  mcpSource: (message, source, _details) => new ValidationError(message, 'source', source)
};

module.exports = {
  // Error classes
  NVMCPError,
  ValidationError,
  ConfigError,
  ProcessError,
  CommandError,

  // Error handler
  ErrorHandler,

  // Error factory
  ErrorFactory,

  // Convenience functions
  handle: ErrorHandler.handle,
  wrap: ErrorHandler.wrap,
  assert,
  validateArgs
};

