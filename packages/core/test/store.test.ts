import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store/index.ts";

const USER_A = "user-a";
const USER_B = "user-b";

test("insert assigns id, userId and timestamps", () => {
  const store = createStore();
  const doc = store.documents.insert(USER_A, {
    workspaceId: "w1", projectId: null, title: "Chapter 1", sourceKind: "paste",
    text: "hello", mimeType: "text/plain", blockCount: 0, ingestState: "ready",
  } as never);
  assert.ok(doc.id);
  assert.equal(doc.userId, USER_A);
  assert.ok(doc.createdAt > 0);
  assert.equal(doc.updatedAt, doc.createdAt);
});

test("a user cannot read another user's rows", () => {
  const store = createStore();
  const a = store.documents.insert(USER_A, {
    workspaceId: "w1", projectId: null, title: "Private", sourceKind: "paste",
    text: "secret", mimeType: "text/plain", blockCount: 0, ingestState: "ready",
  } as never);

  assert.equal(store.documents.get(USER_B, a.id), undefined);
  assert.deepEqual(store.documents.list(USER_B), []);
  assert.equal(store.documents.update(USER_B, a.id, { title: "hijacked" } as never), undefined);
  assert.equal(store.documents.delete(USER_B, a.id), false);
  // Still intact and unmodified for the owner.
  assert.equal(store.documents.get(USER_A, a.id)?.title, "Private");
});

test("update cannot rewrite id, userId or createdAt", () => {
  const store = createStore();
  const doc = store.documents.insert(USER_A, {
    workspaceId: "w1", projectId: null, title: "T", sourceKind: "paste",
    text: "", mimeType: "text/plain", blockCount: 0, ingestState: "ready",
  } as never);
  const patched = store.documents.update(USER_A, doc.id, {
    title: "New", userId: USER_B, createdAt: 0, id: "evil",
  } as never)!;
  assert.equal(patched.id, doc.id);
  assert.equal(patched.userId, USER_A);
  assert.equal(patched.createdAt, doc.createdAt);
  assert.equal(patched.title, "New");
});

test("list supports where, filter, sort and limit", () => {
  const store = createStore();
  for (const [title, kind] of [["A", "paste"], ["B", "upload"], ["C", "upload"]] as const) {
    store.documents.insert(USER_A, {
      workspaceId: "w1", projectId: null, title, sourceKind: kind,
      text: "", mimeType: "text/plain", blockCount: 0, ingestState: "ready",
    } as never);
  }
  assert.equal(store.documents.list(USER_A, { where: { sourceKind: "upload" } as never }).length, 2);
  assert.equal(store.documents.count(USER_A), 3);
  const sorted = store.documents.list(USER_A, {
    sort: (a, b) => a.title.localeCompare(b.title), limit: 2,
  });
  assert.deepEqual(sorted.map((d) => d.title), ["A", "B"]);
});

test("deleteUser removes everything for that user and nothing for others", () => {
  const store = createStore();
  for (const user of [USER_A, USER_B]) {
    store.documents.insert(user, {
      workspaceId: "w1", projectId: null, title: "d", sourceKind: "paste",
      text: "", mimeType: "text/plain", blockCount: 0, ingestState: "ready",
    } as never);
    store.memories.insert(user, {
      kind: "goal", text: "m",
      provenance: { messageId: null, conversationId: null, quote: "" },
      useCount: 0, lastUsedAt: null, pinned: false,
    } as never);
  }
  store.deleteUser(USER_A);
  assert.equal(store.documents.count(USER_A), 0);
  assert.equal(store.memories.count(USER_A), 0);
  assert.equal(store.documents.count(USER_B), 1);
  assert.equal(store.memories.count(USER_B), 1);
});

test("snapshot and restore round-trip preserving user partitions", () => {
  const store = createStore();
  store.documents.insert(USER_A, {
    workspaceId: "w1", projectId: null, title: "Kept", sourceKind: "paste",
    text: "body", mimeType: "text/plain", blockCount: 0, ingestState: "ready",
  } as never);
  store.documents.insert(USER_B, {
    workspaceId: "w2", projectId: null, title: "Other", sourceKind: "paste",
    text: "body", mimeType: "text/plain", blockCount: 0, ingestState: "ready",
  } as never);

  const restored = createStore();
  restored.restore(store.snapshot());

  assert.equal(restored.documents.list(USER_A).length, 1);
  assert.equal(restored.documents.list(USER_A)[0].title, "Kept");
  assert.equal(restored.documents.list(USER_B).length, 1);
  assert.equal(restored.documents.list(USER_B)[0].title, "Other");
});

test("onChange fires for mutations", () => {
  let changes = 0;
  const store = createStore({ onChange: () => changes++ });
  const d = store.documents.insert(USER_A, {
    workspaceId: "w1", projectId: null, title: "x", sourceKind: "paste",
    text: "", mimeType: "text/plain", blockCount: 0, ingestState: "ready",
  } as never);
  assert.equal(changes, 1);
  store.documents.update(USER_A, d.id, { title: "y" } as never);
  assert.equal(changes, 2);
  store.documents.delete(USER_A, d.id);
  assert.equal(changes, 3);
  store.documents.delete(USER_A, d.id); // no-op, must not notify
  assert.equal(changes, 3);
});
