const { getInstalledServers, getServerConfig, getActiveConfig } = require('../utils/config');
const { colors, formatTable, formatStatus } = require('../utils/colors');

async function listCommand(args, options) {
  const servers = getInstalledServers();
  
  if (servers.length === 0) {
    console.log('No MCP servers installed.');
    console.log(`\nTry: ${colors.cyan('nvmcp install <package-name>')}`);
    return;
  }
  
  const activeConfig = getActiveConfig();
  const activeServer = activeConfig?.server;
  
  const serverData = servers.map(serverName => {
    const config = getServerConfig(serverName);
    
    if (!config) {
      return [
        serverName,
        colors.dim('unknown'),
        formatStatus('missing'),
        ''
      ];
    }
    
    let status = 'configured';
    let statusFlags = [];
    
    if (config.type === 'remote') {
      statusFlags.push('remote');
    }
    
    if (serverName === activeServer) {
      statusFlags.push('active');
      status = 'active';
    }
    
    if (config.tags && config.tags.length > 0) {
      statusFlags.push(`tags: ${config.tags.join(', ')}`);
    }
    
    const statusText = statusFlags.length > 0 
      ? `${formatStatus(status)} [${statusFlags.join('] [')}]`
      : formatStatus(status);
    
    return [
      serverName,
      config.version || 'unknown',
      statusText,
      config.description || ''
    ];
  });
  
  console.log(colors.bold('Installed MCP Servers:\n'));
  
  const headers = ['Name', 'Version', 'Status', 'Description'];
  console.log(formatTable(headers, serverData));
  
  console.log(`\nTotal: ${servers.length} server(s)`);
  
  if (activeServer) {
    console.log(`Active: ${colors.cyan(activeServer)}`);
  } else {
    console.log('No active server');
  }
  
  console.log(`\nCommands:`);
  console.log(`  ${colors.cyan('nvmcp config <server>')}  Configure a server`);
  console.log(`  ${colors.cyan('nvmcp use <server>')}     Activate a server`);
  console.log(`  ${colors.cyan('nvmcp doctor')}           Check server health`);
}

module.exports = { listCommand };