/**
 * @fileoverview Tag management commands for NVMCP
 * @module commands/tags
 */

const {
  getTagConfig,
  saveTagConfig,
  listTags,
  deleteTag,
  getActiveTag,
  setActiveTag,
  tagExists,
  createDefaultTag,
  parseSource,
  initialize,
  getCacheDir
} = require('../utils/unified-config');
const { colors, formatSuccess, formatError, formatTable } = require('../utils/colors');
const { prompt, confirm } = require('../utils/prompt');
const { ProcessManager } = require('../utils/processes');
const { ErrorFactory, validateArgs } = require('../utils/errors');
const { Validators } = require('../utils/validation');
const { sanitizeInput } = require('../utils/crypto');

// Node.js built-ins
const fs = require('fs');
const path = require('path');
const os = require('os');

const processManager = new ProcessManager();

/**
 * Switch to a tag configuration
 * @param {Array<string>} args - Command arguments [tagName]
 * @param {Object} options - Command options
 * @param {boolean} [options.start] - Auto-start MCPs after switching
 * @param {boolean} [options.claude] - Export to Claude Desktop
 * @param {boolean} [options.cursor] - Export to Cursor IDE
 * @param {boolean} [options.vscode] - Export to VSCode
 */
async function useCommand(args, options) {
  try {
    initialize();

    validateArgs(args, 1, 'Tag name is required. Usage: nvmcp use <tag-name>');

    const tagName = sanitizeInput(args[0]);
    Validators.tagName(tagName);

    if (!tagExists(tagName)) {
      throw ErrorFactory.tag(`Tag '${tagName}' not found. Run 'nvmcp list' to see available tags.`, tagName);
    }

    const tagConfig = getTagConfig(tagName);

    console.log(`Switching to tag: ${colors.cyan(tagName)}`);

    setActiveTag(tagName);

    console.log(formatSuccess(`Active tag: ${colors.cyan(tagName)}`));

    if (tagConfig.description) {
      console.log(`Description: ${tagConfig.description}`);
    }

    const mcpCount = Object.keys(tagConfig.mcps || {}).length;
    if (mcpCount > 0) {
      console.log(`MCPs configured: ${mcpCount}`);

      if (options.start || options.autostart) {
        console.log('\nStarting MCPs...');
        await startTagMCPs(tagName);
      } else {
        console.log(`\nTo start MCPs: ${colors.cyan('nvmcp start')}`);
      }
    } else {
      console.log('\nAdd MCPs to this tag:');
      console.log(`  ${colors.cyan('nvmcp add <source>')}`);
    }

    if (options.claude) {
      await exportTagToTool(tagName, 'claude');
    }
    if (options.cursor) {
      await exportTagToTool(tagName, 'cursor');
    }
    if (options.vscode) {
      await exportTagToTool(tagName, 'vscode');
    }
  } catch (error) {
    // Add command context for better error messages
    if (!error.command) {
      error.command = 'use';
      error.args = args;
      error.options = options;
    }
    throw error;
  }
}

/**
 * Create a new tag configuration
 * @param {Array<string>} args - Command arguments [tagName?]
 * @param {Object} options - Command options
 * @param {string} [options.description] - Tag description
 * @param {boolean} [options.use] - Switch to tag after creation
 */
async function createCommand(args, options) {
  initialize();

  let tagName = args[0];

  if (!tagName) {
    tagName = await prompt('Tag name', {
      required: true,
      validate: (name) => {
        try {
          Validators.tagName(name);
          if (tagExists(name)) {
            return `Tag '${name}' already exists`;
          }
          return true;
        } catch (error) {
          return error.message;
        }
      }
    });
  } else {
    Validators.tagName(tagName);
  }

  if (tagExists(tagName)) {
    throw ErrorFactory.tag(`Tag '${tagName}' already exists`, tagName);
  }

  const description = options.description ||
    await prompt('Description (optional)', { default: '' });

  const tagConfig = createDefaultTag(tagName, description);

  saveTagConfig(tagName, tagConfig);

  console.log(formatSuccess(`Created tag '${colors.cyan(tagName)}'`));

  if (options.use !== false) {
    const shouldUse = await confirm(`Switch to tag '${tagName}'?`, true);
    if (shouldUse) {
      setActiveTag(tagName);
      console.log(formatSuccess(`Switched to tag '${colors.cyan(tagName)}'`));
    }
  }

  console.log('\nNext steps:');
  console.log(`  ${colors.cyan('nvmcp add <source>')}     Add MCPs to this tag`);
  console.log(`  ${colors.cyan('nvmcp start')}            Start all MCPs`);
}

/**
 * List all tag configurations
 * @param {Array<string>} args - Command arguments (unused)
 * @param {Object} options - Command options (unused)
 */
async function listCommand(_args, _options) {
  initialize();

  const tags = listTags();

  if (tags.length === 0) {
    console.log('No tags found.');
    console.log('\nCreate your first tag:');
    console.log(`  ${colors.cyan('nvmcp create <tag-name>')}`);
    return;
  }

  const activeTag = getActiveTag();

  const tagData = tags.map(tagName => {
    const config = getTagConfig(tagName);

    if (!config) {
      return [tagName, 'invalid', '', ''];
    }

    const isActive = tagName === activeTag;
    const displayName = isActive ? colors.cyan(tagName) : tagName;
    const status = isActive ? colors.green('active') : colors.dim('inactive');
    const mcpCount = Object.keys(config.mcps || {}).length;
    const mcps = mcpCount > 0 ? `${mcpCount} MCP(s)` : 'no MCPs';

    return [
      displayName,
      status,
      mcps,
      config.description || ''
    ];
  });

  console.log(colors.bold('Available tags:\n'));

  const headers = ['Tag', 'Status', 'MCPs', 'Description'];
  console.log(formatTable(headers, tagData));

  if (activeTag) {
    console.log(`\nActive: ${colors.cyan(activeTag)}`);
  }

  console.log('\nCommands:');
  console.log(`  ${colors.cyan('nvmcp use <tag>')}        Switch to a tag`);
  console.log(`  ${colors.cyan('nvmcp add <source>')}     Add MCP to active tag`);
  console.log(`  ${colors.cyan('nvmcp start')}            Start MCPs in active tag`);
}

/**
 * Delete a tag configuration
 * @param {Array<string>} args - Command arguments [tagName]
 * @param {Object} options - Command options (unused)
 */
async function deleteCommand(args, _options) {
  initialize();

  validateArgs(args, 1, 'Tag name is required');
  Validators.tagName(args[0]);

  const tagName = args[0];

  if (!tagExists(tagName)) {
    throw ErrorFactory.tag(`Tag '${tagName}' not found`, tagName);
  }

  const activeTag = getActiveTag();
  if (tagName === activeTag) {
    throw ErrorFactory.tag(`Cannot delete active tag '${tagName}'. Switch to another tag first.`, tagName, { activeTag: true });
  }

  const confirmDelete = await confirm(
    `Delete tag '${tagName}'? This cannot be undone.`,
    false
  );

  if (!confirmDelete) {
    console.log('Cancelled.');
    return;
  }

  deleteTag(tagName);
  console.log(formatSuccess(`Deleted tag '${colors.cyan(tagName)}'`));
}

/**
 * Add MCP to active tag
 * @param {Array<string>} args - Command arguments [source, name?]
 * @param {Object} options - Command options
 * @param {string} [options.name] - Custom name for the MCP
 * @param {boolean} [options.start] - Auto-start MCP after adding
 */
