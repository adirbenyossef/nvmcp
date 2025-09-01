/**
 * @fileoverview Process management for MCP servers
 * @module processes
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { 
  getRunningProcesses, 
  addRunningProcess, 
  removeRunningProcess,
  getCacheDir,
  parseSource,
  initialize
} = require('./unified-config');
const { colors, formatSuccess, formatError } = require('./colors');
const { ProcessError } = require('./errors');

/**
 * Process manager for MCP servers
 */
class ProcessManager {
  constructor() {
    this.processes = new Map();
    this.setupGracefulShutdown();
  }

  /**
   * Start an MCP server process
   * @param {string} mcpName - Name of the MCP
   * @param {string} mcpSource - Source of the MCP (npm:, github:, etc.)
   * @param {Object} [env={}] - Environment variables
   * @returns {Promise<string>} Process ID
   */
  async startMCP(mcpName, mcpSource, env = {}) {
    const processId = `${mcpName}-${Date.now()}`;
    
    try {
      const command = await this.resolveCommand(mcpSource);
      const mcpEnv = { ...process.env, ...env };
      
      console.log(`Starting ${colors.cyan(mcpName)}...`);
      
      const child = spawn(command.cmd, command.args, {
        env: mcpEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: command.cwd || process.cwd()
      });

      const processInfo = {
        id: processId,
        name: mcpName,
        source: mcpSource,
        pid: child.pid,
        command: command,
        status: 'starting'
      };

      this.processes.set(processId, { process: child, info: processInfo });
      addRunningProcess(processId, processInfo);

      this.setupProcessHandlers(child, processId, mcpName);

      return processId;
    } catch (error) {
      console.error(formatError(`Failed to start ${mcpName}: ${error.message}`));
      throw error;
    }
  }

  /**
   * Setup event handlers for a child process
   * @param {ChildProcess} child - Child process
   * @param {string} processId - Process ID
   * @param {string} mcpName - MCP name
   */
  setupProcessHandlers(child, processId, mcpName) {
    const processData = this.processes.get(processId);
    
    child.on('spawn', () => {
      if (processData) {
        processData.info.status = 'running';
        console.log(formatSuccess(`${colors.cyan(mcpName)} started (PID: ${child.pid})`));
      }
    });

    child.on('error', (error) => {
      if (processData) {
        processData.info.status = 'error';
        console.error(formatError(`Failed to start ${mcpName}: ${error.message}`));
        this.cleanup(processId);
      }
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        console.log(`${colors.cyan(mcpName)} was killed with signal ${signal}`);
      } else if (code === 0) {
        console.log(formatSuccess(`${colors.cyan(mcpName)} stopped`));
      } else {
        console.error(formatError(`${colors.cyan(mcpName)} exited with code ${code}`));
      }
      this.cleanup(processId);
    });

