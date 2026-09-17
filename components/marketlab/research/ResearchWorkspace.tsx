"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, Download, FileText, Paperclip, Plus, Printer, Trash2,
} from "lucide-react";
import {
  Badge, Button, Callout, Card, CardBody, CardHeader, EmptyState, Field, Input, Modal,
  Select, Table, Td, Textarea, cx,
} from "@/components/marketlab/ui/primitives";
import {
  PROVENANCE_HELP, PROVENANCE_LABEL, SECTIONS, STAGES, isWritten, researchProgress, toMarkdown,
  type Provenance, type ResearchProject, type SectionId,
} from "@/lib/marketlab/research";
import { download, slugifyFilename, useHydrated, useLab } from "@/lib/marketlab/store";
import { useLabContext } from "@/components/marketlab/assistant/LabAssistant";
import { EXPERIMENTS } from "@/lib/marketlab/experiments";

const STARTERS = [
  "How does a change in price affect estimated revenue under different demand elasticities?",
  "How sensitive is a small business's break-even point to a change in its fixed costs?",
  "How does an assumed price sensitivity change the profit-maximising price in a competitive market?",
  "What does a binding price ceiling cost a market in lost transactions, and who bears it?",
];

export function ResearchWorkspace() {
  const hydrated = useHydrated();
  const projects = useLab((s) => s.projects);
  const activeId = useLab((s) => s.activeProjectId);
  const setActive = useLab((s) => s.setActiveProject);
  const create = useLab((s) => s.createProject);

  const active = projects.find((p) => p.id === activeId) ?? null;

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-52 animate-pulse rounded-ml-sm bg-ml-subtle" />
        <div className="h-48 animate-pulse rounded-ml-lg bg-ml-subtle" />
      </div>
    );
  }

  if (active) return <ProjectEditor project={active} onBack={() => setActive(null)} />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="ml-h1 text-ml-text">Research workspace</h1>
        <p className="ml-body-lg ml-prose mt-2 text-ml-text-2">
          A place to run an actual investigation: choose a question, commit to a hypothesis, attach the exact model runs
          your claims rest on, and write it up in the sections a piece of empirical economics needs.
        </p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((s, i) => (
          <li key={s.id} className="rounded-ml-md border border-ml-border bg-ml-surface px-4 py-3.5">
            <p className="ml-label text-ml-accent">Step {i + 1}</p>
            <p className="ml-h3 mt-1 text-ml-text">{s.label}</p>
            <p className="ml-small mt-1 text-ml-text-3">{s.blurb}</p>
          </li>
        ))}
      </ol>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title="No research projects yet"
          body="A project is a question plus everything you gather trying to answer it. Start from one of the questions below, or write your own."
          action={<Button variant="primary" onClick={() => create()}><Plus size={15} /> New project</Button>}
        />
      ) : (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="ml-h2 text-ml-text">Your projects</h2>
            <Button variant="primary" size="sm" onClick={() => create()}><Plus size={15} /> New project</Button>
          </div>
          <ul className="mt-4 space-y-3">
            {projects.map((p) => {
              const progress = researchProgress(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setActive(p.id)}
                    className="w-full rounded-ml-lg border border-ml-border bg-ml-surface px-5 py-4 text-left transition-colors hover:border-ml-border-strong hover:bg-ml-subtle"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="ml-h3 text-ml-text">{p.title}</p>
                        <p className="ml-small mt-0.5 line-clamp-2 text-ml-text-3">
                          {p.sections.question?.trim() || "No research question yet."}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="ml-num text-[0.875rem] font-semibold text-ml-text">
                          {progress.completed}/{progress.total}
                        </p>
                        <p className="ml-small text-ml-text-4">sections</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ml-subtle">
                      <div className="h-full rounded-full bg-ml-accent transition-[width]" style={{ width: `${progress.fraction * 100}%` }} />
                    </div>
                    <p className="ml-small mt-2 text-ml-text-4">
                      {p.attachments.length} run{p.attachments.length === 1 ? "" : "s"} attached · {p.notes.length} note
                      {p.notes.length === 1 ? "" : "s"} · edited {new Date(p.updatedAt).toLocaleDateString("en-GB")}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Card>
        <CardHeader title="Questions this app can actually help you answer" description="Each is narrow enough to investigate and has a model behind it." />
        <CardBody>
          <ul className="space-y-2">
            {STARTERS.map((q) => (
              <li key={q} className="flex items-start justify-between gap-3 rounded-ml-md border border-ml-border bg-ml-inset px-4 py-3">
                <p className="ml-body text-ml-text-2">{q}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    const project = create(q.length > 60 ? `${q.slice(0, 57)}…` : q);
                    useLab.getState().writeSection(project.id, "question", q);
                  }}
                >
                  Start
                </Button>
              </li>
            ))}
          </ul>
          <p className="ml-small mt-4 text-ml-text-3">
            Each of these is a question about a model. To say anything about a real market you would pair it with
            observations — prices you collected, a survey you ran, or published statistics with a source. That pairing is
            what makes it research rather than an exercise.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function ProjectEditor({ project, onBack }: { project: ResearchProject; onBack: () => void }) {
  const write = useLab((s) => s.writeSection);
  const update = useLab((s) => s.updateProject);
  const remove = useLab((s) => s.deleteProject);
  const runs = useLab((s) => s.runs);
  const attach = useLab((s) => s.attachRun);
  const detach = useLab((s) => s.detachRun);
  const addNote = useLab((s) => s.addNote);
  const deleteNote = useLab((s) => s.deleteNote);

  const [section, setSection] = React.useState<SectionId>("question");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [noteBody, setNoteBody] = React.useState("");
  const [noteKind, setNoteKind] = React.useState<Provenance>("model");
  const [exported, setExported] = React.useState(false);

  const progress = researchProgress(project);
  const spec = SECTIONS.find((s) => s.id === section)!;
  const attached = project.attachments.map((id) => runs.find((r) => r.id === id)).filter(Boolean) as typeof runs;

  useLabContext({
    surface: "research",
    projectTitle: project.title,
    projectQuestion: project.sections.question,
    hypothesis: project.sections.hypothesis,
  });

  const exportMarkdown = () => {
    download(`${slugifyFilename(project.title)}.md`, toMarkdown(project, attached), "text/markdown;charset=utf-8");
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="ml-no-print flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} /> All projects</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={14} /> Print / PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={exportMarkdown}>
            {exported ? <><Check size={14} /> Downloaded</> : <><Download size={14} /> Markdown</>}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</Button>
        </div>
      </div>

      <header>
        <input
          value={project.title}
          onChange={(e) => update(project.id, { title: e.target.value })}
          aria-label="Project title"
          className="ml-h1 w-full border-0 bg-transparent p-0 text-ml-text outline-none placeholder:text-ml-text-4 focus:ring-0"
          placeholder="Untitled research project"
        />
        <div className="ml-no-print mt-3 flex flex-wrap items-center gap-3">
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-ml-subtle">
            <div className="h-full rounded-full bg-ml-accent transition-[width]" style={{ width: `${progress.fraction * 100}%` }} />
          </div>
          <p className="ml-small text-ml-text-3">
            {progress.completed} of {progress.total} sections written
            {progress.next ? <> · next: <button type="button" className="text-ml-accent underline" onClick={() => setSection(progress.next!.id)}>{progress.next.label}</button></> : " · all sections have content"}
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        {/* Section rail */}
        <nav aria-label="Report sections" className="ml-no-print h-fit lg:sticky lg:top-6">
          <ul className="space-y-4">
            {STAGES.map((stage) => {
              const items = SECTIONS.filter((s) => s.stage === stage.id);
              if (items.length === 0) return null;
              return (
                <li key={stage.id}>
                  <p className="ml-label px-2 pb-1.5 text-ml-text-4">{stage.label}</p>
                  <ul className="space-y-0.5">
                    {items.map((s) => {
                      const written = isWritten(project.sections[s.id]);
                      const current = s.id === section;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => setSection(s.id)}
                            aria-current={current ? "true" : undefined}
                            className={cx(
                              "flex w-full items-center gap-2 rounded-ml-sm px-2.5 py-1.5 text-left text-[0.875rem] transition-colors",
                              current ? "bg-ml-accent-subtle font-medium text-ml-accent" : "text-ml-text-2 hover:bg-ml-subtle",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cx(
                                "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[0.5625rem]",
                                written ? "border-ml-positive bg-ml-positive text-white" : "border-ml-border-strong text-transparent",
                              )}
                            >
                              ✓
                            </span>
                            <span className="min-w-0 truncate">{s.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Editor */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title={spec.label}
              description={spec.guide}
              actions={<Badge tone={isWritten(project.sections[section]) ? "positive" : "neutral"}>{spec.hint}</Badge>}
            />
            <CardBody className="space-y-4">
              <Textarea
                key={section}
                rows={14}
                value={project.sections[section] ?? ""}
                onChange={(e) => write(project.id, section, e.target.value)}
                placeholder={`Write your ${spec.label.toLowerCase()} here. Saved as you type.`}
                aria-label={spec.label}
              />
              <div className="rounded-ml-md border border-ml-border bg-ml-inset px-4 py-3">
                <p className="ml-label text-ml-text-4">Before you move on</p>
                <ul className="ml-body ml-rich mt-1.5 space-y-1 text-ml-text-2">
                  {spec.prompts.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
              <p className="ml-small text-ml-text-4">
                {countWords(project.sections[section])} words · saved in this browser
              </p>
            </CardBody>
          </Card>

          {section === "experiments" ? (
            <Card>
              <CardHeader
                title="Attached model runs"
                description="A claim in your results should be traceable to one of these. Each run keeps every input, so it can be reproduced exactly."
              />
              <CardBody className="space-y-4">
                {attached.length === 0 ? (
                  <p className="ml-body text-ml-text-3">
                    Nothing attached yet. Run an{" "}
                    <Link href="/experiments" className="text-ml-accent underline">experiment</Link>, press{" "}
                    <strong>Save run</strong>, and it will be selectable here.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {attached.map((run) => (
                      <li key={run.id} className="rounded-ml-md border border-ml-border px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="ml-h3 text-ml-text">{run.label}</p>
                            <p className="ml-small mt-0.5 text-ml-text-4">
                              {EXPERIMENTS.find((e) => e.slug === run.experiment)?.title ?? run.experiment} ·{" "}
                              {new Date(run.createdAt).toLocaleString("en-GB")}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" className="ml-no-print" onClick={() => detach(project.id, run.id)}>
                            Detach
                          </Button>
                        </div>
                        {run.note ? <p className="ml-small mt-2 text-ml-text-2">{run.note}</p> : null}
                        <div className="mt-3">
                          <Table head={["Result", "Value"]}>
                            {run.outputs.map((o) => (
                              <tr key={o.label}>
                                <Td>{o.label}</Td>
                                <Td numeric>{o.value}</Td>
                              </tr>
                            ))}
                          </Table>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {runs.length > 0 ? (
                  <Field label="Attach a saved run" htmlFor="attach-run">
                    <Select
                      id="attach-run"
                      value=""
                      onChange={(e) => { if (e.target.value) attach(project.id, e.target.value); }}
                    >
                      <option value="">Choose a run…</option>
                      {runs.filter((r) => !project.attachments.includes(r.id)).map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {/* Notes */}
          <Card>
            <CardHeader
              title="Research notes"
              description="Every note is labelled with where it came from, and the label survives into the export."
              actions={<Badge tone="neutral"><Paperclip size={11} /> {project.notes.length}</Badge>}
            />
            <CardBody className="space-y-4">
              <form
                className="ml-no-print space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!noteBody.trim()) return;
                  addNote(project.id, noteBody, noteKind);
                  setNoteBody("");
                }}
              >
                <Textarea
                  rows={3}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Something you noticed, a number you want to keep, a question to come back to…"
                  aria-label="New note"
                />
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="What kind of thing is this?" htmlFor="note-kind" className="flex-1" hint={PROVENANCE_HELP[noteKind]}>
                    <Select id="note-kind" value={noteKind} onChange={(e) => setNoteKind(e.target.value as Provenance)}>
                      {(Object.keys(PROVENANCE_LABEL) as Provenance[]).map((k) => (
                        <option key={k} value={k}>{PROVENANCE_LABEL[k]}</option>
                      ))}
                    </Select>
                  </Field>
                  <Button type="submit" variant="primary" disabled={!noteBody.trim()}><Plus size={15} /> Add note</Button>
                </div>
              </form>

              {project.notes.length > 0 ? (
                <ul className="space-y-2 border-t border-ml-border pt-4">
                  {project.notes.map((n) => (
                    <li key={n.id} className="flex items-start justify-between gap-3 rounded-ml-md border border-ml-border px-3.5 py-2.5">
                      <div className="min-w-0">
                        <Badge tone={n.provenance === "observed" ? "positive" : n.provenance === "model" ? "accent" : "warning"}>
                          {PROVENANCE_LABEL[n.provenance]}
                        </Badge>
                        <p className="ml-body mt-1.5 whitespace-pre-wrap text-ml-text-2">{n.body}</p>
                        <p className="ml-small mt-1 text-ml-text-4">{new Date(n.createdAt).toLocaleString("en-GB")}</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Delete note"
                        className="ml-no-print shrink-0 rounded-ml-xs p-1.5 text-ml-text-4 hover:bg-ml-negative-subtle hover:text-ml-negative"
                        onClick={() => deleteNote(project.id, n.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardBody>
          </Card>

          <Callout tone="neutral" title="How MarketLab keeps the three kinds of number apart">
            <ul>
              <li><strong>Model result</strong> — produced by a MarketLab model from parameters you set. True of the model, not of any market.</li>
              <li><strong>Real-world observation</strong> — measured or published data, with a source you can cite.</li>
              <li><strong>User-entered data</strong> — an assumption, an estimate or a plan that you supplied.</li>
            </ul>
            <p className="mt-2">
              A conclusion that treats the first as though it were the second is the most common way a good investigation
              goes wrong. The export preserves these labels so a reader can check which is which.
            </p>
          </Callout>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this project?"
        description="This removes the project and its notes from this browser. It cannot be undone, and there is no copy anywhere else."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
            <Button variant="danger" onClick={() => { remove(project.id); onBack(); }}>Delete permanently</Button>
          </div>
        }
      >
        <p className="ml-body text-ml-text-2">
          Export it first if there is anything you want to keep — the Markdown export contains everything you have
          written, including the attached runs.
        </p>
        <div className="mt-4">
          <Button variant="secondary" onClick={exportMarkdown}><Download size={15} /> Export first</Button>
        </div>
      </Modal>
    </div>
  );
}

function countWords(text: string | undefined): number {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length;
}
