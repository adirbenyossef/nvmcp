/**
 * NVMCP Constants
 * Centralized constants and configuration values
 * @version 2.0.0
 */

/**
 * Time-related constants (in milliseconds)
 */
const TIME = {
  // Network timeouts
  DEFAULT_TIMEOUT: 30000,        // 30 seconds
  QUICK_TIMEOUT: 5000,           // 5 seconds
  DOWNLOAD_TIMEOUT: 60000,       // 60 seconds (for file downloads)
  
  // Process management
  PROCESS_KILL_TIMEOUT: 5000,    // 5 seconds to wait before force kill
  PROCESS_START_TIMEOUT: 30000,  // 30 seconds to wait for process start
  
  // Caching
  CACHE_TTL: 3600000,            // 1 hour in ms
  
  // Retry delays
  RETRY_DELAY: 1000,             // 1 second base delay
  RETRY_BACKOFF: 2,              // Exponential backoff multiplier
  
  // Time conversion
  MS_TO_SECONDS: 1000,
};

/**
 * Crypto-related constants
 */
const CRYPTO = {
  ALGORITHM: 'aes-256-cbc',
  KEY_LENGTH: 32,                // bytes
  IV_LENGTH: 16,                 // bytes
  SALT_LENGTH: 16,               // bytes
  PBKDF2_ITERATIONS: 100000,     // PBKDF2 iterations
  MASTER_KEY_LENGTH: 32,         // bytes for master key
};

/**
 * Validation constants
 */
const VALIDATION = {
  TAG_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9]([a-zA-Z0-9-_]*[a-zA-Z0-9])?$/,
    RESERVED_NAMES: ['help', 'version', 'list', 'ls', 'create', 'delete', 'use', 'config', 'init'],
  },
  
  DESCRIPTION: {
    MAX_LENGTH: 200,
  },
  
  PROCESS_ID: {
    PATTERN: /^[a-zA-Z0-9-_]+-\d+$/,
  },
  
  MCP_SOURCE: {
    PATTERNS: [
      /^npm:.+/,                          // npm:package-name
      /^github:[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_.]+$/, // github:owner/repo
      /^https?:\/\/.+/,                   // http/https URL
      /^git\+https:\/\/.+/,               // git+https URL
      /^[a-zA-Z0-9@/._-]+$/               // Direct package name
    ],
  },
  
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
};

/**
 * Performance and limits
 */
const LIMITS = {
  MAX_CONCURRENT_PROCESSES: 10,
  MAX_RETRY_ATTEMPTS: 3,
  MAX_OUTPUT_SIZE: 30000,        // characters
  MAX_LINE_LENGTH: 2000,         // characters
  MAX_FILE_READ_LINES: 2000,     // lines
  
  // Table formatting
  MAX_COLUMN_WIDTH: 80,
  MIN_COLUMN_WIDTH: 10,
  
  // Progress bar
  PROGRESS_BAR_WIDTH: 20,
  SPINNER_FRAME_DELAY: 100,      // ms
};

/**
 * File and directory constants
 */
const FILES = {
  CONFIG: {
    NVMCP_DIR: '.nvmcp',
    CONFIG_FILE: 'config.json',
    ACTIVE_TAG_FILE: 'active-tag.json',
    RUNNING_PROCESSES_FILE: 'running.json',
    MASTER_KEY_FILE: '.key',
    TAGS_DIR: 'configs',
    CACHE_DIR: 'cache',
  },
  
  PERMISSIONS: {
    MASTER_KEY: 0o600,             // Read/write for owner only
    CONFIG_DIR: 0o755,             // Standard directory permissions
    CONFIG_FILE: 0o644,            // Standard file permissions
  },
  
  EXTENSIONS: {
    JSON: '.json',
    JS: '.js',
    PY: '.py',
    GIT: '.git',
  },
};

/**
 * Network and protocol constants
 */
const NETWORK = {
  HTTP: {
    DEFAULT_PORT: 80,
    SECURE_PORT: 443,
    USER_AGENT: 'nvmcp/2.0.0',
    
    STATUS_CODES: {
      OK: 200,
      REDIRECT_START: 300,
      REDIRECT_END: 400,
      NOT_FOUND: 404,
      SERVER_ERROR: 500,
    },
    
    HEADERS: {
      CONTENT_TYPE: 'application/json',
      ACCEPT: 'application/json, */*',
    },
  },
  
  REGISTRY: {
    NPM_BASE_URL: 'https://registry.npmjs.org',
    GITHUB_API_BASE: 'https://api.github.com',
  },
};

/**
 * CLI and UI constants
 */
const UI = {
  COLORS: {
    ANSI_RESET: '\x1b[0m',
    ANSI_BOLD: '\x1b[1m',
    ANSI_DIM: '\x1b[2m',
    ANSI_RED: '\x1b[31m',
    ANSI_GREEN: '\x1b[32m',
    ANSI_YELLOW: '\x1b[33m',
    ANSI_BLUE: '\x1b[34m',
    ANSI_CYAN: '\x1b[36m',
  },
  
  SYMBOLS: {
    SUCCESS: '✓',
    ERROR: '✗',
    WARNING: '⚠',
    INFO: 'ℹ',
    SPINNER: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    PROGRESS_FILLED: '█',
    PROGRESS_EMPTY: '░',
  },
  
  TABLE: {
    PADDING: 2,
    MIN_COLUMN_WIDTH: 10,
    MAX_COLUMN_WIDTH: 50,
  },
};

/**
 * Application metadata
 */
const APP = {
  NAME: 'nvmcp',
  VERSION: '2.0.0',
  DESCRIPTION: 'Node Version Manager for Model Context Protocol',
  ARCHITECTURE: 'unified',
  
  COMMANDS: {
    PRIMARY: ['use', 'create', 'list', 'delete', 'add', 'remove', 'start', 'stop', 'ps', 'kill'],
    ALIASES: {
      'ls': 'list',
      'del': 'delete',
      'rm': 'remove',
    },
  },
};

/**
 * Error codes and messages
 */
const ERRORS = {
  CODES: {
    NVMCP_ERROR: 'NVMCP_ERROR',
    CONFIG_ERROR: 'CONFIG_ERROR',
    TAG_ERROR: 'TAG_ERROR',
    MCP_SOURCE_ERROR: 'MCP_SOURCE_ERROR',
    PROCESS_ERROR: 'PROCESS_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    FILESYSTEM_ERROR: 'FILESYSTEM_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MIGRATION_ERROR: 'MIGRATION_ERROR',
    CRYPTO_ERROR: 'CRYPTO_ERROR',
    COMMAND_ERROR: 'COMMAND_ERROR',
    TIMEOUT: 'TIMEOUT',
    UNHANDLED_REJECTION: 'UNHANDLED_REJECTION',
    UNCAUGHT_EXCEPTION: 'UNCAUGHT_EXCEPTION',
    ASSERTION_ERROR: 'ASSERTION_ERROR',
  },
  
  EXIT_CODES: {
    SUCCESS: 0,
    GENERAL_ERROR: 1,
    CONFIG_ERROR: 2,
    VALIDATION_ERROR: 3,
    NETWORK_ERROR: 4,
    FILESYSTEM_ERROR: 5,
  },
};

/**
 * Integration settings
 */
const INTEGRATIONS = {
  CLAUDE: {
    NAME: 'claude',
    CONFIG_PATH: 'Library/Application Support/Claude/claude_desktop_config.json',
  },
  
  CURSOR: {
    NAME: 'cursor',
    CONFIG_PATH: '.cursor/mcp.json',
  },
  
  VSCODE: {
    NAME: 'vscode',
    CONFIG_PATH: '.vscode/mcp.json',
  },
};

/**
 * Environment variables
 */
const ENV = {
  DEBUG: 'DEBUG',
  NVMCP_DEBUG: 'NVMCP_DEBUG',
  FORCE_COLOR: 'FORCE_COLOR',
  NO_COLOR: 'NO_COLOR',
  NODE_DISABLE_COLORS: 'NODE_DISABLE_COLORS',
  HOME: 'HOME',
  TMPDIR: 'TMPDIR',
};

/**
 * Default configurations
 */
const DEFAULTS = {
  CONFIG: {
    version: '2.0.0',
    settings: {
      defaultTag: null,
      autoStartOnUse: false,
      debugMode: false,
    },
    performance: {
      cacheEnabled: true,
      cacheTTL: TIME.CACHE_TTL,
      maxConcurrentProcesses: LIMITS.MAX_CONCURRENT_PROCESSES,
      requestTimeout: TIME.DEFAULT_TIMEOUT,
    },
  },
  
  TAG: {
    version: '2.0.0',
    mcps: {},
    environment: {},
    settings: {
      autoStart: false,
    },
  },
};

module.exports = {
  TIME,
  CRYPTO,
  VALIDATION,
  LIMITS,
  FILES,
  NETWORK,
  UI,
  APP,
  ERRORS,
  INTEGRATIONS,
  ENV,
  DEFAULTS,
};