#!/usr/bin/env node

const { parseArgs } = require('./cli');
const { colors } = require('./utils/colors');
const { ErrorHandler, CommandError } = require('./utils/errors');

// Tag-based commands
const {
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
} = require('./commands/tags');

/**
 * Command registry with organized categories
 */
const COMMAND_REGISTRY = {
  // Tag management commands
  use: {
    handler: useCommand,
    description: 'Switch to a tag configuration',
    category: 'tag',
    aliases: []
  },
  create: {
    handler: createCommand,
    description: 'Create a new tag configuration',
    category: 'tag',
    aliases: []
  },
  list: {
    handler: listCommand,
    description: 'List all tag configurations',
    category: 'tag',
    aliases: ['ls']
  },
  delete: {
    handler: deleteCommand,
    description: 'Delete a tag configuration',
    category: 'tag',
    aliases: ['del', 'rm']
  },

  // MCP management commands
  add: {
    handler: addCommand,
    description: 'Add MCP to active tag',
    category: 'mcp',
    aliases: []
  },
  remove: {
    handler: removeCommand,
    description: 'Remove MCP from active tag',
    category: 'mcp',
    aliases: []
  },

  // Process management commands
  start: {
    handler: startCommand,
    description: 'Start MCPs from active tag',
    category: 'process',
    aliases: []
  },
  stop: {
    handler: stopCommand,
    description: 'Stop MCPs from active tag',
    category: 'process',
    aliases: []
  },
  ps: {
    handler: psCommand,
    description: 'List running MCP processes',
    category: 'process',
    aliases: []
  },
  kill: {
    handler: killCommand,
    description: 'Kill specific MCP process',
    category: 'process',
    aliases: []
  }
};

/**
 * Build command lookup with aliases
 * @returns {Object} Command lookup table
 */
function buildCommandLookup() {
  const lookup = new Map();

  for (const [name, config] of Object.entries(COMMAND_REGISTRY)) {
    lookup.set(name, config);

    // Add aliases to lookup
    if (config.aliases?.length > 0) {
      config.aliases.forEach(alias => {
        lookup.set(alias, config);
      });
    }
  }

  return lookup;
}

const COMMAND_LOOKUP = buildCommandLookup();

/**
 * Main CLI entry point
 */
async function main() {
  try {
    const { command, args, options } = parseArgs(process.argv.slice(2));

    if (options.version) {
      showVersion();
      return;
    }

    if (!command || command === 'help' || options.help) {
      showHelp(command === 'help' ? args[0] : null);
      return;
    }

    const commandConfig = COMMAND_LOOKUP.get(command);
    if (!commandConfig) {
      handleUnknownCommand(command);
      return;
    }

    await executeCommand(commandConfig, args, options);

  } catch (error) {
    ErrorHandler.handle(error, { exit: true });
  }
}

/**
 * Show version information
 */
function showVersion() {
  const pkg = require('../package.json');
  console.log(`nvmcp ${pkg.version}`);
  console.log(`Node ${process.version}`);
  console.log(`Platform ${process.platform}`);
}

/**
 * Execute a command with proper error handling
 * @param {Object} commandConfig - Command configuration
 * @param {Array} args - Command arguments
 * @param {Object} options - Command options
 */
async function executeCommand(commandConfig, args, options) {
  try {
    await commandConfig.handler(args, options);
  } catch (error) {
    // Add command context to error
    if (error.command === undefined) {
      error.command = commandConfig;
    }
    throw error;
  }
}

/**
 * Organize commands by category
 * @returns {Object} Commands organized by category
 */
function organizeCommandsByCategory() {
  const categories = {
    tagCommands: [],
    mcpCommands: [],
    processCommands: []
  };

  for (const [name, config] of Object.entries(COMMAND_REGISTRY)) {
    const commandInfo = {
      name,
      description: config.description,
      aliases: config.aliases || []
    };

    switch (config.category) {
    case 'tag':
      categories.tagCommands.push(commandInfo);
      break;
    case 'mcp':
      categories.mcpCommands.push(commandInfo);
      break;
    case 'process':
      categories.processCommands.push(commandInfo);
      break;
    }
  }

  return categories;
}

/**
 * Format a list of commands for display
 * @param {Array} commands - Array of command objects
 * @returns {string} Formatted command list
 */
function formatCommandList(commands) {
  return commands.map(cmd => {
    const aliasText = cmd.aliases.length > 0 ?
      ` ${colors.dim('(' + cmd.aliases.join(', ') + ')')}` : '';
    const paddedName = cmd.name.padEnd(12);
    return `  ${colors.cyan(paddedName)}${aliasText} ${cmd.description}`;
  }).join('\n');
}

