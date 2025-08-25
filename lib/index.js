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
  update: updateCommand
};

async function main() {
  try {
    const { command, args, options } = parseArgs(process.argv.slice(2));
    
    if (!command || command === 'help' || options.help) {
      showHelp();
      return;
    }
    
    if (options.version) {
      showVersion();
      return;
    }
    
    const commandFn = COMMANDS[command];
    if (!commandFn) {
      console.error(`${colors.red('Error:')} Unknown command '${command}'`);
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
  nvmcp install --repo=github:anthropic/mcp-server-example
  nvmcp config awesome-coralogix-mcp --tag=main-project
  nvmcp use main-project --claude
  nvmcp doctor`);
}

function showVersion() {
  const pkg = require('../package.json');
  console.log(`nvmcp ${pkg.version}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red('Fatal error:')} ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };