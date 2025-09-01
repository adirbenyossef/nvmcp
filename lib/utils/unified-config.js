/**
 * @fileoverview Unified configuration management for NVMCP
 * @module unified-config
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { encryptSensitiveData, decryptSensitiveData } = require('./crypto');
const { ConfigError } = require('./errors');
const { FILES, DEFAULTS, INTEGRATIONS } = require('../constants');

/**
 * Configuration paths
 */
const PATHS = {
  NVMCP_DIR: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR),
  CONFIG_FILE: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.CONFIG_FILE),
  ACTIVE_TAG_FILE: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.ACTIVE_TAG_FILE),
  RUNNING_PROCESSES_FILE: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.RUNNING_PROCESSES_FILE),
  TAGS_DIR: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.TAGS_DIR),
  CACHE_DIR: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.CACHE_DIR),
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  ...DEFAULTS.CONFIG,
  integrations: {
    claude: {
      enabled: true,
      configPath: path.join(os.homedir(), INTEGRATIONS.CLAUDE.CONFIG_PATH)
    },
    cursor: {
      enabled: true,
      configPath: path.join(os.homedir(), INTEGRATIONS.CURSOR.CONFIG_PATH)
    },
    vscode: {
      enabled: true,
      configPath: path.join(os.homedir(), INTEGRATIONS.VSCODE.CONFIG_PATH)
    }
  },
  features: {
    toolDiscovery: true,
    processManagement: true,
    remoteRepositories: true,
    encryption: true
  }
};

let initialized = false;
let config = null;

/**
 * Initialize the configuration system
 * @param {boolean} [force=false] - Force re-initialization
 */
function initialize(force = false) {
  if (initialized && !force) return;

  ensureDirectories();
  loadConfiguration();
  initialized = true;
}

/**
 * Ensure all required directories exist
 */
