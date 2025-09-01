# nvmcp - Node Version Manager for Model Context Protocol

[![npm version](https://badge.fury.io/js/nvmcp.svg)](https://badge.fury.io/js/nvmcp)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Simple tag-based MCP management CLI. Install, configure, and manage Model Context Protocol servers for AI tools like Claude Desktop, Cursor, and VS Code using an intuitive tag-based workflow.

## Features

✨ **Simple Installation** - Add MCP servers from npm, GitHub, or remote URLs  
🏷️ **Tag-Based Management** - Organize MCPs into tags for different environments  
🔄 **Easy Switching** - Switch between tag configurations instantly  
🤖 **AI Tool Integration** - Export configurations for Claude Desktop, Cursor, and VS Code  
🛡️ **Secure Storage** - Encrypted credential storage  
⚡ **Process Management** - Start, stop, and monitor MCP processes  
🌐 **Multiple Sources** - Support for npm packages, GitHub repos, and remote servers  

## Quick Start

### Installation

```bash
npm install -g nvmcp
```

### Create your first tag and add an MCP

```bash
# Create a development tag
nvmcp create development

# Add an MCP from npm
nvmcp add npm:@modelcontextprotocol/server-filesystem

# Add an MCP from GitHub
nvmcp add github:lharries/whatsapp-mcp

# Start the MCPs
nvmcp start

# Export to Claude Desktop
nvmcp use development --claude
```

## Commands

### Tag Management

#### `nvmcp create <tag>`
Create a new tag configuration.

```bash
nvmcp create development
nvmcp create production --description="Production environment"
```

#### `nvmcp use <tag>`
Switch to a tag configuration.

```bash
nvmcp use development
nvmcp use production --claude  # Also export to Claude Desktop
```

#### `nvmcp list` (alias: `ls`)
List all tag configurations.

```bash
nvmcp list
```

Output example:
```
Tag          Status    MCPs        Description
development  active    2 MCP(s)    Development environment
production   inactive  1 MCP(s)    Production environment
```

#### `nvmcp delete <tag>`
Delete a tag configuration.

```bash
nvmcp delete old-tag
```

### MCP Management

#### `nvmcp add <source>`
Add an MCP to the active tag.

```bash
nvmcp add npm:@modelcontextprotocol/server-filesystem
nvmcp add github:lharries/whatsapp-mcp
nvmcp add https://example.com/mcp-server
```

#### `nvmcp remove <mcp-name>`
Remove an MCP from the active tag.

```bash
nvmcp remove filesystem-server
```

### Process Management

#### `nvmcp start [tag]`
Start MCPs from active tag or specified tag.

```bash
nvmcp start
nvmcp start production
```

#### `nvmcp stop [tag]`
Stop MCPs from active tag or specified tag.

```bash
nvmcp stop
nvmcp stop production
```

#### `nvmcp ps`
List running MCP processes.

```bash
nvmcp ps
```

#### `nvmcp kill <process-id>`
Kill a specific MCP process.

```bash
nvmcp kill filesystem-server-1234
```


## Configuration

### Directory Structure

nvmcp stores all data in `~/.nvmcp/`:

```
~/.nvmcp/
├── configs/          # Tag configuration files
├── cache/            # Cached MCP sources
├── config.json       # Global nvmcp configuration
├── active-tag.json   # Currently active tag
├── running.json      # Running process information
└── .key             # Master encryption key
```

### Tag Configuration

Each tag has a configuration file in `~/.nvmcp/configs/<tag-name>.json`:

```json
{
  "name": "development",
  "version": "2.0.0",
  "description": "Development environment",
  "created": "2023-12-01T10:00:00.000Z",
  "updated": "2023-12-01T10:30:00.000Z",
  "mcps": {
    "filesystem": "npm:@modelcontextprotocol/server-filesystem",
    "whatsapp": "github:lharries/whatsapp-mcp"
  },
  "environment": {
    "API_KEY": "[encrypted]"
  },
  "settings": {
    "autoStart": false
  }
}
```

## AI Tool Integration

### Claude Desktop

nvmcp can export tag configurations to AI tools:

```bash
# Export to Claude Desktop
nvmcp use development --claude

# Export to Cursor IDE
nvmcp use development --cursor

# Export to VS Code
nvmcp use development --vscode
```

## Source Types

nvmcp supports multiple MCP source types:

### NPM Packages
```bash
nvmcp add npm:@modelcontextprotocol/server-filesystem
nvmcp add npm:my-custom-mcp
```

### GitHub Repositories
```bash
nvmcp add github:owner/repo
nvmcp add github:anthropic/mcp-server-example
```

### Remote URLs
```bash
nvmcp add https://example.com/mcp-server
nvmcp add http://localhost:3000/mcp
```

### Git Repositories
```bash
nvmcp add git+https://github.com/owner/repo.git
```

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

**MCP won't start:**
```bash
nvmcp ps                       # Check running processes
nvmcp start                    # Try starting again
```

**Missing tag:**
```bash
nvmcp list                     # See available tags
nvmcp create my-tag            # Create a new tag
```

**Export issues:**
```bash
nvmcp use my-tag --claude      # Re-export configuration
```

### Debug Mode

Enable debug output:
```bash
DEBUG=1 nvmcp start
```

## Examples

### Basic Workflow

```bash
# Create a tag
nvmcp create development

# Add MCPs to the tag
nvmcp add npm:@modelcontextprotocol/server-filesystem
nvmcp add github:lharries/whatsapp-mcp

# Start the MCPs
nvmcp start

# Export to Claude Desktop
nvmcp use development --claude
```

### Multi-Environment Workflow

```bash
# Create multiple environments
nvmcp create development
nvmcp create production

# Set up development
nvmcp use development
nvmcp add npm:@modelcontextprotocol/server-filesystem
nvmcp add github:my-org/debug-mcp

# Set up production
nvmcp use production  
nvmcp add npm:@modelcontextprotocol/server-filesystem
nvmcp add github:my-org/analytics-mcp

# Switch between environments
nvmcp use development --start
nvmcp use production --claude
```

## Development

### Project Structure

```
nvmcp/
├── lib/
│   ├── commands/       # CLI command implementations
│   │   └── tags.js     # Tag-based commands
│   ├── utils/         # Utility modules
│   ├── constants/     # Application constants
│   ├── cli.js         # Argument parsing
│   └── main.js        # Main entry point
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

MIT © [Ash]

## Support

- 📖 [Documentation](https://github.com/adirbenyossef/nvmcp)
- 🐛 [Issue Tracker](https://github.com/adirbenyossef/nvmcp/issues)
- 💬 [Discussions](https://github.com/adirbenyossef/nvmcp/discussions)

## Roadmap

- [ ] Plugin system for custom tools
- [ ] Configuration sharing
- [ ] Auto-update mechanism
- [ ] Web UI for server management
- [ ] Docker support
- [ ] CI/CD integrations