async function addCommand(args, options) {
  initialize();

  validateArgs(args, 1, 'MCP source is required. Usage: nvmcp add <source>');

  const activeTag = getActiveTag();
  if (!activeTag) {
    throw ErrorFactory.tag('No active tag. Create or switch to a tag first: nvmcp use <tag>', null, { noActiveTag: true });
  }

  const tagConfig = getTagConfig(activeTag);

  if (!tagConfig) {
    throw ErrorFactory.tag(`Active tag '${activeTag}' not found`, activeTag, { configMissing: true });
  }

  const input = sanitizeInput(args[0]);
  let source = input;
  let mcpName = null;

  // Check if input is a preset name
  if (MCP_PRESETS[input]) {
    mcpName = input;
    source = MCP_PRESETS[input].source;
    console.log(`Using preset: ${colors.cyan(input)}`);
    console.log(`  ${MCP_PRESETS[input].description}`);
  } else {
    // Validate as a source
    Validators.mcpSource(source);
    const sourceInfo = parseSource(source);
    mcpName = sourceInfo.name;
  }

  // Allow custom name override
  if (options.name) {
    mcpName = options.name;
  } else if (args[1]) {
    mcpName = args[1];
  }

  if (tagConfig.mcps[mcpName]) {
    const overwrite = await confirm(
      `MCP '${mcpName}' already exists in tag '${activeTag}'. Overwrite?`,
      false
    );
    if (!overwrite) {
      console.log('Cancelled.');
      return;
    }
  }

  tagConfig.mcps[mcpName] = source;
  saveTagConfig(activeTag, tagConfig);

  console.log(formatSuccess(`Added ${colors.cyan(mcpName)} to tag '${colors.cyan(activeTag)}'`));
  console.log(`Source: ${source}`);

  if (options.start) {
    console.log('\nStarting MCP...');
    try {
      await processManager.startMCP(mcpName, source, tagConfig.env);
    } catch (error) {
      console.error(formatError(`Failed to start MCP: ${error.message}`));
    }
  }
}

/**
 * Remove MCP from active tag
 * @param {Array<string>} args - Command arguments [mcpName]
 * @param {Object} options - Command options (unused)
 */
async function removeCommand(args, _options) {
  initialize();

  validateArgs(args, 1, 'MCP name is required. Usage: nvmcp remove <mcp-name>');
  Validators.string(args[0], { minLength: 1 });

  const activeTag = getActiveTag();
  if (!activeTag) {
    throw ErrorFactory.tag('No active tag. Switch to a tag first: nvmcp use <tag>', null, { noActiveTag: true });
  }

  const mcpName = args[0];
  const tagConfig = getTagConfig(activeTag);

  if (!tagConfig || !tagConfig.mcps[mcpName]) {
    throw ErrorFactory.mcpSource(`MCP '${mcpName}' not found in tag '${activeTag}'`, mcpName, { tagName: activeTag });
  }

  const confirmRemove = await confirm(
    `Remove MCP '${mcpName}' from tag '${activeTag}'?`,
    true
  );

  if (!confirmRemove) {
    console.log('Cancelled.');
    return;
  }

  delete tagConfig.mcps[mcpName];
  saveTagConfig(activeTag, tagConfig);

  console.log(formatSuccess(`Removed ${colors.cyan(mcpName)} from tag '${colors.cyan(activeTag)}'`));
}

/**
 * Start MCPs from tag
 * @param {Array<string>} args - Command arguments [tagName?]
 * @param {Object} options - Command options (unused)
 */
async function startCommand(args, _options) {
  let targetTag = args[0];

  if (!targetTag) {
    targetTag = getActiveTag();
    if (!targetTag) {
      throw new Error('No active tag. Switch to a tag first: nvmcp use <tag>');
    }
  }

  await startTagMCPs(targetTag);
}

/**
 * Start all MCPs from a specific tag
 * @param {string} tagName - Name of the tag
 * @returns {Promise<void>}
 */
async function startTagMCPs(tagName) {
  const tagConfig = getTagConfig(tagName);

  if (!tagConfig) {
    throw ErrorFactory.tag(`Tag '${tagName}' not found`, tagName);
  }

  const mcps = tagConfig.mcps || {};
  const mcpNames = Object.keys(mcps);

  if (mcpNames.length === 0) {
    console.log(`No MCPs configured in tag '${tagName}'`);
    return;
  }

  console.log(`Starting ${mcpNames.length} MCP(s) from tag '${colors.cyan(tagName)}'...\n`);

  const results = [];

  for (const mcpName of mcpNames) {
    try {
      const processId = await processManager.startMCP(mcpName, mcps[mcpName], tagConfig.env);
      results.push({ name: mcpName, status: 'started', processId });
    } catch (error) {
      results.push({ name: mcpName, status: 'failed', error: error.message });
    }
  }

  console.log('\nStartup Summary:');
  results.forEach(result => {
    if (result.status === 'started') {
      console.log(`  ${colors.green('✓')} ${result.name}`);
    } else {
      console.log(`  ${colors.red('✗')} ${result.name}: ${result.error}`);
    }
  });

  const started = results.filter(r => r.status === 'started').length;
  const failed = results.filter(r => r.status === 'failed').length;

  if (started > 0) {
    console.log(`\n${formatSuccess(`Started ${started} MCP(s)`)}`);
  }
  if (failed > 0) {
    console.log(`${formatError(`Failed to start ${failed} MCP(s)`)}`);
  }
}

