const { ensureNvmcpDir, getConfig, saveConfig } = require('../utils/config');
const { colors, formatSuccess } = require('../utils/colors');

async function initCommand(args, options) {
  try {
    console.log(colors.cyan('Initializing nvmcp...'));
    
    ensureNvmcpDir();
    
    let config = getConfig();
    
    console.log(formatSuccess('Created ~/.nvmcp directory structure'));
    console.log(formatSuccess('Generated default configuration'));
    
    console.log('\n' + colors.bold('nvmcp is now ready!'));
    console.log('\nNext steps:');
    console.log(`  ${colors.cyan('nvmcp install <package>')}  Install an MCP server`);
    console.log(`  ${colors.cyan('nvmcp list')}               List installed servers`);
    console.log(`  ${colors.cyan('nvmcp help')}               Show help information`);
    
  } catch (error) {
    throw new Error(`Failed to initialize nvmcp: ${error.message}`);
  }
}

module.exports = { initCommand };