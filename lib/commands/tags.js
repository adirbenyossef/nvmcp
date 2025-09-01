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
  initialize
} = require('../utils/unified-config');
const { colors, formatSuccess, formatError, formatInfo, formatTable } = require('../utils/colors');
const { prompt, confirm, select } = require('../utils/prompt');
const { ProcessManager } = require('../utils/processes');
const { ErrorFactory, validate, assert } = require('../utils/errors');
const { Validators, Schemas, validateArgs } = require('../utils/validation');
const { sanitizeInput } = require('../utils/security');

const processManager = new ProcessManager();

async function useCommand(args, options) {
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
      console.log(`\nTo start MCPs: ${colors.cyan(`nvmcp start`)}`);
    }
  } else {
    console.log(`\nAdd MCPs to this tag:`);
    console.log(`  ${colors.cyan(`nvmcp add <source>`)}`);
  }
  
  // Export to AI tools if requested
  if (options.claude) {
    await exportTagToTool(tagName, 'claude');
  }
  if (options.cursor) {
    await exportTagToTool(tagName, 'cursor');
  }
  if (options.vscode) {
    await exportTagToTool(tagName, 'vscode');
  }
}

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
  
  console.log(`\nNext steps:`);
  console.log(`  ${colors.cyan(`nvmcp add <source>`)}     Add MCPs to this tag`);
  console.log(`  ${colors.cyan(`nvmcp start`)}            Start all MCPs`);
}

async function listCommand(args, options) {
  initialize();
  
  const tags = listTags();
  
  if (tags.length === 0) {
    console.log('No tags found.');
    console.log(`\nCreate your first tag:`);
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
  
  console.log(`\nCommands:`);
  console.log(`  ${colors.cyan('nvmcp use <tag>')}        Switch to a tag`);
  console.log(`  ${colors.cyan('nvmcp add <source>')}     Add MCP to active tag`);
  console.log(`  ${colors.cyan('nvmcp start')}            Start MCPs in active tag`);
}

async function deleteCommand(args, options) {
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

async function addCommand(args, options) {
  initialize();
  
  validateArgs(args, 1, 'MCP source is required. Usage: nvmcp add <source>');
  
  const source = sanitizeInput(args[0]);
  Validators.mcpSource(source);
  
  const activeTag = getActiveTag();
  if (!activeTag) {
    throw ErrorFactory.tag('No active tag. Create or switch to a tag first: nvmcp use <tag>', null, { noActiveTag: true });
  }
  
  const tagConfig = getTagConfig(activeTag);
  
  if (!tagConfig) {
    throw ErrorFactory.tag(`Active tag '${activeTag}' not found`, activeTag, { configMissing: true });
  }
  
  const sourceInfo = parseSource(source);
  let mcpName = sourceInfo.name;
  
  // Allow custom name
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

async function removeCommand(args, options) {
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

async function startCommand(args, options) {
  let targetTag = args[0];
  
  if (!targetTag) {
    targetTag = getActiveTag();
    if (!targetTag) {
      throw new Error('No active tag. Switch to a tag first: nvmcp use <tag>');
    }
  }
  
  await startTagMCPs(targetTag);
}

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

async function stopCommand(args, options) {
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

async function psCommand(args, options) {
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
  
  console.log(`\nCommands:`);
  console.log(`  ${colors.cyan('nvmcp stop')}             Stop all MCPs from active tag`);
  console.log(`  ${colors.cyan('nvmcp kill <process-id>')} Kill specific process`);
}

async function killCommand(args, options) {
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

async function exportTagToTool(tagName, toolName) {
  const tagConfig = getTagConfig(tagName);
  if (!tagConfig) {
    throw ErrorFactory.tag(`Tag '${tagName}' not found`, tagName);
  }
  
  const mcpConfig = {
    mcpServers: {}
  };
  
  for (const [name, source] of Object.entries(tagConfig.mcps || {})) {
    const sourceInfo = parseSource(source);
    
    if (sourceInfo.type === 'remote') {
      mcpConfig.mcpServers[name] = {
        url: sourceInfo.url
      };
    } else {
      mcpConfig.mcpServers[name] = {
        command: 'node', // This will be resolved at runtime
        args: ['placeholder']
      };
    }
  }
  
  console.log(formatSuccess(`Exported tag '${colors.cyan(tagName)}' to ${toolName}`));
  console.log(`Configuration: ${JSON.stringify(mcpConfig, null, 2)}`);
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
  killCommand
};