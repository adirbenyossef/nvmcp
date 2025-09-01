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
const { ErrorFactory, withRetry, withTimeout } = require('./errors');

class ProcessManager {
  constructor() {
    this.processes = new Map();
    this.setupGracefulShutdown();
  }

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

      // Handle process events
      child.on('spawn', () => {
        processInfo.status = 'running';
        console.log(formatSuccess(`${colors.cyan(mcpName)} started (PID: ${child.pid})`));
      });

      child.on('error', (error) => {
        processInfo.status = 'error';
        console.error(formatError(`Failed to start ${mcpName}: ${error.message}`));
        this.cleanup(processId);
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
      child.stdout.on('data', (data) => {
        if (process.env.DEBUG) {
          console.log(`[${mcpName}] ${data.toString().trim()}`);
        }
      });

      child.stderr.on('data', (data) => {
        if (process.env.DEBUG) {
          console.error(`[${mcpName}] ${colors.red(data.toString().trim())}`);
        }
      });

      return processId;
    } catch (error) {
      console.error(formatError(`Failed to start ${mcpName}: ${error.message}`));
      throw error;
    }
  }

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
        throw ErrorFactory.mcpSource(`Unsupported source type: ${sourceInfo.type}`, sourceInfo.url || sourceInfo.package, { type: sourceInfo.type });
    }
  }

  async resolveNpmCommand(sourceInfo) {
    // For npm packages, try to use them directly or via npx
    const packageName = sourceInfo.package;
    
    try {
      // Try to find global installation first
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync(`npm list -g ${packageName} --depth=0`);
        return {
          cmd: packageName,
          args: []
        };
      } catch {
        // Use npx if not globally installed
        return {
          cmd: 'npx',
          args: [packageName]
        };
      }
    } catch (error) {
      throw ErrorFactory.mcpSource(`Failed to resolve npm package ${packageName}`, packageName, { originalError: error.message });
    }
  }

  async resolveGithubCommand(sourceInfo) {
    const cacheDir = getCacheDir(sourceInfo.name);
    
    // Check if already cached
    if (!fs.existsSync(cacheDir)) {
      console.log(`Cloning ${sourceInfo.fullRepo}...`);
      await this.cloneRepository(`https://github.com/${sourceInfo.fullRepo}.git`, cacheDir);
    }
    
    // Look for common entry points
    const entryPoints = [
      'package.json',
      'index.js',
      'main.py',
      'server.py',
      'mcp.py'
    ];
    
    for (const entry of entryPoints) {
      const entryPath = path.join(cacheDir, entry);
      if (fs.existsSync(entryPath)) {
        if (entry === 'package.json') {
          const pkg = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
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
        }
        
        if (entry.endsWith('.js')) {
          return {
            cmd: 'node',
            args: [entryPath],
            cwd: cacheDir
          };
        }
        
        if (entry.endsWith('.py')) {
          return {
            cmd: 'python',
            args: [entryPath],
            cwd: cacheDir
          };
        }
      }
    }
    
    throw ErrorFactory.mcpSource(`Could not determine how to run ${sourceInfo.name}`, sourceInfo.name, { availableEntryPoints });
  }

  async resolveRemoteCommand(sourceInfo) {
    // For remote URLs, we need a proxy/adapter
    return {
      cmd: 'npx',
      args: ['@modelcontextprotocol/server-http', sourceInfo.url]
    };
  }

  async resolveGitCommand(sourceInfo) {
    const cacheDir = getCacheDir(sourceInfo.name);
    
    if (!fs.existsSync(cacheDir)) {
      console.log(`Cloning ${sourceInfo.url}...`);
      await this.cloneRepository(sourceInfo.url, cacheDir);
    }
    
    return this.resolveGithubCommand({ name: sourceInfo.name });
  }

  async cloneRepository(gitUrl, targetDir) {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const git = spawn('git', ['clone', gitUrl, targetDir], {
        stdio: 'pipe'
      });
      
      git.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Git clone failed with exit code ${code}`));
        }
      });
      
      git.on('error', (error) => {
        reject(new Error(`Git clone failed: ${error.message}`));
      });
    });
  }

  stopMCP(processId) {
    const processData = this.processes.get(processId);
    
    if (!processData) {
      throw ErrorFactory.process(`Process ${processId} not found`, processId);
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

  cleanup(processId) {
    this.processes.delete(processId);
    removeRunningProcess(processId);
  }

  setupGracefulShutdown() {
    const cleanup = (signal) => {
      if (this.processes.size > 0) {
        console.log(`\nShutting down ${this.processes.size} MCP processes...`);
        this.stopAll();
      }
      // Only exit if we received a signal (not on normal exit)
      if (signal && signal !== 'exit') {
        process.exit(0);
      }
    };

    // Only handle interrupt and termination signals, not normal exit
    process.on('SIGINT', () => cleanup('SIGINT'));
    process.on('SIGTERM', () => cleanup('SIGTERM'));
    
    // Clean up processes on exit but don't print message for normal exits
    process.on('exit', () => {
      if (this.processes.size > 0) {
        this.stopAll();
      }
    });
  }
}

module.exports = { ProcessManager };