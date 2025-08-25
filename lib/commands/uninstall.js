const fs = require('fs');
const path = require('path');
const { getInstalledServers, getServerConfig, deleteServerConfig, SERVERS_DIR } = require('../utils/config');
const { colors, formatSuccess, formatError } = require('../utils/colors');
const { confirm } = require('../utils/prompt');

async function uninstallCommand(args, options) {
  if (args.length === 0) {
    throw new Error('Server name is required');
  }
  
  const serverName = args[0];
  const installedServers = getInstalledServers();
  
  if (!installedServers.includes(serverName)) {
    throw new Error(`Server '${serverName}' is not installed`);
  }
  
  const config = getServerConfig(serverName);
  const serverDir = path.join(SERVERS_DIR, serverName);
  
  console.log(`Uninstalling ${colors.cyan(serverName)}...`);
  
  if (config) {
    console.log(`Version: ${config.version || 'unknown'}`);
    console.log(`Type: ${config.type || 'local'}`);
  }
  
  const shouldUninstall = await confirm(
    `Are you sure you want to uninstall '${serverName}'?`,
    false
  );
  
  if (!shouldUninstall) {
    console.log('Uninstall cancelled.');
    return;
  }
  
  try {
    if (fs.existsSync(serverDir)) {
      console.log('Removing server files...');
      fs.rmSync(serverDir, { recursive: true, force: true });
      console.log(formatSuccess('Server files removed'));
    }
    
    if (config) {
      console.log('Removing configuration...');
      deleteServerConfig(serverName);
      console.log(formatSuccess('Configuration removed'));
    }
    
    console.log(formatSuccess(`Successfully uninstalled ${colors.cyan(serverName)}`));
    
    console.log('\nNote: This server may still be referenced in:');
    console.log('- AI tool configurations (Claude, Cursor, etc.)');
    console.log('- Profile configurations');
    console.log('Run nvmcp doctor to check for any remaining references.');
    
  } catch (error) {
    throw new Error(`Failed to uninstall ${serverName}: ${error.message}`);
  }
}

module.exports = { uninstallCommand };