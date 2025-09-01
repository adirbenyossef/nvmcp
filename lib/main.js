#!/usr/bin/env node

/**
 * NVMCP - Node Version Manager for Model Context Protocol
 * Unified CLI entry point with legacy compatibility
 * @author Claude (Refactored)
 * @version 2.0.0
 */

const { parseArgs } = require('./cli');
const { colors } = require('./utils/colors');
const { ErrorHandler, ErrorFactory, CommandError } = require('./utils/errors');

// Legacy commands (from old architecture)
const { initCommand } = require('./commands/init');
const { installCommand } = require('./commands/install');
const { listCommand: legacyListCommand } = require('./commands/list');
const { configCommand } = require('./commands/config');
const { useCommand: legacyUseCommand } = require('./commands/use');
const { runCommand } = require('./commands/run');
const { doctorCommand } = require('./commands/doctor');
const { uninstallCommand } = require('./commands/uninstall');
const { updateCommand } = require('./commands/update');
const { projectCommand } = require('./commands/project');

// New tag-based commands (from new architecture)
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
 * Command registry with legacy mapping and feature flags
 */
const COMMAND_REGISTRY = {
  // Tag management (new primary interface)
  use: {
    handler: useCommand,
    description: 'Switch to a tag configuration',
    legacy: false
  },
  create: {
    handler: createCommand,
    description: 'Create a new tag configuration',
    legacy: false
  },
  list: {
    handler: listCommand,
    description: 'List all tag configurations',
    legacy: false,
    aliases: ['ls']
  },
  delete: {
    handler: deleteCommand,
    description: 'Delete a tag configuration',
    legacy: false,
    aliases: ['del', 'rm']
  },
  
  // MCP management within tags
  add: {
    handler: addCommand,
    description: 'Add MCP to active tag',
    legacy: false
  },
  remove: {
    handler: removeCommand,
    description: 'Remove MCP from active tag',
    legacy: false
  },
  
  // Process management
  start: {
    handler: startCommand,
    description: 'Start MCPs from active tag',
    legacy: false
  },
  stop: {
    handler: stopCommand,
    description: 'Stop MCPs from active tag',
    legacy: false
  },
  ps: {
    handler: psCommand,
    description: 'List running MCP processes',
    legacy: false
  },
  kill: {
    handler: killCommand,
    description: 'Kill specific MCP process',
    legacy: false
  },
  
  // Legacy commands (maintained for backward compatibility)
  init: {
    handler: initCommand,
    description: 'Initialize nvmcp (legacy)',
    legacy: true,
    deprecated: true
  },
  install: {
    handler: installCommand,
    description: 'Install MCP package (legacy)',
    legacy: true,
    aliases: ['i'],
    deprecated: true,
    migrationMessage: 'Use "nvmcp create <tag>" then "nvmcp add <source>" instead'
  },
  config: {
    handler: configCommand,
    description: 'Configure MCP server (legacy)',
    legacy: true,
    deprecated: true,
    migrationMessage: 'Configuration is now handled automatically in tags'
  },
  run: {
    handler: runCommand,
    description: 'Run MCP server (legacy)',
    legacy: true,
    deprecated: true,
    migrationMessage: 'Use "nvmcp start" instead'
  },
  doctor: {
    handler: doctorCommand,
    description: 'Diagnose issues (legacy)',
    legacy: true
  },
  uninstall: {
    handler: uninstallCommand,
    description: 'Remove MCP server (legacy)',
    legacy: true,
    deprecated: true,
    migrationMessage: 'Use "nvmcp remove <mcp-name>" instead'
  },
  update: {
    handler: updateCommand,
    description: 'Update MCP server (legacy)',
    legacy: true,
    deprecated: true
  },
  project: {
    handler: projectCommand,
    description: 'Project management (legacy)',
    legacy: true,
    aliases: ['proj'],
    deprecated: true,
    migrationMessage: 'Use tag-based workflow instead'
  },
  
  // Discovery & inspection (to be implemented)
  tools: {
    handler: toolsCommand,
    description: 'Show available tools from active MCPs',
    legacy: false
  },
  capabilities: {
    handler: capabilitiesCommand,
    description: 'Show capabilities from active MCPs',
    legacy: false
  },
  inspect: {
    handler: inspectCommand,
    description: 'Inspect specific MCP details',
    legacy: false
  }
};

/**
 * Build command lookup with aliases
 */
function buildCommandLookup() {
  const lookup = {};
  
  for (const [name, config] of Object.entries(COMMAND_REGISTRY)) {
    lookup[name] = config;
    
    // Add aliases
    if (config.aliases) {
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
    
    // Handle version flag
    if (options.version) {
      showVersion();
      return;
    }
    
    // Handle help flag or no command
    if (!command || command === 'help' || options.help) {
      showHelp(command === 'help' ? args[0] : null);
      return;
    }
    
    // Look up command
    const commandConfig = COMMAND_LOOKUP[command];
    if (!commandConfig) {
      handleUnknownCommand(command);
      return;
    }
    
    // Show deprecation warning for legacy commands
    if (commandConfig.deprecated && !options.quiet) {
      showDeprecationWarning(command, commandConfig);
    }
    
    // Execute command
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
  console.log(`nvmcp ${pkg.version} (unified architecture)`);
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

${colors.bold('LEGACY COMMANDS:')} ${colors.dim('(deprecated, use tag-based workflow)')}
  ${colors.dim('install, config, run, project, doctor, uninstall, update')}

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
  nvmcp ps

${colors.bold('MIGRATION:')}
  Run '${colors.cyan('nvmcp doctor')}' to migrate from legacy configurations`);
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

${config.deprecated ? colors.yellow('⚠  This command is deprecated. ') + config.migrationMessage : ''}

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
 * Show deprecation warning
 */
function showDeprecationWarning(command, config) {
  console.warn(`${colors.yellow('⚠  Warning:')} Command '${colors.cyan(command)}' is deprecated.`);
  if (config.migrationMessage) {
    console.warn(`   ${config.migrationMessage}`);
  }
  console.warn(`   Run '${colors.cyan('nvmcp doctor')}' to migrate your configuration.`);
  console.warn('');
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

// Placeholder functions for discovery commands (to be implemented)
async function toolsCommand(args, options) {
  console.log('🔧 Available tools from active MCPs:');
  console.log('(Tool discovery will be implemented based on running MCP introspection)');
}

async function capabilitiesCommand(args, options) {
  console.log('⚡ Capabilities from active MCPs:');
  console.log('(Capability discovery will be implemented based on MCP protocol)');
}

async function inspectCommand(args, options) {
  if (args.length === 0) {
    throw new Error('MCP name is required. Usage: nvmcp inspect <mcp-name>');
  }
  
  const mcpName = args[0];
  console.log(`🔍 Inspecting MCP: ${colors.cyan(mcpName)}`);
  console.log('(Inspection will show MCP details, available tools, and status)');
}

// Setup graceful shutdown and error handling
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', ErrorHandler.createRejectionHandler('main process'));

// Handle uncaught exceptions
process.on('uncaughtException', ErrorHandler.createExceptionHandler('main process'));

if (require.main === module) {
  main().catch(error => {
    ErrorHandler.handle(error, { exit: true });
  });
}

module.exports = { main, COMMAND_REGISTRY };