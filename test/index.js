const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { parseArgs } = require('../lib/cli');
const { colors } = require('../lib/utils/colors');
const { encrypt, decrypt, isSensitiveKey } = require('../lib/utils/crypto');
const { getConfig, initialize } = require('../lib/utils/unified-config');

console.log(colors.cyan('Running nvmcp tests...\n'));

let testsPassed = 0;
let testsTotal = 0;

function test(name, fn) {
  testsTotal++;
  try {
    fn();
    console.log(colors.green('✓'), name);
    testsPassed++;
  } catch (error) {
    console.log(colors.red('✗'), name);
    console.log(colors.red('  Error:'), error.message);
  }
}

test('CLI argument parsing - basic command', () => {
  const result = parseArgs(['install', 'package-name']);
  assert.strictEqual(result.command, 'install');
  assert.deepStrictEqual(result.args, ['package-name']);
  assert.deepStrictEqual(result.options, {});
});

test('CLI argument parsing - with options', () => {
  const result = parseArgs(['install', 'package-name', '--repo=github:user/repo', '--tag', 'main']);
  assert.strictEqual(result.command, 'install');
  assert.deepStrictEqual(result.args, ['package-name']);
  assert.strictEqual(result.options.repo, 'github:user/repo');
  assert.strictEqual(result.options.tag, 'main');
});

test('CLI argument parsing - short options', () => {
  const result = parseArgs(['list', '-h']);
  assert.strictEqual(result.command, 'list');
  assert.strictEqual(result.options.help, true);
});

test('Colors - strip ANSI codes', () => {
  const { stripAnsi } = require('../lib/utils/colors');
  const coloredText = colors.red('error message');
  const plainText = stripAnsi(coloredText);
  assert.strictEqual(plainText, 'error message');
});

test('Colors - format status', () => {
  const { formatStatus } = require('../lib/utils/colors');
  const status = formatStatus('active');
  assert.ok(status.includes('active'));
});

test('Crypto - encrypt and decrypt', () => {
  const plaintext = 'secret message';
  const password = 'test-password';

  const encrypted = encrypt(plaintext, password);
  assert.ok(encrypted.encrypted);
  assert.ok(encrypted.salt);
  assert.ok(encrypted.iv);

  const decrypted = decrypt(encrypted, password);
  assert.strictEqual(decrypted, plaintext);
});

test('Crypto - sensitive key detection', () => {
  assert.strictEqual(isSensitiveKey('apiKey'), true);
  assert.strictEqual(isSensitiveKey('password'), true);
  assert.strictEqual(isSensitiveKey('secret'), true);
  assert.strictEqual(isSensitiveKey('token'), true);
  assert.strictEqual(isSensitiveKey('normalField'), false);
});

test('Config - default configuration', () => {
  initialize();
  const config = getConfig();
  assert.ok(config.version);
  assert.ok(config.settings);
  assert.ok(config.integrations);
  assert.ok(config.integrations.claude);
  assert.ok(config.integrations.cursor);
});

test('HTTP client - URL validation', () => {
  const { URL } = require('url');

  assert.doesNotThrow(() => {
    new URL('https://example.com');
  });

  assert.throws(() => {
    new URL('invalid-url');
  });
});

test('Package spec parsing', () => {
  const { parsePackageSpec } = require('../lib/cli');

  const npmPackage = parsePackageSpec('my-package');
  assert.strictEqual(npmPackage.type, 'npm');
  assert.strictEqual(npmPackage.name, 'my-package');

  const githubPackage = parsePackageSpec('github:user/repo');
  assert.strictEqual(githubPackage.type, 'github');
  assert.strictEqual(githubPackage.owner, 'user');
  assert.strictEqual(githubPackage.repo, 'user/repo');
});

test('Terminal colors support detection', () => {
  const { isColorSupported } = require('../lib/utils/colors');
  const result = isColorSupported();
  assert.strictEqual(typeof result, 'boolean');
});

test('Progress bar formatting', () => {
  const { progressBar } = require('../lib/utils/colors');
  const progress = progressBar(50, 100, 20);
  assert.ok(typeof progress === 'string');
  assert.ok(progress.length > 0);
});

test('Table formatting', () => {
  const { formatTable } = require('../lib/utils/colors');
  const headers = ['Name', 'Version'];
  const rows = [['test-server', '1.0.0'], ['another-server', '2.1.0']];
  const table = formatTable(headers, rows);
  assert.ok(table.includes('Name'));
  assert.ok(table.includes('test-server'));
});

test('Environment variable handling', () => {
  const originalEnv = process.env.TEST_VAR;
  process.env.TEST_VAR = 'test-value';

  assert.strictEqual(process.env.TEST_VAR, 'test-value');

  if (originalEnv !== undefined) {
    process.env.TEST_VAR = originalEnv;
  } else {
    delete process.env.TEST_VAR;
  }
});

test('Path operations', () => {
  const testPath = path.join(os.homedir(), '.nvmcp', 'test');
  const parentDir = path.dirname(testPath);
  const basename = path.basename(testPath);

  assert.ok(parentDir.includes('.nvmcp'));
  assert.strictEqual(basename, 'test');
});

test('File system operations', () => {
  const tempDir = path.join(os.tmpdir(), 'nvmcp-test');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  assert.ok(fs.existsSync(tempDir));

  const testFile = path.join(tempDir, 'test.json');
  const testData = { test: 'data' };

  fs.writeFileSync(testFile, JSON.stringify(testData));
  assert.ok(fs.existsSync(testFile));

  const readData = JSON.parse(fs.readFileSync(testFile, 'utf8'));
  assert.deepStrictEqual(readData, testData);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

console.log(`\n${colors.bold('Test Results:')}`);
console.log(`${colors.green('Passed:')} ${testsPassed}`);
console.log(`${colors.dim('Total:')} ${testsTotal}`);

if (testsPassed === testsTotal) {
  console.log(colors.green('\nAll tests passed! ✓'));
  process.exit(0);
} else {
  console.log(colors.red(`\n${testsTotal - testsPassed} test(s) failed ✗`));
  process.exit(1);
}