/**
 * Stop MCPs from tag
 * @param {Array<string>} args - Command arguments [tagName?]
 * @param {Object} options - Command options (unused)
 */
async function stopCommand(args, _options) {
  let targetTag = args[0];

  if (!targetTag) {
    targetTag = getActiveTag();
    if (!targetTag) {
      console.log('No active tag. Stopping all running MCPs...');
      const stopped = processManager.stopAll();
      console.log(formatSuccess(`Stopped ${stopped} process(es)`));
      return;
    }
  }

  const tagConfig = getTagConfig(targetTag);
  if (!tagConfig) {
    throw ErrorFactory.tag(`Tag '${targetTag}' not found`, targetTag);
  }

  const runningProcesses = processManager.listProcesses();
  const tagMCPs = Object.keys(tagConfig.mcps || {});

  const toStop = runningProcesses.filter(p => tagMCPs.includes(p.name));

  if (toStop.length === 0) {
    console.log(`No running MCPs from tag '${targetTag}'`);
    return;
  }

  console.log(`Stopping ${toStop.length} MCP(s) from tag '${colors.cyan(targetTag)}'...`);

  toStop.forEach(process => {
    try {
      processManager.stopMCP(process.id);
    } catch (error) {
      console.error(formatError(`Failed to stop ${process.name}: ${error.message}`));
    }
  });
}

/**
 * List running MCP processes
 * @param {Array<string>} args - Command arguments (unused)
 * @param {Object} options - Command options (unused)
 */
async function psCommand(_args, _options) {
  const processes = processManager.listProcesses();

  if (processes.length === 0) {
    console.log('No MCP processes running.');
    console.log(`\nStart MCPs: ${colors.cyan('nvmcp start')}`);
    return;
  }

  console.log(colors.bold('Running MCPs:\n'));

  const processData = processes.map(p => [
    colors.cyan(p.name),
    p.pid.toString(),
    p.status,
    `${p.uptime}s`,
    p.id
  ]);

  const headers = ['Name', 'PID', 'Status', 'Uptime', 'Process ID'];
  console.log(formatTable(headers, processData));

  console.log('\nCommands:');
  console.log(`  ${colors.cyan('nvmcp stop')}             Stop all MCPs from active tag`);
  console.log(`  ${colors.cyan('nvmcp kill <process-id>')} Kill specific process`);
}

/**
 * Kill specific MCP process
 * @param {Array<string>} args - Command arguments [processId]
 * @param {Object} options - Command options (unused)
 */
async function killCommand(args, _options) {
  initialize();

  validateArgs(args, 1, 'Process ID is required. Usage: nvmcp kill <process-id>');
  Validators.processId(args[0]);

  const processId = args[0];

  try {
    processManager.stopMCP(processId);
    console.log(formatSuccess(`Killed process ${processId}`));
  } catch (error) {
    throw ErrorFactory.process(`Failed to kill process: ${error.message}`, processId, { originalError: error.message });
  }
}

/**
 * Export tag configuration to external tool
 * @param {string} tagName - Name of the tag
 * @param {string} toolName - Name of the tool (claude, cursor, vscode)
 * @returns {Promise<void>}
 */
