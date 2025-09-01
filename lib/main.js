#!/usr/bin/env node

const { parseArgs } = require('./cli');
const { colors } = require('./utils/colors');
const { ErrorHandler, ErrorFactory, CommandError } = require('./utils/errors');

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
 * Command registry
 */
const COMMAND_REGISTRY = {
  use: {
    handler: useCommand,
    description: 'Switch to a tag configuration',
    aliases: []
  },
  create: {
    handler: createCommand,
    description: 'Create a new tag configuration',
    aliases: []
  },
  list: {
    handler: listCommand,
    description: 'List all tag configurations',
    aliases: ['ls']
  },
  delete: {
    handler: deleteCommand,
    description: 'Delete a tag configuration',
    aliases: ['del', 'rm']
  },

  add: {
    handler: addCommand,
    description: 'Add MCP to active tag',
    aliases: []
  },
  remove: {
    handler: removeCommand,
    description: 'Remove MCP from active tag',
    aliases: []
  },

  start: {
    handler: startCommand,
    description: 'Start MCPs from active tag',
    aliases: []
  },
  stop: {
    handler: stopCommand,
    description: 'Stop MCPs from active tag',
    aliases: []
  },
  ps: {
    handler: psCommand,
    description: 'List running MCP processes',
    aliases: []
  },
  kill: {
    handler: killCommand,
    description: 'Kill specific MCP process',
    aliases: []
  },

};

/**
 * Build command lookup with aliases
 */
function buildCommandLookup() {
  const lookup = {};

  for (const [name, config] of Object.entries(COMMAND_REGISTRY)) {
    lookup[name] = config;

    if (config.aliases && config.aliases.length > 0) {
      config.aliases.forEach(alias => {
        lookup[alias] = config;
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

    const commandConfig = COMMAND_LOOKUP[command];
    if (!commandConfig) {
      handleUnknownCommand(command);
      return;
    }

    await commandConfig.handler(args, options);

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
 * Show help information
 */
function showHelp(specificCommand = null) {
  if (specificCommand && COMMAND_LOOKUP[specificCommand]) {
    showCommandHelp(specificCommand);
    return;
  }

  console.log(`${colors.cyan('nvmcp')} - Simple Tag-Based MCP Management

${colors.bold('USAGE:')}
  nvmcp <command> [options]

${colors.bold('TAG MANAGEMENT:')}
  ${colors.cyan('create')} <tag>           Create a new tag configuration
  ${colors.cyan('use')} <tag>              Switch to a tag configuration
  ${colors.cyan('list')}                   List all tag configurations
  ${colors.cyan('delete')} <tag>           Delete a tag configuration

${colors.bold('MCP MANAGEMENT:')}
  ${colors.cyan('add')} <source>           Add MCP to active tag
  ${colors.cyan('remove')} <mcp-name>      Remove MCP from active tag

${colors.bold('PROCESS MANAGEMENT:')}
  ${colors.cyan('start')} [tag]            Start MCPs (from active tag or specified tag)
  ${colors.cyan('stop')} [tag]             Stop MCPs (from active tag or specified tag)
  ${colors.cyan('ps')}                     List running MCP processes
  ${colors.cyan('kill')} <process-id>      Kill specific process

${colors.bold('DISCOVERY:')}
  ${colors.cyan('tools')}                  Show available tools from active MCPs
  ${colors.cyan('capabilities')}           Show capabilities from active MCPs
  ${colors.cyan('inspect')} <mcp-name>     Inspect specific MCP details

${colors.bold('SOURCE FORMATS:')}
  npm:package-name                 NPM package
  github:owner/repo                GitHub repository
  https://example.com/mcp          Remote MCP URL
  git+https://github.com/...       Git repository

${colors.bold('OPTIONS:')}
  ${colors.cyan('-h, --help')}             Show help
  ${colors.cyan('-v, --version')}          Show version
  ${colors.cyan('--start')}                Auto-start MCPs after adding/using
  ${colors.cyan('--claude')}               Export to Claude Desktop
  ${colors.cyan('--cursor')}               Export to Cursor IDE
  ${colors.cyan('--quiet')}                Suppress warnings

${colors.bold('EXAMPLES:')}
  nvmcp create development
  nvmcp add npm:@modelcontextprotocol/server-filesystem
  nvmcp add github:lharries/whatsapp-mcp
  nvmcp use development --start
  nvmcp ps`);
}

/**
 * Show specific command help
 */
function showCommandHelp(commandName) {
  const config = COMMAND_LOOKUP[commandName];
  if (!config) {
    console.error(`${colors.red('Error:')} Unknown command '${commandName}'`);
    return;
  }

  console.log(`${colors.cyan('nvmcp')} ${colors.bold(commandName)}

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
 * Suggest similar commands using Levenshtein distance
 */
function suggestCommand(input) {
  const commands = Object.keys(COMMAND_LOOKUP);
  const suggestions = [];

  for (const cmd of commands) {
    if (cmd.includes(input) || input.includes(cmd)) {
      suggestions.push(cmd);
    } else if (levenshteinDistance(input.toLowerCase(), cmd.toLowerCase()) <= 2) {
      suggestions.push(cmd);
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

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
