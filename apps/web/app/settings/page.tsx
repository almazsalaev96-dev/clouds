'use client';

import { useState } from 'react';
import { useStudy } from '@/lib/study';
import { saveFile, type SaveOutcome } from '@/lib/save-file';

export default function SettingsPage() {
  const study = useStudy();
  const { settings, update } = study;
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [exportState, setExportState] = useState<SaveOutcome | 'working' | null>(null);

  if (!study.ready) return <div className="empty">Loading…</div>;

  const examDateValue = settings.examAt
    ? new Date(settings.examAt).toISOString().slice(0, 10)
    : '';

  const download = async () => {
    setExportState('working');
    const outcome = await saveFile(
      `atlas-export-${new Date().toISOString().slice(0, 10)}.json`,
      study.exportJson(),
    );
    setExportState(outcome);
  };

  const setTheme = (theme: 'system' | 'light' | 'dark') => {
    void update({ theme });
    try {
      if (theme === 'system') {
        delete document.documentElement.dataset.theme;
        localStorage.removeItem('atlas-theme');
      } else {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('atlas-theme', theme);
      }
    } catch {
      /* a device that blocks storage still gets the change for this session */
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <p className="lede">
          Everything is stored on this device. Nothing is uploaded, and the export below
          is the complete record.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Scheduling</h2>
        </div>

        <label htmlFor="retention" style={{ display: 'block', fontSize: '0.9rem' }}>
          Target retention — {Math.round(settings.desiredRetention * 100)}%
        </label>
        <input
          id="retention"
          type="range"
          min={70}
          max={97}
          step={1}
          value={Math.round(settings.desiredRetention * 100)}
          onChange={(e) => void update({ desiredRetention: Number(e.target.value) / 100 })}
        />
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          The probability you want of recalling a card when it comes up. Higher means
          shorter intervals and more reviews; 90% is the calibrated default and there is
          rarely a good reason to go above 95%.
        </p>

        <div className="grid grid-2" style={{ marginTop: '1rem' }}>
          <div>
            <label htmlFor="session-limit" style={{ display: 'block', fontSize: '0.9rem' }}>
              Cards per session
            </label>
            <input
              id="session-limit"
              type="number"
              min={5}
              max={200}
              value={settings.sessionLimit}
              onChange={(e) => void update({ sessionLimit: Number(e.target.value) })}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="new-limit" style={{ display: 'block', fontSize: '0.9rem' }}>
              New cards per session
            </label>
            <input
              id="new-limit"
              type="number"
              min={0}
              max={50}
              value={settings.newCardLimit}
              onChange={(e) => void update({ newCardLimit: Number(e.target.value) })}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Exam</h2>
        </div>
        <label htmlFor="exam-date" style={{ display: 'block', fontSize: '0.9rem' }}>
          Next exam date
        </label>
        <input
          id="exam-date"
          type="date"
          value={examDateValue}
          onChange={(e) =>
            void update({ examAt: e.target.value ? new Date(e.target.value).getTime() : null })
          }
          style={inputStyle}
        />
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
          Inside the final four months the planner shifts from protecting long-term
          retention to maximising marks on the day.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Practice</h2>
        </div>
        <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={settings.askConfidence}
            onChange={(e) => void update({ askConfidence: e.target.checked })}
            style={{ marginTop: '0.25rem' }}
          />
          <span>
            <span style={{ fontSize: '0.92rem' }}>Ask how confident I am before revealing</span>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)' }}>
              Takes two seconds and is the only way the app can tell you where you are
              confidently wrong — the failure mode that costs the most marks.
            </span>
          </span>
        </label>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Appearance</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['system', 'light', 'dark'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className="btn"
              aria-pressed={settings.theme === option}
              style={
                settings.theme === option
                  ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                  : undefined
              }
              onClick={() => setTheme(option)}
            >
              {option[0]?.toUpperCase()}
              {option.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Your data</h2>
          <span className="chip">{study.events.length} events</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
          Atlas stores an append-only log of every review. Every screen is derived from
          it, so the export below really is everything.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void download()}
            disabled={exportState === 'working'}
          >
            {exportState === 'working' ? 'Preparing…' : 'Export everything (JSON)'}
          </button>
          {confirmingReset ? (
            <>
              <button
                type="button"
                className="btn"
                style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
                onClick={() => {
                  void study.reset();
                  setConfirmingReset(false);
                }}
              >
                Yes, erase everything
              </button>
              <button type="button" className="btn" onClick={() => setConfirmingReset(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirmingReset(true)}>
              Erase all study data
            </button>
          )}
        </div>
        {exportState === 'saved' && (
          <p style={{ fontSize: '0.8rem', color: 'var(--good)', marginTop: '0.7rem' }}>
            Exported {study.events.length} events.
          </p>
        )}
        {exportState === 'declined' && (
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.7rem' }}>
            Export cancelled — nothing left this device.
          </p>
        )}
        {exportState === 'unavailable' && (
          <p style={{ fontSize: '0.8rem', color: 'var(--warn)', marginTop: '0.7rem' }}>
            This viewer will not let the page save a file. Open Atlas in its own tab to
            export.
          </p>
        )}
        {study.ephemeral && (
          <p style={{ fontSize: '0.8rem', color: 'var(--warn)', marginTop: '0.7rem' }}>
            This browser is blocking local storage, so this session will not be saved.
          </p>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.6rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--rule-strong)',
  background: 'var(--panel)',
  color: 'var(--ink)',
  font: 'inherit',
  marginTop: '0.3rem',
};
