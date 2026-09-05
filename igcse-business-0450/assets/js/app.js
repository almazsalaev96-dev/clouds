/* ============================================================
   app.js — router, views, search, settings
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var view = $('#view');

  function esc(s) { return R.esc(s); }
  function secColor(s) { return 'var(--s' + s + ')'; }
  function secWash(s)  { return 'var(--s' + s + 'w)'; }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  /* ============================================================
     SIDEBAR
     ============================================================ */
  function buildNav() {
    var host = $('#navSections'), html = '';
    SYLLABUS.sections.forEach(function (s) {
      var chs = Course.sectionChapters(s.n);
      var done = chs.filter(function (c) { return Store.isDone(c.n); }).length;
      html += '<button class="nav-sec" data-sec="' + s.n + '" aria-expanded="false">' +
        '<span class="dot" style="background:' + secColor(s.n) + '"></span>' +
        '<span>' + esc(s.title) + '</span>' +
        '<span class="chev">▸</span></button>' +
        '<div class="nav-chaps" id="navChaps' + s.n + '" hidden>' +
        chs.map(function (c) {
          return '<a class="nav-chap" href="#/ch/' + c.n + '" data-ch="' + c.n + '">' +
            '<span class="n">' + c.n + '</span><span>' + esc(c.title) + '</span>' +
            (Store.isDone(c.n) ? '<span class="tick">✓</span>' : '') + '</a>';
        }).join('') + '</div>';
    });
    host.innerHTML = html;
    $$('.nav-sec', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') === 'true';
        b.setAttribute('aria-expanded', String(!open));
        $('#navChaps' + b.dataset.sec).hidden = open;
      });
    });
    var st = Course.stats();
    $('#nbDefs').textContent = st.cards;
    $('#nbMcq').textContent  = st.mcq;
    $('#nbExam').textContent = st.exam;
  }

  function syncNav(route) {
    $$('.nav-item').forEach(function (a) {
      a.classList.toggle('on', a.dataset.route === route);
    });
    $$('.nav-chap').forEach(function (a) { a.classList.remove('on'); });
    var m = route.match(/^\/ch\/(\d+)/);
    if (m) {
      var link = $('.nav-chap[data-ch="' + m[1] + '"]');
      if (link) {
        link.classList.add('on');
        var ch = Course.ch(m[1]);
        if (ch) {
          var btn = $('.nav-sec[data-sec="' + ch.s + '"]');
          if (btn && btn.getAttribute('aria-expanded') !== 'true') {
            btn.setAttribute('aria-expanded', 'true');
            $('#navChaps' + ch.s).hidden = false;
          }
        }
      }
    }
  }

  function crumb(parts) {
    $('#crumb').innerHTML = parts.map(function (p, i) {
      return (i ? '<span class="sep">/</span>' : '') +
        (p.href ? '<a href="' + p.href + '">' + esc(p.t) + '</a>' : '<b>' + esc(p.t) + '</b>');
    }).join('');
  }

  /* ============================================================
     VIEW: DASHBOARD
     ============================================================ */
  function vHome() {
    var st = Course.stats();
    var pctCh = st.chapters ? Math.round(st.chaptersDone / st.chapters * 100) : 0;
    var pctCards = st.cards ? Math.round(st.cardsLearned / st.cards * 100) : 0;
    var due = Store.dueCards(Course.defs).length;
    var streak = Store.state.streak.days || 0;

    var h = '<div class="hero">' +
      '<div class="eyebrow">Cambridge IGCSE &amp; O Level · ' + esc(SYLLABUS.code) + '</div>' +
      '<h1>Business Studies</h1>' +
      '<p class="lede">Every chapter of the course, rewritten for the exam: condensed notes, ' +
      st.cards + ' definitions as flashcards, ' + st.mcq + ' quiz questions, ' + st.exam +
      ' exam questions with full mark-scheme model answers, six calculators and an AI examiner that marks your writing.</p></div>';

    h += '<div class="grid g4" style="margin-bottom:26px">' +
      stat('Chapters revised', st.chaptersDone + '<small> / ' + st.chapters + '</small>', pctCh) +
      stat('Definitions learned', st.cardsLearned + '<small> / ' + st.cards + '</small>', pctCards) +
      stat('Quiz average', st.quizPct == null ? '—' : st.quizPct + '<small>%</small>', st.quizPct || 0) +
      stat('Day streak', streak + '<small> ' + (streak === 1 ? 'day' : 'days') + '</small>', Math.min(100, streak * 14)) +
      '</div>';

    // next actions
    h += '<div class="grid g3" style="margin-bottom:34px">' +
      action('#/flashcards', '▤', due ? due + ' cards due' : 'Review definitions',
             due ? 'Spaced repetition has scheduled these for today.' : 'Nothing due — start a fresh deck any time.') +
      action('#/quiz', '◎', 'Take a quiz', 'Mixed questions from the whole course, or target one chapter.') +
      action('#/exam', '✎', 'Exam technique', 'What each command word demands, and the timing that fits 90 minutes.') +
      '</div>';

    h += '<h2 style="font-family:var(--serif);margin-bottom:14px">The syllabus</h2>';
    h += '<div class="grid g2">' + SYLLABUS.sections.map(function (s) {
      var chs = Course.sectionChapters(s.n);
      var done = chs.filter(function (c) { return Store.isDone(c.n); }).length;
      return '<a class="sec-card" href="#/s/' + s.n + '" style="--sc:' + secColor(s.n) + '">' +
        '<span class="n">Section ' + s.n + '</span>' +
        '<h3>' + esc(s.title) + '</h3>' +
        '<p>' + esc(s.blurb) + '</p>' +
        '<div class="meta"><span>' + chs.length + ' chapters</span>' +
        '<span>' + done + '/' + chs.length + ' revised</span></div>' +
        '<div class="bar" style="margin-top:9px"><i style="width:' +
        (chs.length ? done / chs.length * 100 : 0) + '%;background:' + secColor(s.n) + '"></i></div></a>';
    }).join('') + '</div>';

    // papers
    h += '<hr class="hr"><h2 style="font-family:var(--serif);margin-bottom:6px">How you are assessed</h2>' +
      '<p class="muted small" style="margin-bottom:14px">Two papers, equally weighted. Both are compulsory — there is no choice of question.</p>' +
      '<div class="grid g2">' + SYLLABUS.papers.map(function (p) {
        return '<div class="card"><div class="eyebrow">Paper ' + p.n + ' · ' + esc(p.weight) + '</div>' +
          '<h3 style="margin-bottom:7px">' + esc(p.name) + '</h3>' +
          '<p class="small muted" style="margin-bottom:10px">' + esc(p.format) + '</p>' +
          '<div class="small"><b>' + esc(p.time) + '</b> · ' + p.marks + ' marks</div></div>';
      }).join('') + '</div>';

    h += '<div class="grid g4" style="margin-top:14px">' + SYLLABUS.aos.map(function (a) {
      return '<div class="card tight"><div class="eyebrow" style="margin-bottom:5px">' + esc(a.k) + ' · ' + esc(a.w) + '</div>' +
        '<h4 style="margin-bottom:5px">' + esc(a.name) + '</h4>' +
        '<p class="small muted" style="margin:0">' + esc(a.d) + '</p></div>';
    }).join('') + '</div>';

    view.innerHTML = h;
    crumb([{ t: 'Dashboard' }]);

    function stat(k, v, p) {
      return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div>' +
        '<div class="bar" style="margin-top:9px"><i style="width:' + Math.min(100, p) + '%"></i></div></div>';
    }
    function action(href, ic, title, sub) {
      return '<a class="sec-card" href="' + href + '" style="--sc:var(--brand)">' +
        '<div style="font-size:1.3rem;color:var(--brand);margin-bottom:6px">' + ic + '</div>' +
        '<h3 style="margin-top:0">' + esc(title) + '</h3><p>' + esc(sub) + '</p></a>';
    }
  }

  /* ============================================================
     VIEW: SECTION
     ============================================================ */
  function vSection(n) {
    var s = Course.section(n);
    if (!s) return vNotFound();
    var chs = Course.sectionChapters(n);
    var h = '<div class="hero"><div class="eyebrow" style="color:' + secColor(n) + '">Section ' + n + '</div>' +
      '<h1>' + esc(s.title) + '</h1><p class="lede">' + esc(s.blurb) + '</p></div>';

    h += '<div class="grid" style="gap:12px">' + chs.map(function (c) {
      var done = Store.isDone(c.n);
      var q = Store.state.quiz['ch' + c.n];
      return '<a class="sec-card" href="#/ch/' + c.n + '" style="--sc:' + secColor(n) + '">' +
        '<div style="display:flex;align-items:baseline;gap:11px">' +
        '<span class="n" style="font-size:1.15rem;font-family:var(--mono);opacity:.55">' + c.n + '</span>' +
        '<div style="flex:1"><h3 style="margin:0 0 4px">' + esc(c.title) + '</h3>' +
        '<p>' + esc(c.sub) + '</p></div>' +
        (done ? '<span class="pill good">✓ revised</span>' : '') + '</div>' +
        '<div class="meta">' +
        '<span>' + (c.defs || []).length + ' definitions</span>' +
        '<span>' + (c.mcq || []).length + ' quiz Qs</span>' +
        '<span>' + (c.exam || []).length + ' exam Qs</span>' +
        (q ? '<span style="color:var(--good)">best ' + q.best + '/' + q.total + '</span>' : '') +
        '</div></a>';
    }).join('') + '</div>';

    h += '<hr class="hr"><div class="grid g2">' +
      '<a class="btn lg" href="#/quiz?scope=s' + n + '">◎ Quiz this whole section</a>' +
      '<a class="btn lg" href="#/flashcards?scope=s' + n + '">▤ Flashcards for this section</a></div>';

    view.innerHTML = h;
    crumb([{ t: 'Syllabus', href: '#/' }, { t: 'Section ' + n + ': ' + s.title }]);
  }

  /* ============================================================
     VIEW: CHAPTER
     ============================================================ */
  function vChapter(n) {
    var c = Course.ch(n);
    if (!c) return vNotFound();
    Store.markOpened(n);
    var sec = Course.section(c.s);
    var done = Store.isDone(n);

    var h = '<div class="chap-head" style="--sc:' + secColor(c.s) + '">' +
      '<div class="sec-tag"><span class="dot"></span>Section ' + c.s + ' · ' + esc(sec.title) + '</div>' +
      '<h1><span class="chap-num">' + c.n + '</span>' + esc(c.title) + '</h1>' +
      '<p class="lede" style="margin-top:8px">' + esc(c.sub) + '</p>' +
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:16px" class="no-print">' +
      '<button class="btn ' + (done ? 'good' : '') + '" id="btnDone">' + (done ? '✓ Revised' : 'Mark as revised') + '</button>' +
      '<a class="btn" href="#/quiz?scope=ch' + n + '">◎ Quiz this chapter</a>' +
      '<a class="btn" href="#/flashcards?scope=ch' + n + '">▤ Flashcards</a>' +
      '<a class="btn" href="#/tutor?ch=' + n + '">✦ Ask the examiner</a>' +
      '</div></div>';

    if (c.obj && c.obj.length) {
      h += '<div class="obj" style="--sc:' + secColor(c.s) + ';--sw:' + secWash(c.s) + '">' +
        '<h4>In this chapter you will learn</h4><ul>' +
        c.obj.map(function (o) { return '<li>' + R.inline(o) + '</li>'; }).join('') + '</ul></div>';
    }

    if (c.defs && c.defs.length) {
      h += '<section class="block"><h2>Definitions to learn</h2>' +
        '<p class="small muted">Every one of these can appear as a 2-mark question. They are all in your flashcard deck.</p>' +
        R.defs(c.defs) + '</section>';
    }

    h += R.chapterBody(c);

    if (c.exam && c.exam.length) {
      h += '<section class="block"><h2>Exam questions</h2>' +
        '<p class="small muted">Write your answer, then open the model. The mark scheme note tells you where each mark sits.</p>' +
        c.exam.map(function (q, i) { return examCard(q, 'e' + n + '-' + i); }).join('') + '</section>';
    }

    // prev / next
    var all = Course.chapters, idx = all.indexOf(c);
    h += '<hr class="hr"><div style="display:flex;gap:10px;justify-content:space-between" class="no-print">' +
      (idx > 0 ? '<a class="btn" href="#/ch/' + all[idx - 1].n + '">← ' + esc(all[idx - 1].title) + '</a>' : '<span></span>') +
      (idx < all.length - 1 ? '<a class="btn" href="#/ch/' + all[idx + 1].n + '">' + esc(all[idx + 1].title) + ' →</a>' : '<span></span>') +
      '</div>';

    view.innerHTML = h;
    crumb([{ t: 'Section ' + c.s, href: '#/s/' + c.s }, { t: 'Ch ' + c.n + ': ' + c.title }]);
    wireExamCards();

    $('#btnDone').addEventListener('click', function () {
      var now = Store.toggleDone(n);
      this.classList.toggle('good', now);
      this.textContent = now ? '✓ Revised' : 'Mark as revised';
      if (now) { Store.touchStreak(); toast('Chapter ' + n + ' marked as revised'); }
      buildNav(); syncNav('/ch/' + n);
    });
  }

  /* ---- exam question card (shared by chapter + practice views) ---- */
  function examCard(q, id) {
    var saved = Store.answer(id);
    return '<div class="eq" data-id="' + id + '">' +
      '<div class="eq-h"><div class="qt">' +
        '<div class="eq-cmd">' + esc(q.cmd) + '</div>' +
        (q.ctx ? '<p class="small muted" style="margin-bottom:8px">' + R.inline(q.ctx) + '</p>' : '') +
        '<div>' + R.inline(q.q) + '</div></div>' +
        '<span class="mk">' + q.m + ' marks</span></div>' +
      '<div class="eq-body">' +
        '<h5>Your answer</h5>' +
        '<textarea class="ans-area" data-ans="' + id + '" placeholder="Write your answer here. It is saved in this browser as you type.">' +
        esc(saved) + '</textarea>' +
        '<div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap" class="no-print">' +
        '<button class="btn sm" data-toggle="plan">Show plan</button>' +
        '<button class="btn sm" data-toggle="model">Show model answer</button>' +
        '<a class="btn sm" href="#/tutor?mark=' + id + '">✦ Mark my answer</a></div>' +
        '<div data-panel="plan" hidden><h5>How to plan it</h5>' + R.ol(q.plan) + '</div>' +
        '<div data-panel="model" hidden><h5>Model answer</h5>' +
        q.model.map(function (p) { return '<p style="font-size:.87rem;color:var(--ink-soft)">' + R.inline(p) + '</p>'; }).join('') +
        '<h5>Where the marks are</h5><p style="font-size:.85rem;color:var(--ink-soft)">' + R.inline(q.marker) + '</p>' +
        '</div></div></div>';
  }

  function wireExamCards() {
    $$('[data-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var kind = b.dataset.toggle;
        var panel = b.closest('.eq-body').querySelector('[data-panel="' + kind + '"]');
        panel.hidden = !panel.hidden;
        b.textContent = (panel.hidden ? 'Show ' : 'Hide ') + (kind === 'plan' ? 'plan' : 'model answer');
      });
    });
    $$('[data-ans]').forEach(function (t) {
      t.addEventListener('input', function () { Store.answer(t.dataset.ans, t.value); });
    });
  }

  /* ============================================================
     VIEW: EXAM TECHNIQUE
     ============================================================ */
  function vExam() {
    var h = '<div class="hero"><div class="eyebrow">The highest-leverage page on this site</div>' +
      '<h1>Exam technique</h1><p class="lede">Most marks are lost not to missing knowledge but to answering the ' +
      'wrong shape of question. Each command word demands something specific. Learn these eight and you will ' +
      'never again write a 6-mark answer to a 2-mark question.</p></div>';

    h += '<section class="block"><h2>Command words</h2>' + COMMANDS.map(function (c) {
      return '<div class="card" style="margin-bottom:14px">' +
        '<div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:10px">' +
        '<h3 style="font-family:var(--serif);font-size:1.25rem">' + esc(c.w) + '</h3>' +
        '<span class="pill b">' + esc(c.m) + '</span>' +
        '<span class="pill">' + esc(c.ao) + '</span>' +
        '<span class="pill">' + esc(c.time) + '</span></div>' +
        '<p style="font-size:.9rem"><b>What it asks:</b> ' + esc(c.means) + '</p>' +
        '<p style="font-size:.9rem"><b>How to answer:</b> ' + esc(c.how) + '</p>' +
        '<div class="call key"><span class="lb">Full marks looks like</span><p>' + c.good + '</p></div>' +
        '<div class="call trap"><span class="lb">Where marks are lost</span><p>' + esc(c.bad) + '</p></div>' +
        '</div>';
    }).join('') + '</section>';

    h += '<section class="block"><h2>Timing</h2>' + TECHNIQUE.timing.map(function (p) {
      return '<h3>' + esc(p.p) + '</h3>' + R.table(['Task', 'Time', 'What to do'], p.rows);
    }).join('') + '</section>';

    h += '<section class="block"><h2>The seven rules</h2>' + TECHNIQUE.rules.map(function (r, i) {
      return '<div class="card tight" style="margin-bottom:10px">' +
        '<h4 style="margin-bottom:5px"><span style="font-family:var(--mono);color:var(--muted)">' +
        (i + 1) + '.</span> ' + esc(r.t) + '</h4>' +
        '<p class="small muted" style="margin:0">' + esc(r.d) + '</p></div>';
    }).join('') + '</section>';

    h += '<section class="block"><h2>Phrases that earn marks</h2>' +
      '<div class="pc"><div class="adv"><h5>Analysis (AO3)</h5>' + R.ul(TECHNIQUE.connectives.analysis) + '</div>' +
      '<div class="dis"><h5>Evaluation (AO4)</h5>' + R.ul(TECHNIQUE.connectives.evaluation) + '</div></div>' +
      R.call('tip', 'Print this page. Put the analysis column on your desk when you practise 6-markers and the ' +
        'evaluation column when you practise 12-markers. Using the phrase forces the thinking.') +
      '</section>';

    view.innerHTML = h;
    crumb([{ t: 'Exam technique' }]);
  }

  /* ============================================================
     VIEW: FLASHCARDS
     ============================================================ */
  function vFlashcards(params) {
    var scope = params.scope || 'due';
    var count = FC.build(scope);
    var h = '<div class="hero"><div class="eyebrow">Spaced repetition · Leitner boxes</div>' +
      '<h1>Flashcards</h1><p class="lede">Cards you get right move up a box and come back later; ' +
      'cards you get wrong drop to box 1 and come back today. Boxes are 1 day, 3 days, 7 days, 21 days.</p></div>';

    h += '<div class="card tight" style="margin-bottom:20px"><div class="field" style="margin:0">' +
      '<label for="fcScope">Deck</label><select class="inp" id="fcScope">' +
      opt('due', 'Due today (' + Store.dueCards(Course.defs).length + ')', scope) +
      opt('all', 'All ' + Course.defs.length + ' definitions', scope) +
      opt('weak', 'Weak cards only', scope) +
      SYLLABUS.sections.map(function (s) {
        return opt('s' + s.n, 'Section ' + s.n + ' — ' + s.title, scope);
      }).join('') +
      Course.chapters.map(function (c) {
        return opt('ch' + c.n, 'Chapter ' + c.n + ' — ' + c.title, scope);
      }).join('') +
      '</select></div>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:11px;font-size:.85rem;color:var(--ink-soft)">' +
      '<input type="checkbox" id="fcRev"' + (FC.reverse ? ' checked' : '') + '> Show the definition first and recall the term (harder)</label>' +
      '</div>';

    h += '<div id="fcStage"></div>';
    view.innerHTML = h;
    crumb([{ t: 'Flashcards' }]);

    $('#fcScope').addEventListener('change', function () {
      location.hash = '#/flashcards?scope=' + this.value;
    });
    $('#fcRev').addEventListener('change', function () { FC.reverse = this.checked; drawCard(); });

    if (!count) {
      $('#fcStage').innerHTML = '<div class="card" style="text-align:center;padding:44px">' +
        '<h3 style="margin-bottom:8px">Nothing due right now</h3>' +
        '<p class="muted small" style="margin-bottom:16px">Spaced repetition has scheduled your cards for later. ' +
        'Pick another deck above to keep going.</p>' +
        '<button class="btn pri" onclick="location.hash=\'#/flashcards?scope=all\'">Study all definitions</button></div>';
      return;
    }
    drawCard();

    function drawCard() {
      var stage = $('#fcStage'), p = FC.progress();
      if (FC.i >= FC.deck.length) {
        stage.innerHTML = '<div class="card" style="text-align:center;padding:44px">' +
          '<div style="font-size:2rem;margin-bottom:8px">✓</div>' +
          '<h3 style="margin-bottom:8px">Deck complete</h3>' +
          '<p class="muted" style="margin-bottom:6px">' + FC.session.right + ' right · ' + FC.session.wrong + ' wrong</p>' +
          '<p class="small muted" style="margin-bottom:18px">Cards you got wrong were shown again and have been reset to box 1.</p>' +
          '<div style="display:flex;gap:9px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn pri" id="fcAgain">Go again</button>' +
          '<a class="btn" href="#/quiz">Take a quiz instead</a></div></div>';
        $('#fcAgain').addEventListener('click', function () { FC.build(FC.scope); drawCard(); });
        Store.touchStreak();
        return;
      }
      var c = FC.current();
      var box = Store.card(c.id).box;
      var front = FC.reverse ? c.def : c.term;
      var back  = FC.reverse ? c.term : c.def;
      stage.innerHTML =
        '<div class="q-prog"><span>' + (p.i + 1) + ' / ' + p.total + '</span>' +
        '<div class="bar"><i style="width:' + (p.i / p.total * 100) + '%"></i></div>' +
        '<span>' + FC.session.right + ' ✓ · ' + FC.session.wrong + ' ✗</span></div>' +
        '<div class="fc-stage"><div class="fc" id="fcCard">' +
        '<div class="fc-face">' +
          '<span class="tag">Ch ' + c.ch + ' · ' + esc(c.chTitle) + '</span>' +
          '<span class="box pill">box ' + box + '/5</span>' +
          '<div class="' + (FC.reverse ? 'fc-def' : 'fc-term') + '">' + esc(front) + '</div>' +
          '<span class="fc-hint">Click, or press Space, to reveal</span></div>' +
        '<div class="fc-face fc-back">' +
          '<span class="tag">' + (FC.reverse ? 'The term' : 'The definition') + '</span>' +
          '<div class="' + (FC.reverse ? 'fc-term' : 'fc-def') + '">' + esc(back) + '</div>' +
          '<span class="fc-hint">Did you get it right?</span></div>' +
        '</div></div>' +
        '<div class="fc-ctrl" id="fcCtrl" hidden>' +
        '<button class="btn bad" id="fcNo">✗ Not quite <span class="muted small">(1)</span></button>' +
        '<button class="btn good" id="fcYes">✓ Got it <span class="muted small">(2)</span></button>' +
        '<a class="btn gh" href="#/ch/' + c.ch + '">Read the chapter</a></div>';

      var card = $('#fcCard');
      card.addEventListener('click', flip);
      function flip() {
        if (FC.flipped) return;
        FC.flipped = true; card.classList.add('flip'); $('#fcCtrl').hidden = false;
      }
      $('#fcYes').addEventListener('click', function () { FC.grade(true); drawCard(); });
      $('#fcNo').addEventListener('click', function () { FC.grade(false); drawCard(); });
      stage._flip = flip;
    }

    function opt(v, label, cur) {
      return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>';
    }
  }

  /* ============================================================
     VIEW: QUIZ
     ============================================================ */
  function vQuiz(params) {
    var scope = params.scope || 'all';
    if (!params.start) {
      var pool = scope === 'all' ? Course.mcq.length
        : /^s[1-6]$/.test(scope) ? Course.mcq.filter(function (q) { return q.s === Number(scope.slice(1)); }).length
        : /^ch/.test(scope) ? Course.mcq.filter(function (q) { return q.ch === scope.slice(2); }).length
        : Course.mcq.length;
      var h = '<div class="hero"><div class="eyebrow">' + Course.mcq.length + ' questions across 29 chapters</div>' +
        '<h1>Quiz</h1><p class="lede">Multiple choice with a written explanation for every answer — including the ones ' +
        'you get right. Options are shuffled each time so you cannot learn them by position.</p></div>';
      h += '<div class="card"><div class="field"><label for="qScope">What to quiz</label>' +
        '<select class="inp" id="qScope">' +
        '<option value="all"' + (scope === 'all' ? ' selected' : '') + '>Mixed — whole course (' + Course.mcq.length + ' available)</option>' +
        '<option value="weak"' + (scope === 'weak' ? ' selected' : '') + '>Weak areas — chapters you have not mastered</option>' +
        SYLLABUS.sections.map(function (s) {
          var c = Course.mcq.filter(function (q) { return q.s === s.n; }).length;
          return '<option value="s' + s.n + '"' + (scope === 's' + s.n ? ' selected' : '') + '>Section ' + s.n + ' — ' + esc(s.title) + ' (' + c + ')</option>';
        }).join('') +
        Course.chapters.map(function (c) {
          var k = (c.mcq || []).length;
          return '<option value="ch' + c.n + '"' + (scope === 'ch' + c.n ? ' selected' : '') + '>Chapter ' + c.n + ' — ' + esc(c.title) + ' (' + k + ')</option>';
        }).join('') +
        '</select></div>' +
        '<div class="field"><label for="qLen">Number of questions</label>' +
        '<select class="inp" id="qLen"><option value="10">10</option><option value="15" selected>15</option>' +
        '<option value="25">25</option><option value="999">All available</option></select></div>' +
        '<button class="btn pri lg wide" id="qStart">Start quiz</button></div>';
      view.innerHTML = h;
      crumb([{ t: 'Quiz' }]);
      $('#qScope').addEventListener('change', function () { location.hash = '#/quiz?scope=' + this.value; });
      $('#qStart').addEventListener('click', function () {
        var len = Number($('#qLen').value);
        Quiz.build($('#qScope').value, len);
        runQuiz();
      });
      return;
    }
    Quiz.build(scope, Number(params.n || 15));
    runQuiz();

    function runQuiz() {
      crumb([{ t: 'Quiz', href: '#/quiz' }, { t: Quiz.label }]);
      drawQ();
    }

    function drawQ() {
      if (Quiz.finished) return drawResults();
      var q = Quiz.current();
      if (!q) { view.innerHTML = '<div class="card">No questions available for that selection.</div>'; return; }
      var chosen = Quiz.answers[Quiz.i];
      var h = '<div class="q-prog"><span>Question ' + (Quiz.i + 1) + ' / ' + Quiz.qs.length + '</span>' +
        '<div class="bar"><i style="width:' + (Quiz.i / Quiz.qs.length * 100) + '%"></i></div>' +
        '<span>' + esc(Quiz.label) + '</span></div>';
      h += '<div class="card"><div class="eyebrow" style="margin-bottom:8px">Chapter ' + q.ch + ' · ' + esc(q.chTitle) + '</div>' +
        '<h3 style="margin-bottom:16px;font-size:1.1rem;line-height:1.45">' + R.inline(q.q) + '</h3>' +
        '<div id="qOpts">' + q.o.map(function (o, i) {
          var cls = '';
          if (chosen != null) {
            if (i === q.a) cls = ' right';
            else if (i === chosen) cls = ' wrong';
          }
          return '<button class="opt' + cls + '" data-i="' + i + '"' + (chosen != null ? ' disabled' : '') + '>' +
            '<span class="lt">' + 'ABCD'[i] + '</span><span>' + R.inline(o) + '</span></button>';
        }).join('') + '</div>';
      if (chosen != null) {
        h += R.call(chosen === q.a ? 'key' : 'trap', q.why, chosen === q.a ? 'Correct' : 'Not quite') +
          '<div style="display:flex;gap:9px;flex-wrap:wrap">' +
          '<button class="btn pri" id="qNext">' + (Quiz.i === Quiz.qs.length - 1 ? 'See results' : 'Next question') + '</button>' +
          '<a class="btn gh" href="#/ch/' + q.ch + '">Read chapter ' + q.ch + '</a></div>';
      }
      h += '</div>';
      view.innerHTML = h;

      $$('#qOpts .opt').forEach(function (b) {
        b.addEventListener('click', function () { Quiz.answer(Number(b.dataset.i)); drawQ(); });
      });
      var nx = $('#qNext');
      if (nx) nx.addEventListener('click', function () { Quiz.next(); drawQ(); });
    }

    function drawResults() {
      var s = Quiz.score();
      var grade = s.pct >= 85 ? ['Excellent', 'good'] : s.pct >= 70 ? ['Solid', 'good'] :
                  s.pct >= 50 ? ['Needs work', 'warn'] : ['Go back to the notes', 'bad'];
      var wrong = Quiz.wrongOnes();
      var h = '<div class="card" style="text-align:center;padding:34px;margin-bottom:20px">' +
        '<div class="eyebrow">' + esc(Quiz.label) + '</div>' +
        '<div style="font-size:3rem;font-weight:600;line-height:1.1;font-variant-numeric:tabular-nums">' + s.pct + '%</div>' +
        '<div class="muted" style="margin-bottom:10px">' + s.right + ' out of ' + s.total + ' correct</div>' +
        '<span class="pill ' + grade[1] + '">' + grade[0] + '</span>' +
        '<div style="display:flex;gap:9px;justify-content:center;margin-top:20px;flex-wrap:wrap">' +
        '<button class="btn pri" id="qAgain">Try again</button>' +
        '<a class="btn" href="#/quiz">Change selection</a>' +
        '<a class="btn gh" href="#/flashcards?scope=weak">Revise weak definitions</a></div></div>';

      if (wrong.length) {
        h += '<h2 style="font-family:var(--serif);margin-bottom:12px">What to review</h2>';
        var byCh = {};
        wrong.forEach(function (w) { (byCh[w.q.ch] = byCh[w.q.ch] || []).push(w); });
        h += Object.keys(byCh).sort(function (a, b) { return Number(a) - Number(b); }).map(function (ch) {
          var ws = byCh[ch];
          return '<div class="card" style="margin-bottom:12px">' +
            '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px">' +
            '<h4>Chapter ' + ch + ' — ' + esc(ws[0].q.chTitle) + '</h4>' +
            '<a class="btn sm" href="#/ch/' + ch + '">Read it</a></div>' +
            ws.map(function (w) {
              return '<div style="padding:9px 0;border-top:1px solid var(--rule)">' +
                '<p class="small" style="margin-bottom:5px"><b>' + R.inline(w.q.q) + '</b></p>' +
                '<p class="small" style="color:var(--good);margin-bottom:3px">Correct: ' + R.inline(w.q.o[w.q.a]) + '</p>' +
                (w.chose != null ? '<p class="small" style="color:var(--bad);margin-bottom:5px">You chose: ' + R.inline(w.q.o[w.chose]) + '</p>' : '') +
                '<p class="small muted" style="margin:0">' + esc(w.q.why) + '</p></div>';
            }).join('') + '</div>';
        }).join('');
      } else {
        h += R.call('key', 'Every question correct. Try a harder selection, or move on to the ' +
          '<a href="#/practice">written exam questions</a> — that is where the other 80% of the marks are.');
      }
      view.innerHTML = h;
      $('#qAgain').addEventListener('click', function () {
        Quiz.build(Quiz.key, Quiz.qs.length); drawQ();
      });
    }
  }

  /* ============================================================
     VIEW: PRACTICE (written exam questions)
     ============================================================ */
  function vPractice(params) {
    var filter = params.filter || 'all';
    var qs = Course.exam.slice();
    if (/^s[1-6]$/.test(filter)) qs = qs.filter(function (q) { return q.s === Number(filter.slice(1)); });
    else if (/^m\d+/.test(filter)) qs = qs.filter(function (q) { return q.m === Number(filter.slice(1)); });
    else if (/^ch/.test(filter)) qs = qs.filter(function (q) { return q.ch === filter.slice(2); });

    var h = '<div class="hero"><div class="eyebrow">' + Course.exam.length + ' questions · full model answers</div>' +
      '<h1>Exam questions</h1><p class="lede">These are where the grade is decided. Write your answer first — ' +
      'properly, in full sentences — then open the model and compare. Your answers are saved in this browser.</p></div>';

    h += '<div class="card tight" style="margin-bottom:20px"><div class="field" style="margin:0">' +
      '<label for="pFilter">Filter</label><select class="inp" id="pFilter">' +
      '<option value="all">All ' + Course.exam.length + ' questions</option>' +
      '<option value="m2"' + (filter === 'm2' ? ' selected' : '') + '>2-mark definitions</option>' +
      '<option value="m4"' + (filter === 'm4' ? ' selected' : '') + '>4-mark outline questions</option>' +
      '<option value="m6"' + (filter === 'm6' ? ' selected' : '') + '>6-mark explain / justify questions</option>' +
      '<option value="m12"' + (filter === 'm12' ? ' selected' : '') + '>12-mark recommend questions</option>' +
      SYLLABUS.sections.map(function (s) {
        return '<option value="s' + s.n + '"' + (filter === 's' + s.n ? ' selected' : '') + '>Section ' + s.n + ' — ' + esc(s.title) + '</option>';
      }).join('') + '</select></div></div>';

    if (!qs.length) {
      h += '<div class="card">No questions match that filter.</div>';
    } else {
      var byCh = {};
      qs.forEach(function (q) { (byCh[q.ch] = byCh[q.ch] || []).push(q); });
      h += Object.keys(byCh).sort(function (a, b) { return Number(a) - Number(b); }).map(function (ch) {
        return '<section class="block"><h2 style="font-size:1.15rem">Chapter ' + ch + ' — ' +
          esc(byCh[ch][0].chTitle) + '</h2>' +
          byCh[ch].map(function (q) { return examCard(q, q.id); }).join('') + '</section>';
      }).join('');
    }
    view.innerHTML = h;
    crumb([{ t: 'Exam questions' }]);
    $('#pFilter').addEventListener('change', function () { location.hash = '#/practice?filter=' + this.value; });
    wireExamCards();
  }

  /* ============================================================
     VIEW: TOOLS
     ============================================================ */
  function vTools(params) {
    var id = params.t || TOOLS[0].id;
    var tool = TOOLS.filter(function (t) { return t.id === id; })[0] || TOOLS[0];

    var h = '<div class="hero"><h1>Calculators</h1>' +
      '<p class="lede">Every calculation the syllabus asks for, with the interpretation the examiner wants. ' +
      'Change any number and the result — and the comment underneath it — updates.</p></div>';

    h += '<div class="chips" style="margin-bottom:20px">' + TOOLS.map(function (t) {
      return '<a class="chip' + (t.id === tool.id ? ' on' : '') + '" href="#/tools?t=' + t.id + '"' +
        (t.id === tool.id ? ' style="border-color:var(--brand);color:var(--brand);background:var(--brand-soft)"' : '') +
        '>' + t.icon + ' ' + esc(t.name) + '</a>';
    }).join('') + '</div>';

    h += '<div class="card"><div class="eyebrow">' + esc(tool.name) + '</div>' +
      '<p class="small muted" style="margin-bottom:18px">' + esc(tool.blurb) + '</p>';

    if (tool.custom) {
      h += '<div id="toolCustom">' + tool.render() + '</div>';
    } else {
      h += '<div class="grid g2" style="align-items:start"><div id="toolForm">' + tool.form() + '</div>' +
        '<div class="out" id="toolOut"></div></div><div id="toolChart"></div>';
    }
    h += '</div>';
    view.innerHTML = h;
    crumb([{ t: 'Calculators' }, { t: tool.name }]);

    if (tool.custom) {
      var root = $('#toolCustom');
      root.addEventListener('input', function () { tool.update(root); });
      tool.update(root);
    } else {
      var form = $('#toolForm');
      var run = function () {
        var g = function (id) { var el = $('#' + id); return el ? el.value : 0; };
        var r = tool.calc(g);
        $('#toolOut').innerHTML = r.html;
        $('#toolChart').innerHTML = (tool.chart && r.chart) ? tool.chart(r.chart) : '';
      };
      form.addEventListener('input', run);
      run();
    }
  }

  /* ============================================================
     VIEW: GLOSSARY
     ============================================================ */
  function vGlossary(params) {
    var q = (params.q || '').toLowerCase();
    var defs = Course.defs.slice().sort(function (a, b) { return a.term.localeCompare(b.term); });
    if (q) defs = defs.filter(function (d) {
      return d.term.toLowerCase().indexOf(q) > -1 || d.def.toLowerCase().indexOf(q) > -1;
    });

    var h = '<div class="hero"><h1>Glossary</h1>' +
      '<p class="lede">All ' + Course.defs.length + ' definitions from the course in one place, alphabetically. ' +
      'Each one is a potential 2-mark question.</p></div>';
    h += '<div class="field" style="max-width:400px"><input class="inp" id="glQ" type="search" ' +
      'placeholder="Filter definitions…" value="' + esc(params.q || '') + '" style="font-family:var(--sans)"></div>';
    h += '<p class="small muted" style="margin-bottom:14px">' + defs.length + ' shown</p>';

    var letters = {};
    defs.forEach(function (d) {
      var L = d.term[0].toUpperCase();
      (letters[L] = letters[L] || []).push(d);
    });
    h += Object.keys(letters).sort().map(function (L) {
      return '<section class="block" style="margin-bottom:22px">' +
        '<h3 style="font-family:var(--mono);color:var(--muted);font-size:.9rem;border-bottom:1px solid var(--rule);padding-bottom:5px">' + L + '</h3>' +
        '<div class="defs">' + letters[L].map(function (d) {
          return '<dl class="def"><dt>' + esc(d.term) +
            ' <a href="#/ch/' + d.ch + '" class="small" style="font-weight:400;font-family:var(--mono);font-size:.7rem;color:var(--muted)">ch ' + d.ch + '</a></dt>' +
            '<dd>' + esc(d.def) + '</dd></dl>';
        }).join('') + '</div></section>';
    }).join('');

    view.innerHTML = h;
    crumb([{ t: 'Glossary' }]);
    var inp = $('#glQ');
    var t;
    inp.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        history.replaceState(null, '', '#/glossary?q=' + encodeURIComponent(inp.value));
        var pos = inp.selectionStart;
        vGlossary({ q: inp.value });
        var ni = $('#glQ'); if (ni) { ni.focus(); ni.setSelectionRange(pos, pos); }
      }, 220);
    });
  }

  /* ============================================================
     VIEW: AI TUTOR
     ============================================================ */
  function vTutor(params) {
    var ctx = {};
    var preload = '';
    if (params.ch) ctx.ch = params.ch;
    if (params.mark) {
      var m = params.mark.match(/^e(\d+)-(\d+)$/);
      if (m) {
        var ch = Course.ch(m[1]);
        var q = ch && ch.exam[Number(m[2])];
        if (q) {
          ctx.ch = m[1];
          var mine = Store.answer(params.mark);
          preload = 'Mark my answer to this question.\n\n' +
            'QUESTION (' + q.cmd + ', ' + q.m + ' marks): ' + q.q + '\n' +
            (q.ctx ? 'CASE: ' + q.ctx + '\n' : '') +
            '\nMY ANSWER:\n' + (mine || '(I have not written an answer yet — please give me a plan instead.)');
        }
      }
    }

    var h = '<div class="hero" style="margin-bottom:18px"><h1>AI examiner</h1>' +
      '<p class="lede">Paste an answer and it will be marked the way a Cambridge examiner marks it: ' +
      'a mark out of the total, what earned credit, what was missing, and one paragraph rewritten to full-mark standard.</p></div>';

    if (!AI.ready()) {
      h += '<div class="card" style="margin-bottom:18px">' +
        '<h3 style="margin-bottom:8px">Add an API key to switch this on</h3>' +
        '<p class="small muted" style="margin-bottom:14px">The key is stored only in this browser and is sent only ' +
        'to the API you choose. It never touches any other server.</p>' +
        '<button class="btn pri" id="tSetup">Open settings</button></div>';
    }

    if (ctx.ch) {
      var c = Course.ch(ctx.ch);
      if (c) h += '<div class="pill b" style="margin-bottom:12px">Context: Chapter ' + c.n + ' — ' + esc(c.title) + '</div>';
    }

    h += '<div class="chips" id="tChips">' +
      chip('Mark this answer for me') +
      chip('Give me a 6-mark question on this chapter') +
      chip('Explain the difference between profit and cash flow') +
      chip('How do I structure a 12-mark answer?') +
      chip('Turn my answer into a full-mark one') +
      '</div>';

    h += '<div class="chat"><div class="chat-log" id="tLog"></div>' +
      '<div class="chat-in"><textarea id="tIn" rows="1" placeholder="Ask a question, or paste an answer to be marked…"></textarea>' +
      '<button class="btn pri" id="tSend">Send</button></div></div>';

    view.innerHTML = h;
    crumb([{ t: 'AI examiner' }]);

    var log = $('#tLog'), inp = $('#tIn');
    if (!AI.history.length) {
      addMsg('a', '<p>I am your Business Studies examiner. I can:</p><ul>' +
        '<li><b>Mark your answers</b> against the real assessment objectives and tell you the mark you would get</li>' +
        '<li><b>Set you questions</b> at any mark tariff, on any chapter</li>' +
        '<li><b>Explain anything</b> in the syllabus with worked examples</li>' +
        '<li><b>Rewrite your paragraph</b> so you can see what full marks looks like</li></ul>' +
        '<p>I will not tell you an answer is good when it is not.</p>');
    } else {
      AI.history.forEach(function (m) {
        addMsg(m.role === 'user' ? 'u' : 'a', m.role === 'user' ? '<p>' + esc(m.content) + '</p>' : AI.md(m.content));
      });
    }

    var setup = $('#tSetup');
    if (setup) setup.addEventListener('click', openSettings);

    $$('#tChips .chip').forEach(function (b) {
      b.addEventListener('click', function () { inp.value = b.dataset.q; inp.focus(); autosize(); });
    });

    inp.addEventListener('input', autosize);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $('#tSend').addEventListener('click', send);

    if (preload) { inp.value = preload; autosize(); }

    function autosize() { inp.style.height = 'auto'; inp.style.height = Math.min(190, inp.scrollHeight) + 'px'; }

    function chip(q) { return '<button class="chip" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }

    function addMsg(kind, html) {
      var d = document.createElement('div');
      d.className = 'msg ' + kind;
      d.innerHTML = '<div class="av">' + (kind === 'u' ? 'You' : '✦') + '</div><div class="bd">' + html + '</div>';
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d.querySelector('.bd');
    }

    function send() {
      var text = inp.value.trim();
      if (!text || AI.busy) return;
      if (!AI.ready()) { openSettings(); return; }
      addMsg('u', '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>');
      inp.value = ''; autosize();
      var body = addMsg('a', '<span class="typing"><i></i><i></i><i></i></span>');
      var acc = '';
      $('#tSend').disabled = true;
      AI.send(text, ctx,
        function (piece) { acc += piece; body.innerHTML = AI.md(acc); log.scrollTop = log.scrollHeight; },
        function () { $('#tSend').disabled = false; if (!acc) body.innerHTML = '<p class="muted">No response received.</p>'; Store.touchStreak(); },
        function (err) {
          $('#tSend').disabled = false;
          body.innerHTML = R.call('trap', esc(err.message), 'Could not get a reply');
        });
    }
  }

  function vNotFound() {
    view.innerHTML = '<div class="card" style="text-align:center;padding:44px">' +
      '<h2 style="margin-bottom:8px">Page not found</h2>' +
      '<p class="muted" style="margin-bottom:16px">That link does not match anything in the course.</p>' +
      '<a class="btn pri" href="#/">Back to the dashboard</a></div>';
    crumb([{ t: 'Not found' }]);
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  function openSettings() {
    var c = AI.cfg();
    var wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = '<div class="modal-box">' +
      '<h2>Settings</h2>' +
      '<p class="small muted" style="margin-bottom:18px">Your API key is stored only in this browser ' +
      '(localStorage) and is sent only to the provider you select. It is never sent anywhere else.</p>' +

      '<div class="field"><label for="sProv">Provider</label><select class="inp" id="sProv">' +
      Object.keys(AI.providers).map(function (k) {
        return '<option value="' + k + '"' + (k === c.provider ? ' selected' : '') + '>' + esc(AI.providers[k].name) + '</option>';
      }).join('') + '</select></div>' +

      '<div class="field"><label for="sKey">API key</label>' +
      '<input class="inp" id="sKey" type="password" value="' + esc(c.key) + '" placeholder="sk-…" autocomplete="off">' +
      '<div class="hint" id="sHint"></div></div>' +

      '<div class="field"><label for="sModel">Model</label><select class="inp" id="sModel"></select></div>' +

      '<div class="field"><label for="sBase">Base URL</label>' +
      '<input class="inp" id="sBase" value="' + esc(c.base) + '">' +
      '<div class="hint">Change this only for a self-hosted or alternative endpoint.</div></div>' +

      '<hr class="hr" style="margin:20px 0">' +
      '<h4 style="margin-bottom:9px">Your progress</h4>' +
      '<p class="small muted" style="margin-bottom:12px">Progress is stored in this browser only. ' +
      'Export it to move to another device.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">' +
      '<button class="btn sm" id="sExport">Export progress</button>' +
      '<button class="btn sm" id="sImport">Import progress</button>' +
      '<button class="btn sm bad" id="sReset">Reset progress</button></div>' +

      '<div style="display:flex;gap:9px;justify-content:flex-end">' +
      '<button class="btn" id="sCancel">Cancel</button>' +
      '<button class="btn pri" id="sSave">Save</button></div></div>';
    document.body.appendChild(wrap);

    var provSel = wrap.querySelector('#sProv'),
        modelSel = wrap.querySelector('#sModel'),
        baseInp = wrap.querySelector('#sBase'),
        hint = wrap.querySelector('#sHint');

    function fillModels() {
      var p = AI.providers[provSel.value];
      modelSel.innerHTML = p.models.map(function (m) {
        return '<option value="' + m[0] + '"' + (m[0] === c.model ? ' selected' : '') + '>' + esc(m[1]) + '</option>';
      }).join('');
      hint.innerHTML = esc(p.keyHint) + (p.keyUrl ? ' — <a href="' + p.keyUrl + '" target="_blank" rel="noopener">get a key</a>' : '');
    }
    fillModels();
    provSel.addEventListener('change', function () {
      baseInp.value = AI.providers[provSel.value].base;
      c.model = AI.providers[provSel.value].models[0][0];
      fillModels();
    });

    wrap.querySelector('#sCancel').addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('#sSave').addEventListener('click', function () {
      Store.setting('provider', provSel.value);
      Store.setting('apiKey', wrap.querySelector('#sKey').value.trim());
      Store.setting('model', modelSel.value);
      Store.setting('baseUrl', baseInp.value.trim());
      close(); toast('Settings saved'); route();
    });
    wrap.querySelector('#sExport').addEventListener('click', function () {
      var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'business-studies-progress.json';
      a.click(); URL.revokeObjectURL(a.href);
    });
    wrap.querySelector('#sImport').addEventListener('click', function () {
      var f = document.createElement('input');
      f.type = 'file'; f.accept = 'application/json';
      f.addEventListener('change', function () {
        var file = f.files[0]; if (!file) return;
        var r = new FileReader();
        r.onload = function () {
          try { Store.importJSON(r.result); close(); toast('Progress imported'); buildNav(); route(); }
          catch (e) { toast('That file could not be read'); }
        };
        r.readAsText(file);
      });
      f.click();
    });
    wrap.querySelector('#sReset').addEventListener('click', function () {
      if (confirm('Reset all chapter ticks, flashcard boxes, quiz scores and saved answers? Your API key is kept.')) {
        Store.reset(); close(); toast('Progress reset'); buildNav(); route();
      }
    });
    function close() { wrap.remove(); }
  }

  /* ============================================================
     SEARCH
     ============================================================ */
  var searchIndex = null;
  function buildSearch() {
    if (searchIndex) return searchIndex;
    var idx = [];
    Course.chapters.forEach(function (c) {
      idx.push({ kind: 'Chapter', title: 'Ch ' + c.n + ' — ' + c.title, sub: c.sub,
                 href: '#/ch/' + c.n, hay: (c.n + ' ' + c.title + ' ' + c.sub).toLowerCase() });
      (c.blocks || []).forEach(function (b, bi) {
        if (b.h2) idx.push({ kind: 'Topic', title: b.h2, sub: 'Chapter ' + c.n + ' — ' + c.title,
                             href: '#/ch/' + c.n, hay: (b.h2 + ' ' + c.title).toLowerCase() });
      });
    });
    Course.defs.forEach(function (d) {
      idx.push({ kind: 'Definition', title: d.term, sub: d.def,
                 href: '#/ch/' + d.ch, hay: (d.term + ' ' + d.def).toLowerCase() });
    });
    Course.exam.forEach(function (q) {
      idx.push({ kind: q.m + '-mark question', title: q.q, sub: 'Chapter ' + q.ch + ' — ' + q.chTitle,
                 href: '#/practice?filter=ch' + q.ch, hay: (q.q + ' ' + (q.ctx || '')).toLowerCase() });
    });
    COMMANDS.forEach(function (c) {
      idx.push({ kind: 'Command word', title: c.w, sub: c.means, href: '#/exam',
                 hay: (c.w + ' ' + c.means).toLowerCase() });
    });
    TOOLS.forEach(function (t) {
      idx.push({ kind: 'Calculator', title: t.name, sub: t.blurb, href: '#/tools?t=' + t.id,
                 hay: (t.name + ' ' + t.blurb).toLowerCase() });
    });
    searchIndex = idx;
    return idx;
  }

  function wireSearch() {
    var inp = $('#search'), box = $('#searchRes'), sel = -1, results = [];
    function hide() { box.hidden = true; sel = -1; }
    function run() {
      var q = inp.value.trim().toLowerCase();
      if (q.length < 2) return hide();
      var idx = buildSearch();
      results = idx.filter(function (r) { return r.hay.indexOf(q) > -1; })
        .sort(function (a, b) {
          var ai = a.title.toLowerCase().indexOf(q), bi = b.title.toLowerCase().indexOf(q);
          if ((ai > -1) !== (bi > -1)) return ai > -1 ? -1 : 1;
          return a.title.length - b.title.length;
        }).slice(0, 12);
      if (!results.length) {
        box.innerHTML = '<div class="sr-item"><div class="sr-sub">Nothing found for “' + esc(inp.value) + '”</div></div>';
      } else {
        box.innerHTML = results.map(function (r, i) {
          return '<a class="sr-item" href="' + r.href + '" data-i="' + i + '">' +
            '<div class="sr-kind">' + esc(r.kind) + '</div>' +
            '<div class="sr-title">' + esc(r.title) + '</div>' +
            '<div class="sr-sub">' + esc(r.sub || '') + '</div></a>';
        }).join('');
      }
      box.hidden = false; sel = -1;
    }
    var t;
    inp.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 130); });
    inp.addEventListener('focus', function () { if (inp.value.trim().length > 1) run(); });
    inp.addEventListener('keydown', function (e) {
      var items = $$('.sr-item', box);
      if (e.key === 'Escape') { inp.blur(); hide(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        items.forEach(function (i) { i.classList.remove('sel'); });
        sel = e.key === 'ArrowDown' ? (sel + 1) % items.length : (sel - 1 + items.length) % items.length;
        items[sel].classList.add('sel');
        items[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (sel > -1 && items[sel]) { location.hash = items[sel].getAttribute('href'); inp.blur(); hide(); }
        else if (results[0]) { location.hash = results[0].href; inp.blur(); hide(); }
      }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-wrap')) hide();
    });
    box.addEventListener('click', function () { setTimeout(hide, 10); inp.blur(); });
  }

  /* ============================================================
     ROUTER
     ============================================================ */
  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?');
    var path = qi > -1 ? h.slice(0, qi) : h;
    var params = {};
    if (qi > -1) {
      h.slice(qi + 1).split('&').forEach(function (kv) {
        var p = kv.split('=');
        if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
    }
    return { path: path, params: params };
  }

  function route() {
    var r = parseHash(), p = r.path;
    window.scrollTo(0, 0);
    $('#sidebar').classList.remove('open');
    var scrim = $('.scrim'); if (scrim) scrim.remove();

    if (p === '/' || p === '') vHome();
    else if (p === '/exam') vExam();
    else if (p === '/flashcards') vFlashcards(r.params);
    else if (p === '/quiz') vQuiz(r.params);
    else if (p === '/practice') vPractice(r.params);
    else if (p === '/tools') vTools(r.params);
    else if (p === '/glossary') vGlossary(r.params);
    else if (p === '/tutor') vTutor(r.params);
    else if (/^\/s\/\d+$/.test(p)) vSection(p.split('/')[2]);
    else if (/^\/ch\/\d+$/.test(p)) vChapter(p.split('/')[2]);
    else vNotFound();

    syncNav(p);
    view.focus({ preventScroll: true });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function applyTheme() {
    var t = Store.setting('theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  function boot() {
    applyTheme();
    buildNav();
    wireSearch();

    $('#themeBtn').addEventListener('click', function () {
      var cur = Store.setting('theme');
      var next = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark';
      Store.setting('theme', next);
      applyTheme();
      toast(next ? next.charAt(0).toUpperCase() + next.slice(1) + ' theme' : 'Matching your system');
    });
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#printBtn').addEventListener('click', function () { window.print(); });
    $('#menuBtn').addEventListener('click', function () {
      var sb = $('#sidebar');
      sb.classList.add('open');
      var s = document.createElement('div');
      s.className = 'scrim';
      s.addEventListener('click', function () { sb.classList.remove('open'); s.remove(); });
      document.body.appendChild(s);
    });

    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === '/' && !typing) { e.preventDefault(); $('#search').focus(); return; }
      if (typing) return;
      // flashcard shortcuts
      var stage = $('#fcStage');
      if (stage && location.hash.indexOf('/flashcards') > -1) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (stage._flip) stage._flip(); }
        else if (e.key === '2' || e.key === 'ArrowRight') { var y = $('#fcYes'); if (y && !$('#fcCtrl').hidden) y.click(); }
        else if (e.key === '1' || e.key === 'ArrowLeft') { var nb = $('#fcNo'); if (nb && !$('#fcCtrl').hidden) nb.click(); }
      }
      // quiz shortcuts
      if (location.hash.indexOf('/quiz') > -1) {
        var k = 'abcd'.indexOf(e.key.toLowerCase());
        if (k > -1) { var b = $$('#qOpts .opt')[k]; if (b && !b.disabled) b.click(); }
        if (e.key === 'Enter') { var nx = $('#qNext'); if (nx) nx.click(); }
      }
    });

    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