async function exportTagToTool(tagName, toolName) {

  const tagConfig = getTagConfig(tagName);
  if (!tagConfig) {
    throw ErrorFactory.tag(`Tag '${tagName}' not found`, tagName);
  }

  const mcpConfig = {
    mcpServers: {}
  };

  // Build proper MCP server configurations
  for (const [name, source] of Object.entries(tagConfig.mcps || {})) {
    const sourceInfo = parseSource(source);

    switch (sourceInfo.type) {
    case 'remote':
      mcpConfig.mcpServers[name] = {
        command: 'npx',
        args: ['@modelcontextprotocol/server-http', sourceInfo.url]
      };
      break;
    case 'npm':
      mcpConfig.mcpServers[name] = {
        command: 'npx',
        args: [sourceInfo.package]
      };
      break;
    case 'github':
      mcpConfig.mcpServers[name] = {
        command: 'node',
        args: [path.join(getCacheDir(sourceInfo.name), 'index.js')]
      };
      break;
    default:
      mcpConfig.mcpServers[name] = {
        command: 'node',
        args: ['placeholder']
      };
    }
  }

  // Get the appropriate config file path based on tool
  let configPath;
  switch (toolName) {
  case 'claude':
    configPath = path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
    break;
  case 'cursor':
    configPath = path.join(os.homedir(), '.cursor/mcp.json');
    break;
  case 'vscode':
    configPath = path.join(os.homedir(), '.vscode/mcp.json');
    break;
  default:
    throw ErrorFactory.validation(`Unsupported tool: ${toolName}`);
  }

  try {
    // Ensure directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Write the configuration
    fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
    console.log(formatSuccess(`Exported tag '${colors.cyan(tagName)}' to ${toolName}`));
    console.log(`Configuration saved to: ${colors.dim(configPath)}`);
  } catch (error) {
    throw ErrorFactory.config(`Failed to write ${toolName} configuration: ${error.message}`);
  }
}

/**
 * Popular MCP presets for quick setup
 */
const MCP_PRESETS = {
  whatsapp: {
    source: 'github:lharries/whatsapp-mcp',
    description: 'WhatsApp messaging integration'
  },
  filesystem: {
    source: 'npm:@modelcontextprotocol/server-filesystem',
    description: 'File system access and operations'
  },
  github: {
    source: 'npm:@modelcontextprotocol/server-github',
    description: 'GitHub repository integration'
  },
  slack: {
    source: 'npm:@modelcontextprotocol/server-slack',
    description: 'Slack workspace integration'
  },
  memory: {
    source: 'npm:@modelcontextprotocol/server-memory',
    description: 'Persistent memory storage'
  },
  postgres: {
    source: 'npm:@modelcontextprotocol/server-postgres',
    description: 'PostgreSQL database integration'
  }
};

/**
 * Initialize nvmcp with an interactive wizard
 * @param {Array<string>} args - Command arguments
 * @param {Object} options - Command options
 */
