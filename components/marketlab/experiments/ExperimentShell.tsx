"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Download, RotateCcw, Save } from "lucide-react";
import {
  Badge, Button, Callout, Card, CardBody, CardHeader, Disclosure, Formula, Modal, Input, Select, cx,
} from "@/components/marketlab/ui/primitives";
import type { ExperimentMeta } from "@/lib/marketlab/experiments";
import { runToMarkdown, type SavedRun } from "@/lib/marketlab/research";
import { download, slugifyFilename, useHydrated, useLab } from "@/lib/marketlab/store";
import { useLabContext } from "@/components/marketlab/assistant/LabAssistant";

/**
 * The frame every experiment is presented in.
 *
 * It exists to make one thing impossible: publishing a result without the
 * question it answers and the limitations it carries. The research question,
 * the objective, the formulae actually evaluated and the list of what the
 * model cannot show are all structural parts of the page, not optional extras
 * a busy author might leave out.
 */
export interface ExperimentShellProps {
  meta: ExperimentMeta;
  /** Everything needed to reproduce the run. Saved verbatim. */
  inputs: Record<string, number | string | boolean>;
  /** The headline figures, already formatted. Also what the assistant sees. */
  outputs: Array<{ label: string; value: string }>;
  onReset: () => void;
  controls: React.ReactNode;
  chart: React.ReactNode;
  results: React.ReactNode;
  /** Prose that reads the numbers back and says what they mean. */
  interpretation: React.ReactNode;
  /** Anything extra below the fold — scenario tables, comparisons. */
  extra?: React.ReactNode;
}

