const fs = require('fs');
const path = require('path');
const { NVMCP_DIR, ensureNvmcpDir, getConfig } = require('../utils/config');
const { colors, formatSuccess, formatError, formatInfo, formatTable } = require('../utils/colors');
const { prompt, confirm, select } = require('../utils/prompt');

const PROJECTS_DIR = path.join(NVMCP_DIR, 'projects');
const ACTIVE_PROJECT_FILE = path.join(NVMCP_DIR, 'active-project.json');

function ensureProjectsDir() {
  ensureNvmcpDir();
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

async function projectCommand(args, options) {
  const subcommand = args[0];
  
  if (!subcommand || subcommand === 'help') {
    showProjectHelp();
    return;
  }
  
  switch (subcommand) {
    case 'create':
      await createProject(args.slice(1), options);
      break;
    case 'list':
    case 'ls':
      await listProjects();
      break;
    case 'switch':
    case 'use':
      await switchProject(args.slice(1));
      break;
    case 'current':
      showCurrentProject();
      break;
    case 'config':
      await configureProject(args.slice(1), options);
      break;
    case 'delete':
    case 'rm':
      await deleteProject(args.slice(1));
      break;
    case 'export':
      await exportProject(args.slice(1), options);
      break;
    default:
      console.error(formatError(`Unknown project subcommand: ${subcommand}`));
      showProjectHelp();
  }
}

async function createProject(args, options) {
  ensureProjectsDir();
  
  let projectName = args[0];
  
  if (!projectName) {
    projectName = await prompt('Project name', { 
      required: true,
      validate: (name) => {
        if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
          return 'Project name can only contain letters, numbers, hyphens, and underscores';
        }
        const projectFile = path.join(PROJECTS_DIR, `${name}.json`);
        if (fs.existsSync(projectFile)) {
          return `Project '${name}' already exists`;
        }
        return true;
      }
    });
  }
  
  const projectFile = path.join(PROJECTS_DIR, `${projectName}.json`);
  
  if (fs.existsSync(projectFile)) {
    throw new Error(`Project '${projectName}' already exists`);
  }
  
  const projectType = await select('Project type', [
    { name: 'Web Development (NextJS, React, etc.)', value: 'web' },
    { name: 'Python/AI Development', value: 'python' },
    { name: 'Node.js/JavaScript', value: 'nodejs' },
    { name: 'Custom/Other', value: 'custom' }
  ]);
  
  const description = await prompt('Project description (optional)');
  
  const projectConfig = {
    name: projectName,
    type: projectType,
    description: description || '',
    created: new Date().toISOString(),
    mcpServers: {},
    ai_tools: {
      claude: options.claude !== false,
      cursor: options.cursor !== false,
      vscode: options.vscode === true
    }
  };
  
  // Add default servers based on project type
  if (projectType === 'web') {
    projectConfig.mcpServers = {
      'nextjs-mastra-docs': {
        url: 'https://gitmcp.io/huanshenyi/nextjs-mastra',
        description: 'NextJS Mastra documentation and helpers'
      }
    };
  } else if (projectType === 'python') {
    projectConfig.mcpServers = {
      'python-tools': {
        url: 'https://gitmcp.io/python/tools',
        description: 'Python development tools and utilities'
      }
    };
  }
  
  fs.writeFileSync(projectFile, JSON.stringify(projectConfig, null, 2));
  
  console.log(formatSuccess(`Created project '${colors.cyan(projectName)}'`));
  
  if (options.switch !== false) {
    const shouldSwitch = await confirm(`Switch to project '${projectName}'?`, true);
    if (shouldSwitch) {
      await switchProject([projectName]);
    }
  }
  
  console.log(`\nNext steps:`);
  console.log(`  ${colors.cyan(`nvmcp project config ${projectName}`)}  Configure MCP servers`);
  console.log(`  ${colors.cyan(`nvmcp project switch ${projectName}`)}   Switch to this project`);
  console.log(`  ${colors.cyan(`nvmcp project export ${projectName} --claude`)}  Export to AI tools`);
}

async function listProjects() {
  ensureProjectsDir();
  
  const projectFiles = fs.readdirSync(PROJECTS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.basename(file, '.json'));
    
  if (projectFiles.length === 0) {
    console.log('No projects found.');
    console.log(`\nCreate your first project:`);
    console.log(`  ${colors.cyan('nvmcp project create')}`);
    return;
  }
  
  const currentProject = getCurrentProject();
  
  const projectData = projectFiles.map(name => {
    const projectFile = path.join(PROJECTS_DIR, `${name}.json`);
    let config;
    
    try {
      config = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
    } catch (error) {
      return [name, 'invalid', '', ''];
    }
    
    const status = name === currentProject?.name ? 
      colors.green('active') : 
      colors.dim('inactive');
      
    const serverCount = Object.keys(config.mcpServers || {}).length;
    const servers = serverCount > 0 ? `${serverCount} server(s)` : 'no servers';
    
    return [
      name === currentProject?.name ? colors.cyan(name) : name,
      config.type || 'unknown',
      status,
      servers,
      config.description || ''
    ];
  });
  
  console.log(colors.bold('Projects:\n'));
  
  const headers = ['Name', 'Type', 'Status', 'Servers', 'Description'];
  console.log(formatTable(headers, projectData));
  
  console.log(`\nCommands:`);
  console.log(`  ${colors.cyan('nvmcp project switch <name>')}  Switch to a project`);
  console.log(`  ${colors.cyan('nvmcp project config <name>')}  Configure project servers`);
  console.log(`  ${colors.cyan('nvmcp project export <name>')}  Export to AI tools`);
}

async function switchProject(args) {
  const projectName = args[0];
  
  if (!projectName) {
    const projects = getAvailableProjects();
    if (projects.length === 0) {
      console.log('No projects available. Create one first:');
      console.log(`  ${colors.cyan('nvmcp project create')}`);
      return;
    }
    
    const selected = await select('Select project', projects);
    return switchProject([selected]);
  }
  
  const projectFile = path.join(PROJECTS_DIR, `${projectName}.json`);
  
  if (!fs.existsSync(projectFile)) {
    throw new Error(`Project '${projectName}' not found`);
  }
  
  const activeProject = {
    name: projectName,
    switched: new Date().toISOString()
  };
  
  fs.writeFileSync(ACTIVE_PROJECT_FILE, JSON.stringify(activeProject, null, 2));
  
  console.log(formatSuccess(`Switched to project '${colors.cyan(projectName)}'`));
  
  const config = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  const serverCount = Object.keys(config.mcpServers || {}).length;
  
  if (serverCount > 0) {
    console.log(`Active servers: ${serverCount}`);
    console.log(`\nExport to AI tools:`);
    console.log(`  ${colors.cyan(`nvmcp project export ${projectName} --claude`)}`);
    console.log(`  ${colors.cyan(`nvmcp project export ${projectName} --cursor`)}`);
  } else {
    console.log(`\nConfigure servers for this project:`);
    console.log(`  ${colors.cyan(`nvmcp project config ${projectName}`)}`);
  }
}

function getCurrentProject() {
  if (!fs.existsSync(ACTIVE_PROJECT_FILE)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(ACTIVE_PROJECT_FILE, 'utf8'));
  } catch (error) {
    return null;
  }
}

function showCurrentProject() {
  const current = getCurrentProject();
  
  if (!current) {
    console.log('No active project.');
    console.log(`\nSwitch to a project:`);
    console.log(`  ${colors.cyan('nvmcp project switch <name>')}`);
    return;
  }
  
  const projectFile = path.join(PROJECTS_DIR, `${current.name}.json`);
  
  if (!fs.existsSync(projectFile)) {
    console.log(formatError(`Active project '${current.name}' not found`));
    return;
  }
  
  const config = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  
  console.log(`Current project: ${colors.cyan(current.name)}`);
  console.log(`Type: ${config.type}`);
  console.log(`Description: ${config.description || 'None'}`);
  console.log(`Servers: ${Object.keys(config.mcpServers || {}).length}`);
  
  if (Object.keys(config.mcpServers || {}).length > 0) {
    console.log('\nConfigured servers:');
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      console.log(`  ${colors.cyan(name)}: ${serverConfig.url || serverConfig.command || 'configured'}`);
    }
  }
}

async function configureProject(args, options) {
  let projectName = args[0];
  
  if (!projectName) {
    const current = getCurrentProject();
    if (current) {
      projectName = current.name;
    } else {
      throw new Error('No project specified and no active project');
    }
  }
  
  const projectFile = path.join(PROJECTS_DIR, `${projectName}.json`);
  
  if (!fs.existsSync(projectFile)) {
    throw new Error(`Project '${projectName}' not found`);
  }
  
  const config = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  
  console.log(`Configuring project: ${colors.cyan(projectName)}\n`);
  
  const action = await select('What would you like to do?', [
    { name: 'Add a new MCP server', value: 'add' },
    { name: 'Remove an existing server', value: 'remove' },
    { name: 'List current servers', value: 'list' },
    { name: 'Edit project settings', value: 'settings' }
  ]);
  
  if (action === 'add') {
    await addServerToProject(config, projectFile);
  } else if (action === 'remove') {
    await removeServerFromProject(config, projectFile);
  } else if (action === 'list') {
    listProjectServers(config);
  } else if (action === 'settings') {
    await editProjectSettings(config, projectFile);
  }
}

async function addServerToProject(config, projectFile) {
  const serverName = await prompt('Server name', { required: true });
  
  const serverType = await select('Server type', [
    { name: 'Remote URL (like your NextJS example)', value: 'url' },
    { name: 'Local command', value: 'command' },
    { name: 'From global servers', value: 'global' }
  ]);
  
  let serverConfig = {};
  
  if (serverType === 'url') {
    const url = await prompt('Server URL', { 
      required: true,
      validate: (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    });
    const description = await prompt('Description (optional)');
    
    serverConfig = {
      url,
      description: description || ''
    };
  } else if (serverType === 'command') {
    const command = await prompt('Command to run', { required: true });
    const args = await prompt('Arguments (space-separated, optional)');
    const description = await prompt('Description (optional)');
    
    serverConfig = {
      command,
      args: args ? args.split(' ') : [],
      description: description || ''
    };
  }
  
  config.mcpServers[serverName] = serverConfig;
  config.updated = new Date().toISOString();
  
  fs.writeFileSync(projectFile, JSON.stringify(config, null, 2));
  
  console.log(formatSuccess(`Added server '${colors.cyan(serverName)}' to project`));
}

async function removeServerFromProject(config, projectFile) {
  const servers = Object.keys(config.mcpServers || {});
  
  if (servers.length === 0) {
    console.log('No servers configured in this project.');
    return;
  }
  
  const serverToRemove = await select('Select server to remove', servers);
  
  const confirm = await confirm(`Remove server '${serverToRemove}'?`, false);
  if (!confirm) {
    console.log('Cancelled.');
    return;
  }
  
  delete config.mcpServers[serverToRemove];
  config.updated = new Date().toISOString();
  
  fs.writeFileSync(projectFile, JSON.stringify(config, null, 2));
  
  console.log(formatSuccess(`Removed server '${colors.cyan(serverToRemove)}'`));
}

function listProjectServers(config) {
  const servers = config.mcpServers || {};
  
  if (Object.keys(servers).length === 0) {
    console.log('No servers configured in this project.');
    return;
  }
  
  console.log('Configured servers:\n');
  
  for (const [name, serverConfig] of Object.entries(servers)) {
    console.log(`${colors.cyan(name)}`);
    if (serverConfig.url) {
      console.log(`  URL: ${serverConfig.url}`);
    }
    if (serverConfig.command) {
      console.log(`  Command: ${serverConfig.command}`);
    }
    if (serverConfig.description) {
      console.log(`  Description: ${serverConfig.description}`);
    }
    console.log();
  }
}

async function editProjectSettings(config, projectFile) {
  console.log('Edit project settings:\n');
  
  const newDescription = await prompt('Description', { default: config.description });
  const newType = await select('Project type', [
    { name: 'Web Development', value: 'web' },
    { name: 'Python/AI Development', value: 'python' },
    { name: 'Node.js/JavaScript', value: 'nodejs' },
    { name: 'Custom/Other', value: 'custom' }
  ], { default: config.type === 'web' ? 1 : config.type === 'python' ? 2 : config.type === 'nodejs' ? 3 : 4 });
  
  config.description = newDescription;
  config.type = newType;
  config.updated = new Date().toISOString();
  
  fs.writeFileSync(projectFile, JSON.stringify(config, null, 2));
  
  console.log(formatSuccess('Project settings updated'));
}

async function deleteProject(args) {
  const projectName = args[0];
  
  if (!projectName) {
    throw new Error('Project name is required');
  }
  
  const projectFile = path.join(PROJECTS_DIR, `${projectName}.json`);
  
  if (!fs.existsSync(projectFile)) {
    throw new Error(`Project '${projectName}' not found`);
  }
  
  const confirmDelete = await confirm(`Delete project '${projectName}'? This cannot be undone.`, false);
  
  if (!confirmDelete) {
    console.log('Cancelled.');
    return;
  }
  
  fs.unlinkSync(projectFile);
  
  // Clear active project if it was deleted
  const current = getCurrentProject();
  if (current && current.name === projectName) {
    if (fs.existsSync(ACTIVE_PROJECT_FILE)) {
      fs.unlinkSync(ACTIVE_PROJECT_FILE);
    }
  }
  
  console.log(formatSuccess(`Deleted project '${colors.cyan(projectName)}'`));
}

async function exportProject(args, options) {
  let projectName = args[0];
  
  if (!projectName) {
    const current = getCurrentProject();
    if (current) {
      projectName = current.name;
    } else {
      throw new Error('No project specified and no active project');
    }
  }
  
  const projectFile = path.join(PROJECTS_DIR, `${projectName}.json`);
  
  if (!fs.existsSync(projectFile)) {
    throw new Error(`Project '${projectName}' not found`);
  }
  
  const config = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  
  // Convert to AI tool format
  const mcpConfig = {
    mcpServers: {}
  };
  
  for (const [name, serverConfig] of Object.entries(config.mcpServers || {})) {
    if (serverConfig.url) {
      mcpConfig.mcpServers[name] = {
        url: serverConfig.url
      };
    } else if (serverConfig.command) {
      mcpConfig.mcpServers[name] = {
        command: serverConfig.command,
        args: serverConfig.args || []
      };
    }
  }
  
  if (Object.keys(mcpConfig.mcpServers).length === 0) {
    console.log(formatInfo('No servers to export. Configure servers first:'));
    console.log(`  ${colors.cyan(`nvmcp project config ${projectName}`)}`);
    return;
  }
  
  // Export to specified AI tools
  if (options.claude) {
    await exportToTool('claude', mcpConfig, projectName);
  }
  
  if (options.cursor) {
    await exportToTool('cursor', mcpConfig, projectName);
  }
  
  if (options.vscode) {
    await exportToTool('vscode', mcpConfig, projectName);
  }
  
  if (!options.claude && !options.cursor && !options.vscode) {
    console.log('Generated configuration:');
    console.log(JSON.stringify(mcpConfig, null, 2));
    console.log('\nTo export to AI tools:');
    console.log(`  ${colors.cyan(`nvmcp project export ${projectName} --claude`)}`);
    console.log(`  ${colors.cyan(`nvmcp project export ${projectName} --cursor`)}`);
  }
}

async function exportToTool(toolName, mcpConfig, projectName) {
  try {
    const config = getConfig();
    const toolConfig = config.tools[toolName];
    
    if (!toolConfig || !toolConfig.configPath) {
      throw new Error(`No configuration path defined for ${toolName}`);
    }
    
    const toolConfigPath = expandPath(toolConfig.configPath);
    const dir = path.dirname(toolConfigPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    let existingConfig = {};
    if (fs.existsSync(toolConfigPath)) {
      try {
        const content = fs.readFileSync(toolConfigPath, 'utf8');
        existingConfig = JSON.parse(content);
      } catch (error) {
        console.warn(colors.yellow(`Warning: Could not parse existing ${toolName} config`));
      }
    }
    
    // Merge the project's MCP servers
    existingConfig.mcpServers = { ...existingConfig.mcpServers, ...mcpConfig.mcpServers };
    
    fs.writeFileSync(toolConfigPath, JSON.stringify(existingConfig, null, 2));
    
    console.log(formatSuccess(`Exported project '${colors.cyan(projectName)}' to ${toolName}`));
    console.log(colors.dim(`Config file: ${toolConfigPath}`));
    
  } catch (error) {
    console.error(formatError(`Failed to export to ${toolName}: ${error.message}`));
  }
}

function expandPath(filePath) {
  if (filePath.startsWith('~')) {
    return path.join(require('os').homedir(), filePath.slice(1));
  }
  return filePath;
}

function getAvailableProjects() {
  ensureProjectsDir();
  
  return fs.readdirSync(PROJECTS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.basename(file, '.json'));
}

function showProjectHelp() {
  console.log(`${colors.cyan('nvmcp project')} - Project-based MCP management

${colors.bold('USAGE:')}
  nvmcp project <command> [options]

${colors.bold('COMMANDS:')}
  ${colors.cyan('create')}                 Create a new project
  ${colors.cyan('list')}                   List all projects
  ${colors.cyan('switch')} <name>          Switch to a project
  ${colors.cyan('current')}                Show current active project
  ${colors.cyan('config')} <name>          Configure project servers
  ${colors.cyan('export')} <name>          Export project to AI tools
  ${colors.cyan('delete')} <name>          Delete a project

${colors.bold('OPTIONS:')}
  ${colors.cyan('--claude')}               Export to Claude Desktop
  ${colors.cyan('--cursor')}               Export to Cursor IDE
  ${colors.cyan('--vscode')}               Export to VS Code

${colors.bold('EXAMPLES:')}
  nvmcp project create nextjs-app
  nvmcp project config nextjs-app
  nvmcp project switch nextjs-app
  nvmcp project export nextjs-app --claude`);
}

module.exports = { 
  projectCommand,
  getCurrentProject,
  getAvailableProjects
};