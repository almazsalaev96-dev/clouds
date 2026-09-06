"use client";

/**
 * Course navigator and breadcrumbs.
 *
 * Lodestar leads with what you should do next, and that stays the thesis. But a
 * student also needs to look things up — open the syllabus, find a topic, read
 * it — without the system having an opinion about it. Everything reachable by
 * recommendation is reachable by browsing too.
 *
 * The tree is a syllabus, not a menu, so it shows what a syllabus knows: how
 * much material each topic holds, and where the student stands on it. Mastery
 * is a dot rather than a bar because at this size a bar reads as decoration and
 * the tree has to stay scannable.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { childTopics, rootTopics, type Syllabus, type Topic } from "@/domain/curriculum";
import { retentionState } from "@/domain/mastery";
import type { SubjectView } from "@/view/derive";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {trail.map((c, i) => (
        <span key={`${c.label}-${i}`} style={{ display: "contents" }}>
          {i > 0 && <span className="sep" aria-hidden="true">›</span>}
          {c.href && i < trail.length - 1 ? (
            <Link href={c.href}>{c.label}</Link>
          ) : (
            <span aria-current={i === trail.length - 1 ? "page" : undefined}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Trail for any topic, walking up through its ancestors. */
export function topicTrail(syllabus: Syllabus, topic: Topic): Crumb[] {
  const chain: Topic[] = [];
  let current: Topic | undefined = topic;
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    chain.unshift(current);
    current = current.parentId ? syllabus.topics.find((t) => t.id === current!.parentId) : undefined;
  }
  return [
    { label: "Subjects", href: "/subjects" },
    { label: syllabus.subject, href: `/subjects/${syllabus.id}` },
    ...chain.map((t) => ({ label: t.title, href: `/topics/${encodeURIComponent(t.id)}` })),
  ];
}

export function CourseNavigator({
  view,
  activeTopicId,
}: {
  view: SubjectView;
  activeTopicId?: string;
}) {
  const sections = rootTopics(view.syllabus).filter(
    (t) => !(view.enrolment.stage === "as" && t.stage === "a2"),
  );

  // Open the section containing whatever is being read, and the first section
  // otherwise, so the navigator never opens fully collapsed.
  const activeAncestors = new Set<string>();
  if (activeTopicId) {
    let cur = view.syllabus.topics.find((t) => t.id === activeTopicId);
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      activeAncestors.add(cur.id);
      cur = cur.parentId ? view.syllabus.topics.find((t) => t.id === cur!.parentId) : undefined;
    }
  }

  return (
    <aside className="navigator" aria-label="Course contents">
      <div className="nav-head">
        <div className="row between">
          <span className="eyebrow">Course contents</span>
          <span className="tiny muted num">{view.syllabus.code}</span>
        </div>
        <Link
          href={`/subjects/${view.syllabus.id}`}
          style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600, fontSize: "0.92rem" }}
        >
          {view.syllabus.subject}
        </Link>
      </div>

      {sections.map((section, i) => {
        const children = childTopics(view.syllabus, section.id).filter(
          (t) => !(view.enrolment.stage === "as" && t.stage === "a2"),
        );
        const mastery = view.topicMastery.get(section.id);
        const open = activeAncestors.has(section.id) || (!activeTopicId && i === 0);

        return (
          <details className="tree-section" key={section.id} open={open}>
            <summary>
              <span className="tree-code">{section.code}</span>
              <span className="tree-title" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {section.title}
              </span>
              <span className="tree-meter meter" title={`${Math.round((mastery?.score ?? 0) * 100)}% mastery`}>
                <span
                  className="meter-fill"
                  style={{ width: `${Math.max(2, (mastery?.score ?? 0) * 100)}%` }}
                />
              </span>
            </summary>

            {(children.length ? children : [section]).map((topic) => {
              const m = view.topicMastery.get(topic.id);
              const retention = view.topicRetention.get(topic.id) ?? 0;
              const count = view.questions.filter((q) => q.topicIds.includes(topic.id)).length;
              const state = !m || m.observations === 0 ? "untested" : retentionState(retention);
              return (
                <Link
                  key={topic.id}
                  href={`/topics/${encodeURIComponent(topic.id)}`}
                  className="tree-item"
                  aria-current={topic.id === activeTopicId ? "page" : undefined}
                >
                  <span
                    className="tick"
                    data-state={state}
                    title={
                      state === "untested"
                        ? "Not yet tested"
                        : `${Math.round((m?.score ?? 0) * 100)}% mastery · recall ${Math.round(retention * 100)}%`
                    }
                  />
                  <span className="tree-title">{topic.title}</span>
                  <span className="tree-count">{count || "—"}</span>
                </Link>
              );
            })}
          </details>
        );
      })}

      <div style={{ padding: "10px 10px 6px", borderTop: "1px solid var(--rule)", marginTop: 4 }}>
        <p className="tiny muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Dots show recall, not completion. Hollow means untested; the number is how many questions
          the pack holds for that topic.
        </p>
      </div>
    </aside>
  );
}

/** Page shell that pairs the navigator with content. */
export function WithNavigator({
  view,
  activeTopicId,
  children,
}: {
  view: SubjectView;
  activeTopicId?: string;
  children: ReactNode;
}) {
  return (
    <div className="with-nav">
      <CourseNavigator view={view} activeTopicId={activeTopicId} />
      <div className="stack loose" style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * The four things you can do with a topic, given equal weight — the browse-side
 * counterpart to a recommendation. Counts come from the pack, so a material
 * with nothing behind it says so rather than opening an empty page.
 */
export function MaterialTabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: { id: T; name: string; meta: string; disabled?: boolean }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="materials" role="tablist" aria-label="Study materials">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          className="material"
          aria-selected={active === item.id}
          disabled={item.disabled}
          style={item.disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          onClick={() => !item.disabled && onChange(item.id)}
        >
          <span className="material-name">{item.name}</span>
          <span className="material-meta">{item.meta}</span>
        </button>
      ))}
    </div>
  );
}

/** Difficulty as five ordinal ticks. */
export function Difficulty({ value }: { value: number }) {
  const filled = Math.max(1, Math.min(5, Math.round(value * 5)));
  return (
    <span className="diff" title={`Difficulty ${filled} of 5`} aria-label={`Difficulty ${filled} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} data-on={n <= filled} />
      ))}
    </span>
  );
}
