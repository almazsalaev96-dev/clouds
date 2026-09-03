/**
 * Artifacts (§16).
 *
 * An artifact is an editable object, not a rendered card. That distinction is
 * what makes the conversation ↔ work loop in §15 possible: "make slide 4
 * simpler" has to address slide 4 specifically, which means the AI must be
 * able to patch one block without regenerating the whole document and
 * discarding the user's own edits.
 *
 * Hence a block list with stable ids, and patch operations rather than
 * wholesale replacement.
 */

import type { Artifact, ArtifactBlock, ArtifactKind, Id, Result } from "../types/index.ts";
import { fail, ok } from "../types/index.ts";
import { newId, type Store } from "../store/index.ts";

export interface CreateArtifactInput {
  workspaceId: Id;
  projectId?: Id | null;
  conversationId?: Id | null;
  kind: ArtifactKind;
  title: string;
  blocks: Array<Omit<ArtifactBlock, "id"> & { id?: Id }>;
  sourceDocumentIds?: Id[];
}

export function createArtifact(
  store: Store,
  userId: Id,
  input: CreateArtifactInput,
): Result<Artifact> {
  if (!input.title?.trim()) {
    return fail("invalid_input", "An artifact needs a title.");
  }
  if (!input.blocks?.length) {
    return fail("invalid_input", "An artifact needs at least one block of content.");
  }

  const artifact = store.artifacts.insert(userId, {
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    conversationId: input.conversationId ?? null,
    kind: input.kind,
    title: input.title.trim(),
    blocks: input.blocks.map((b) => ({ ...b, id: b.id ?? newId() })),
    sourceDocumentIds: input.sourceDocumentIds ?? [],
    version: 1,
  } as never);

  // Provenance: an artifact knows what it was made from (§14).
  for (const documentId of artifact.sourceDocumentIds) {
    store.edges.insert(userId, {
      fromType: "artifact", fromId: artifact.id,
      toType: "document", toId: documentId,
      kind: "derived_from", weight: 1,
      provenance: "artifact generated from this document",
    } as never);
  }
  if (artifact.conversationId) {
    store.edges.insert(userId, {
      fromType: "artifact", fromId: artifact.id,
      toType: "conversation", toId: artifact.conversationId,
      kind: "derived_from", weight: 1,
      provenance: "artifact created during this conversation",
    } as never);
  }

  return ok(artifact);
}

export type ArtifactPatch =
  | { op: "setTitle"; title: string }
  | { op: "replaceBlock"; blockId: Id; text: string; answer?: string; options?: string[] }
  | { op: "insertBlock"; afterBlockId: Id | null; block: Omit<ArtifactBlock, "id"> }
  | { op: "deleteBlock"; blockId: Id }
  | { op: "moveBlock"; blockId: Id; toIndex: number };

/**
 * Applies patches atomically: either every operation lands or none does, so a
 * bad reference in the middle of a model-generated edit cannot leave the
 * artifact half-modified.
 */
export function patchArtifact(
  store: Store,
  userId: Id,
  artifactId: Id,
  patches: ArtifactPatch[],
): Result<Artifact> {
  const artifact = store.artifacts.get(userId, artifactId);
  if (!artifact) return fail("not_found", "That artifact no longer exists.");
  if (patches.length === 0) return ok(artifact);

  let blocks = [...artifact.blocks];
  let title = artifact.title;

  for (const patch of patches) {
    switch (patch.op) {
      case "setTitle": {
        if (!patch.title.trim()) return fail("invalid_input", "An artifact needs a title.");
        title = patch.title.trim();
        break;
      }
      case "replaceBlock": {
        const index = blocks.findIndex((b) => b.id === patch.blockId);
        if (index === -1) {
          return fail("not_found", "That part of the artifact no longer exists — it may have been edited.");
        }
        blocks[index] = {
          ...blocks[index],
          text: patch.text,
          ...(patch.answer !== undefined ? { answer: patch.answer } : {}),
          ...(patch.options !== undefined ? { options: patch.options } : {}),
        };
        break;
      }
      case "insertBlock": {
        const block = { ...patch.block, id: newId() };
        if (patch.afterBlockId === null) {
          blocks.unshift(block);
          break;
        }
        const index = blocks.findIndex((b) => b.id === patch.afterBlockId);
        if (index === -1) return fail("not_found", "Could not find where to insert that content.");
        blocks.splice(index + 1, 0, block);
        break;
      }
      case "deleteBlock": {
        const next = blocks.filter((b) => b.id !== patch.blockId);
        if (next.length === blocks.length) {
          return fail("not_found", "That part of the artifact no longer exists.");
        }
        if (next.length === 0) {
          return fail("invalid_input", "An artifact cannot be left with no content.");
        }
        blocks = next;
        break;
      }
      case "moveBlock": {
        const index = blocks.findIndex((b) => b.id === patch.blockId);
        if (index === -1) return fail("not_found", "That part of the artifact no longer exists.");
        const target = Math.max(0, Math.min(blocks.length - 1, patch.toIndex));
        const [moved] = blocks.splice(index, 1);
        blocks.splice(target, 0, moved);
        break;
      }
    }
  }

  const updated = store.artifacts.update(userId, artifactId, {
    blocks, title, version: artifact.version + 1,
  } as never);
  return updated ? ok(updated) : fail("not_found", "That artifact no longer exists.");
}

/** Renders an artifact as Markdown for display, export, or model context. */
export function renderArtifact(artifact: Artifact): string {
  const lines: string[] = [`# ${artifact.title}`, ""];
  for (const block of artifact.blocks) {
    switch (block.kind) {
      case "heading": lines.push(`## ${block.text}`, ""); break;
      case "listItem": lines.push(`- ${block.text}`); break;
      case "quote": lines.push(`> ${block.text}`, ""); break;
      case "code": lines.push("```", block.text, "```", ""); break;
      case "quizQuestion":
        lines.push(`**${block.text}**`);
        for (const [i, option] of (block.options ?? []).entries()) {
          lines.push(`  ${String.fromCharCode(97 + i)}) ${option}`);
        }
        lines.push("");
        break;
      case "flashcard": lines.push(`**${block.text}** → ${block.answer ?? ""}`, ""); break;
      default: lines.push(block.text, "");
    }
  }
  return lines.join("\n").trim();
}
