# CubePath for OpenClaw

Deploy and manage [CubePath](https://cubepath.com) infrastructure from OpenClaw: VPS, baremetal,
networking, DNS, CDN, Kubernetes, managed databases and object storage.

The tools come from the official [CubePath MCP server](https://mcp.cubepath.com). This plugin adds
approval prompts for anything that changes your infrastructure, and a skill that teaches the agent
to resolve IDs, confirm prices and follow queued operations. It contains no credentials and no
server code.

## Requirements

- OpenClaw 2026.11.1 or later, tested with 2026.11.2.
- A [CubePath account](https://my.cubepath.com).
- Any model with tool calling. CubePath access and model access are separate: the plugin does not
  need a particular model or provider.

## Install

```bash
openclaw plugins install clawhub:@cubepath/openclaw
openclaw mcp set cubepath '{"url":"https://mcp.cubepath.com/mcp","transport":"streamable-http","auth":"oauth"}'
openclaw gateway stop
openclaw mcp login cubepath
openclaw gateway start
```

`mcp login` opens CubePath in your browser to authorize OpenClaw. If OpenClaw asks for capability
consent, rerun the install command with `--accept-capabilities`. Then start a new chat: an open
chat does not see the new skill.

The server must be named `cubepath`: approval prompts only apply to tools with that prefix.

### With an API token

Instead of signing in, you can create a token in the
[dashboard](https://my.cubepath.com) with only the scopes you need, export it as
`CUBEPATH_API_TOKEN`, and run:

```bash
openclaw mcp set cubepath '{"url":"https://mcp.cubepath.com/mcp","transport":"streamable-http","headers":{"Authorization":"Bearer ${CUBEPATH_API_TOKEN}"}}'
```

Keep the single quotes so that the variable is stored as a reference, not as its value. Never
paste a token into the chat.

## Try it

1. "List my VPS and their IPs."
2. "Create a DNS zone for example.com with an A record for www pointing to my server web-1."
3. "Take a snapshot of web-1, tell me the price first."

## Safety

| Tool | Behaviour |
|---|---|
| Read-only | Runs without asking |
| Changes something, including anything billable | Asks; you may allow it once or always |
| Destructive or unknown | Asks every time, marked as critical |

**You need somewhere to approve.** Without a connected approval surface, such as the Control UI or
a chat channel that supports `/approve`, every action that changes something is blocked with
`no approval route`. Read-only tools keep working. See
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

## Support

Open an issue in this repository, or contact [CubePath support](https://my.cubepath.com).

## Development

```bash
npm test
CUBEPATH_API_TOKEN=... npm run sync-tools   # refresh tool-policy.js from the live server
```

## License

MIT
