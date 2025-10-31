# nvmcp Quick Start Guide

Welcome to nvmcp! This guide will help you get started with managing MCP servers for Claude and other AI tools in just a few minutes.

## What is nvmcp?

nvmcp is a simple CLI tool that helps you:
- Install and manage MCP (Model Context Protocol) servers
- Organize MCPs into tags for different environments
- Connect MCPs to Claude Desktop, Cursor, and VS Code
- Start, stop, and monitor MCP processes

## Installation

```bash
npm install -g nvmcp
```

## Getting Started (3 Ways)

### 🎯 Option 1: Interactive Wizard (Easiest)

Perfect for first-time users. The wizard guides you through everything:

```bash
nvmcp init
```

This will:
1. Help you create your first tag
2. Let you choose from popular MCPs (WhatsApp, filesystem, etc.)
3. Export the configuration to your AI tool of choice

**Try it now!** Just run `nvmcp init` and follow the prompts.

---

### ⚡ Option 2: Quick Start with Presets (Fastest)

Get up and running instantly with pre-configured setups:

```bash
# WhatsApp development environment
nvmcp quickstart whatsapp-dev --claude

# Full-stack development setup
nvmcp quickstart full-stack --claude

# Minimal setup (just filesystem)
nvmcp quickstart minimal --claude
```

The `--claude` flag automatically exports to Claude Desktop. You can also use `--cursor` or `--vscode`.

**Available presets:**
- `whatsapp-dev` - WhatsApp + filesystem + memory
- `full-stack` - Filesystem + GitHub + Postgres + memory
- `minimal` - Just filesystem

---

### 🛠️ Option 3: Manual Setup (Most Control)

Build your configuration step by step:

```bash
# 1. Create a tag
nvmcp create development

# 2. Add MCPs using preset names (easiest!)
nvmcp add whatsapp
nvmcp add filesystem

# Or use full sources
nvmcp add github:lharries/whatsapp-mcp
nvmcp add npm:@modelcontextprotocol/server-filesystem

# 3. Start the MCPs
nvmcp start

# 4. Export to Claude Desktop
nvmcp use development --claude
```

---

## Available MCP Presets

View all available presets:

```bash
nvmcp presets
```

Current presets include:
- **whatsapp** - WhatsApp messaging integration
- **filesystem** - File system access and operations
- **github** - GitHub repository integration
- **slack** - Slack workspace integration
- **memory** - Persistent memory storage
- **postgres** - PostgreSQL database integration

---

## Common Workflows

### Adding WhatsApp MCP to Claude

The simplest way:

```bash
# Option A: Use the wizard
nvmcp init
# Select WhatsApp when prompted, export to Claude

# Option B: Quick start
nvmcp quickstart whatsapp-dev --claude

# Option C: Manual
nvmcp create my-tag
nvmcp add whatsapp
nvmcp use my-tag --claude
```

### Managing Multiple Environments

```bash
# Create separate tags for different environments
nvmcp create development
nvmcp add whatsapp
nvmcp add filesystem

nvmcp create production
nvmcp add whatsapp
nvmcp add postgres

# Switch between environments
nvmcp use development --start
nvmcp use production --start --claude
```

### Viewing and Managing MCPs

```bash
# List all tags
nvmcp list

# View available presets
nvmcp presets

# View running processes
nvmcp ps

# Stop all MCPs
nvmcp stop

# Remove an MCP
nvmcp remove whatsapp
```

---

## Next Steps

### Start Your MCPs

After setting up, start your MCPs:

```bash
nvmcp start
```

### Monitor Running Processes

Check what's running:

```bash
nvmcp ps
```

### Export to AI Tools

Export your configuration:

```bash
# Claude Desktop
nvmcp use my-tag --claude

# Cursor IDE
nvmcp use my-tag --cursor

# VS Code
nvmcp use my-tag --vscode
```

### Add More MCPs

You can always add more MCPs:

```bash
# Using preset names
nvmcp add github
nvmcp add slack

# Using custom sources
nvmcp add npm:my-custom-mcp
nvmcp add github:username/repo
nvmcp add https://example.com/mcp
```

---

## Tips & Tricks

1. **Use preset names** - Instead of remembering full package names, just use `nvmcp add whatsapp`

2. **Auto-start MCPs** - Add `--start` to automatically start MCPs after adding them:
   ```bash
   nvmcp add whatsapp --start
   ```

3. **Combine operations** - The `use` command can switch tags, start MCPs, and export config:
   ```bash
   nvmcp use development --start --claude
   ```

4. **Quick setup** - For demos or testing, use quickstart:
   ```bash
   nvmcp quickstart whatsapp-dev --start --claude
   ```

---

## Troubleshooting

### No tags found

```bash
nvmcp create my-first-tag
```

### MCP won't start

```bash
nvmcp ps              # Check running processes
nvmcp stop            # Stop all
nvmcp start           # Try starting again
```

### Need help?

```bash
nvmcp help            # Show all commands
nvmcp help <command>  # Show help for specific command
```

---

## Example: Complete WhatsApp Setup

Here's a complete example from start to finish:

```bash
# 1. Install nvmcp
npm install -g nvmcp

# 2. Quick start with WhatsApp
nvmcp quickstart whatsapp-dev --start --claude

# 3. Verify it's running
nvmcp ps

# 4. Open Claude Desktop and start chatting!
```

That's it! Your WhatsApp MCP is now connected to Claude Desktop.

---

## Learn More

- Full documentation: See [README.md](README.md)
- Available commands: Run `nvmcp help`
- View presets: Run `nvmcp presets`
- GitHub: https://github.com/adirbenyossef/nvmcp

---

**Happy coding! 🎉**