function ensureDirectories() {
  const dirs = [
    PATHS.NVMCP_DIR,
    PATHS.TAGS_DIR,
    PATHS.CACHE_DIR
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Load the main configuration
 */
function loadConfiguration() {
  try {
    if (fs.existsSync(PATHS.CONFIG_FILE)) {
      const content = fs.readFileSync(PATHS.CONFIG_FILE, 'utf8');
      config = { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    } else {
      config = { ...DEFAULT_CONFIG };
      saveConfiguration();
    }
  } catch (error) {
    console.warn('Warning: Invalid config file, using defaults');
    config = { ...DEFAULT_CONFIG };
    saveConfiguration();
  }
}

/**
 * Save the main configuration
 */
function saveConfiguration() {
  try {
    fs.writeFileSync(PATHS.CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new ConfigError(`Failed to save configuration: ${error.message}`);
  }
}

/**
 * Get configuration value
 * @param {string} [key] - Configuration key (dot notation supported)
 * @param {*} [defaultValue] - Default value if key not found
 * @returns {*} Configuration value
 */
function getConfig(key = null, defaultValue = null) {
  if (!initialized) initialize();

  if (!key) return config;

  return getNestedValue(config, key, defaultValue);
}

/**
 * Set configuration value
 * @param {string} key - Configuration key (dot notation supported)
 * @param {*} value - Value to set
 */
function setConfig(key, value) {
  if (!initialized) initialize();

  setNestedValue(config, key, value);
  saveConfiguration();
}

/**
 * Get nested value from an object using dot notation
 * @param {Object} obj - Object to search
 * @param {string} key - Key path (dot notation)
 * @param {*} defaultValue - Default value
 * @returns {*} Found value or default
 */
function getNestedValue(obj, key, defaultValue) {
  const keys = key.split('.');
  let current = obj;

  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return defaultValue;
    }
  }

  return current;
}

/**
 * Set nested value in an object using dot notation
 * @param {Object} obj - Object to modify
 * @param {string} key - Key path (dot notation)
 * @param {*} value - Value to set
 */
function setNestedValue(obj, key, value) {
  const keys = key.split('.');
  const lastKey = keys.pop();
  let current = obj;

  for (const k of keys) {
    if (!(k in current) || typeof current[k] !== 'object') {
      current[k] = {};
    }
    current = current[k];
  }

  current[lastKey] = value;
}


/**
 * Get tag configuration
 * @param {string} tagName - Name of the tag
 * @returns {Object|null} Tag configuration or null if not found
 */
function getTagConfig(tagName) {
  const tagFile = path.join(PATHS.TAGS_DIR, `${tagName}.json`);

  if (!fs.existsSync(tagFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(tagFile, 'utf8');
    const tagConfig = JSON.parse(content);
    return decryptSensitiveData(tagConfig);
  } catch (error) {
    throw new ConfigError(`Invalid tag config for ${tagName}: ${error.message}`);
  }
}

/**
 * Save tag configuration
 * @param {string} tagName - Name of the tag
 * @param {Object} tagConfig - Tag configuration
 * @returns {Object} Saved tag configuration
 */
function saveTagConfig(tagName, tagConfig) {
  const tagFile = path.join(PATHS.TAGS_DIR, `${tagName}.json`);

  const config = {
    name: tagName,
    version: '2.0.0',
    created: tagConfig.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    description: tagConfig.description || '',
    mcps: tagConfig.mcps || {},
    environment: tagConfig.environment || {},
    settings: {
      autoStart: false,
      ...tagConfig.settings
    },
    ...tagConfig
  };

  const encryptedConfig = encryptSensitiveData(config);
  fs.writeFileSync(tagFile, JSON.stringify(encryptedConfig, null, 2));

  return config;
}

/**
 * List all available tags
 * @returns {Array<string>} Array of tag names
 */
function listTags() {
  if (!fs.existsSync(PATHS.TAGS_DIR)) {
    return [];
  }

  return fs.readdirSync(PATHS.TAGS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.basename(file, '.json'))
    .sort();
}

/**
 * Delete a tag
 * @param {string} tagName - Name of the tag to delete
 * @returns {boolean} True if tag was deleted, false if not found
 */
function deleteTag(tagName) {
  const tagFile = path.join(PATHS.TAGS_DIR, `${tagName}.json`);

  if (fs.existsSync(tagFile)) {
    fs.unlinkSync(tagFile);
    return true;
  }

  return false;
}

/**
 * Check if a tag exists
 * @param {string} tagName - Name of the tag
 * @returns {boolean} True if tag exists
 */
function tagExists(tagName) {
  const tagFile = path.join(PATHS.TAGS_DIR, `${tagName}.json`);
  return fs.existsSync(tagFile);
}

/**
 * Get active tag
 * @returns {string|null} Active tag name or null
 */
function getActiveTag() {
  if (!fs.existsSync(PATHS.ACTIVE_TAG_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(PATHS.ACTIVE_TAG_FILE, 'utf8');
    const activeData = JSON.parse(content);
    return activeData.tag;
  } catch (error) {
    return null;
  }
}

/**
 * Set active tag
 * @param {string} tagName - Name of the tag to set as active
 */
function setActiveTag(tagName) {
  const activeData = {
    tag: tagName,
    activated: new Date().toISOString(),
    version: '2.0.0'
  };

  fs.writeFileSync(PATHS.ACTIVE_TAG_FILE, JSON.stringify(activeData, null, 2));
}

/**
 * Create a default tag configuration
 * @param {string} tagName - Name of the tag
 * @param {string} [description=''] - Tag description
 * @param {Object} [mcps={}] - Initial MCPs
 * @returns {Object} Default tag configuration
 */
function createDefaultTag(tagName, description = '', mcps = {}) {
  return {
    name: tagName,
    version: '2.0.0',
    description,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    mcps,
    environment: {},
    settings: {
      autoStart: false
    }
  };
}

/**
 * Get running processes (cleans up dead processes automatically)
 * @returns {Object} Running processes object
 */
function getRunningProcesses() {
  if (!fs.existsSync(PATHS.RUNNING_PROCESSES_FILE)) {
    return {};
  }

  try {
    const content = fs.readFileSync(PATHS.RUNNING_PROCESSES_FILE, 'utf8');
    const processes = JSON.parse(content);

    const activeProcesses = {};
    for (const [id, processInfo] of Object.entries(processes)) {
      try {
        process.kill(processInfo.pid, 0);
        activeProcesses[id] = processInfo;
      } catch (error) {
      }
    }

    // Update the file if we removed dead processes
    if (Object.keys(activeProcesses).length !== Object.keys(processes).length) {
      saveRunningProcesses(activeProcesses);
    }

    return activeProcesses;
  } catch (error) {
    return {};
  }
}

/**
 * Save running processes
 * @param {Object} processes - Process information
 */
function saveRunningProcesses(processes) {
  fs.writeFileSync(PATHS.RUNNING_PROCESSES_FILE, JSON.stringify(processes, null, 2));
}

/**
 * Add running process
 * @param {string} id - Process ID
 * @param {Object} processInfo - Process information
 */
function addRunningProcess(id, processInfo) {
  const processes = getRunningProcesses();
  processes[id] = {
    ...processInfo,
    started: new Date().toISOString(),
    version: '2.0.0'
  };
  saveRunningProcesses(processes);
}

/**
 * Remove running process
 * @param {string} id - Process ID
 */
function removeRunningProcess(id) {
  const processes = getRunningProcesses();
  delete processes[id];
  saveRunningProcesses(processes);
}

/**
 * Parse MCP source string into structured information
 * @param {string} source - Source string to parse
 * @returns {Object} Parsed source information
 */
function parseSource(source) {
  if (source.startsWith('npm:')) {
    const packageName = source.slice(4);
    return {
      type: 'npm',
      package: packageName,
      name: packageName.split('/').pop(),
      safeName: packageName.startsWith('@') ?
        packageName.replace('@', '').replace('/', '-') :
        packageName.split('/').pop()
    };
  }

  if (source.startsWith('github:')) {
    const repo = source.slice(7);
    const [owner, repoName] = repo.split('/');
    return {
      type: 'github',
      owner,
      repo: repoName,
      fullRepo: repo,
      name: repoName
    };
  }

  if (source.startsWith('https://') || source.startsWith('http://')) {
    const url = new URL(source);
    const pathParts = url.pathname.split('/').filter(p => p);
    const name = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || 'remote-mcp';

    return {
      type: 'remote',
      url: source,
      name: name.replace(/\.git$/, '')
    };
  }

  if (source.startsWith('git+')) {
    const gitUrl = source.slice(4);
    return {
      type: 'git',
      url: gitUrl,
      name: path.basename(gitUrl, '.git')
    };
  }

  return {
    type: 'npm',
    package: source,
    name: source.split('/').pop(),
    safeName: source.startsWith('@') ?
      source.replace('@', '').replace('/', '-') :
      source.split('/').pop()
  };
}

/**
 * Get cache directory for a source
 * @param {string} sourceName - Name of the source
 * @returns {string} Cache directory path
 */
function getCacheDir(sourceName) {
  return path.join(PATHS.CACHE_DIR, sourceName);
}

module.exports = {
  // Core functions
  initialize,
  ensureDirectories,
  getConfig,
  setConfig,

  // Tag management
  getTagConfig,
  saveTagConfig,
  listTags,
  deleteTag,
  tagExists,
  getActiveTag,
  setActiveTag,
  createDefaultTag,

  // Process management
  getRunningProcesses,
  saveRunningProcesses,
  addRunningProcess,
  removeRunningProcess,

  // Utilities
  parseSource,
  getCacheDir,

  // Path constants (for compatibility)
  NVMCP_DIR: PATHS.NVMCP_DIR,
  CONFIGS_DIR: PATHS.TAGS_DIR,
  CACHE_DIR: PATHS.CACHE_DIR,
  ACTIVE_TAG_FILE: PATHS.ACTIVE_TAG_FILE,
  RUNNING_FILE: PATHS.RUNNING_PROCESSES_FILE
};
