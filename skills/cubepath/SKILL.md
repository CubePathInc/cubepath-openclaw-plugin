---
name: cubepath
description: "CubePath cloud: VPS, DNS, CDN, S3, k8s, DBs. Read before any cubepath__ tool. They are MCP tools, never exec: tool_search, tool_describe, then dispatch_action. Show the price and get an OK before anything billable."
---

# CubePath

CubePath tools are MCP tools named `cubepath__cubepath_<resource>_<action>`. They are not shell
commands: never run them with `exec`. If they are not in your tool list, find them with
`tool_search` (for example `cubepath vps`), read their parameters with `tool_describe`, and call
them with `dispatch_action`. Below they are written without the `cubepath__` prefix; always use
the full name, for example `cubepath__cubepath_project_list`.

If `tool_search` finds no CubePath tools, the server is not connected: point the user to the
plugin README instead of guessing.

## Rules

- Never guess identifiers and never ask the user for one you can look up. Resolve them first, for
  example `cubepath_vps_list` for a `vps_id` or a server's IP.
- Before creating anything billable (servers, snapshots, IPs, buckets, CDN zones), tell the user
  what it costs and wait for their OK. If no tool returns the price, say so; never estimate one.
  If the user set a price limit and the cost is above it, do not create it.
- Never end a turn saying you will check something: call the tools now, or say you cannot.
- Before anything destructive, name the exact resource and what will be lost, and wait for their
  OK. An approval prompt does not replace this.
- Long operations are queued and return immediately. Follow them with `cubepath_wait_for_status`.
  If it times out, call it again. Never repeat the original operation.
- Never print passwords, tokens or other credentials back to the user unless they ask for them.
- If a tool is missing, the token may lack that scope. Say so; do not work around it.

## Keep calls few

Every call resends the whole conversation, so a wasted call is expensive, and a failed write
asks the user to approve it again for nothing.

- Before the first call to a tool, run `tool_describe` on it. Parameters are exact: `project_id`
  is a number, not a project name. If a call fails with `Invalid argument`, run `tool_describe`
  again before retrying; do not guess another name.
- Call independent reads in the same turn.
- Do not repeat a list call whose result you already have.

## Deploying a VPS

1. In one turn: `cubepath_project_list`, `cubepath_vps_plan_list`, `cubepath_vps_template_list`
   and `cubepath_ssh_key_list`. A server needs an SSH key or a password.
2. Show plan, location, image, SSH key and monthly price. Stop and wait for the user's OK.
3. `cubepath_vps_create` with `project_id` (number), `name`, `plan_name`, `location_name`,
   `template_name` and `ssh_key_ids` (numbers).
4. `cubepath_wait_for_status` with `resource_type: "vps"` and `resource_id` set to the returned
   id, then report the IP addresses.

## Destroying a VPS

1. `cubepath_vps_list` to get the `vps_id`. Name the server and its IP and wait for the user's OK.
2. `cubepath_vps_destroy` with `vps_id`, then `cubepath_wait_for_status` until it is gone.

When a request mixes destroying and creating, finish and confirm the destroy before you create.
