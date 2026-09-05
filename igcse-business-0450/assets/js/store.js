/* ============================================================
   store.js — persistence, progress, chapter index helpers
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'bs0450.v1';

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  var state = load();
  state.done      = state.done      || {};   // chapterNumber -> true (marked as revised)
  state.quiz      = state.quiz      || {};   // chapterNumber -> {best, attempts, last}
  state.cards     = state.cards     || {};   // cardId -> {box:1..5, due:ts, seen:n, right:n}
  state.answers   = state.answers   || {};   // questionId -> saved written answer
  state.settings  = state.settings  || {};
  state.streak    = state.streak    || { last: null, days: 0 };
  state.opened    = state.opened    || {};   // chapterNumber -> ts of last visit

  var Store = {
    get state() { return state; },
    save: function () { save(state); },

    /* ---- settings ---- */
    setting: function (k, v) {
      if (arguments.length === 1) return state.settings[k];
      state.settings[k] = v; save(state); return v;
    },

    /* ---- chapter completion ---- */
    isDone: function (n) { return !!state.done[n]; },
    toggleDone: function (n) {
      if (state.done[n]) delete state.done[n]; else state.done[n] = Date.now();
      save(state); return !!state.done[n];
    },
    markOpened: function (n) { state.opened[n] = Date.now(); save(state); },

    /* ---- quiz results ---- */
    recordQuiz: function (key, score, total) {
      var q = state.quiz[key] || { best: 0, attempts: 0, last: 0, total: total };
      q.attempts++;
      q.last = score;
      q.total = total;
      if (score > q.best) q.best = score;
      q.when = Date.now();
      state.quiz[key] = q; save(state); return q;
    },

    /* ---- written answers ---- */
    answer: function (id, txt) {
      if (arguments.length === 1) return state.answers[id] || '';
      if (txt) state.answers[id] = txt; else delete state.answers[id];
      save(state); return txt;
    },

    /* ---- flashcards: 5-box Leitner ---- */
    card: function (id) {
      return state.cards[id] || { box: 1, due: 0, seen: 0, right: 0 };
    },
    gradeCard: function (id, ok) {
      var c = Store.card(id);
      c.seen++;
      if (ok) { c.right++; c.box = Math.min(5, c.box + 1); }
      else    { c.box = 1; }
      // Leitner intervals in days per box
      var days = [0, 0, 1, 3, 7, 21][c.box] || 0;
      c.due = Date.now() + days * 864e5;
      state.cards[id] = c; save(state); return c;
    },
    dueCards: function (all) {
      var now = Date.now();
      return all.filter(function (c) {
        var s = state.cards[c.id];
        return !s || s.due <= now;
      });
    },

    /* ---- streak ---- */
    touchStreak: function () {
      var today = new Date().toISOString().slice(0, 10);
      var s = state.streak;
      if (s.last === today) return s.days;
      var y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      s.days = (s.last === y) ? s.days + 1 : 1;
      s.last = today; save(state); return s.days;
    },

    reset: function () {
      var keepKey = state.settings.apiKey, keepProv = state.settings.provider,
          keepModel = state.settings.model, keepBase = state.settings.baseUrl;
      state = { done:{}, quiz:{}, cards:{}, answers:{}, streak:{last:null,days:0}, opened:{},
                settings:{ apiKey:keepKey, provider:keepProv, model:keepModel, baseUrl:keepBase } };
      save(state);
    },
    exportJSON: function () { return JSON.stringify(state, null, 2); },
    importJSON: function (txt) {
      var o = JSON.parse(txt);
      if (typeof o !== 'object' || !o) throw new Error('Not a valid backup file.');
      state = Object.assign({ done:{}, quiz:{}, cards:{}, answers:{}, settings:{},
                              streak:{last:null,days:0}, opened:{} }, o);
      save(state);
    }
  };

  /* ============================================================
     Course index — built from the chapter data files
     ============================================================ */
  var CH = window.CH || [];
  var byNum = {};
  CH.forEach(function (c) { byNum[c.n] = c; });

  function allDefs() {
    var out = [];
    CH.forEach(function (c) {
      (c.defs || []).forEach(function (d, i) {
        out.push({ id: 'd' + c.n + '-' + i, term: d[0], def: d[1], ch: c.n, chTitle: c.title, s: c.s });
      });
    });
    return out;
  }
  function allMcq() {
    var out = [];
    CH.forEach(function (c) {
      (c.mcq || []).forEach(function (q, i) {
        out.push(Object.assign({ id: 'q' + c.n + '-' + i, ch: c.n, chTitle: c.title, s: c.s }, q));
      });
    });
    return out;
  }
  function allExam() {
    var out = [];
    CH.forEach(function (c) {
      (c.exam || []).forEach(function (q, i) {
        out.push(Object.assign({ id: 'e' + c.n + '-' + i, ch: c.n, chTitle: c.title, s: c.s }, q));
      });
    });
    return out;
  }

  var Course = {
    chapters: CH,
    ch: function (n) { return byNum[String(n)]; },
    section: function (n) {
      return window.SYLLABUS.sections.filter(function (s) { return s.n === Number(n); })[0];
    },
    sectionChapters: function (n) {
      return CH.filter(function (c) { return c.s === Number(n); });
    },
    defs: allDefs(),
    mcq: allMcq(),
    exam: allExam(),
    stats: function () {
      var done = 0;
      CH.forEach(function (c) { if (Store.isDone(c.n)) done++; });
      var cards = Course.defs, learned = 0;
      cards.forEach(function (c) { if ((Store.state.cards[c.id] || {}).box >= 4) learned++; });
      var qk = Object.keys(Store.state.quiz), qScore = 0, qTot = 0;
      qk.forEach(function (k) {
        var q = Store.state.quiz[k]; qScore += q.best || 0; qTot += q.total || 0;
      });
      return {
        chapters: CH.length, chaptersDone: done,
        cards: cards.length, cardsLearned: learned,
        mcq: Course.mcq.length, exam: Course.exam.length,
        quizPct: qTot ? Math.round(qScore / qTot * 100) : null,
        quizzesTaken: qk.length
      };
    }
  };

  window.Store = Store;
  window.Course = Course;
})();
