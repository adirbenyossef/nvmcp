const fs = require('fs');
const path = require('path');
const os = require('os');

const NVMCP_DIR = path.join(os.homedir(), '.nvmcp');
const CONFIGS_DIR = path.join(NVMCP_DIR, 'configs');
const CACHE_DIR = path.join(NVMCP_DIR, 'cache');
const ACTIVE_TAG_FILE = path.join(NVMCP_DIR, 'active-tag.json');
const RUNNING_FILE = path.join(NVMCP_DIR, 'running.json');

function ensureNvmcpDirs() {
  const dirs = [NVMCP_DIR, CONFIGS_DIR, CACHE_DIR];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function getTagConfig(tagName) {
  const tagFile = path.join(CONFIGS_DIR, `${tagName}.json`);
  
  if (!fs.existsSync(tagFile)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(tagFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid tag config for ${tagName}: ${error.message}`);
  }
}

function saveTagConfig(tagName, config) {
  ensureNvmcpDirs();
  const tagFile = path.join(CONFIGS_DIR, `${tagName}.json`);
  
  // Ensure config has required structure
  const tagConfig = {
    name: tagName,
    created: config.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    mcps: config.mcps || {},
    env: config.env || {},
    description: config.description || '',
    ...config
  };
  
  fs.writeFileSync(tagFile, JSON.stringify(tagConfig, null, 2));
  return tagConfig;
}

function listTags() {
  ensureNvmcpDirs();
  
  if (!fs.existsSync(CONFIGS_DIR)) {
    return [];
  }
  
  return fs.readdirSync(CONFIGS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.basename(file, '.json'));
}

function deleteTag(tagName) {
  const tagFile = path.join(CONFIGS_DIR, `${tagName}.json`);
  
  if (fs.existsSync(tagFile)) {
    fs.unlinkSync(tagFile);
    return true;
  }
  
  return false;
}

function getActiveTag() {
  if (!fs.existsSync(ACTIVE_TAG_FILE)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(ACTIVE_TAG_FILE, 'utf8');
    const activeData = JSON.parse(content);
    return activeData.tag;
  } catch (error) {
    return null;
  }
}

function setActiveTag(tagName) {
  ensureNvmcpDirs();
  
  const activeData = {
    tag: tagName,
    activated: new Date().toISOString()
  };
  
  fs.writeFileSync(ACTIVE_TAG_FILE, JSON.stringify(activeData, null, 2));
}

function getRunningProcesses() {
  if (!fs.existsSync(RUNNING_FILE)) {
    return {};
  }
  
  try {
    const content = fs.readFileSync(RUNNING_FILE, 'utf8');
    const processes = JSON.parse(content);
    
    // Clean up dead processes
    const activeProcesses = {};
    for (const [id, processInfo] of Object.entries(processes)) {
      try {
        // Check if process is still running
        process.kill(processInfo.pid, 0);
        activeProcesses[id] = processInfo;
      } catch (error) {
        // Process is dead, don't include it
      }
    }
    
    // Update file if we removed dead processes
    if (Object.keys(activeProcesses).length !== Object.keys(processes).length) {
      saveRunningProcesses(activeProcesses);
    }
    
    return activeProcesses;
  } catch (error) {
    return {};
  }
}

function saveRunningProcesses(processes) {
  ensureNvmcpDirs();
  fs.writeFileSync(RUNNING_FILE, JSON.stringify(processes, null, 2));
}

function addRunningProcess(id, processInfo) {
  const processes = getRunningProcesses();
  processes[id] = {
    ...processInfo,
    started: new Date().toISOString()
  };
  saveRunningProcesses(processes);
}

function removeRunningProcess(id) {
  const processes = getRunningProcesses();
  delete processes[id];
  saveRunningProcesses(processes);
}

function parseSource(source) {
  // Parse different source formats:
  // npm:package-name
  // github:owner/repo
  // https://gitmcp.io/...
  // git+https://github.com/...
  
  if (source.startsWith('npm:')) {
    return {
      type: 'npm',
      package: source.slice(4),
      name: source.slice(4).split('/').pop()
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
    // Extract name from URL
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
  
  // Default to npm if no prefix
  return {
    type: 'npm',
    package: source,
    name: source.split('/').pop()
  };
}

function getCacheDir(sourceName) {
  return path.join(CACHE_DIR, sourceName);
}

function tagExists(tagName) {
  const tagFile = path.join(CONFIGS_DIR, `${tagName}.json`);
  return fs.existsSync(tagFile);
}

function createDefaultTag(tagName, description = '', mcps = {}) {
  return {
    name: tagName,
    description,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    mcps,
    env: {}
  };
}

module.exports = {
  NVMCP_DIR,
  CONFIGS_DIR,
  CACHE_DIR,
  ACTIVE_TAG_FILE,
  RUNNING_FILE,
  ensureNvmcpDirs,
  getTagConfig,
  saveTagConfig,
  listTags,
  deleteTag,
  getActiveTag,
  setActiveTag,
  getRunningProcesses,
  saveRunningProcesses,
  addRunningProcess,
  removeRunningProcess,
  parseSource,
  getCacheDir,
  tagExists,
  createDefaultTag
};