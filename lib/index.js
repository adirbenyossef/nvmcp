#!/usr/bin/env node

const { parseArgs } = require('./cli');
const { initCommand } = require('./commands/init');
const { installCommand } = require('./commands/install');
const { listCommand } = require('./commands/list');
const { configCommand } = require('./commands/config');
const { useCommand } = require('./commands/use');
const { runCommand } = require('./commands/run');
const { doctorCommand } = require('./commands/doctor');
const { uninstallCommand } = require('./commands/uninstall');
const { updateCommand } = require('./commands/update');
const { projectCommand } = require('./commands/project');
const { colors } = require('./utils/colors');

const COMMANDS = {
  init: initCommand,
  install: installCommand,
  i: installCommand,
  list: listCommand,
  ls: listCommand,
  config: configCommand,
  use: useCommand,
  run: runCommand,
  doctor: doctorCommand,
  uninstall: uninstallCommand,
  rm: uninstallCommand,
  update: updateCommand,
  project: projectCommand,
  proj: projectCommand
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
  console.log(`${colors.cyan('nvmcp')} - Node Version Manager for Model Context Protocol

${colors.bold('USAGE:')}
  nvmcp <command> [options]

${colors.bold('COMMANDS:')}
  ${colors.cyan('init')}                 Initialize nvmcp
  ${colors.cyan('install')} <package>     Install an MCP server package
  ${colors.cyan('i')} <package>          Alias for install
  ${colors.cyan('list')}                 List installed MCP servers
  ${colors.cyan('ls')}                   Alias for list
  ${colors.cyan('config')} <server>      Configure an MCP server
  ${colors.cyan('use')} <profile>        Activate a configuration profile
  ${colors.cyan('run')} <server>         Start an MCP server
  ${colors.cyan('doctor')}               Diagnose configuration issues
  ${colors.cyan('uninstall')} <server>   Remove an MCP server
  ${colors.cyan('rm')} <server>          Alias for uninstall
  ${colors.cyan('update')} <server>      Update an MCP server
  ${colors.cyan('project')} <command>    Manage project-based configurations
  ${colors.cyan('proj')} <command>       Alias for project

${colors.bold('OPTIONS:')}
  ${colors.cyan('-h, --help')}           Show help
  ${colors.cyan('-v, --version')}        Show version
  ${colors.cyan('--repo')} <repo>        Install from GitHub repository
  ${colors.cyan('--tag')} <tag>          Tag installation with profile name
  ${colors.cyan('--claude')}             Export for Claude Desktop
  ${colors.cyan('--cursor')}             Export for Cursor IDE
  ${colors.cyan('--daemon')}             Run as background daemon

${colors.bold('EXAMPLES:')}
  nvmcp init
  nvmcp install awesome-coralogix-mcp
  nvmcp project create nextjs-app
  nvmcp project export nextjs-app --claude
  nvmcp doctor`);
}

function showVersion() {
  const pkg = require('../package.json');
  console.log(`nvmcp ${pkg.version}`);
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

if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red('Fatal error:')} ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };