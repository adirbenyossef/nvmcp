const ANSI_CODES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

function isColorSupported() {
  const env = process.env;
  
  if (env.FORCE_COLOR) {
    return true;
  }
  
  if (env.NO_COLOR || env.NODE_DISABLE_COLORS) {
    return false;
  }
  
  if (process.stdout && process.stdout.isTTY) {
    return true;
  }
  
  return false;
}

function colorize(text, colorCode) {
  if (!isColorSupported()) {
    return text;
  }
  
  return `${colorCode}${text}${ANSI_CODES.reset}`;
}

const colors = {
  reset: (text) => colorize(text, ANSI_CODES.reset),
  bold: (text) => colorize(text, ANSI_CODES.bold),
  dim: (text) => colorize(text, ANSI_CODES.dim),
  underscore: (text) => colorize(text, ANSI_CODES.underscore),
  
  black: (text) => colorize(text, ANSI_CODES.black),
  red: (text) => colorize(text, ANSI_CODES.red),
  green: (text) => colorize(text, ANSI_CODES.green),
  yellow: (text) => colorize(text, ANSI_CODES.yellow),
  blue: (text) => colorize(text, ANSI_CODES.blue),
  magenta: (text) => colorize(text, ANSI_CODES.magenta),
  cyan: (text) => colorize(text, ANSI_CODES.cyan),
  white: (text) => colorize(text, ANSI_CODES.white),
  
  bgBlack: (text) => colorize(text, ANSI_CODES.bgBlack),
  bgRed: (text) => colorize(text, ANSI_CODES.bgRed),
  bgGreen: (text) => colorize(text, ANSI_CODES.bgGreen),
  bgYellow: (text) => colorize(text, ANSI_CODES.bgYellow),
  bgBlue: (text) => colorize(text, ANSI_CODES.bgBlue),
  bgMagenta: (text) => colorize(text, ANSI_CODES.bgMagenta),
  bgCyan: (text) => colorize(text, ANSI_CODES.bgCyan),
  bgWhite: (text) => colorize(text, ANSI_CODES.bgWhite)
};

function formatStatus(status) {
  switch (status) {
    case 'active':
      return colors.green('active');
    case 'configured':
      return colors.cyan('configured');
    case 'error':
      return colors.red('error');
    case 'missing':
      return colors.yellow('missing');
    case 'remote':
      return colors.blue('remote');
    default:
      return colors.dim(status);
  }
}

function formatSuccess(text) {
  return `${colors.green('✓')} ${text}`;
}

function formatError(text) {
  return `${colors.red('✗')} ${text}`;
}

function formatWarning(text) {
  return `${colors.yellow('⚠')} ${text}`;
}

function formatInfo(text) {
  return `${colors.blue('ℹ')} ${text}`;
}

function progressBar(current, total, width = 20) {
  if (!isColorSupported()) {
    return `[${current}/${total}]`;
  }
  
  const percentage = Math.floor((current / total) * 100);
  const filled = Math.floor((current / total) * width);
  const empty = width - filled;
  
  const bar = colors.green('█'.repeat(filled)) + colors.dim('█'.repeat(empty));
  return `[${bar}] ${percentage}%`;
}

function formatTable(headers, rows, options = {}) {
  if (!headers || !rows || rows.length === 0) {
    return '';
  }
  
  const columnWidths = headers.map((header, index) => {
    const values = [header, ...rows.map(row => String(row[index] || ''))];
    return Math.max(...values.map(v => stripAnsi(v).length));
  });
  
  const separator = '+' + columnWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const headerRow = '|' + headers.map((header, index) => {
    const padded = ` ${colors.bold(header).padEnd(columnWidths[index] + colors.bold(header).length - header.length)} `;
    return padded;
  }).join('|') + '|';
  
  const dataRows = rows.map(row => {
    return '|' + row.map((cell, index) => {
      const cellStr = String(cell || '');
      const padded = ` ${cellStr.padEnd(columnWidths[index] + cellStr.length - stripAnsi(cellStr).length)} `;
      return padded;
    }).join('|') + '|';
  });
  
  return [separator, headerRow, separator, ...dataRows, separator].join('\n');
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

module.exports = {
  colors,
  formatStatus,
  formatSuccess,
  formatError,
  formatWarning,
  formatInfo,
  progressBar,
  formatTable,
  stripAnsi,
  isColorSupported
};