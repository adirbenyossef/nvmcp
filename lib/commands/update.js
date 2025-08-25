const { getServerConfig, getInstalledServers } = require('../utils/config');
const { getNpmPackageInfo, getGithubRepoInfo } = require('../utils/http');
const { colors, formatSuccess, formatInfo } = require('../utils/colors');
const { installCommand } = require('./install');
const { uninstallCommand } = require('./uninstall');

async function updateCommand(args, options) {
  if (args.length === 0) {
    await updateAllServers(options);
    return;
  }
  
  const serverName = args[0];
  await updateSingleServer(serverName, options);
}

async function updateSingleServer(serverName, options) {
  const config = getServerConfig(serverName);
  
  if (!config) {
    throw new Error(`Server '${serverName}' is not installed`);
  }
  
  console.log(`Checking for updates to ${colors.cyan(serverName)}...`);
  
  try {
    const updateInfo = await checkForUpdates(serverName, config);
    
    if (!updateInfo.hasUpdate) {
      console.log(formatSuccess(`${colors.cyan(serverName)} is already up to date (${config.version})`));
      return;
    }
    
    console.log(`Update available: ${colors.dim(config.version)} → ${colors.green(updateInfo.latestVersion)}`);
    
    if (updateInfo.changes && updateInfo.changes.length > 0) {
      console.log('\nChanges:');
      updateInfo.changes.forEach(change => {
        console.log(`  • ${change}`);
      });
    }
    
    console.log(`\nUpdating ${colors.cyan(serverName)}...`);
    
    await uninstallCommand([serverName], { ...options, skipConfirm: true });
    
    let installArgs = [serverName];
    let installOptions = { ...options };
    
    if (config.source && config.source.includes('github')) {
      const repoPath = extractGithubRepo(config.source);
      if (repoPath) {
        installOptions.repo = repoPath;
      }
    }
    
    if (config.tags && config.tags.length > 0) {
      installOptions.tag = config.tags[0];
    }
    
    await installCommand(installArgs, installOptions);
    
    console.log(formatSuccess(`Successfully updated ${colors.cyan(serverName)} to ${updateInfo.latestVersion}`));
    
  } catch (error) {
    throw new Error(`Failed to update ${serverName}: ${error.message}`);
  }
}

async function updateAllServers(options) {
  const servers = getInstalledServers();
  
  if (servers.length === 0) {
    console.log('No servers installed.');
    return;
  }
  
  console.log('Checking all servers for updates...\n');
  
  const updates = [];
  
  for (const serverName of servers) {
    try {
      const config = getServerConfig(serverName);
      if (!config) continue;
      
      const updateInfo = await checkForUpdates(serverName, config);
      
      if (updateInfo.hasUpdate) {
        updates.push({
          name: serverName,
          currentVersion: config.version,
          latestVersion: updateInfo.latestVersion,
          config
        });
        
        console.log(`${colors.cyan(serverName)}: ${colors.dim(config.version)} → ${colors.green(updateInfo.latestVersion)}`);
      } else {
        console.log(`${colors.cyan(serverName)}: ${formatInfo('up to date')}`);
      }
    } catch (error) {
      console.log(`${colors.cyan(serverName)}: ${colors.red(`error checking updates - ${error.message}`)}`);
    }
  }
  
  if (updates.length === 0) {
    console.log(formatSuccess('\nAll servers are up to date!'));
    return;
  }
  
  console.log(`\nFound ${updates.length} update(s) available.`);
  console.log(`Run ${colors.cyan('nvmcp update <server-name>')} to update individual servers.`);
}

async function checkForUpdates(serverName, config) {
  try {
    let latestVersion;
    let packageInfo;
    
    if (config.source && config.source.includes('github')) {
      const repoPath = extractGithubRepo(config.source);
      if (repoPath) {
        packageInfo = await getGithubRepoInfo(repoPath);
        latestVersion = packageInfo.default_branch || 'main';
      }
    } else {
      packageInfo = await getNpmPackageInfo(serverName);
      latestVersion = packageInfo.version;
    }
    
    if (!latestVersion) {
      throw new Error('Could not determine latest version');
    }
    
    const hasUpdate = config.version !== latestVersion && 
                     !isNewerVersion(config.version, latestVersion);
    
    return {
      hasUpdate,
      latestVersion,
      packageInfo,
      changes: extractChanges(packageInfo)
    };
    
  } catch (error) {
    throw new Error(`Failed to check for updates: ${error.message}`);
  }
}

function isNewerVersion(current, latest) {
  if (!current || !latest) return false;
  
  if (current === latest) return false;
  
  const currentParts = current.replace(/[^0-9.]/g, '').split('.').map(Number);
  const latestParts = latest.replace(/[^0-9.]/g, '').split('.').map(Number);
  
  const maxLength = Math.max(currentParts.length, latestParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (currentPart > latestPart) return true;
    if (currentPart < latestPart) return false;
  }
  
  return false;
}

function extractGithubRepo(source) {
  if (!source) return null;
  
  const githubMatch = source.match(/github\.com[/:]([\w-]+\/[\w-]+)/);
  return githubMatch ? githubMatch[1] : null;
}

function extractChanges(packageInfo) {
  const changes = [];
  
  if (packageInfo.description) {
    changes.push(packageInfo.description);
  }
  
  return changes;
}

module.exports = { updateCommand };