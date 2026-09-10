import type { Project, ProjectFile, Style } from "./types";
import type { ModeSpec } from "./modes";
import { estimateTokens } from "./models";

/**
 * One place where everything the model is told before your first word gets
 * assembled, in a fixed order:
 *
 *   1. your own instructions — the standing ones, or this thread's
 *   2. the project — what it is for, then the material it holds
 *   3. the style — how the answer should be shaped
 *
 * Style goes last deliberately. It is the only layer that governs *form*, and
 * a "keep it short" that arrives before three pages of project knowledge is a
 * "keep it short" the model has stopped thinking about by the time it answers.
 *
 * Order also matters for cost. The layers above change rarely and the thread
 * changes every turn, so this whole block is a stable prefix — which is exactly
 * what the provider's cache is for, and why it is built the same way every time
 * rather than in whatever order the state happened to arrive in.
 */

/** Knowledge is capped so a project can never crowd out the conversation. */
export const KNOWLEDGE_BUDGET_TOKENS = 60_000;

export interface PromptParts {
  base?: string;
  project?: Project;
  files?: ProjectFile[];
  style?: Style;
  mode?: ModeSpec;
}

export interface ComposedPrompt {
  text: string;
  /** Files that did not fit, so the project page can say so rather than lie. */
  droppedFiles: ProjectFile[];
}

export function composeSystemPrompt(parts: PromptParts): ComposedPrompt {
  const sections: string[] = [];
  const droppedFiles: ProjectFile[] = [];

  const base = parts.base?.trim();
  if (base) sections.push(base);

  const project = parts.project;
  if (project) {
    const instructions = project.instructions.trim();
    if (instructions) {
      sections.push(`## Project: ${project.name}\n\n${instructions}`);
    }

    /* Knowledge is fitted whole-file at a time, in the order it was added.
       Half a file is worse than no file: the model reads the truncation as the
       end of the document and answers confidently about a spec that stops
       mid-sentence. */
    const files = parts.files ?? [];
    if (files.length) {
      const kept: ProjectFile[] = [];
      let spent = 0;
      for (const f of files) {
        const cost = estimateTokens(f.text) + 24;
        if (spent + cost > KNOWLEDGE_BUDGET_TOKENS) {
          droppedFiles.push(f);
          continue;
        }
        spent += cost;
        kept.push(f);
      }
      if (kept.length) {
        const body = kept
          .map((f) => `<document name="${escapeAttr(f.name)}">\n${f.text.trim()}\n</document>`)
          .join("\n\n");
        sections.push(
          `## Project knowledge\n\nMaterial for this project. Use it where it applies, ` +
            `and say so plainly when the answer is not in it rather than filling the gap.\n\n${body}`,
        );
      }
    }
  }

  const style = parts.style?.instructions.trim();
  if (style) sections.push(`## Response style\n\n${style}`);

  // Last of all. The mode is the narrowest instruction in the stack and the
  // one that should win a disagreement with anything above it.
  const mode = parts.mode?.instructions.trim();
  if (mode) sections.push(`## Mode: ${parts.mode?.label}\n\n${mode}`);

  return { text: sections.join("\n\n"), droppedFiles };
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
