# nvmcp - Node Version Manager for Model Context Protocol

Initial commit: Establishing the master branch with the README.md file.

[![npm version](https://badge.fury.io/js/nvmcp.svg)](https://badge.fury.io/js/nvmcp)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight package manager for Model Context Protocol (MCP) servers and clients. Think "nvm for MCP servers" - nvmcp makes it simple to install, configure, and manage MCP servers for AI tools like Claude, Cursor, and custom AI agents.

## Features

✨ **Simple Installation** - Install MCP servers from npm or GitHub with one command  
🔧 **Easy Configuration** - Interactive setup with secure credential storage  
🔄 **Profile Management** - Tag and switch between different configurations  
🤖 **AI Tool Integration** - Native support for Claude Desktop, Cursor, and VS Code  
🛡️ **Secure Storage** - Encrypted credential storage using OS keychain  
🩺 **Health Diagnostics** - Built-in doctor command for troubleshooting  
🌐 **Remote Servers** - Support for cloud-hosted AI agents  

## Quick Start

### Installation

```bash
npm install -g nvmcp
# or
yarn global add nvmcp
```

### Initialize nvmcp

```bash
nvmcp init
```

### Install and configure your first MCP server

```bash
# Install from npm
nvmcp install awesome-coralogix-mcp

# Install from GitHub
nvmcp install --repo=github:anthropic/mcp-server-example

# Configure the server
nvmcp config awesome-coralogix-mcp

# Activate for Claude Desktop
nvmcp use awesome-coralogix-mcp --claude
```

## Commands

### Core Commands

#### `nvmcp init`
Initialize nvmcp directory structure and configuration.

```bash
nvmcp init
```

#### `nvmcp install <package>` (alias: `i`)
Install an MCP server from npm or GitHub.

```bash
nvmcp install awesome-coralogix-mcp
nvmcp install --repo=github:anthropic/mcp-server-example
nvmcp install my-server --tag=production
```

**Options:**
- `--repo=<repo>` - Install from GitHub repository (format: `github:owner/repo`)
- `--tag=<tag>` - Tag the installation with a profile name

#### `nvmcp list` (alias: `ls`)
List all installed MCP servers with their status.

```bash
nvmcp list
```

Output example:
```
Name                 Version  Status                    Description
awesome-coralogix    1.2.3    active [remote]          Coralogix MCP server
github-mcp           2.0.0    configured               GitHub integration
frontend-agent       3.1.0    error: missing config    Frontend development agent
```

#### `nvmcp config <server>`
Configure an MCP server with interactive prompts.

```bash
nvmcp config awesome-coralogix-mcp
nvmcp config my-server --command="node server.js"
nvmcp config my-server --env="API_KEY=your-key"
nvmcp config my-server --tag=production
```

**Options:**
- `--command=<cmd>` - Set custom run command
- `--env=<KEY=value>` - Set environment variable
- `--tag=<tag>` - Create/update tagged profile

#### `nvmcp use <profile|server>`
Activate a configuration profile or server.

```bash
nvmcp use production
nvmcp use awesome-coralogix-mcp --claude
nvmcp use my-profile --cursor
```

**Options:**
- `--claude` - Export configuration for Claude Desktop
- `--cursor` - Export configuration for Cursor IDE  
- `--vscode` - Export configuration for VS Code

#### `nvmcp run <server>`
Start an MCP server.

```bash
nvmcp run awesome-coralogix-mcp
nvmcp run my-server --daemon
nvmcp run production-profile
```

**Options:**
- `--daemon` - Run as background daemon

#### `nvmcp doctor`
Diagnose configuration and connectivity issues.

```bash
nvmcp doctor
```

Output example:
```
✓ nvmcp installation OK
✓ awesome-coralogix-mcp - Connected
✗ github-mcp - Error: Invalid Access Key  
✓ frontend-agent - Remote agent accessible
```

### Management Commands

#### `nvmcp uninstall <server>` (alias: `rm`)
Remove an installed MCP server.

```bash
nvmcp uninstall old-server
```

#### `nvmcp update [server]`
Update an MCP server to the latest version.

```bash
nvmcp update awesome-coralogix-mcp  # Update specific server
nvmcp update                        # Check all servers for updates
```

## Configuration

### Directory Structure

nvmcp stores all data in `~/.nvmcp/`:

```
~/.nvmcp/
├── servers/          # Installed MCP server packages
├── configs/          # Configuration files for each server  
├── profiles/         # Tagged configuration profiles
├── config.json       # Global nvmcp configuration
├── active.json       # Currently active configuration
└── .key             # Master encryption key
```

### Server Configuration

Each server has a configuration file in `~/.nvmcp/configs/<server-name>.json`:

```json
{
  "name": "awesome-coralogix-mcp",
  "version": "1.2.3",
  "type": "local",
  "command": "node index.js",
  "env": {
    "API_KEY": "[encrypted]",
    "ENDPOINT": "https://api.coralogix.com"
  },
  "args": ["--verbose"],
  "capabilities": ["search", "query", "analyze"]
}
```

### Profile Configuration

Profiles group multiple servers together:

```json
{
  "name": "production",
  "servers": [
    {
      "name": "awesome-coralogix-mcp",
      "config": "~/.nvmcp/configs/awesome-coralogix-mcp.json"
    }
  ],
  "default": "awesome-coralogix-mcp"
}
```

## AI Tool Integration

### Claude Desktop

nvmcp automatically configures Claude Desktop by updating:
`~/Library/Application Support/Claude/claude_desktop_config.json`

```bash
nvmcp use my-server --claude
```

### Cursor IDE

Export configuration for Cursor:

```bash
nvmcp use my-server --cursor
```

### VS Code

Export configuration for VS Code:

```bash
nvmcp use my-server --vscode
```

## Remote Servers

nvmcp supports remote MCP servers hosted in the cloud:

```bash
nvmcp install remote-ai-agent
nvmcp config remote-ai-agent
```

During configuration, choose "Remote server" and provide:
- Endpoint URL
- Transport protocol (HTTP/WebSocket)
- Authentication details

## Security

### Credential Storage

Sensitive data (API keys, passwords, tokens) is automatically:
1. Detected using pattern matching
2. Encrypted using AES-256-CBC
3. Stored with a master key in `~/.nvmcp/.key` (mode 600)

### Pattern Detection

The following keys are treated as sensitive:
- `*key`, `*token`, `*secret`, `*password`
- `*auth*`, `*credential*`, `api*`

## Troubleshooting

### Common Issues

**Server won't start:**
```bash
nvmcp doctor                    # Check system health
nvmcp config my-server         # Reconfigure server
```

**Missing dependencies:**
```bash
cd ~/.nvmcp/servers/my-server
npm install
```

**Configuration issues:**
```bash
nvmcp doctor                   # Detailed diagnostics
nvmcp use my-server --claude   # Re-export configuration
```

### Debug Mode

Enable debug output:
```bash
DEBUG=1 nvmcp run my-server
```

## Examples

### Basic Workflow

```bash
# Initialize nvmcp
nvmcp init

# Install a server
nvmcp install awesome-coralogix-mcp

# Configure with API key
nvmcp config awesome-coralogix-mcp
# Enter API key when prompted

# Use with Claude
nvmcp use awesome-coralogix-mcp --claude

# Start the server
nvmcp run awesome-coralogix-mcp
```

### Development Workflow

```bash
# Install development server
nvmcp install my-dev-server --tag=development

# Configure for development
nvmcp config my-dev-server --env="DEBUG=1"

# Create production profile  
nvmcp config prod-server --tag=production

# Switch between environments
nvmcp use development --cursor
nvmcp use production --claude
```

### GitHub Installation

```bash
# Install from GitHub
nvmcp install --repo=github:user/custom-mcp-server

# Install specific branch/tag
nvmcp install --repo=github:user/server --tag=v2.0

# Update from GitHub
nvmcp update github-server
```

## Development

### Project Structure

```
nvmcp/
├── lib/
│   ├── commands/       # CLI command implementations
│   ├── utils/         # Utility modules  
│   ├── cli.js         # Argument parsing
│   └── index.js       # Main entry point
├── bin/
│   └── nvmcp          # Executable binary
└── test/
    └── index.js       # Test suite
```

### Building from Source

```bash
git clone https://github.com/yourusername/nvmcp.git
cd nvmcp
npm install
npm test
npm run lint
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request

## Requirements

- **Node.js**: >= 16.0.0
- **npm**: Latest version recommended
- **OS**: macOS, Linux, Windows

## Dependencies

nvmcp is built with **zero external dependencies** for maximum reliability and security. It only uses Node.js built-in modules:

- `fs` - File system operations
- `path` - Path manipulation  
- `https/http` - Network requests
- `crypto` - Encryption
- `readline` - Interactive prompts
- `child_process` - Process management

## License

MIT © [Your Name]

## Support

- 📖 [Documentation](https://github.com/yourusername/nvmcp)
- 🐛 [Issue Tracker](https://github.com/yourusername/nvmcp/issues)
- 💬 [Discussions](https://github.com/yourusername/nvmcp/discussions)

## Roadmap

- [ ] Plugin system for custom tools
- [ ] Server marketplace/registry  
- [ ] Configuration sharing
- [ ] Auto-update mechanism
- [ ] Web UI for server management
- [ ] Docker support
- [ ] CI/CD integrations

---

Made with ❤️ for the MCP ecosystem