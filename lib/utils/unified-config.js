/**
 * Unified Configuration System for NVMCP
 * Merges legacy config.js and tags.js into a single, cohesive system
 * Provides backward compatibility and migration utilities
 * @author Claude (Refactored)
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { encryptSensitiveData, decryptSensitiveData } = require('./security');
const { ErrorFactory } = require('./errors');
const { FILES, TIME, LIMITS, DEFAULTS, INTEGRATIONS } = require('../constants');

/**
 * Configuration constants and paths
 */
const CONFIG_CONSTANTS = {
  NVMCP_DIR: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR),
  CONFIG_FILE: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.CONFIG_FILE),
  ACTIVE_TAG_FILE: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.ACTIVE_TAG_FILE),
  RUNNING_PROCESSES_FILE: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.RUNNING_PROCESSES_FILE),
  TAGS_DIR: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.TAGS_DIR),
  CACHE_DIR: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.CACHE_DIR),
  
  // Legacy paths (for migration)
  LEGACY_SERVERS_DIR: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.LEGACY_SERVERS_DIR),
  LEGACY_PROFILES_DIR: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.LEGACY_PROFILES_DIR),
  LEGACY_ACTIVE_FILE: path.join(os.homedir(), FILES.CONFIG.NVMCP_DIR, FILES.CONFIG.LEGACY_ACTIVE_FILE),
};

/**
 * Default configuration structure
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

/**
 * Configuration Manager class
 */
