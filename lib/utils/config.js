const fs = require('fs');
const path = require('path');
const os = require('os');

const NVMCP_DIR = path.join(os.homedir(), '.nvmcp');
const CONFIG_FILE = path.join(NVMCP_DIR, 'config.json');
const ACTIVE_FILE = path.join(NVMCP_DIR, 'active.json');
const SERVERS_DIR = path.join(NVMCP_DIR, 'servers');
const CONFIGS_DIR = path.join(NVMCP_DIR, 'configs');
const PROFILES_DIR = path.join(NVMCP_DIR, 'profiles');

const DEFAULT_CONFIG = {
  version: '1.0.0',
  defaultProfile: null,
  registries: ['npm', 'github'],
  tools: {
    claude: {
      configPath: path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    },
    cursor: {
      configPath: path.join(os.homedir(), '.cursor', 'mcp.json')
    },
    vscode: {
      configPath: path.join(os.homedir(), '.vscode', 'mcp.json')
    }
  }
};

function ensureNvmcpDir() {
  const dirs = [NVMCP_DIR, SERVERS_DIR, CONFIGS_DIR, PROFILES_DIR];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function getConfig() {
  ensureNvmcpDir();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch (error) {
    console.warn('Warning: Invalid config file, using defaults');
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config) {
  ensureNvmcpDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getServerConfig(serverName) {
  const configPath = path.join(CONFIGS_DIR, `${serverName}.json`);
  
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid server config for ${serverName}: ${error.message}`);
  }
}

function saveServerConfig(serverName, config) {
  ensureNvmcpDir();
  const configPath = path.join(CONFIGS_DIR, `${serverName}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getProfile(profileName) {
  const profilePath = path.join(PROFILES_DIR, `${profileName}.json`);
  
  if (!fs.existsSync(profilePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(profilePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid profile ${profileName}: ${error.message}`);
  }
}

function saveProfile(profileName, profile) {
  ensureNvmcpDir();
  const profilePath = path.join(PROFILES_DIR, `${profileName}.json`);
  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
}

function getActiveConfig() {
  if (!fs.existsSync(ACTIVE_FILE)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(ACTIVE_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function setActiveConfig(config) {
  ensureNvmcpDir();
  fs.writeFileSync(ACTIVE_FILE, JSON.stringify(config, null, 2));
}

function getInstalledServers() {
  if (!fs.existsSync(SERVERS_DIR)) {
    return [];
  }
  
  return fs.readdirSync(SERVERS_DIR)
    .filter(item => {
      const serverPath = path.join(SERVERS_DIR, item);
      return fs.statSync(serverPath).isDirectory();
    });
}

function listProfiles() {
  if (!fs.existsSync(PROFILES_DIR)) {
    return [];
  }
  
  return fs.readdirSync(PROFILES_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.basename(file, '.json'));
}

function deleteServerConfig(serverName) {
  const configPath = path.join(CONFIGS_DIR, `${serverName}.json`);
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}

function deleteProfile(profileName) {
  const profilePath = path.join(PROFILES_DIR, `${profileName}.json`);
  if (fs.existsSync(profilePath)) {
    fs.unlinkSync(profilePath);
  }
}

module.exports = {
  NVMCP_DIR,
  SERVERS_DIR,
  CONFIGS_DIR,
  PROFILES_DIR,
  ensureNvmcpDir,
  getConfig,
  saveConfig,
  getServerConfig,
  saveServerConfig,
  getProfile,
  saveProfile,
  getActiveConfig,
  setActiveConfig,
  getInstalledServers,
  listProfiles,
  deleteServerConfig,
  deleteProfile
};