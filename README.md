# CubePath for OpenClaw

Deploy and manage [CubePath](https://cubepath.com) infrastructure from OpenClaw: VPS, baremetal,
networking, DNS, CDN, Kubernetes, managed databases and object storage.

The tools come from the official [CubePath MCP server](https://mcp.cubepath.com). This plugin adds
approval prompts for anything that changes your infrastructure, and a skill that teaches the agent
to resolve IDs, confirm prices and follow queued operations.

## Install

Requires OpenClaw 2026.11.1 or later and a [CubePath account](https://my.cubepath.com).

```bash
openclaw plugins install clawhub:@cubepath/openclaw
openclaw mcp set cubepath '{"url":"https://mcp.cubepath.com/mcp","transport":"streamable-http","auth":"oauth"}'
openclaw mcp login cubepath
```

Stop the Gateway before `mcp login`, and restart it afterwards. If OpenClaw asks for capability
consent, rerun the install command with `--accept-capabilities`. Start a new chat once it is
installed: an open chat does not see the new skill.

The server must be named `cubepath`: approval prompts only apply to tools with that prefix.

**OpenClaw on a remote server.** After you authorize, the browser returns to `127.0.0.1:8989` on
the machine running OpenClaw. Either open an SSH tunnel from your computer before running
`mcp login`:

```bash
ssh -L 8989:127.0.0.1:8989 you@your-server
```

or let the redirect fail, copy the `code` value from the browser's address bar, and run
`openclaw mcp login cubepath --code <code>` on the server.

### With an API token

Create a token in the [dashboard](https://my.cubepath.com) with only the scopes you need, export it
as `CUBEPATH_API_TOKEN`, and run:

```bash
openclaw mcp set cubepath '{"url":"https://mcp.cubepath.com/mcp","transport":"streamable-http","headers":{"Authorization":"Bearer ${CUBEPATH_API_TOKEN}"}}'
```

Keep the single quotes so that the variable is stored as a reference, not as its value.

## Safety

| Tool | Behaviour |
|---|---|
| Read-only | Runs without asking |
| Changes something, including anything billable | Asks; you may allow it once or always |
| Destructive or unknown | Asks every time, marked as critical |

**You need somewhere to approve.** Without a connected approval surface, such as the Control UI or
a chat channel that supports `/approve`, every action that changes something is blocked with
`no approval route`. Read-only tools keep working. Restarting the Gateway disconnects the
Control UI: reload it before asking for anything that changes your infrastructure. See
[plugin permission requests](https://docs.openclaw.ai/plugins/plugin-permission-requests).

Each call is approved separately: if an approved call fails and the agent retries it, you are
asked again.

**Allow always** trusts that tool with any parameters, so choosing it for `cubepath_vps_create`
lets the agent create billable servers without asking again. Run `/cubepath-reset-approvals` to
undo every such approval.

The approval prompt shows the parameters, not the price. The skill tells the agent to show the
price and wait for your OK first, but a model can skip that, so the prompt is the one check that
always applies.

Start with a read-only token if you are trying this out. Creating resources costs money.

## Model and token use

Every step of the agent resends OpenClaw's system prompt and the whole conversation, so the
number of steps decides the cost more than the size of any single reply.

- **Use a capable model.** Small models guess parameter names and retry, and every failed write
  also asks for approval again. In our tests `gpt-4.1-mini` often skipped the skill and
  guessed, and even `gpt-4.1` sometimes guessed parameters or asked for IDs it could look up.
- **Start a new chat per task**, so old history is not resent.
- **Turn off tools you do not use** with `tools.deny` or a smaller `tools.profile`: every tool
  definition is sent with every request.

## Development

```bash
npm test
CUBEPATH_API_TOKEN=... npm run sync-tools   # refresh tool-policy.js from the live server
```

## License

MIT