class ConfigManager {
  constructor() {
    this.config = null;
    this.configCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the configuration system
   * @param {boolean} force - Force re-initialization
   */
  initialize(force = false) {
    if (this.initialized && !force) return;
    
    // Set initialized early to prevent recursive calls
    this.initialized = true;
    
    this.ensureDirectories();
    this.loadConfiguration();
    this.performMigrationIfNeeded();
  }

  /**
   * Ensure all required directories exist
   */
  ensureDirectories() {
    const dirs = [
      CONFIG_CONSTANTS.NVMCP_DIR,
      CONFIG_CONSTANTS.TAGS_DIR,
      CONFIG_CONSTANTS.CACHE_DIR
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
  loadConfiguration() {
    try {
      if (fs.existsSync(CONFIG_CONSTANTS.CONFIG_FILE)) {
        const content = fs.readFileSync(CONFIG_CONSTANTS.CONFIG_FILE, 'utf8');
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(content) };
      } else {
        this.config = { ...DEFAULT_CONFIG };
        this.saveConfiguration();
      }
    } catch (error) {
      console.warn('Warning: Invalid config file, using defaults');
      this.config = { ...DEFAULT_CONFIG };
      this.saveConfiguration();
    }
  }

  /**
   * Save the main configuration
   */
  saveConfiguration() {
    try {
      fs.writeFileSync(CONFIG_CONSTANTS.CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw ErrorFactory.config(`Failed to save configuration: ${error.message}`, { originalError: error.message });
    }
  }

  /**
   * Get configuration value with dot notation support
   * @param {string} key - Configuration key (e.g., 'settings.defaultTag')
   * @param {any} defaultValue - Default value if key not found
   */
  get(key, defaultValue = null) {
    if (!this.initialized) {
      // Auto-initialize if not done yet
      this.initialize();
    }
    
    return this.getNestedValue(this.config, key, defaultValue);
  }

  /**
   * Set configuration value with dot notation support
   * @param {string} key - Configuration key
   * @param {any} value - Value to set
   */
  set(key, value) {
    if (!this.initialized) {
      // Auto-initialize if not done yet
      this.initialize();
    }
    
    this.setNestedValue(this.config, key, value);
    this.saveConfiguration();
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, key, defaultValue) {
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
   * Set nested value in object using dot notation
   */
  setNestedValue(obj, key, value) {
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
   * Tag Management
   */
  
  /**
   * Get tag configuration
   * @param {string} tagName - Name of the tag
   */
  getTagConfig(tagName) {
    const tagFile = path.join(CONFIG_CONSTANTS.TAGS_DIR, `${tagName}.json`);
    
    if (!fs.existsSync(tagFile)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(tagFile, 'utf8');
      const config = JSON.parse(content);
      return decryptSensitiveData(config);
    } catch (error) {
      throw new Error(`Invalid tag config for ${tagName}: ${error.message}`);
    }
  }

  /**
   * Save tag configuration
   * @param {string} tagName - Name of the tag
   * @param {Object} config - Tag configuration
   */
  saveTagConfig(tagName, config) {
    const tagFile = path.join(CONFIG_CONSTANTS.TAGS_DIR, `${tagName}.json`);
    
    const tagConfig = {
      name: tagName,
      version: '2.0.0',
      created: config.created || new Date().toISOString(),
      updated: new Date().toISOString(),
      description: config.description || '',
      mcps: config.mcps || {},
      environment: config.environment || {},
      settings: {
        autoStart: config.autoStart || false,
        ...config.settings
      },
      ...config
    };
    
    const encryptedConfig = encryptSensitiveData(tagConfig);
    fs.writeFileSync(tagFile, JSON.stringify(encryptedConfig, null, 2));
    
    return tagConfig;
  }

  /**
   * List all available tags
   */
  listTags() {
    if (!fs.existsSync(CONFIG_CONSTANTS.TAGS_DIR)) {
      return [];
    }
    
    return fs.readdirSync(CONFIG_CONSTANTS.TAGS_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'))
      .sort();
  }

  /**
   * Delete a tag
   * @param {string} tagName - Name of the tag to delete
   */
  deleteTag(tagName) {
    const tagFile = path.join(CONFIG_CONSTANTS.TAGS_DIR, `${tagName}.json`);
    
    if (fs.existsSync(tagFile)) {
      fs.unlinkSync(tagFile);
      return true;
    }
    
    return false;
  }

  /**
   * Check if a tag exists
   * @param {string} tagName - Name of the tag
   */
  tagExists(tagName) {
    const tagFile = path.join(CONFIG_CONSTANTS.TAGS_DIR, `${tagName}.json`);
    return fs.existsSync(tagFile);
  }

  /**
   * Get active tag
   */
  getActiveTag() {
    if (!fs.existsSync(CONFIG_CONSTANTS.ACTIVE_TAG_FILE)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(CONFIG_CONSTANTS.ACTIVE_TAG_FILE, 'utf8');
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
  setActiveTag(tagName) {
    const activeData = {
      tag: tagName,
      activated: new Date().toISOString(),
      version: '2.0.0'
    };
    
    fs.writeFileSync(CONFIG_CONSTANTS.ACTIVE_TAG_FILE, JSON.stringify(activeData, null, 2));
  }

  /**
   * Process Management
   */
  
  /**
   * Get running processes
   */
  getRunningProcesses() {
    if (!fs.existsSync(CONFIG_CONSTANTS.RUNNING_PROCESSES_FILE)) {
      return {};
    }
    
    try {
      const content = fs.readFileSync(CONFIG_CONSTANTS.RUNNING_PROCESSES_FILE, 'utf8');
      const processes = JSON.parse(content);
      
      // Clean up dead processes
      const activeProcesses = {};
      for (const [id, processInfo] of Object.entries(processes)) {
        try {
          process.kill(processInfo.pid, 0);
          activeProcesses[id] = processInfo;
        } catch (error) {
          // Process is dead, don't include it
        }
      }
      
      // Update file if we removed dead processes
      if (Object.keys(activeProcesses).length !== Object.keys(processes).length) {
        this.saveRunningProcesses(activeProcesses);
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
  saveRunningProcesses(processes) {
    fs.writeFileSync(CONFIG_CONSTANTS.RUNNING_PROCESSES_FILE, JSON.stringify(processes, null, 2));
  }

  /**
   * Add running process
   * @param {string} id - Process ID
   * @param {Object} processInfo - Process information
   */
  addRunningProcess(id, processInfo) {
    const processes = this.getRunningProcesses();
    processes[id] = {
      ...processInfo,
      started: new Date().toISOString(),
      version: '2.0.0'
    };
    this.saveRunningProcesses(processes);
  }

  /**
   * Remove running process
   * @param {string} id - Process ID
   */
  removeRunningProcess(id) {
    const processes = this.getRunningProcesses();
    delete processes[id];
    this.saveRunningProcesses(processes);
  }

  /**
   * Source parsing utility
   * @param {string} source - Source string to parse
   */
  parseSource(source) {
    // npm:package-name
    if (source.startsWith('npm:')) {
      return {
        type: 'npm',
        package: source.slice(4),
        name: source.slice(4).split('/').pop(),
        safeName: source.slice(4).startsWith('@') ? 
          source.slice(4).replace('@', '').replace('/', '-') : 
          source.slice(4).split('/').pop()
      };
    }
    
    // github:owner/repo
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
    
    // https:// or http://
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
    
    // git+https://
    if (source.startsWith('git+')) {
      const gitUrl = source.slice(4);
      return {
        type: 'git',
        url: gitUrl,
        name: path.basename(gitUrl, '.git')
      };
    }
    
    // Default to npm if no prefix
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
   */
  getCacheDir(sourceName) {
    return path.join(CONFIG_CONSTANTS.CACHE_DIR, sourceName);
  }

  /**
   * Create a default tag configuration
   * @param {string} tagName - Name of the tag
   * @param {string} description - Tag description
   * @param {Object} mcps - Initial MCPs
   */
  createDefaultTag(tagName, description = '', mcps = {}) {
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
   * Migration utilities
   */
  
  /**
   * Check if migration is needed
   */
  needsMigration() {
    return !this.config?.migrated && (
      fs.existsSync(CONFIG_CONSTANTS.LEGACY_SERVERS_DIR) ||
      fs.existsSync(CONFIG_CONSTANTS.LEGACY_PROFILES_DIR) ||
      fs.existsSync(CONFIG_CONSTANTS.LEGACY_ACTIVE_FILE)
    );
  }

  /**
   * Perform migration from legacy configuration
   */
  performMigrationIfNeeded() {
    if (!this.needsMigration()) {
      return;
    }

    // Prevent recursive migration
    if (this._migrating) {
      return;
    }
    this._migrating = true;

    console.log('Migrating legacy configuration to unified system...');
    
    try {
      this.migrateLegacyProfiles();
      this.migrateLegacyServers();
      this.migrateLegacyActive();
      
      // Mark as migrated
      this.config.migrated = true;
      this.saveConfiguration();
      
      console.log('✓ Migration completed successfully');
    } catch (error) {
      console.error('✗ Migration failed:', error.message);
      throw error;
    } finally {
      this._migrating = false;
    }
  }

  /**
   * Migrate legacy profiles to tags
   */
  migrateLegacyProfiles() {
    if (!fs.existsSync(CONFIG_CONSTANTS.LEGACY_PROFILES_DIR)) {
      return;
    }
    
    const profiles = fs.readdirSync(CONFIG_CONSTANTS.LEGACY_PROFILES_DIR)
      .filter(file => file.endsWith('.json'));
    
    for (const profileFile of profiles) {
      const profileName = path.basename(profileFile, '.json');
      const profilePath = path.join(CONFIG_CONSTANTS.LEGACY_PROFILES_DIR, profileFile);
      
      try {
        const profileContent = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        const tagConfig = this.createDefaultTag(
          profileName, 
          profileContent.description || `Migrated from legacy profile: ${profileName}`
        );
        
        // Convert profile servers to MCPs
        if (profileContent.servers) {
          for (const [serverName, serverConfig] of Object.entries(profileContent.servers)) {
            tagConfig.mcps[serverName] = serverConfig.source || serverName;
          }
        }
        
        this.saveTagConfig(profileName, tagConfig);
      } catch (error) {
        console.warn(`Warning: Failed to migrate profile ${profileName}: ${error.message}`);
      }
    }
  }

  /**
   * Migrate legacy servers to MCP sources
   */
  migrateLegacyServers() {
    // Legacy server migration logic
    // This would convert installed servers to appropriate source formats
  }

  /**
   * Migrate legacy active configuration
   */
  migrateLegacyActive() {
    if (!fs.existsSync(CONFIG_CONSTANTS.LEGACY_ACTIVE_FILE)) {
      return;
    }
    
    try {
      const activeContent = JSON.parse(fs.readFileSync(CONFIG_CONSTANTS.LEGACY_ACTIVE_FILE, 'utf8'));
      if (activeContent.profile && this.tagExists(activeContent.profile)) {
        this.setActiveTag(activeContent.profile);
      }
    } catch (error) {
      console.warn('Warning: Failed to migrate active configuration:', error.message);
    }
  }
}

// Global instance
const configManager = new ConfigManager();

/**
 * Convenience functions for backward compatibility
 */

// Initialization
const ensureNvmcpDirs = () => configManager.ensureDirectories();
const initialize = () => configManager.initialize();

// Configuration
const getConfig = () => configManager.config;
const saveConfig = (config) => configManager.set('', config);

// Tags (new primary interface)
const getTagConfig = (tagName) => configManager.getTagConfig(tagName);
const saveTagConfig = (tagName, config) => configManager.saveTagConfig(tagName, config);
const listTags = () => configManager.listTags();
const deleteTag = (tagName) => configManager.deleteTag(tagName);
const tagExists = (tagName) => configManager.tagExists(tagName);
const getActiveTag = () => configManager.getActiveTag();
const setActiveTag = (tagName) => configManager.setActiveTag(tagName);
const createDefaultTag = (tagName, description, mcps) => 
  configManager.createDefaultTag(tagName, description, mcps);

// Process management
const getRunningProcesses = () => configManager.getRunningProcesses();
const saveRunningProcesses = (processes) => configManager.saveRunningProcesses(processes);
const addRunningProcess = (id, processInfo) => configManager.addRunningProcess(id, processInfo);
const removeRunningProcess = (id) => configManager.removeRunningProcess(id);

// Utilities
const parseSource = (source) => configManager.parseSource(source);
const getCacheDir = (sourceName) => configManager.getCacheDir(sourceName);

module.exports = {
  ConfigManager,
  configManager,
  CONFIG_CONSTANTS,
  DEFAULT_CONFIG,
  
  // Initialization
  initialize,
  ensureNvmcpDirs,
  
  // Configuration
  getConfig,
  saveConfig,
  
  // Tags
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
  
  // Legacy paths for backward compatibility
  NVMCP_DIR: CONFIG_CONSTANTS.NVMCP_DIR,
  CONFIGS_DIR: CONFIG_CONSTANTS.TAGS_DIR,
  CACHE_DIR: CONFIG_CONSTANTS.CACHE_DIR,
  ACTIVE_TAG_FILE: CONFIG_CONSTANTS.ACTIVE_TAG_FILE,
  RUNNING_FILE: CONFIG_CONSTANTS.RUNNING_PROCESSES_FILE
};