    // Capture output for debugging
    if (process.env.DEBUG) {
      child.stdout?.on('data', (data) => {
        console.log(`[${mcpName}] ${data.toString().trim()}`);
      });

      child.stderr?.on('data', (data) => {
        console.error(`[${mcpName}] ${colors.red(data.toString().trim())}`);
      });
    }
  }

  /**
   * Resolve command from MCP source
   * @param {string} mcpSource - MCP source string
   * @returns {Promise<Object>} Command object with cmd, args, and optional cwd
   */
  async resolveCommand(mcpSource) {
    initialize();
    const sourceInfo = parseSource(mcpSource);
    
    switch (sourceInfo.type) {
      case 'npm':
        return this.resolveNpmCommand(sourceInfo);
      case 'github':
        return this.resolveGithubCommand(sourceInfo);
      case 'remote':
        return this.resolveRemoteCommand(sourceInfo);
      case 'git':
        return this.resolveGitCommand(sourceInfo);
      default:
        throw new ProcessError(`Unsupported source type: ${sourceInfo.type}`, null, { type: sourceInfo.type });
    }
  }

  /**
   * Resolve NPM package command
   * @param {Object} sourceInfo - Parsed source information
   * @returns {Promise<Object>} Command object
   */
  async resolveNpmCommand(sourceInfo) {
    const packageName = sourceInfo.package;
    
    try {
      // Try to use npx for npm packages
      return {
        cmd: 'npx',
        args: [packageName]
      };
    } catch (error) {
      throw new ProcessError(`Failed to resolve npm package ${packageName}`, null, { originalError: error.message });
    }
  }

  /**
   * Resolve GitHub repository command
   * @param {Object} sourceInfo - Parsed source information
   * @returns {Promise<Object>} Command object
   */
  async resolveGithubCommand(sourceInfo) {
    const cacheDir = getCacheDir(sourceInfo.name);
    
    // Check if already cached
    if (!fs.existsSync(cacheDir)) {
      console.log(`Cloning ${sourceInfo.fullRepo}...`);
      await this.cloneRepository(`https://github.com/${sourceInfo.fullRepo}.git`, cacheDir);
    }
    
    // Look for common entry points
    const entryPoints = [
      { file: 'package.json', handler: this.handlePackageJson },
      { file: 'index.js', cmd: 'node' },
      { file: 'main.py', cmd: 'python' },
      { file: 'server.py', cmd: 'python' },
      { file: 'mcp.py', cmd: 'python' }
    ];
    
    for (const entry of entryPoints) {
      const entryPath = path.join(cacheDir, entry.file);
      if (fs.existsSync(entryPath)) {
        if (entry.handler) {
          return entry.handler(entryPath, cacheDir);
        }
        
        return {
          cmd: entry.cmd,
          args: [entryPath],
          cwd: cacheDir
        };
      }
    }
    
    throw new ProcessError(`Could not determine how to run ${sourceInfo.name}`, null, { name: sourceInfo.name });
  }

  /**
   * Handle package.json entry point
   * @param {string} packageJsonPath - Path to package.json
   * @param {string} cacheDir - Cache directory
   * @returns {Object} Command object
   */
  handlePackageJson(packageJsonPath, cacheDir) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (pkg.bin) {
      const binName = typeof pkg.bin === 'string' ? pkg.bin : Object.values(pkg.bin)[0];
      return {
        cmd: 'node',
        args: [path.resolve(cacheDir, binName)],
        cwd: cacheDir
      };
    }
    
    if (pkg.main) {
      return {
        cmd: 'node',
        args: [path.resolve(cacheDir, pkg.main)],
        cwd: cacheDir
      };
    }
    
    throw new ProcessError('No executable found in package.json');
  }

  /**
   * Resolve remote URL command
   * @param {Object} sourceInfo - Parsed source information
   * @returns {Object} Command object
   */
  resolveRemoteCommand(sourceInfo) {
    // For remote URLs, use a simple HTTP proxy
    return {
      cmd: 'npx',
      args: ['@modelcontextprotocol/server-http', sourceInfo.url]
    };
  }

  /**
   * Resolve Git repository command
   * @param {Object} sourceInfo - Parsed source information
   * @returns {Promise<Object>} Command object
   */
  async resolveGitCommand(sourceInfo) {
    const cacheDir = getCacheDir(sourceInfo.name);
    
    if (!fs.existsSync(cacheDir)) {
      console.log(`Cloning ${sourceInfo.url}...`);
      await this.cloneRepository(sourceInfo.url, cacheDir);
    }
    
    return this.resolveGithubCommand({ name: sourceInfo.name });
  }

  /**
   * Clone a git repository
   * @param {string} gitUrl - Git URL to clone
   * @param {string} targetDir - Target directory
   * @returns {Promise<void>}
   */
  async cloneRepository(gitUrl, targetDir) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', ['clone', gitUrl, targetDir], {
        stdio: 'pipe'
      });
      
      git.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new ProcessError(`Git clone failed with exit code ${code}`));
        }
      });
      
      git.on('error', (error) => {
        reject(new ProcessError(`Git clone failed: ${error.message}`));
      });
    });
  }

  /**
   * Stop an MCP process
   * @param {string} processId - Process ID to stop
   * @returns {boolean} True if process was stopped
   */
  stopMCP(processId) {
    const processData = this.processes.get(processId);
    
    if (!processData) {
      throw new ProcessError(`Process ${processId} not found`, processId);
    }
    
    const { process: child, info } = processData;
    
    console.log(`Stopping ${colors.cyan(info.name)}...`);
    
    // Try graceful shutdown first
    child.kill('SIGTERM');
    
    // Force kill after 5 seconds
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 5000);
    
    return true;
  }

  /**
   * Stop all running processes
   * @returns {number} Number of processes stopped
   */
  stopAll() {
    const processIds = Array.from(this.processes.keys());
    
    processIds.forEach(id => {
      try {
        this.stopMCP(id);
      } catch (error) {
        console.warn(`Failed to stop process ${id}: ${error.message}`);
      }
    });
    
    return processIds.length;
  }

  /**
   * List running processes
   * @returns {Array<Object>} Array of process information
   */
  listProcesses() {
    const runningProcesses = getRunningProcesses();
    const processInfo = [];
    
    for (const [id, info] of Object.entries(runningProcesses)) {
      processInfo.push({
        id,
        name: info.name,
        pid: info.pid,
        status: info.status,
        started: info.started,
        uptime: info.started ? Math.floor((Date.now() - new Date(info.started).getTime()) / 1000) : 0
      });
    }
    
    return processInfo;
  }

  /**
   * Clean up process resources
   * @param {string} processId - Process ID to clean up
   */
  cleanup(processId) {
    this.processes.delete(processId);
    removeRunningProcess(processId);
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const cleanup = (signal) => {
      if (this.processes.size > 0) {
        console.log(`\nShutting down ${this.processes.size} MCP processes...`);
        this.stopAll();
      }
      // Only exit if we received a signal
      if (signal && signal !== 'exit') {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => cleanup('SIGINT'));
    process.on('SIGTERM', () => cleanup('SIGTERM'));
    
    // Clean up processes on normal exit
    process.on('exit', () => {
      if (this.processes.size > 0) {
        this.stopAll();
      }
    });
  }
}

module.exports = { ProcessManager };