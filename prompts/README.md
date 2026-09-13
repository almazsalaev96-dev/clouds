# Prompts

Prompts for building a multi-model AI chat application (OpenAI · Anthropic ·
Gemini · DeepSeek), competing purely on design and feel rather than features.

| File | Use it when |
|---|---|
| [`ARMIS_SPEC.md`](ARMIS_SPEC.md) | The brief **this repository** is measured against. Read it beside the README's [Known gaps](../README.md#known-gaps), which names the sections the code does not reach and why. |
| [`MASTER_PROMPT.md`](MASTER_PROMPT.md) | Building a multi-model chat app from nothing. Paste into a coding agent as the first message, then say "Start with Milestone 0." |
| [`SHORT_PROMPT.md`](SHORT_PROMPT.md) | The target has a paste-length limit. Same spine, less detail. |

The two are different documents about different scopes, and the difference is
worth knowing before you pick one. `MASTER_PROMPT.md` is a *construction* brief
for a multi-model chat application, and treats everything beyond "chat with a
model, beautifully" as out of scope. `ARMIS_SPEC.md` is the wider one this app
grew into — a universal AI workspace — and includes plenty that a browser tab
with no server cannot reach. Both are kept: one is how the thing was built, the
other is what it is now held to.

## Why it's written this way

Every chat app has the same feature list, so the master prompt treats features as
table stakes (§2) and spends its length on the things that actually differentiate:
design tokens, streaming psychology, code-block behavior, micro-interactions, and a
definition of done that an agent can audit itself against.

The two rules that matter most, and the two most often skipped:

- **Milestone 0 ships a static UI that already looks finished** — before a single
  API call works. If the shell doesn't beat ChatGPT on looks with zero features,
  no amount of features will fix it later.
- **Messages carry a `parentId` from day one.** The conversation is a tree rendered
  as a linear path. Edit and regenerate create siblings; nothing is destroyed.
  Retrofitting this is a rewrite.

## Adapting it

- Swap the `§4.1` color values for your own palette — everything else derives from
  tokens, so the rest of the spec still holds.
- Changing providers: edit `§1` and `§11`. The adapter layer is designed so a fifth
  provider is one new file.
- Do not delete `§18` (definition of done), `§20` (do not), or `§21` (how to work) —
  those three are what keep an agent from drifting into generic output.
