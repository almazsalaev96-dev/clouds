/* ============================================================
   ai.js — the AI examiner
   Supports Anthropic (direct browser access) and any
   OpenAI-compatible endpoint. The key lives only in this
   browser's localStorage and is sent only to the chosen API.
   ============================================================ */
(function () {
  'use strict';

  var PROVIDERS = {
    anthropic: {
      name: 'Anthropic (Claude)',
      base: 'https://api.anthropic.com',
      models: [
        ['claude-sonnet-5', 'Claude Sonnet 5 — recommended'],
        ['claude-opus-5', 'Claude Opus 5 — most capable'],
        ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5 — fastest'],
        ['claude-fable-5-1', 'Claude Fable 5.1']
      ],
      keyHint: 'Starts with sk-ant-',
      keyUrl: 'https://console.anthropic.com/settings/keys'
    },
    openai: {
      name: 'OpenAI-compatible',
      base: 'https://api.openai.com',
      models: [['gpt-4o-mini', 'gpt-4o-mini'], ['gpt-4o', 'gpt-4o']],
      keyHint: 'Any OpenAI-compatible key. Change the base URL for other providers.',
      keyUrl: ''
    }
  };

  var SYSTEM = [
    'You are an experienced Cambridge IGCSE / O Level Business Studies examiner and tutor for syllabus 0450 / 0986 / 7115.',
    '',
    'YOUR JOB is to get this student the highest possible grade. Be warm but rigorous. Never flatter a weak answer.',
    '',
    'THE ASSESSMENT OBJECTIVES you mark against:',
    '- AO1 Knowledge (30%): correct business terms and concepts.',
    '- AO2 Application (20%): USES the specific business in the question — its name, product, size, people, numbers. Generic answers are capped.',
    '- AO3 Analysis (30%): chains of reasoning. Point -> applied to this business -> consequence (cost, revenue, profit, motivation, market share, cash flow).',
    '- AO4 Evaluation (20%): weighs both sides then DECIDES, with a reason grounded in the case and a statement of why the alternative was rejected.',
    '',
    'MARK ALLOCATIONS: 2 = define/identify. 4 = outline (2 points + 2 developments). 6 = explain (2 points, applied + analysed) or justify (both sides + judgement). 8 = Paper 2 part (a). 12 = Paper 2 part (b): all options weighed, then a decided recommendation.',
    '',
    'WHEN THE STUDENT SUBMITS AN ANSWER TO MARK, reply in exactly this structure:',
    '1. **Mark: X / Y** — the mark you would award, and the band.',
    '2. **What earned marks** — quote their actual words back to them.',
    '3. **What was missing** — be specific about which AO was weak and why.',
    '4. **Model upgrade** — rewrite ONE of their paragraphs to full-mark standard so they can see the difference.',
    '5. **The one habit to fix** — a single actionable instruction for next time.',
    '',
    'WHEN THE STUDENT ASKS A CONTENT QUESTION: answer precisely, define the key terms, give a worked example or a named business, and finish with how it is likely to be examined.',
    '',
    'ALWAYS: show formulas, substitution and units for any calculation. Use UK/international spelling. Use British/Cambridge terminology (revenue, not sales income; non-current assets, not fixed assets, though note both). Keep to the 0450 syllabus - do not introduce A Level content such as investment appraisal, Ansoff or Boston Matrix unless the student asks.',
    '',
    'NEVER just praise. If an answer is a 3/6, say so and show exactly what a 6/6 looks like.'
  ].join('\n');

  var AI = {
    providers: PROVIDERS,
    history: [],
    busy: false,

    /* When this page runs as a published Claude Artifact, the viewer's own
       Claude account can answer — no API key needed. Resolved asynchronously
       at load; stays null everywhere else. */
    sample: null,
    hostChecked: false,

    cfg: function () {
      var s = Store.state.settings;
      var p = s.provider || 'anthropic';
      return {
        provider: p,
        key: s.apiKey || '',
        model: s.model || PROVIDERS[p].models[0][0],
        base: s.baseUrl || PROVIDERS[p].base
      };
    },
    ready: function () { return !!this.sample || !!this.cfg().key; },
    hosted: function () { return !!this.sample; },

    /* Build a system prompt that includes what the student is currently studying */
    systemFor: function (ctx) {
      var s = SYSTEM;
      if (ctx && ctx.ch) {
        var ch = Course.ch(ctx.ch);
        if (ch) {
          s += '\n\nTHE STUDENT IS CURRENTLY STUDYING: Chapter ' + ch.n + ' — ' + ch.title +
               ' (Section ' + ch.s + '). Key terms in this chapter: ' +
               (ch.defs || []).map(function (d) { return d[0]; }).join('; ') + '.' +
               '\nPrefer examples and questions from this chapter unless the student asks otherwise.';
        }
      }
      return s;
    },

    reset: function () { this.history = []; },

    /* ---- the call ---- */
    send: function (text, ctx, onDelta, onDone, onError) {
      var c = this.cfg();
      if (this.sample) { this.sendHosted(text, ctx, onDelta, onDone, onError); return; }
      if (!c.key) { onError(new Error('No API key set. Open Settings to add one.')); return; }
      var self = this;
      this.history.push({ role: 'user', content: text });
      this.busy = true;

      var url, headers, body;
      if (c.provider === 'anthropic') {
        url = c.base.replace(/\/$/, '') + '/v1/messages';
        headers = {
          'content-type': 'application/json',
          'x-api-key': c.key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        };
        body = {
          model: c.model, max_tokens: 2000, stream: true,
          system: this.systemFor(ctx),
          messages: this.history.slice(-16)
        };
      } else {
        url = c.base.replace(/\/$/, '') + '/v1/chat/completions';
        headers = { 'content-type': 'application/json', 'authorization': 'Bearer ' + c.key };
        body = {
          model: c.model, max_tokens: 2000, stream: true,
          messages: [{ role: 'system', content: this.systemFor(ctx) }].concat(this.history.slice(-16))
        };
      }

      var acc = '';
      fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) })
        .then(function (res) {
          if (!res.ok) {
            return res.text().then(function (t) {
              var msg = 'API error ' + res.status;
              try {
                var j = JSON.parse(t);
                msg = (j.error && (j.error.message || j.error.type)) || msg;
              } catch (e) { if (t) msg += ': ' + t.slice(0, 200); }
              if (res.status === 401) msg = 'Your API key was rejected (401). Check it in Settings.';
              if (res.status === 429) msg = 'Rate limited (429). Wait a few seconds and try again.';
              throw new Error(msg);
            });
          }
          if (!res.body || !res.body.getReader) {
            return res.json().then(function (j) {
              var t = self.extractWhole(j, c.provider);
              acc = t; onDelta(t);
            });
          }
          var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
          function pump() {
            return reader.read().then(function (r) {
              if (r.done) return;
              buf += dec.decode(r.value, { stream: true });
              var lines = buf.split('\n');
              buf = lines.pop();
              lines.forEach(function (line) {
                line = line.trim();
                if (!line || line.indexOf('data:') !== 0) return;
                var payload = line.slice(5).trim();
                if (payload === '[DONE]') return;
                var j; try { j = JSON.parse(payload); } catch (e) { return; }
                var piece = self.extractDelta(j, c.provider);
                if (piece) { acc += piece; onDelta(piece); }
              });
              return pump();
            });
          }
          return pump();
        })
        .then(function () {
          self.busy = false;
          if (acc) self.history.push({ role: 'assistant', content: acc });
          onDone(acc);
        })
        .catch(function (e) {
          self.busy = false;
          self.history.pop();          // drop the user turn so a retry is clean
          var m = e && e.message ? e.message : String(e);
          if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
            m = 'Could not reach the API. If you opened this page from a file:// path, ' +
                'some browsers block the request — run it from a local server instead (see the README). ' +
                'Otherwise check your internet connection and the base URL in Settings.';
          }
          onError(new Error(m));
        });
    },

    /* ---- the same call, answered by the viewer's own Claude account ---- */
    sendHosted: function (text, ctx, onDelta, onDone, onError) {
      var self = this;
      this.history.push({ role: 'user', content: text });
      this.busy = true;

      /* sample() is memory-less, so the examiner brief is carried in the turns. */
      var turns = [
        { role: 'user', content: this.systemFor(ctx) + '\n\nReply "Ready." and nothing else.' },
        { role: 'assistant', content: 'Ready.' }
      ].concat(this.history.slice(-16));

      var acc = '';
      this.sample(turns, {
        cache: false,
        modelTier: 'default',
        onText: function (ev) {
          var whole = (ev && ev.text) || '';
          var piece = (ev && typeof ev.delta === 'string') ? ev.delta : whole.slice(acc.length);
          if (!piece) return;
          acc = whole || (acc + piece);
          onDelta(piece);
        }
      }).then(function (res) {
        self.busy = false;
        var full = (res && res.text) || acc;
        if (full && full.length > acc.length) onDelta(full.slice(acc.length));
        acc = full;
        if (acc) self.history.push({ role: 'assistant', content: acc });
        onDone(acc);
      }).catch(function (e) {
        self.busy = false;
        self.history.pop();
        var code = e && e.code, m = (e && e.message) || String(e);
        if (code === 'not_granted') m = 'This page does not have permission to ask Claude. Add your own API key in Settings instead.';
        else if (code === 'rate_limited') m = 'Too many requests in a row. Wait about a minute, then try again.';
        else if (code === 'cancelled') m = 'The request was cancelled.';
        else if (code === 'too_large') m = 'That message is too long. Shorten the answer you pasted and try again.';
        onError(new Error(m));
      });
    },

    /* Resolve the artifact runtime capability, if this page is running inside one. */
    initHost: function () {
      var self = this;
      function done() {
        self.hostChecked = true;
        try { window.dispatchEvent(new CustomEvent('ai-host-ready')); } catch (e) {}
      }
      if (!window.claude || typeof window.claude.use !== 'function') { done(); return; }
      try {
        Promise.resolve(window.claude.use('sample')).then(function (fn) {
          if (typeof fn === 'function') self.sample = fn;
          done();
        }, done);
      } catch (e) { done(); }
    },

    extractDelta: function (j, provider) {
      if (provider === 'anthropic') {
        if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') return j.delta.text;
        return '';
      }
      var ch = j.choices && j.choices[0];
      return (ch && ch.delta && ch.delta.content) || '';
    },
    extractWhole: function (j, provider) {
      if (provider === 'anthropic') {
        return (j.content || []).map(function (b) { return b.text || ''; }).join('');
      }
      var ch = j.choices && j.choices[0];
      return (ch && ch.message && ch.message.content) || '';
    }
  };

  /* ---- tiny markdown renderer for the chat pane ---- */
  function md(src) {
    var t = String(src == null ? '' : src);
    t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    var blocks = t.split(/\n{2,}/).map(function (b) {
      b = b.trim();
      if (!b) return '';
      // table
      if (/^\|.*\|/.test(b) && /\n\s*\|[\s:|-]+\|/.test(b)) {
        var rows = b.split('\n').filter(function (r) { return /\|/.test(r); });
        var cells = rows.map(function (r) {
          return r.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
        });
        var head = cells.shift();
        cells = cells.filter(function (r) { return !/^[-: ]+$/.test(r.join('')); });
        return '<div class="tbl-wrap"><table><thead><tr>' +
          head.map(function (c) { return '<th>' + inl(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + cells.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + inl(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>';
      }
      // headings
      var h = b.match(/^(#{1,4})\s+(.*)$/);
      if (h) { var lv = Math.min(4, h[1].length + 2); return '<h' + lv + '>' + inl(h[2]) + '</h' + lv + '>'; }
      // ordered list
      if (/^\d+[.)]\s/.test(b)) {
        return '<ol>' + b.split('\n').map(function (l) {
          return '<li>' + inl(l.replace(/^\s*\d+[.)]\s*/, '')) + '</li>';
        }).join('') + '</ol>';
      }
      // unordered list
      if (/^[-*•]\s/.test(b)) {
        return '<ul>' + b.split('\n').map(function (l) {
          return '<li>' + inl(l.replace(/^\s*[-*•]\s*/, '')) + '</li>';
        }).join('') + '</ul>';
      }
      return '<p>' + inl(b).replace(/\n/g, '<br>') + '</p>';
    });
    return blocks.join('');

    function inl(s) {
      return s
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    }
  }

  AI.md = md;
  window.AI = AI;
  AI.initHost();
})();
