const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getInstalledServers, getServerConfig, SERVERS_DIR } = require('../utils/config');
const { decryptSensitiveData } = require('../utils/crypto');
const { get } = require('../utils/http');
const { colors, formatSuccess, formatError, formatWarning, formatInfo } = require('../utils/colors');

async function doctorCommand(args, options) {
  console.log(colors.bold('nvmcp Doctor - Checking System Health\n'));
  
  let hasErrors = false;
  let hasWarnings = false;
  
  console.log(colors.cyan('Checking nvmcp installation...'));
  await checkNvmcpInstallation();
  
  console.log(colors.cyan('\nChecking installed servers...'));
  const servers = getInstalledServers();
  
  if (servers.length === 0) {
    console.log(formatWarning('No servers installed'));
    hasWarnings = true;
  } else {
    for (const serverName of servers) {
      console.log(`\nChecking ${colors.cyan(serverName)}:`);
      
      const result = await checkServer(serverName);
      if (result.hasError) hasErrors = true;
      if (result.hasWarning) hasWarnings = true;
    }
  }
  
  console.log(colors.cyan('\nChecking tool integrations...'));
  await checkToolIntegrations();
  
  console.log(colors.cyan('\nChecking system dependencies...'));
  await checkSystemDependencies();
  
  console.log('\n' + colors.bold('Summary:'));
  
  if (hasErrors) {
    console.log(formatError('Some issues found that require attention'));
    process.exit(1);
  } else if (hasWarnings) {
    console.log(formatWarning('Some warnings found, but system is functional'));
  } else {
    console.log(formatSuccess('All checks passed! nvmcp is working correctly'));
  }
}

async function checkNvmcpInstallation() {
  try {
    const { NVMCP_DIR } = require('../utils/config');
    
    if (!fs.existsSync(NVMCP_DIR)) {
      console.log(formatError('nvmcp directory not found'));
      console.log(formatInfo(`Run: ${colors.cyan('nvmcp init')}`));
      return;
    }
    
    const requiredDirs = ['servers', 'configs', 'profiles'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(NVMCP_DIR, dir);
      if (!fs.existsSync(dirPath)) {
        console.log(formatWarning(`Missing directory: ${dir}`));
      }
    }
    
    console.log(formatSuccess('nvmcp installation OK'));
  } catch (error) {
    console.log(formatError(`Installation check failed: ${error.message}`));
  }
}

async function checkServer(serverName) {
  let hasError = false;
  let hasWarning = false;
  
  try {
    const config = getServerConfig(serverName);
    
    if (!config) {
      console.log(formatError('  Configuration missing'));
      console.log(formatInfo(`  Run: ${colors.cyan(`nvmcp config ${serverName}`)}`));
      return { hasError: true, hasWarning };
    }
    
    const serverDir = path.join(SERVERS_DIR, serverName);
    
    if (!fs.existsSync(serverDir)) {
      console.log(formatError('  Server files missing'));
      console.log(formatInfo(`  Run: ${colors.cyan(`nvmcp install ${serverName}`)}`));
      return { hasError: true, hasWarning };
    }
    
    if (config.type === 'remote') {
      const remoteResult = await checkRemoteServer(config);
      hasError = remoteResult.hasError;
      hasWarning = remoteResult.hasWarning;
    } else {
      const localResult = await checkLocalServer(serverName, config);
      hasError = localResult.hasError;
      hasWarning = localResult.hasWarning;
    }
    
  } catch (error) {
    console.log(formatError(`  Check failed: ${error.message}`));
    hasError = true;
  }
  
  return { hasError, hasWarning };
}

async function checkRemoteServer(config) {
  let hasError = false;
  let hasWarning = false;
  
  try {
    const decryptedConfig = decryptSensitiveData(config);
    
    if (!decryptedConfig.endpoint) {
      console.log(formatError('  Missing endpoint URL'));
      return { hasError: true, hasWarning };
    }
    
    console.log('  Testing connection...');
    
    const response = await get(decryptedConfig.endpoint, { timeout: 5000 });
    
    if (response.statusCode === 200) {
      console.log(formatSuccess('  Remote server accessible'));
    } else {
      console.log(formatWarning(`  Server responded with status ${response.statusCode}`));
      hasWarning = true;
    }
    
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.log(formatError('  Connection timeout'));
    } else if (error.message.includes('ENOTFOUND')) {
      console.log(formatError('  Server not found (DNS resolution failed)'));
    } else {
      console.log(formatError(`  Connection failed: ${error.message}`));
    }
    hasError = true;
  }
  
  return { hasError, hasWarning };
}

