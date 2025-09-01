/**
 * @fileoverview Simple command-line argument parsing for NVMCP
 * @module cli
 */

/**
 * Parse command line arguments
 * @param {Array<string>} args - Command line arguments (usually process.argv.slice(2))
 * @returns {Object} Parsed arguments with command, args, and options
 */
function parseArgs(args) {
  const result = {
    command: null,
    args: [],
    options: {}
  };

  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const longOption = arg.slice(2);

      if (longOption.includes('=')) {
        const [key, value] = longOption.split('=', 2);
        result.options[key] = value;
      } else {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          result.options[longOption] = nextArg;
          i++;
        } else {
          result.options[longOption] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      const shortOptions = arg.slice(1);

      for (let j = 0; j < shortOptions.length; j++) {
        const shortOption = shortOptions[j];
        const fullName = getFullOptionName(shortOption);

        if (j === shortOptions.length - 1) {
          const nextArg = args[i + 1];
          if (nextArg && !nextArg.startsWith('-')) {
            result.options[fullName] = nextArg;
            i++;
          } else {
            result.options[fullName] = true;
          }
        } else {
          result.options[fullName] = true;
        }
      }
    } else {
      if (!result.command) {
        result.command = arg;
      } else {
        result.args.push(arg);
      }
    }

    i++;
  }

  return result;
}

/**
 * Map short options to full option names
 * @param {string} shortOption - Short option character
 * @returns {string} Full option name
 */
function getFullOptionName(shortOption) {
  const shortToLong = {
    'h': 'help',
    'v': 'version',
    'd': 'daemon',
    't': 'tag',
    'r': 'repo',
    'c': 'claude',
    's': 'cursor'
  };

  return shortToLong[shortOption] || shortOption;
}

/**
 * Validate that a command is in the list of valid commands
 * @param {string} command - Command to validate
 * @param {Array<string>} validCommands - Array of valid command names
 * @throws {Error} If command is not valid
 */
function validateCommand(command, validCommands) {
  if (!validCommands.includes(command)) {
    throw new Error(`Unknown command: ${command}. Valid commands: ${validCommands.join(', ')}`);
  }
}

/**
 * Validate that minimum required arguments are provided
 * @param {Array} args - Arguments array
 * @param {number} required - Minimum required arguments
 * @param {string} commandName - Command name for error message
 * @throws {Error} If insufficient arguments
 */
function validateRequiredArgs(args, required, commandName) {
  if (args.length < required) {
    throw new Error(`${commandName} requires at least ${required} argument(s)`);
  }
}

/**
 * Parse an MCP source specification
 * @param {string} spec - Source specification string
 * @returns {Object} Parsed source information
 */
function parsePackageSpec(spec) {
  if (!spec) {
    throw new Error('Package specification is required');
  }

  if (spec.startsWith('github:')) {
    const repoPath = spec.slice(7);
    const [owner, repo] = repoPath.split('/');

    if (!owner || !repo) {
      throw new Error('Invalid GitHub repository format. Expected: github:owner/repo');
    }

    return {
      type: 'github',
      name: repo,
      owner,
      repo: repoPath,
      fullName: spec
    };
  }

  if (spec.includes('/') && !spec.startsWith('@')) {
    const [owner, repo] = spec.split('/');
    return {
      type: 'github',
      name: repo,
      owner,
      repo: spec,
      fullName: `github:${spec}`
    };
  }

  return {
    type: 'npm',
    name: spec,
    safeName: spec.startsWith('@') ? spec.replace('@', '').replace('/', '-') : spec,
    fullName: spec
  };
}

/**
 * Format usage string for help output
 * @param {string} command - Command name
 * @param {string} usage - Usage pattern
 * @param {string} description - Command description
 * @returns {string} Formatted usage string
 */
function formatUsage(command, usage, description) {
  return `
Usage: nvmcp ${command} ${usage}

${description}
`.trim();
}

/**
 * Show help for a specific command
 * @param {string} command - Command name
 * @param {Object} details - Command details with usage, description, options, examples
 */
function showCommandHelp(command, details) {
  console.log(formatUsage(command, details.usage, details.description));

  if (details.options && details.options.length > 0) {
    console.log('\nOptions:');
    details.options.forEach(option => {
      console.log(`  ${option.flags.padEnd(20)} ${option.description}`);
    });
  }

  if (details.examples && details.examples.length > 0) {
    console.log('\nExamples:');
    details.examples.forEach(example => {
      console.log(`  ${example}`);
    });
  }
}

module.exports = {
  parseArgs,
  getFullOptionName,
  validateCommand,
  validateRequiredArgs,
  parsePackageSpec,
  formatUsage,
  showCommandHelp
};
