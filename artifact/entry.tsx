/**
 * Single-file build entry.
 *
 * The Next application is server-rendered and file-routed; this compiles the
 * same components into one self-contained page with a hash router, so the
 * product can be opened and used without running anything. It is the identical
 * component tree and the identical engines — only routing and content delivery
 * differ, and the content bundle is compiled in rather than read from disk.
 *
 * AI features are absent here because there is no server to hold a key. The UI
 * already treats that as a first-class state, so the tutor explains itself and
 * every deterministic engine runs untouched.
 */

import { createRoot } from "react-dom/client";
import { StrictMode, type ReactElement } from "react";
import { usePathname } from "next/navigation";

import { AppFrame } from "@/ui/shell";
import type { ContentBundle } from "@/content/bundle";

import HomePage from "@app/page";
import PracticePage from "@app/practice/page";
import ReviewPage from "@app/review/page";
import MistakesPage from "@app/mistakes/page";
import SubjectsPage from "@app/subjects/page";
import ReadinessPage from "@app/readiness/page";
import ProgressPage from "@app/progress/page";
import PlanPage from "@app/plan/page";
import TechniquePage from "@app/technique/page";
import TutorPage from "@app/tutor/page";
import NotesPage from "@app/notes/page";
import GlossaryPage from "@app/glossary/page";
import SettingsPage from "@app/settings/page";
import MockPage from "@app/mock/page";
import SessionPage from "@app/session/page";

import { SubjectPage } from "@/ui/subject";
import { TopicPage } from "@/ui/topic";
import LibraryClient from "./library-client";

declare const __CONTENT__: ContentBundle;

const STATIC_ROUTES: Record<string, () => ReactElement> = {
  "/": HomePage,
  "/practice": PracticePage,
  "/review": ReviewPage,
  "/mistakes": MistakesPage,
  "/subjects": SubjectsPage,
  "/readiness": ReadinessPage,
  "/progress": ProgressPage,
  "/plan": PlanPage,
  "/technique": TechniquePage,
  "/tutor": TutorPage,
  "/notes": NotesPage,
  "/glossary": GlossaryPage,
  "/settings": SettingsPage,
  "/mock": MockPage,
  "/session": SessionPage,
  "/library": LibraryClient,
};

function Router() {
  const pathname = usePathname();

  const Static = STATIC_ROUTES[pathname];
  if (Static) return <Static />;

  // Dynamic segments: /subjects/:id and /topics/:id
  const topic = pathname.match(/^\/topics\/(.+)$/);
  if (topic) return <TopicPage topicId={decodeURIComponent(topic[1]!)} />;

  const subject = pathname.match(/^\/subjects\/(.+)$/);
  if (subject) return <SubjectPage syllabusId={decodeURIComponent(subject[1]!)} />;

  return (
    <div className="empty">
      <h3>Nothing here</h3>
      <p className="small">
        <a href="#/">Back to the command centre</a>
      </p>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <AppFrame bundle={__CONTENT__}>
        <Router />
      </AppFrame>
    </StrictMode>,
  );
}
