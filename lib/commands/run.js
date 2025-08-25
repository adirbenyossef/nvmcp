const { spawn } = require('child_process');
const path = require('path');
const { getServerConfig, getProfile, SERVERS_DIR } = require('../utils/config');
const { decryptSensitiveData } = require('../utils/crypto');
const { colors, formatSuccess, formatError } = require('../utils/colors');

let runningProcesses = new Map();

async function runCommand(args, options) {
  if (args.length === 0) {
    throw new Error('Server name or profile name is required');
  }
  
  const target = args[0];
  let serverConfig;
  let serverName;
  
  const profile = getProfile(target);
  if (profile) {
    console.log(`Running servers from profile: ${colors.cyan(target)}`);
    
    if (profile.servers && profile.servers.length > 0) {
      const defaultServer = profile.default || profile.servers[0].name;
      const server = profile.servers.find(s => s.name === defaultServer) || profile.servers[0];
      serverName = server.name;
      serverConfig = server.config;
    } else {
      throw new Error(`Profile '${target}' has no configured servers`);
    }
  } else {
    serverConfig = getServerConfig(target);
    if (!serverConfig) {
      throw new Error(`Server or profile '${target}' not found`);
    }
    serverName = target;
  }
  
  if (runningProcesses.has(serverName)) {
    throw new Error(`Server '${serverName}' is already running`);
  }
  
  const config = decryptSensitiveData(serverConfig);
  
  if (config.type === 'remote') {
    console.log(`Remote server: ${colors.cyan(config.endpoint)}`);
    console.log(formatSuccess('Remote server configuration is ready'));
    return;
  }
  
  console.log(`Starting ${colors.cyan(serverName)}...`);
  
  const serverDir = path.join(SERVERS_DIR, serverName);
  const env = createEnvironment(config);
  const [command, ...commandArgs] = config.command.split(' ');
  const allArgs = [...commandArgs, ...(config.args || [])];
  
  try {
    const child = spawn(command, allArgs, {
      cwd: serverDir,
      env: env,
      stdio: options.daemon ? 'pipe' : 'inherit'
    });
    
    runningProcesses.set(serverName, {
      process: child,
      config: config,
      startTime: new Date()
    });
    
    child.on('error', (error) => {
      console.error(formatError(`Failed to start server: ${error.message}`));
      runningProcesses.delete(serverName);
    });
    
    child.on('exit', (code, signal) => {
      runningProcesses.delete(serverName);
      
      if (code === 0) {
        console.log(formatSuccess(`Server ${colors.cyan(serverName)} stopped`));
      } else if (signal) {
        console.log(`Server ${colors.cyan(serverName)} was killed with signal ${signal}`);
      } else {
        console.error(formatError(`Server ${colors.cyan(serverName)} exited with code ${code}`));
      }
    });
    
    if (options.daemon) {
      console.log(formatSuccess(`Server ${colors.cyan(serverName)} started as daemon (PID: ${child.pid})`));
      
      child.stdout.on('data', (data) => {
        console.log(`[${serverName}] ${data.toString().trim()}`);
      });
      
      child.stderr.on('data', (data) => {
        console.error(`[${serverName}] ${colors.red(data.toString().trim())}`);
      });
      
      setupProcessShutdown();
    } else {
      console.log(formatSuccess(`Server ${colors.cyan(serverName)} started`));
      console.log(colors.dim('Press Ctrl+C to stop\n'));
      
      process.on('SIGINT', () => {
        console.log('\nStopping server...');
        stopServer(serverName);
        process.exit(0);
      });
      
      await waitForExit(child);
    }
    
  } catch (error) {
    throw new Error(`Failed to start server: ${error.message}`);
  }
}

function createEnvironment(config) {
  const env = { ...process.env };
  
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      env[key] = value;
    }
  }
  
  return env;
}

function stopServer(serverName) {
  const serverInfo = runningProcesses.get(serverName);
  if (!serverInfo) {
    throw new Error(`Server '${serverName}' is not running`);
  }
  
  const { process: child } = serverInfo;
  
  if (process.platform === 'win32') {
    child.kill('SIGTERM');
  } else {
    child.kill('SIGTERM');
    
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 5000);
  }
  
  runningProcesses.delete(serverName);
}

function setupProcessShutdown() {
  const cleanup = () => {
    console.log('\nShutting down servers...');
    
    for (const [serverName, serverInfo] of runningProcesses.entries()) {
      try {
        serverInfo.process.kill('SIGTERM');
        console.log(`Stopped ${colors.cyan(serverName)}`);
      } catch (error) {
        console.error(`Failed to stop ${serverName}: ${error.message}`);
      }
    }
    
    runningProcesses.clear();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.on('exit', resolve);
    child.on('close', resolve);
  });
}

function listRunningServers() {
  if (runningProcesses.size === 0) {
    console.log('No servers are currently running.');
    return;
  }
  
  console.log(colors.bold('Running Servers:\n'));
  
  for (const [serverName, serverInfo] of runningProcesses.entries()) {
    const uptime = Math.floor((Date.now() - serverInfo.startTime.getTime()) / 1000);
    console.log(`  ${colors.cyan(serverName)}`);
    console.log(`    PID: ${serverInfo.process.pid}`);
    console.log(`    Uptime: ${uptime}s`);
    console.log(`    Command: ${colors.dim(serverInfo.config.command)}`);
    console.log();
  }
}

module.exports = { 
  runCommand,
  stopServer,
  listRunningServers,
  runningProcesses
};