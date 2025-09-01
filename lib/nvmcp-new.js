#!/usr/bin/env node

const { parseArgs } = require('./cli');
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
const { colors } = require('./utils/colors');

// New simplified command structure
const COMMANDS = {
  // Tag management (like nvm)
  use: useCommand,
  create: createCommand,
  list: listCommand,
  ls: listCommand,
  delete: deleteCommand,
  del: deleteCommand,
  rm: deleteCommand,
  
  // MCP management within tags
  add: addCommand,
  remove: removeCommand,
  
  // Process management
  start: startCommand,
  stop: stopCommand,
  ps: psCommand,
  kill: killCommand,
  
  // Discovery & inspection (to be implemented)
  tools: toolsCommand,
  capabilities: capabilitiesCommand,
  inspect: inspectCommand
};

async function main() {
  try {
    const { command, args, options } = parseArgs(process.argv.slice(2));
    
    if (options.version) {
      showVersion();
      return;
    }
    
    if (!command || command === 'help' || options.help) {
      showHelp();
      return;
    }
    
    const commandFn = COMMANDS[command];
    if (!commandFn) {
      console.error(`${colors.red('Error:')} Unknown command '${command}'`);
      
      const suggestions = suggestCommand(command);
      if (suggestions.length > 0) {
        console.error(`Did you mean: ${suggestions.map(s => colors.cyan(s)).join(', ')}?`);
      }
      
      console.error(`Run '${colors.cyan('nvmcp help')}' for usage information.`);
      process.exit(1);
    }
    
    await commandFn(args, options);
  } catch (error) {
    console.error(`${colors.red('Error:')} ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function showHelp() {
  console.log(`${colors.cyan('nvmcp')} - Simple Tag-Based MCP Management

${colors.bold('USAGE:')}
  nvmcp <command> [options]

${colors.bold('TAG MANAGEMENT (like nvm):')}
  ${colors.cyan('use')} <tag>              Switch to a tag (like nvm use)
  ${colors.cyan('create')} <tag>           Create a new tag
  ${colors.cyan('list')}                   List all tags
  ${colors.cyan('delete')} <tag>           Delete a tag

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
  https://gitmcp.io/path           Remote MCP URL
  git+https://github.com/...       Git repository

${colors.bold('OPTIONS:')}
  ${colors.cyan('-h, --help')}             Show help
  ${colors.cyan('-v, --version')}          Show version
  ${colors.cyan('--start')}                Auto-start MCPs after adding/using
  ${colors.cyan('--claude')}               Export to Claude Desktop
  ${colors.cyan('--cursor')}               Export to Cursor IDE

${colors.bold('EXAMPLES:')}
  nvmcp create flask-config
  nvmcp add npm:@modelcontextprotocol/server-filesystem
  nvmcp add github:lharries/whatsapp-mcp
  nvmcp add https://gitmcp.io/huanshenyi/nextjs-mastra
  nvmcp use flask-config --start
  nvmcp ps`);
}

function showVersion() {
  const pkg = require('../package.json');
  console.log(`nvmcp ${pkg.version} (redesigned)`);
}

function suggestCommand(input) {
  const commands = Object.keys(COMMANDS);
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

// Placeholder functions for discovery commands
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

if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red('Fatal error:')} ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };