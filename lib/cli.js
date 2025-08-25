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
        
        if (j === shortOptions.length - 1) {
          const nextArg = args[i + 1];
          if (nextArg && !nextArg.startsWith('-')) {
            result.options[getFullOptionName(shortOption)] = nextArg;
            i++;
          } else {
            result.options[getFullOptionName(shortOption)] = true;
          }
        } else {
          result.options[getFullOptionName(shortOption)] = true;
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

function validateCommand(command, validCommands) {
  if (!validCommands.includes(command)) {
    throw new Error(`Unknown command: ${command}. Valid commands: ${validCommands.join(', ')}`);
  }
}

function validateRequiredArgs(args, required, commandName) {
  if (args.length < required) {
    throw new Error(`${commandName} requires at least ${required} argument(s)`);
  }
}

function normalizePackageName(packageName, options = {}) {
  if (!packageName) {
    throw new Error('Package name is required');
  }
  
  if (options.repo) {
    if (options.repo.startsWith('github:')) {
      return options.repo.slice(7);
    }
    return options.repo;
  }
  
  if (packageName.includes('/') && !packageName.startsWith('@')) {
    return `github:${packageName}`;
  }
  
  return packageName;
}

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
    fullName: spec
  };
}

function formatUsage(command, usage, description) {
  return `
Usage: nvmcp ${command} ${usage}

${description}
`.trim();
}

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
  normalizePackageName,
  parsePackageSpec,
  formatUsage,
  showCommandHelp
};