async function initCommand(args, options) {
  initialize();

  console.log(colors.bold('\n🚀 Welcome to nvmcp - MCP Server Manager!\n'));
  console.log('This wizard will help you set up your first MCP configuration.\n');

  // Check if tags exist
  const existingTags = listTags();
  if (existingTags.length > 0 && !options.force) {
    console.log(colors.yellow('You already have existing tags:'));
    existingTags.forEach(tag => console.log(`  - ${tag}`));
    const continueAnyway = await confirm('\nContinue with initialization anyway?', false);
    if (!continueAnyway) {
      console.log('\nCancelled. Use existing tags with:');
      console.log(`  ${colors.cyan('nvmcp list')}      View all tags`);
      console.log(`  ${colors.cyan('nvmcp use <tag>')} Switch to a tag`);
      return;
    }
  }

  // Step 1: Create a tag
  console.log(colors.bold('\nStep 1: Create a tag'));
  console.log('Tags help you organize MCPs for different environments (e.g., development, production)\n');

  const tagName = await prompt('Tag name', {
    default: 'default',
    required: true,
    validate: (name) => {
      try {
        Validators.tagName(name);
        if (tagExists(name)) {
          return `Tag '${name}' already exists`;
        }
        return true;
      } catch (error) {
        return error.message;
      }
    }
  });

  const description = await prompt('Description (optional)', {
    default: 'My first MCP configuration'
  });

  const tagConfig = createDefaultTag(tagName, description);
  saveTagConfig(tagName, tagConfig);
  setActiveTag(tagName);

  console.log(formatSuccess(`\n✓ Created and switched to tag '${colors.cyan(tagName)}'`));

  // Step 2: Add MCPs
  console.log(colors.bold('\n\nStep 2: Add MCP servers'));
  console.log('MCP servers provide capabilities like file access, API integrations, etc.\n');

  console.log('Available presets:');
  Object.entries(MCP_PRESETS).forEach(([name, { description }]) => {
    console.log(`  ${colors.cyan(name.padEnd(12))} - ${description}`);
  });

  const addMCPs = await confirm('\nWould you like to add MCPs now?', true);

  if (addMCPs) {
    const selectedPresets = [];

    // WhatsApp
    if (await confirm(`Add ${colors.cyan('WhatsApp')} MCP? (messaging integration)`, true)) {
      selectedPresets.push('whatsapp');
    }

    // Filesystem
    if (await confirm(`Add ${colors.cyan('Filesystem')} MCP? (file operations)`, true)) {
      selectedPresets.push('filesystem');
    }

    // Allow more
    const addMore = await confirm('Add more MCPs?', false);
    if (addMore) {
      console.log('\nEnter preset names (comma-separated) or custom sources:');
      console.log('Available: ' + Object.keys(MCP_PRESETS).join(', '));
      const moreInput = await prompt('Additional MCPs', { default: '' });
      if (moreInput) {
        const additional = moreInput.split(',').map(s => s.trim()).filter(Boolean);
        selectedPresets.push(...additional);
      }
    }

    // Add selected MCPs
    for (const preset of selectedPresets) {
      if (MCP_PRESETS[preset]) {
        tagConfig.mcps[preset] = MCP_PRESETS[preset].source;
        console.log(`  ${colors.green('✓')} Added ${colors.cyan(preset)}`);
      } else if (preset.includes(':') || preset.includes('http')) {
        // Custom source
        const sourceInfo = parseSource(preset);
        tagConfig.mcps[sourceInfo.name] = preset;
        console.log(`  ${colors.green('✓')} Added ${colors.cyan(sourceInfo.name)}`);
      }
    }

    saveTagConfig(tagName, tagConfig);
  }

  // Step 3: Export to Claude
  console.log(colors.bold('\n\nStep 3: Connect to AI tools'));
  console.log('Export your MCP configuration to Claude Desktop, Cursor, or VS Code\n');

  const exportTool = await prompt('Export to which tool? (claude/cursor/vscode/skip)', {
    default: 'claude',
    validate: (input) => {
      const valid = ['claude', 'cursor', 'vscode', 'skip', ''];
      return valid.includes(input.toLowerCase()) ? true : 'Invalid option';
    }
  });

  if (exportTool && exportTool !== 'skip') {
    try {
      await exportTagToTool(tagName, exportTool.toLowerCase());
      console.log(formatSuccess(`\n✓ Exported to ${exportTool}`));
    } catch (error) {
      console.error(formatError(`Failed to export: ${error.message}`));
    }
  }

  // Done!
  console.log(colors.bold('\n\n✨ Setup complete!'));
  console.log('\nNext steps:');
  console.log(`  ${colors.cyan('nvmcp start')}                Start your MCPs`);
  console.log(`  ${colors.cyan('nvmcp ps')}                   View running processes`);
  console.log(`  ${colors.cyan('nvmcp add <source>')}         Add more MCPs`);
  console.log(`  ${colors.cyan('nvmcp help')}                 View all commands`);
  console.log('\nHappy coding! 🎉\n');
}

/**
 * Quick start with preset configurations
 * @param {Array<string>} args - Command arguments
 * @param {Object} options - Command options
 */
async function quickstartCommand(args, options) {
  initialize();

  console.log(colors.bold('\n⚡ Quick Start - Popular MCP Setup\n'));

  const presetName = args[0] || await prompt('Choose a preset', {
    default: 'whatsapp-dev',
    validate: (input) => {
      const presets = ['whatsapp-dev', 'full-stack', 'minimal', 'custom'];
      return presets.includes(input) ? true : `Available: ${presets.join(', ')}`;
    }
  });

  let mcpsToAdd = [];
  let tagName = 'quickstart';
  let tagDescription = 'Quick start configuration';

  switch (presetName) {
  case 'whatsapp-dev':
    mcpsToAdd = ['whatsapp', 'filesystem', 'memory'];
    tagDescription = 'WhatsApp development environment';
    break;
  case 'full-stack':
    mcpsToAdd = ['filesystem', 'github', 'postgres', 'memory'];
    tagDescription = 'Full-stack development setup';
    break;
  case 'minimal':
    mcpsToAdd = ['filesystem'];
    tagDescription = 'Minimal MCP setup';
    break;
  case 'custom': {
    console.log('\nAvailable MCPs:');
    Object.entries(MCP_PRESETS).forEach(([name, { description }]) => {
      console.log(`  ${colors.cyan(name.padEnd(12))} - ${description}`);
    });
    const selection = await prompt('Enter MCP names (comma-separated)', {
      required: true
    });
    mcpsToAdd = selection.split(',').map(s => s.trim()).filter(Boolean);
    break;
  }
  }

  // Allow custom tag name
  if (options.tag) {
    tagName = options.tag;
  } else {
    const customName = await prompt('Tag name', { default: tagName });
    tagName = customName || tagName;
  }

  // Check if tag exists
  if (tagExists(tagName)) {
    const overwrite = await confirm(`Tag '${tagName}' already exists. Overwrite?`, false);
    if (!overwrite) {
      console.log('Cancelled.');
      return;
    }
  }

  // Create tag
  const tagConfig = createDefaultTag(tagName, tagDescription);

  // Add MCPs
  console.log(`\n${colors.bold('Adding MCPs...')}`);
  for (const mcpName of mcpsToAdd) {
    if (MCP_PRESETS[mcpName]) {
      tagConfig.mcps[mcpName] = MCP_PRESETS[mcpName].source;
      console.log(`  ${colors.green('✓')} ${mcpName} - ${MCP_PRESETS[mcpName].description}`);
    }
  }

  saveTagConfig(tagName, tagConfig);
  setActiveTag(tagName);

  console.log(formatSuccess(`\n✓ Created quickstart tag '${colors.cyan(tagName)}' with ${mcpsToAdd.length} MCPs`));

  // Auto-start if requested
  if (options.start) {
    console.log('\nStarting MCPs...');
    await startTagMCPs(tagName);
  }

  // Auto-export if requested
  if (options.claude || options.cursor || options.vscode) {
    const tool = options.claude ? 'claude' : options.cursor ? 'cursor' : 'vscode';
    await exportTagToTool(tagName, tool);
  }

  console.log('\nQuick start complete! 🚀');
  console.log(`\nTo start MCPs: ${colors.cyan('nvmcp start')}`);
  console.log(`To export: ${colors.cyan(`nvmcp use ${tagName} --claude`)}`);
}

/**
 * Show available MCP presets
 * @param {Array<string>} args - Command arguments
 * @param {Object} options - Command options
 */
async function presetsCommand(_args, _options) {
  console.log(colors.bold('\n📦 Available MCP Presets\n'));

  const presetData = Object.entries(MCP_PRESETS).map(([name, { source, description }]) => {
    return [
      colors.cyan(name),
      description,
      colors.dim(source)
    ];
  });

  const headers = ['Name', 'Description', 'Source'];
  console.log(formatTable(headers, presetData));

  console.log('\nUsage:');
  console.log(`  ${colors.cyan('nvmcp add <preset-name>')}              Add a preset MCP`);
  console.log(`  ${colors.cyan('nvmcp quickstart whatsapp-dev')}        Quick setup with presets`);
  console.log(`  ${colors.cyan('nvmcp add npm:custom-package')}         Add custom MCP source`);
  console.log('\nSource formats:');
  console.log('  npm:package-name');
  console.log('  github:owner/repo');
  console.log('  https://example.com/mcp');
  console.log('  git+https://github.com/...');
}

module.exports = {
  useCommand,
  createCommand,
  listCommand,
  deleteCommand,
  addCommand,
  removeCommand,
  startCommand,
  stopCommand,
  psCommand,
  killCommand,
  initCommand,
  quickstartCommand,
  presetsCommand
};
