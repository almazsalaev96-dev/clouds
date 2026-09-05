/* ============================================================
   study.js — flashcards (Leitner) and the quiz engine
   ============================================================ */
(function () {
  'use strict';

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ============================================================
     FLASHCARDS
     ============================================================ */
  var FC = {
    deck: [], i: 0, flipped: false, scope: 'due', reverse: false,
    session: { right: 0, wrong: 0, done: 0 },

    build: function (scope) {
      var all = Course.defs;
      if (scope === 'due')       this.deck = shuffle(Store.dueCards(all));
      else if (scope === 'weak') this.deck = shuffle(all.filter(function (c) { return Store.card(c.id).box <= 2 && Store.card(c.id).seen > 0; }));
      else if (/^s[1-6]$/.test(scope)) {
        var s = Number(scope.slice(1));
        this.deck = shuffle(all.filter(function (c) { return c.s === s; }));
      } else if (/^ch/.test(scope)) {
        var n = scope.slice(2);
        this.deck = shuffle(all.filter(function (c) { return c.ch === n; }));
      } else this.deck = shuffle(all);
      this.scope = scope; this.i = 0; this.flipped = false;
      this.session = { right: 0, wrong: 0, done: 0 };
      return this.deck.length;
    },

    current: function () { return this.deck[this.i]; },

    grade: function (ok) {
      var c = this.current(); if (!c) return;
      Store.gradeCard(c.id, ok);
      this.session.done++;
      if (ok) this.session.right++; else this.session.wrong++;
      if (!ok) this.deck.push(c);          // wrong cards come round again this session
      this.i++; this.flipped = false;
    },

    progress: function () {
      return { i: Math.min(this.i, this.deck.length), total: this.deck.length };
    }
  };

  /* ============================================================
     QUIZ
     ============================================================ */
  var Quiz = {
    qs: [], i: 0, answers: [], key: '', label: '', finished: false,

    build: function (scope, limit) {
      var all = Course.mcq, pool;
      if (/^s[1-6]$/.test(scope)) {
        var s = Number(scope.slice(1));
        pool = all.filter(function (q) { return q.s === s; });
        this.label = 'Section ' + s + ' — ' + Course.section(s).title;
      } else if (/^ch/.test(scope)) {
        var n = scope.slice(2);
        pool = all.filter(function (q) { return q.ch === n; });
        var ch = Course.ch(n);
        this.label = 'Chapter ' + n + ' — ' + (ch ? ch.title : '');
      } else if (scope === 'weak') {
        // chapters not yet marked done, or with a low best score
        pool = all.filter(function (q) {
          var r = Store.state.quiz['ch' + q.ch];
          return !r || (r.total && r.best / r.total < 0.7);
        });
        if (!pool.length) pool = all;
        this.label = 'Weak areas';
      } else {
        pool = all;
        this.label = 'Mixed — whole course';
      }
      // shuffle the options within each question so answers cannot be memorised by position
      this.qs = shuffle(pool).slice(0, limit || 15).map(function (q) {
        var idx = q.o.map(function (_, k) { return k; });
        var order = shuffle(idx);
        return {
          id: q.id, ch: q.ch, chTitle: q.chTitle, s: q.s, q: q.q, why: q.why,
          o: order.map(function (k) { return q.o[k]; }),
          a: order.indexOf(q.a)
        };
      });
      this.i = 0; this.answers = []; this.finished = false;
      this.key = scope;
      return this.qs.length;
    },

    current: function () { return this.qs[this.i]; },

    answer: function (choice) {
      var q = this.current(); if (!q || this.answers[this.i] != null) return null;
      this.answers[this.i] = choice;
      return choice === q.a;
    },

    next: function () {
      if (this.i < this.qs.length - 1) { this.i++; return true; }
      this.finished = true;
      var s = this.score();
      Store.recordQuiz(this.key, s.right, s.total);
      Store.touchStreak();
      return false;
    },

    score: function () {
      var right = 0, self = this;
      this.answers.forEach(function (a, k) { if (a === self.qs[k].a) right++; });
      return { right: right, total: this.qs.length, pct: this.qs.length ? Math.round(right / this.qs.length * 100) : 0 };
    },

    wrongOnes: function () {
      var out = [], self = this;
      this.qs.forEach(function (q, k) {
        if (self.answers[k] !== q.a) out.push({ q: q, chose: self.answers[k] });
      });
      return out;
    }
  };

  window.FC = FC;
  window.Quiz = Quiz;
  window.shuffleArr = shuffle;
})();
