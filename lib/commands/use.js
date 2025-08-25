const fs = require('fs');
const path = require('path');
const os = require('os');
const { getServerConfig, getProfile, setActiveConfig, getConfig } = require('../utils/config');
const { decryptSensitiveData } = require('../utils/crypto');
const { colors, formatSuccess, formatError } = require('../utils/colors');

async function useCommand(args, options) {
  if (args.length === 0) {
    throw new Error('Server name or profile name is required');
  }
  
  const target = args[0];
  let serverConfig;
  let profileName;
  
  const profile = getProfile(target);
  if (profile) {
    console.log(`Using profile: ${colors.cyan(target)}`);
    profileName = target;
    
    if (profile.servers && profile.servers.length > 0) {
      const defaultServer = profile.default || profile.servers[0].name;
      serverConfig = profile.servers.find(s => s.name === defaultServer);
      
      if (!serverConfig) {
        serverConfig = profile.servers[0];
      }
    } else {
      throw new Error(`Profile '${target}' has no configured servers`);
    }
  } else {
    serverConfig = getServerConfig(target);
    if (!serverConfig) {
      throw new Error(`Server or profile '${target}' not found`);
    }
    
    serverConfig = { name: target, config: serverConfig };
  }
  
  const activeConfig = {
    server: serverConfig.name,
    profile: profileName || null,
    config: serverConfig.config || serverConfig,
    activated: new Date().toISOString()
  };
  
  setActiveConfig(activeConfig);
  console.log(formatSuccess(`Activated ${colors.cyan(serverConfig.name)}`));
  
  if (options.claude) {
    await exportToTool('claude', activeConfig);
  }
  
  if (options.cursor) {
    await exportToTool('cursor', activeConfig);
  }
  
  if (options.vscode) {
    await exportToTool('vscode', activeConfig);
  }
  
  if (!options.claude && !options.cursor && !options.vscode) {
    console.log(`\nTo use with AI tools, run:`);
    console.log(`  ${colors.cyan(`nvmcp use ${target} --claude`)}   Export to Claude Desktop`);
    console.log(`  ${colors.cyan(`nvmcp use ${target} --cursor`)}   Export to Cursor IDE`);
    console.log(`  ${colors.cyan(`nvmcp use ${target} --vscode`)}   Export to VS Code`);
  }
  
  console.log(`\nTo start the server:`);
  console.log(`  ${colors.cyan(`nvmcp run ${serverConfig.name}`)}`);
}

async function exportToTool(toolName, activeConfig) {
  try {
    const config = getConfig();
    const toolConfig = config.tools[toolName];
    
    if (!toolConfig || !toolConfig.configPath) {
      throw new Error(`No configuration path defined for ${toolName}`);
    }
    
    const mcpConfig = generateMcpConfig(activeConfig);
    const toolConfigPath = expandPath(toolConfig.configPath);
    
    ensureDirectoryExists(path.dirname(toolConfigPath));
    
    let existingConfig = {};
    if (fs.existsSync(toolConfigPath)) {
      try {
        const content = fs.readFileSync(toolConfigPath, 'utf8');
        existingConfig = JSON.parse(content);
      } catch (error) {
        console.warn(colors.yellow(`Warning: Could not parse existing ${toolName} config`));
      }
    }
    
    existingConfig.mcpServers = existingConfig.mcpServers || {};
    existingConfig.mcpServers[activeConfig.server] = mcpConfig;
    
    fs.writeFileSync(toolConfigPath, JSON.stringify(existingConfig, null, 2));
    
    console.log(formatSuccess(`Exported configuration to ${toolName}`));
    console.log(colors.dim(`Config file: ${toolConfigPath}`));
    
  } catch (error) {
    console.error(formatError(`Failed to export to ${toolName}: ${error.message}`));
  }
}

function generateMcpConfig(activeConfig) {
  const config = activeConfig.config;
  const decryptedConfig = decryptSensitiveData(config);
  
  if (config.type === 'remote') {
    return generateRemoteMcpConfig(decryptedConfig);
  } else {
    return generateLocalMcpConfig(decryptedConfig);
  }
}

function generateLocalMcpConfig(config) {
  const mcpConfig = {
    command: config.command.split(' ')[0],
    args: [...config.command.split(' ').slice(1), ...(config.args || [])],
    env: {}
  };
  
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      mcpConfig.env[key] = value;
    }
  }
  
  return mcpConfig;
}

function generateRemoteMcpConfig(config) {
  const mcpConfig = {
    command: 'npx',
    args: ['@modelcontextprotocol/server-http'],
    env: {
      MCP_SERVER_URL: config.endpoint,
      MCP_TRANSPORT: config.transport || 'http'
    }
  };
  
  if (config.authType === 'bearer' && config.authToken) {
    mcpConfig.env.MCP_AUTH_TOKEN = config.authToken;
  } else if (config.authType === 'basic') {
    mcpConfig.env.MCP_AUTH_USERNAME = config.authUsername;
    mcpConfig.env.MCP_AUTH_PASSWORD = config.authPassword;
  } else if (config.authType === 'api-key') {
    mcpConfig.env.MCP_API_KEY = config.apiKey;
    mcpConfig.env.MCP_API_KEY_HEADER = config.apiKeyHeader || 'X-API-Key';
  }
  
  if (config.env) {
    Object.assign(mcpConfig.env, config.env);
  }
  
  return mcpConfig;
}

function expandPath(filePath) {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

module.exports = { useCommand };