async function checkLocalServer(serverName, config) {
  let hasError = false;
  let hasWarning = false;
  
  const serverDir = path.join(SERVERS_DIR, serverName);
  
  const [command, ...args] = config.command.split(' ');
  
  const packageJsonPath = path.join(serverDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      console.log(`  Package: ${pkg.name}@${pkg.version}`);
      
      if (pkg.engines && pkg.engines.node) {
        const currentNodeVersion = process.version;
        console.log(`  Node requirement: ${pkg.engines.node}, current: ${currentNodeVersion}`);
      }
      
    } catch (error) {
      console.log(formatWarning('  Could not read package.json'));
      hasWarning = true;
    }
  }
  
  const mainFile = args[0] || 'index.js';
  const mainFilePath = path.join(serverDir, mainFile);
  
  if (!fs.existsSync(mainFilePath)) {
    console.log(formatError(`  Main file not found: ${mainFile}`));
    hasError = true;
  } else {
    console.log(formatSuccess(`  Main file exists: ${mainFile}`));
  }
  
  const nodeModulesPath = path.join(serverDir, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(formatWarning('  Dependencies not installed'));
    console.log(formatInfo('  Dependencies may be installed globally or not required'));
    hasWarning = true;
  } else {
    console.log(formatSuccess('  Dependencies installed'));
  }
  
  console.log('  Testing server startup...');
  const canStart = await testServerStartup(serverName, config);
  if (!canStart) {
    console.log(formatError('  Server failed to start'));
    hasError = true;
  } else {
    console.log(formatSuccess('  Server can start successfully'));
  }
  
  return { hasError, hasWarning };
}

async function testServerStartup(serverName, config) {
  return new Promise((resolve) => {
    const serverDir = path.join(SERVERS_DIR, serverName);
    const [command, ...args] = config.command.split(' ');
    
    const testArgs = [...args, '--help'];
    
    const child = spawn(command, testArgs, {
      cwd: serverDir,
      stdio: 'pipe',
      timeout: 5000
    });
    
    let hasOutput = false;
    
    child.stdout.on('data', () => {
      hasOutput = true;
    });
    
    child.stderr.on('data', () => {
      hasOutput = true;
    });
    
    child.on('error', () => {
      resolve(false);
    });
    
    child.on('exit', (code) => {
      resolve(hasOutput || code === 0);
    });
    
    setTimeout(() => {
      child.kill();
      resolve(hasOutput);
    }, 3000);
  });
}

async function checkToolIntegrations() {
  const { getConfig } = require('../utils/config');
  const config = getConfig();
  
  for (const [toolName, toolConfig] of Object.entries(config.tools)) {
    const configPath = expandPath(toolConfig.configPath);
    
    if (fs.existsSync(configPath)) {
      console.log(formatSuccess(`${toolName} config file exists`));
      
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        const toolConfigData = JSON.parse(content);
        
        if (toolConfigData.mcpServers && Object.keys(toolConfigData.mcpServers).length > 0) {
          console.log(formatInfo(`  ${Object.keys(toolConfigData.mcpServers).length} MCP server(s) configured`));
        } else {
          console.log(formatInfo('  No MCP servers configured'));
        }
      } catch (error) {
        console.log(formatWarning(`  Could not parse ${toolName} config`));
      }
    } else {
      console.log(formatInfo(`${toolName} not found or not configured`));
    }
  }
}

async function checkSystemDependencies() {
  const dependencies = [
    { name: 'Node.js', command: 'node', args: ['--version'] },
    { name: 'npm', command: 'npm', args: ['--version'] },
    { name: 'tar', command: 'tar', args: ['--version'] }
  ];
  
  for (const dep of dependencies) {
    try {
      const version = await getCommandVersion(dep.command, dep.args);
      console.log(formatSuccess(`${dep.name}: ${version}`));
    } catch (error) {
      console.log(formatError(`${dep.name}: not found`));
    }
  }
}

function getCommandVersion(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe' });
    
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('error', reject);
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(output.trim().split('\n')[0]);
      } else {
        reject(new Error(`Exit code: ${code}`));
      }
    });
  });
}

function expandPath(filePath) {
  if (filePath.startsWith('~')) {
    return path.join(require('os').homedir(), filePath.slice(1));
  }
  return filePath;
}

module.exports = { doctorCommand };