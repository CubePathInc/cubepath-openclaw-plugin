import { READ_ONLY_TOOLS, WRITE_TOOLS } from "./tool-policy.js";

const TOOL_PREFIX = "cubepath__";
const SENSITIVE_PARAM = /pass|secret|token|key|credential|user_?data|cloud_?init/i;
const MAX_PARAMS = 240;
const RESET_COMMAND = "cubepath-reset-approvals";

const WRITE_NOTICE =
  `May cost money. "Allow always" stops asking for this tool, with any parameters, ` +
  `until you run /${RESET_COMMAND}.`;
const CRITICAL_NOTICE = "Can delete resources or data, and may cost money. Check the target.";

function describeParams(params) {
  const shown = Object.fromEntries(
    Object.entries(params ?? {}).map(([name, value]) => [
      name,
      SENSITIVE_PARAM.test(name) ? "[hidden]" : value,
    ]),
  );
  const text = JSON.stringify(shown);
  return text.length > MAX_PARAMS ? `${text.slice(0, MAX_PARAMS - 1)}…` : text;
}

/**
 * Only tools known to be read-only run without asking. Anything else, including a
 * tool added to the MCP server after this release, needs approval, and only known
 * non-destructive writes can be approved permanently.
 */
export function approvalFor(toolName, params) {
  if (!toolName?.startsWith(TOOL_PREFIX)) return undefined;
  const tool = toolName.slice(TOOL_PREFIX.length);
  if (READ_ONLY_TOOLS.has(tool)) return undefined;

  const isPlainWrite = WRITE_TOOLS.has(tool);
  return {
    title: `CubePath: ${tool}`,
    description: `${isPlainWrite ? WRITE_NOTICE : CRITICAL_NOTICE} ${describeParams(params)}`,
    severity: isPlainWrite ? "warning" : "critical",
    allowedDecisions: isPlainWrite ? ["allow-once", "allow-always", "deny"] : ["allow-once", "deny"],
  };
}

/** A failed read means asking again: trust is never assumed. */
async function isTrusted(store, tool) {
  if (!WRITE_TOOLS.has(tool)) return false;
  try {
    return Boolean(await store.lookup(tool));
  } catch {
    return false;
  }
}

export function createHook(store) {
  return async (event) => {
    const requireApproval = approvalFor(event?.toolName, event?.params);
    if (!requireApproval) return undefined;

    const tool = event.toolName.slice(TOOL_PREFIX.length);
    if (await isTrusted(store, tool)) return undefined;

    return {
      requireApproval: {
        ...requireApproval,
        // OpenClaw does not persist allow-always for hooks: the plugin has to.
        onResolution: async (decision) => {
          if (decision === "allow-always") await store.register(tool, { approvedAt: Date.now() });
        },
      },
    };
  };
}

export default {
  id: "cubepath",
  name: "CubePath",
  description: "Deploy and manage CubePath cloud infrastructure from OpenClaw.",
  register(api) {
    const store = api.runtime.state.openKeyedStoreV2({ namespace: "trusted-tools", maxEntries: 500 });
    api.on("before_tool_call", createHook(store));
    api.registerCommand({
      name: RESET_COMMAND,
      description: "Ask again before every CubePath action approved with Allow always",
      handler: async () => {
        await store.clear();
        return { text: "CubePath will ask again before every action." };
      },
    });
  },
};