/**
 * Show help information
 */
function showHelp(specificCommand = null) {
  if (specificCommand && COMMAND_LOOKUP.has(specificCommand)) {
    showCommandHelp(specificCommand);
    return;
  }

  const { tagCommands, mcpCommands, processCommands } = organizeCommandsByCategory();

  console.log(`${colors.cyan('nvmcp')} - Simple Tag-Based MCP Management

${colors.bold('USAGE:')}
  nvmcp <command> [options]

${colors.bold('TAG MANAGEMENT:')}
${formatCommandList(tagCommands)}

${colors.bold('MCP MANAGEMENT:')}
${formatCommandList(mcpCommands)}

${colors.bold('PROCESS MANAGEMENT:')}
${formatCommandList(processCommands)}

${colors.bold('SOURCE FORMATS:')}
  ${colors.dim('npm:package-name')}                NPM package
  ${colors.dim('github:owner/repo')}               GitHub repository  
  ${colors.dim('https://example.com/mcp')}         Remote MCP URL
  ${colors.dim('git+https://github.com/...')}      Git repository

${colors.bold('OPTIONS:')}
  ${colors.cyan('-h, --help')}                    Show help
  ${colors.cyan('-v, --version')}                 Show version
  ${colors.cyan('--start')}                       Auto-start MCPs after adding/using
  ${colors.cyan('--claude')}                      Export to Claude Desktop
  ${colors.cyan('--cursor')}                      Export to Cursor IDE
  ${colors.cyan('--quiet')}                       Suppress warnings

${colors.bold('EXAMPLES:')}
  ${colors.dim('nvmcp create development')}
  ${colors.dim('nvmcp add npm:@modelcontextprotocol/server-filesystem')}
  ${colors.dim('nvmcp add github:lharries/whatsapp-mcp')}
  ${colors.dim('nvmcp use development --start')}
  ${colors.dim('nvmcp ps')}`);
}

/**
 * Show specific command help
 * @param {string} commandName - Name of the command
 */
function showCommandHelp(commandName) {
  const config = COMMAND_LOOKUP.get(commandName);
  if (!config) {
    console.error(`${colors.red('Error:')} Unknown command '${commandName}'`);
    return;
  }

  const categoryLabel = config.category ? ` (${config.category})` : '';

  console.log(`${colors.cyan('nvmcp')} ${colors.bold(commandName)}${colors.dim(categoryLabel)}

${config.description}

Run '${colors.cyan('nvmcp help')}' for all commands.`);
}

/**
 * Handle unknown commands with suggestions
 */
function handleUnknownCommand(command) {
  const suggestions = suggestCommand(command);
  const details = {
    command,
    suggestions: suggestions.length > 0 ? suggestions : null
  };

  const error = new CommandError(`Unknown command '${command}'`, command, [], details);

  console.error(error.getFormattedMessage());
  if (suggestions.length > 0) {
    console.error(`Did you mean: ${suggestions.map(s => colors.cyan(s)).join(', ')}?`);
  }
  console.error(`Run '${colors.cyan('nvmcp help')}' for usage information.`);
  process.exit(1);
}


/**
 * Suggest similar commands using multiple heuristics
 * @param {string} input - User input
 * @returns {Array<string>} Array of suggested commands
 */
function suggestCommand(input) {
  const commands = Array.from(COMMAND_LOOKUP.keys());
  const suggestions = new Set();
  const inputLower = input.toLowerCase();

  // Find exact substring matches first
  commands.forEach(cmd => {
    const cmdLower = cmd.toLowerCase();
    if (cmd.includes(input) || input.includes(cmd) ||
        cmdLower.includes(inputLower) || inputLower.includes(cmdLower)) {
      suggestions.add(cmd);
    }
  });

  // Add close matches using Levenshtein distance
  if (suggestions.size < 3) {
    commands.forEach(cmd => {
      if (suggestions.size >= 3) {return;}
      if (!suggestions.has(cmd) &&
          levenshteinDistance(inputLower, cmd.toLowerCase()) <= 2) {
        suggestions.add(cmd);
      }
    });
  }

  return Array.from(suggestions).slice(0, 3);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {matrix[0][i] = i;}
  for (let j = 0; j <= str2.length; j++) {matrix[j][0] = j;}

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + substitutionCost
      );
    }
  }

  return matrix[str2.length][str1.length];
}


process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', ErrorHandler.createRejectionHandler('main process'));

process.on('uncaughtException', ErrorHandler.createExceptionHandler('main process'));

if (require.main === module) {
  main().catch(error => {
    ErrorHandler.handle(error, { exit: true });
  });
}

module.exports = { main };