export function ExperimentShell({
  meta, inputs, outputs, onReset, controls, chart, results, interpretation, extra,
}: ExperimentShellProps) {
  const hydrated = useHydrated();
  const saveRun = useLab((s) => s.saveRun);
  const projects = useLab((s) => s.projects);
  const attachRun = useLab((s) => s.attachRun);

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<SavedRun | null>(null);
  const [label, setLabel] = React.useState("");
  const [note, setNote] = React.useState("");
  const [projectId, setProjectId] = React.useState<string>("");

  useLabContext({
    surface: "experiment",
    experiment: meta.slug,
    inputs: Object.entries(inputs).map(([k, v]) => ({ label: k, value: String(v) })),
    outputs,
  });

  const defaultLabel = () => {
    const stamp = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return `${meta.title} — ${stamp}`;
  };

  const commit = () => {
    const run = saveRun({
      experiment: meta.slug,
      label: label.trim() || defaultLabel(),
      inputs,
      outputs,
      note: note.trim() || undefined,
    });
    if (projectId) attachRun(projectId, run.id);
    setSaved(run);
    setSaving(false);
    setLabel("");
    setNote("");
    setTimeout(() => setSaved(null), 4000);
  };

  const exportMarkdown = () => {
    const run: SavedRun = {
      id: "preview", experiment: meta.slug, label: defaultLabel(),
      createdAt: Date.now(), inputs, outputs,
    };
    const body = [
      `# ${meta.title}`, "",
      `**Research question.** ${meta.question}`, "",
      `**Objective.** ${meta.objective}`, "",
      runToMarkdown(run),
      "## Limitations of this model", "",
      ...meta.limitations.map((l) => `- ${l}`),
      "",
      "_Exported from MarketLab. These figures are produced by a simplified teaching model from the inputs above. "
      + "They describe the model, not any real market._", "",
    ].join("\n");
    download(`${slugifyFilename(meta.title)}-run.md`, body, "text/markdown;charset=utf-8");
  };

  const exportCsv = () => {
    const rows = [
      `# ${meta.title} — MarketLab model run`,
      `# Research question: ${meta.question.replace(/\n/g, " ")}`,
      "# These are model results computed from the inputs below, not observations of a real market.",
      "section,name,value",
      ...Object.entries(inputs).map(([k, v]) => `input,"${k}","${String(v).replace(/"/g, '""')}"`),
      ...outputs.map((o) => `result,"${o.label}","${o.value.replace(/"/g, '""')}"`),
    ];
    download(`${slugifyFilename(meta.title)}-run.csv`, rows.join("\n"), "text/csv;charset=utf-8");
  };

  return (
    <div className="space-y-6">
      {/* ---- Header -------------------------------------------------- */}
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/experiments" className="ml-small text-ml-text-3 hover:text-ml-accent">Experiments</Link>
          <span aria-hidden className="text-ml-text-4">/</span>
          <Badge tone="neutral">{meta.difficulty}</Badge>
          <Badge tone="neutral">{meta.minutes} min</Badge>
        </div>
        <h1 className="ml-h1 mt-2 text-ml-text">{meta.title}</h1>
        <p className="ml-body-lg ml-prose mt-2 text-ml-text-2">{meta.summary}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-ml-md border border-ml-border bg-ml-surface px-4 py-3">
            <p className="ml-label text-ml-text-4">Research question</p>
            <p className="ml-body mt-1 text-ml-text">{meta.question}</p>
          </div>
          <div className="rounded-ml-md border border-ml-border bg-ml-surface px-4 py-3">
            <p className="ml-label text-ml-text-4">Objective</p>
            <p className="ml-body mt-1 text-ml-text-2">{meta.objective}</p>
          </div>
        </div>
      </header>

      {/* ---- The bench ----------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader
            title="Variables"
            description="Change any of these and every result updates immediately."
            actions={
              <Button size="sm" variant="ghost" onClick={onReset} aria-label="Reset all variables">
                <RotateCcw size={14} /> Reset
              </Button>
            }
          />
          <CardBody className="space-y-5">{controls}</CardBody>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardBody>{chart}</CardBody>
          </Card>

          <section aria-label="Results">{results}</section>

          <Card>
            <CardHeader title="What the results mean" />
            <CardBody className="ml-body ml-rich space-y-3 text-ml-text-2">{interpretation}</CardBody>
          </Card>

          {extra}
        </div>
      </div>

      {/* ---- Save / export ------------------------------------------- */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="ml-h3 text-ml-text">Keep this run</p>
            <p className="ml-small mt-0.5 text-ml-text-3">
              Saved runs keep every input, so a result in your write-up can be reproduced exactly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportCsv}><Download size={15} /> CSV</Button>
            <Button variant="secondary" onClick={exportMarkdown}><Download size={15} /> Markdown</Button>
            <Button variant="primary" onClick={() => { setLabel(defaultLabel()); setSaving(true); }} disabled={!hydrated}>
              {saved ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save run</>}
            </Button>
          </div>
        </CardBody>
        {saved ? (
          <div className="border-t border-ml-border px-5 py-3">
            <p className="ml-small text-ml-positive">
              Saved as “{saved.label}”. It is in <Link href="/research" className="underline">Research</Link>.
            </p>
          </div>
        ) : null}
      </Card>

      {/* ---- The theory, the maths, the caveats ---------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="The concept" description="What this experiment is a model of." />
          <CardBody className="ml-body ml-prose text-ml-text-2">{meta.concept}</CardBody>
        </Card>
        <Card>
          <CardHeader title="The formulae" description="Exactly what MarketLab evaluates. Check the app against these." />
          <CardBody className="space-y-4">
            {meta.formulae.map((f) => <Formula key={f.label} {...f} />)}
          </CardBody>
        </Card>
      </div>

      <Callout tone="warning" title="What this model cannot tell you">
        <ul>
          {meta.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
        <p className="mt-2">
          Every figure on this page is a <strong>model result</strong>. It follows from the assumptions above and from the
          numbers you entered. It is not evidence about any real market, and a research write-up should say so.
        </p>
      </Callout>

      <Disclosure summary="Syllabus areas this covers">
        <div className="flex flex-wrap gap-2">
          {meta.topics.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
        </div>
      </Disclosure>

      {/* ---- Save dialog --------------------------------------------- */}
      <Modal
        open={saving}
        onClose={() => setSaving(false)}
        title="Save this run"
        description="It keeps the inputs and the results as they are right now."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSaving(false)}>Cancel</Button>
            <Button variant="primary" onClick={commit}>Save run</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="run-label" className="ml-label block text-ml-text-3">Name</label>
            <Input id="run-label" value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="run-note" className="ml-label block text-ml-text-3">Why this run? (optional)</label>
            <Input id="run-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5"
              placeholder="e.g. testing whether the revenue rule holds at PED = −0.8" />
          </div>
          <div>
            <label htmlFor="run-project" className="ml-label block text-ml-text-3">Attach to a research project</label>
            <Select id="run-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1.5">
              <option value="">Don&apos;t attach</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
            {projects.length === 0 ? (
              <p className="ml-small mt-1.5 text-ml-text-4">
                You have no projects yet. <Link href="/research" className="text-ml-accent underline">Start one</Link> and
                runs can be attached to it.
              </p>
            ) : null}
          </div>
          <div className="rounded-ml-md border border-ml-border bg-ml-inset px-3 py-2.5">
            <p className="ml-label text-ml-text-4">What gets saved</p>
            <dl className="mt-1.5 space-y-0.5">
              {outputs.slice(0, 4).map((o) => (
                <div key={o.label} className="ml-small flex justify-between gap-3">
                  <dt className="text-ml-text-3">{o.label}</dt>
                  <dd className="ml-num font-medium text-ml-text">{o.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** A small strip of result cards. Used by every experiment for consistency. */
export function ResultGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}
