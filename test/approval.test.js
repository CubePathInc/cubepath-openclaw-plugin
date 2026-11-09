import assert from "node:assert/strict";
import { test } from "node:test";
import plugin, { approvalFor, createHook } from "../index.js";
import { DESTRUCTIVE_TOOLS, READ_ONLY_TOOLS, WRITE_TOOLS } from "../tool-policy.js";

test("read-only tools run without approval", () => {
  assert.equal(approvalFor("cubepath__cubepath_vps_list", {}), undefined);
});

test("tools from other servers are left alone", () => {
  assert.equal(approvalFor("exec", {}), undefined);
  assert.equal(approvalFor("github__cubepath_vps_destroy", {}), undefined);
  assert.equal(approvalFor(undefined, {}), undefined);
});

test("destructive tools can only be approved once", () => {
  const approval = approvalFor("cubepath__cubepath_vps_destroy", { vps_id: 1 });
  assert.equal(approval.severity, "critical");
  assert.deepEqual(approval.allowedDecisions, ["allow-once", "deny"]);
  assert.match(approval.description, /"vps_id":1/);
});

test("plain writes can be approved permanently, with a clear notice", () => {
  const approval = approvalFor("cubepath__cubepath_vps_create", {});
  assert.equal(approval.severity, "warning");
  assert.ok(approval.allowedDecisions.includes("allow-always"));
  assert.match(approval.description, /May cost money/);
  assert.match(approval.description, /cubepath-reset-approvals/);
});

test("no destructive tool can be approved permanently", () => {
  for (const tool of DESTRUCTIVE_TOOLS) {
    assert.deepEqual(approvalFor(`cubepath__${tool}`, {}).allowedDecisions, ["allow-once", "deny"]);
  }
});

test("the prompt fits the gateway limits", () => {
  const { title, description } = approvalFor("cubepath__cubepath_vps_create", { name: "x".repeat(1000) });
  assert.ok(title.length <= 80);
  assert.ok(description.length <= 512);
});

test("unknown tools fail safe", () => {
  const approval = approvalFor("cubepath__cubepath_added_later", {});
  assert.equal(approval.severity, "critical");
  assert.ok(!approval.allowedDecisions.includes("allow-always"));
});

test("secrets stay out of the approval prompt", () => {
  const { description } = approvalFor("cubepath__cubepath_vps_create", {
    name: "web",
    password: "hunter2",
    ssh_key_names: ["k"],
    cloud_init: "secret-script",
    api_token: "abc",
  });
  assert.match(description, /"name":"web"/);
  for (const leaked of ["hunter2", "secret-script", "abc"]) assert.ok(!description.includes(leaked));
});

test("every tool has exactly one class", () => {
  const all = [...READ_ONLY_TOOLS, ...WRITE_TOOLS, ...DESTRUCTIVE_TOOLS];
  assert.equal(new Set(all).size, all.length);
});

function memoryStore() {
  const rows = new Map();
  return {
    rows,
    lookup: async (key) => rows.get(key),
    register: async (key, value) => void rows.set(key, value),
    clear: async () => rows.clear(),
  };
}

const CREATE = { toolName: "cubepath__cubepath_vps_create", params: {} };
const DESTROY = { toolName: "cubepath__cubepath_vps_destroy", params: {} };

test("allow-always stops asking for that tool only", async () => {
  const hook = createHook(memoryStore());
  await (await hook(CREATE)).requireApproval.onResolution("allow-always");
  assert.equal(await hook(CREATE), undefined);
  assert.ok((await hook({ toolName: "cubepath__cubepath_ssh_key_set", params: {} })).requireApproval);
});

test("allow-once and deny are not remembered", async () => {
  const hook = createHook(memoryStore());
  for (const decision of ["allow-once", "deny", "timeout"]) {
    await (await hook(CREATE)).requireApproval.onResolution(decision);
    assert.ok((await hook(CREATE)).requireApproval);
  }
});

test("stored trust never covers a destructive tool", async () => {
  const store = memoryStore();
  store.rows.set("cubepath_vps_destroy", { approvedAt: 1 });
  assert.ok((await createHook(store)(DESTROY)).requireApproval);
});

test("a failing store asks again", async () => {
  const store = { lookup: async () => { throw new Error("db down"); } };
  assert.ok((await createHook(store)(CREATE)).requireApproval);
});

test("register wires the hooks and the reset command", async () => {
  const store = memoryStore();
  const hooks = {};
  let command;
  plugin.register({
    runtime: { state: { openKeyedStoreV2: () => store } },
    on: (name, fn) => { hooks[name] = fn; },
    registerCommand: (definition) => { command = definition; },
  });
  assert.deepEqual(Object.keys(hooks), ["before_tool_call"]);
  const hook = hooks.before_tool_call;
  await (await hook(CREATE)).requireApproval.onResolution("allow-always");
  assert.equal(await hook(CREATE), undefined);
  await command.handler();
  assert.ok((await hook(CREATE)).requireApproval);
});
