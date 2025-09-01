const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parsePackageSpec } = require('../cli');
const { SERVERS_DIR, saveServerConfig } = require('../utils/config');
const { getNpmPackageInfo, getGithubRepoInfo, downloadFile } = require('../utils/http');
const { colors, formatSuccess, formatError } = require('../utils/colors');
const { spinner } = require('../utils/prompt');

async function installCommand(args, options) {
  if (args.length === 0) {
    throw new Error('Package name is required');
  }
  
  const packageName = args[0];
  const packageSpec = parsePackageSpec(options.repo ? `github:${options.repo}` : packageName);
  
  console.log(`Installing ${colors.cyan(packageSpec.fullName)}...`);
  
  const loadingSpinner = spinner('Fetching package information');
  loadingSpinner.start();
  
  try {
    let packageInfo;
    
    if (packageSpec.type === 'npm') {
      packageInfo = await getNpmPackageInfo(packageSpec.name);
      await installNpmPackage(packageInfo, options, packageSpec.safeName || packageSpec.name);
    } else if (packageSpec.type === 'github') {
      packageInfo = await getGithubRepoInfo(packageSpec.repo);
      await installGithubPackage(packageInfo, packageSpec, options);
    }
    
    loadingSpinner.stop();
    
    const serverName = packageSpec.safeName || packageSpec.name;
    await createDefaultConfig(serverName, packageInfo, options, packageSpec.name);
    
    console.log(formatSuccess(`Successfully installed ${colors.cyan(packageSpec.name)}`));
    
    if (options.tag) {
      console.log(`Tagged as: ${colors.cyan(options.tag)}`);
    }
    
    console.log(`\nNext steps:`);
    console.log(`  ${colors.cyan(`nvmcp config ${packageSpec.name}`)}  Configure the server`);
    console.log(`  ${colors.cyan(`nvmcp use ${packageSpec.name}`)}     Activate the server`);
    
  } catch (error) {
    loadingSpinner.stop(formatError(`Installation failed: ${error.message}`));
    throw error;
  }
}

async function installNpmPackage(packageInfo, options, safeName) {
  const serverDir = path.join(SERVERS_DIR, safeName || packageInfo.name);
  
  if (fs.existsSync(serverDir)) {
    throw new Error(`Package ${packageInfo.name} is already installed`);
  }
  
  fs.mkdirSync(serverDir, { recursive: true });
  
  const tempDir = path.join(serverDir, 'temp');
  fs.mkdirSync(tempDir);
  
  const tarballPath = path.join(tempDir, 'package.tgz');
  
  await downloadFile(packageInfo.tarball, tarballPath);
  
  await extractTarball(tarballPath, serverDir);
  
  fs.rmSync(tempDir, { recursive: true });
  
  const packageJsonPath = path.join(serverDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    await installDependencies(serverDir);
  }
}

async function installGithubPackage(repoInfo, packageSpec, options) {
  const serverDir = path.join(SERVERS_DIR, packageSpec.name);
  
  if (fs.existsSync(serverDir)) {
    throw new Error(`Package ${packageSpec.name} is already installed`);
  }
  
  fs.mkdirSync(serverDir, { recursive: true });
  
  const tempDir = path.join(serverDir, 'temp');
  fs.mkdirSync(tempDir);
  
  const tarballPath = path.join(tempDir, 'repo.tar.gz');
  
  await downloadFile(repoInfo.tarball_url, tarballPath);
  
  await extractTarball(tarballPath, serverDir, true);
  
  fs.rmSync(tempDir, { recursive: true });
  
  const packageJsonPath = path.join(serverDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    await installDependencies(serverDir);
  }
}

async function extractTarball(tarballPath, destination, isGithub = false) {
  return new Promise((resolve, reject) => {
    let extractArgs;
    
    if (isGithub) {
      extractArgs = ['tar', '-xzf', tarballPath, '--strip-components=1', '-C', destination];
    } else {
      extractArgs = ['tar', '-xzf', tarballPath, '--strip-components=1', '-C', destination];
    }
    
    const extract = spawn(extractArgs[0], extractArgs.slice(1), {
      stdio: 'pipe'
    });
    
    extract.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to extract package (exit code: ${code})`));
      }
    });
    
    extract.on('error', (error) => {
      reject(new Error(`Failed to extract package: ${error.message}`));
    });
  });
}

async function installDependencies(serverDir) {
  return new Promise((resolve, reject) => {
    const npm = spawn('npm', ['install', '--production'], {
      cwd: serverDir,
      stdio: 'pipe'
    });
    
    npm.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.warn(colors.yellow('Warning: Failed to install dependencies'));
        resolve();
      }
    });
    
    npm.on('error', (error) => {
      console.warn(colors.yellow(`Warning: ${error.message}`));
      resolve();
    });
  });
}

async function createDefaultConfig(serverName, packageInfo, options, originalName) {
  const config = {
    name: originalName || serverName,
    serverName: serverName,
    version: packageInfo.version || 'unknown',
    type: 'local',
    command: detectCommand(serverName, packageInfo),
    env: {},
    args: [],
    capabilities: ['tools', 'resources'],
    installed: new Date().toISOString(),
    source: packageInfo.homepage || packageInfo.repository?.url || 'unknown'
  };
  
  if (options.tag) {
    config.tags = [options.tag];
  }
  
  saveServerConfig(serverName, config);
}

function detectCommand(serverName, packageInfo) {
  const serverDir = path.join(SERVERS_DIR, serverName);
  
  const packageJsonPath = path.join(serverDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (pkg.bin && typeof pkg.bin === 'string') {
        return `node ${pkg.bin}`;
      }
      
      if (pkg.bin && typeof pkg.bin === 'object') {
        const binName = Object.keys(pkg.bin)[0];
        return `node ${pkg.bin[binName]}`;
      }
      
      if (pkg.main) {
        return `node ${pkg.main}`;
      }
    } catch (error) {
    }
  }
  
  const commonEntries = ['index.js', 'main.js', 'server.js', 'app.js'];
  for (const entry of commonEntries) {
    if (fs.existsSync(path.join(serverDir, entry))) {
      return `node ${entry}`;
    }
  }
  
  return 'node index.js';
}

module.exports = { installCommand };