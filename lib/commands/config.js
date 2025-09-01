const { getServerConfig, saveServerConfig, saveProfile } = require('../utils/config');
const { encryptSensitiveData, isSensitiveKey } = require('../utils/crypto');
const { colors, formatSuccess } = require('../utils/colors');
const { prompt, password, multiInput, confirm } = require('../utils/prompt');

async function configCommand(args, options) {
  if (args.length === 0) {
    throw new Error('Server name is required');
  }

  const serverName = args[0];
  let config = getServerConfig(serverName);

  if (!config) {
    throw new Error(`Server '${serverName}' not found. Run 'nvmcp list' to see installed servers.`);
  }

  console.log(`Configuring ${colors.cyan(serverName)}...`);
  console.log(colors.dim('Press Enter to keep current values\n'));

  if (options.command) {
    config.command = options.command;
    console.log(formatSuccess(`Command set to: ${options.command}`));
  }

  if (options.env) {
    const [key, value] = options.env.split('=', 2);
    if (!key || value === undefined) {
      throw new Error('Environment variable format should be KEY=value');
    }

    config.env = config.env || {};

    if (isSensitiveKey(key)) {
      const encrypted = encryptSensitiveData(value);
      config.env[key] = encrypted;
      console.log(formatSuccess(`Environment variable ${key} set (encrypted)`));
    } else {
      config.env[key] = value;
      console.log(formatSuccess(`Environment variable ${key} set`));
    }
  }

  if (!options.command && !options.env) {
    config = await interactiveConfig(config);
  }

  saveServerConfig(serverName, config);
  console.log(formatSuccess(`Configuration saved for ${colors.cyan(serverName)}`));

  if (options.tag) {
    await createProfile(options.tag, serverName, config);
    console.log(formatSuccess(`Profile '${colors.cyan(options.tag)}' created`));
  }

  console.log(`\nNext steps:`);
  console.log(`  ${colors.cyan(`nvmcp use ${serverName}`)}     Activate this server`);
  console.log(`  ${colors.cyan('nvmcp doctor')}             Check configuration`);
}

async function interactiveConfig(config) {
  const prompts = [
    {
      name: 'command',
      message: 'Command to run the server',
      default: config.command,
      validate: (value) => value.trim().length > 0 || 'Command is required'
    },
    {
      name: 'description',
      message: 'Description (optional)',
      default: config.description || ''
    },
    {
      name: 'type',
      type: 'select',
      message: 'Server type',
      choices: [
        { name: 'Local server', value: 'local' },
        { name: 'Remote server', value: 'remote' }
      ],
      default: config.type === 'remote' ? 2 : 1
    }
  ];

  const answers = await multiInput(prompts);

  config.command = answers.command;
  config.description = answers.description;
  config.type = answers.type;

  if (answers.type === 'remote') {
    const remoteConfig = await configureRemoteServer(config);
    Object.assign(config, remoteConfig);
  } else {
    await configureEnvironment(config);
  }

  const needsArgs = await confirm('Does this server need command line arguments?', false);
  if (needsArgs) {
    const argsInput = await prompt('Command line arguments (space-separated)', {
      default: config.args ? config.args.join(' ') : ''
    });

    config.args = argsInput.trim() ? argsInput.trim().split(' ') : [];
  }

  return config;
}

async function configureRemoteServer(config) {
  const remotePrompts = [
    {
      name: 'endpoint',
      message: 'Remote server endpoint (URL)',
      default: config.endpoint || '',
      validate: (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      name: 'transport',
      type: 'select',
      message: 'Transport protocol',
      choices: [
        { name: 'HTTP/HTTPS', value: 'http' },
        { name: 'WebSocket', value: 'websocket' }
      ],
      default: config.transport === 'websocket' ? 2 : 1
    }
  ];

  const remoteAnswers = await multiInput(remotePrompts);

  const needsAuth = await confirm('Does this server require authentication?', true);

  if (needsAuth) {
    const authType = await prompt('Authentication type', {
      default: 'bearer',
      validate: (value) => ['bearer', 'basic', 'api-key'].includes(value) || 'Must be: bearer, basic, or api-key'
    });

    remoteAnswers.authType = authType;

    if (authType === 'bearer') {
      remoteAnswers.authToken = await password('Bearer token');
    } else if (authType === 'basic') {
      remoteAnswers.authUsername = await prompt('Username');
      remoteAnswers.authPassword = await password('Password');
    } else if (authType === 'api-key') {
      remoteAnswers.apiKey = await password('API key');
      const headerName = await prompt('API key header name', { default: 'X-API-Key' });
      remoteAnswers.apiKeyHeader = headerName;
    }
  }

  return remoteAnswers;
}

async function configureEnvironment(config) {
  console.log(colors.dim('\nConfigure environment variables (press Enter when done):'));

  config.env = config.env || {};

  while (true) {
    const envName = await prompt('Environment variable name (or press Enter to finish)');

    if (!envName.trim()) {
      break;
    }

    const currentValue = config.env[envName];
    let defaultText = '';

    if (currentValue) {
      if (typeof currentValue === 'object' && currentValue.encrypted) {
        defaultText = '[encrypted]';
      } else {
        defaultText = currentValue;
      }
    }

    let envValue;
    if (isSensitiveKey(envName)) {
      envValue = await password(`Value for ${envName}${defaultText ? ` (current: ${defaultText})` : ''}`);
      if (envValue) {
        config.env[envName] = encryptSensitiveData(envValue);
      }
    } else {
      envValue = await prompt(`Value for ${envName}`, { default: defaultText });
      if (envValue) {
        config.env[envName] = envValue;
      }
    }
  }
}

async function createProfile(profileName, serverName, serverConfig) {
  const profile = {
    name: profileName,
    servers: [
      {
        name: serverName,
        config: serverConfig
      }
    ],
    default: serverName,
    created: new Date().toISOString()
  };

  saveProfile(profileName, profile);
}

module.exports = { configCommand };
