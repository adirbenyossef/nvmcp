/**
 * @fileoverview Interactive command-line prompts for NVMCP
 * @module prompt
 */

const readline = require('readline');
const { colors } = require('./colors');

/**
 * Create a readline interface
 * @returns {readline.Interface} Readline interface
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Promisified readline question
 * @param {readline.Interface} rl - Readline interface
 * @param {string} text - Question text
 * @returns {Promise<string>} Promise resolving to user input
 */
function question(rl, text) {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

/**
 * Show an interactive text prompt
 * @param {string} message - Prompt message
 * @param {Object} [options={}] - Prompt options
 * @param {*} [options.default] - Default value
 * @param {boolean} [options.required] - Whether input is required
 * @param {Function} [options.validate] - Validation function
 * @returns {Promise<string>} Promise resolving to user input
 */
async function prompt(message, options = {}) {
  const rl = createInterface();

  try {
    let fullMessage = message;

    if (options.default !== undefined) {
      fullMessage += ` ${colors.dim(`(${options.default})`)}`;
    }

    fullMessage += ': ';

    const answer = await question(rl, fullMessage);

    if (!answer && options.default !== undefined) {
      return options.default;
    }

    if (options.required && !answer) {
      console.log(colors.red('This field is required.'));
      return prompt(message, options);
    }

    if (options.validate) {
      const validation = options.validate(answer);
      if (validation !== true) {
        console.log(colors.red(validation));
        return prompt(message, options);
      }
    }

    return answer;
  } finally {
    rl.close();
  }
}

/**
 * Show a yes/no confirmation prompt
 * @param {string} message - Confirmation message
 * @param {boolean} [defaultValue=false] - Default value
 * @returns {Promise<boolean>} Promise resolving to user confirmation
 */
async function confirm(message, defaultValue = false) {
  const rl = createInterface();

  try {
    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    const fullMessage = `${message} ${colors.dim(`(${defaultText})`)}`;

    const answer = await question(rl, fullMessage + ': ');

    if (!answer) {
      return defaultValue;
    }

    const lower = answer.toLowerCase();
    return lower === 'y' || lower === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * Show a selection prompt with multiple choices
 * @param {string} message - Selection message
 * @param {Array<string|Object>} choices - Array of choices (strings or objects with name/value/description)
 * @param {Object} [options={}] - Selection options
 * @param {*} [options.default] - Default selection
 * @returns {Promise<*>} Promise resolving to selected value
 */
async function select(message, choices, options = {}) {
  const rl = createInterface();

  try {
    console.log(message);

    choices.forEach((choice, index) => {
      const prefix = colors.cyan(`  ${index + 1})`);
      const text = typeof choice === 'string' ? choice : choice.name || choice.value;
      const description = typeof choice === 'object' && choice.description
        ? colors.dim(` - ${choice.description}`)
        : '';

      console.log(`${prefix} ${text}${description}`);
    });

    const maxIndex = choices.length;
    const defaultText = options.default ? ` (${options.default})` : '';

    let answer;
    do {
      answer = await question(rl, `Select 1-${maxIndex}${defaultText}: `);

      if (!answer && options.default) {
        answer = options.default;
        break;
      }

      const index = parseInt(answer, 10);
      if (index >= 1 && index <= maxIndex) {
        const choice = choices[index - 1];
        return typeof choice === 'string' ? choice : choice.value || choice.name;
      }

      console.log(colors.red(`Please enter a number between 1 and ${maxIndex}`));
    // eslint-disable-next-line no-constant-condition
    } while (true);

    return answer;
  } finally {
    rl.close();
  }
}

/**
 * Show a password prompt (masked input)
 * @param {string} message - Password prompt message
 * @returns {Promise<string>} Promise resolving to password input
 */
async function password(message) {
  const rl = createInterface();

  try {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      const stdout = process.stdout;

      stdout.write(message + ': ');

      stdin.setRawMode(true);
      stdin.resume();

      let password = '';

      const onData = (char) => {
        char = char + '';

        switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(password);
          break;

        case '\u0003':
          process.exit(1);
          break;

        case '\u007f':
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.write('\b \b');
          }
          break;

        default:
          password += char;
          stdout.write('*');
          break;
        }
      };

      stdin.on('data', onData);
    });
  } finally {
    rl.close();
  }
}

/**
 * Show multiple prompts in sequence
 * @param {Array<Object>} prompts - Array of prompt configurations
 * @returns {Promise<Object>} Promise resolving to object with named results
 */
async function multiInput(prompts) {
  const results = {};

  for (const promptConfig of prompts) {
    const { name, type = 'input', message, ...options } = promptConfig;

    switch (type) {
    case 'input':
      results[name] = await prompt(message, options);
      break;

    case 'password':
      results[name] = await password(message);
      break;

    case 'confirm':
      results[name] = await confirm(message, options.default);
      break;

    case 'select':
      results[name] = await select(message, options.choices, options);
      break;

    default:
      throw new Error(`Unknown prompt type: ${type}`);
    }
  }

  return results;
}

/**
 * Create a loading spinner
 * @param {string} message - Message to display with spinner
 * @returns {Object} Spinner object with start() and stop() methods
 */
function spinner(message) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let interval;

  const start = () => {
    process.stdout.write(`${frames[i]} ${message}`);
    interval = setInterval(() => {
      process.stdout.write('\r' + ' '.repeat(message.length + 2) + '\r');
      i = (i + 1) % frames.length;
      process.stdout.write(`${frames[i]} ${message}`);
    }, 100);
  };

  const stop = (finalMessage) => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }

    process.stdout.write('\r' + ' '.repeat(message.length + 2) + '\r');

    if (finalMessage) {
      console.log(finalMessage);
    }
  };

  return { start, stop };
}

module.exports = {
  prompt,
  confirm,
  select,
  password,
  multiInput,
  spinner
};

