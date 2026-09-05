/* ============================================================
   tools.js — exam calculators
   ============================================================ */
(function () {
  'use strict';

  function n(v) { var x = parseFloat(String(v).replace(/[, $%]/g, '')); return isFinite(x) ? x : 0; }
  function money(v) {
    if (!isFinite(v)) return '—';
    var r = Math.round(v * 100) / 100;
    return (r < 0 ? '-$' : '$') + Math.abs(r).toLocaleString();
  }
  function num(v, dp) {
    if (!isFinite(v)) return '—';
    var f = Math.pow(10, dp == null ? 2 : dp);
    return (Math.round(v * f) / f).toLocaleString();
  }
  function pct(v, dp) { return isFinite(v) ? num(v, dp == null ? 1 : dp) + '%' : '—'; }

  function field(id, label, val, hint, unit) {
    return '<div class="field"><label for="' + id + '">' + R.esc(label) +
      (unit ? ' <span class="muted small">(' + R.esc(unit) + ')</span>' : '') + '</label>' +
      '<input class="inp" id="' + id + '" type="number" step="any" value="' + val + '" inputmode="decimal">' +
      (hint ? '<div class="hint">' + R.esc(hint) + '</div>' : '') + '</div>';
  }
  function row(k, v, hi) {
    return '<div class="out-row' + (hi ? ' hi' : '') + '"><span class="k">' + R.esc(k) +
      '</span><span class="v">' + v + '</span></div>';
  }

  /* ---------------------------------------------------------
     1. BREAK-EVEN
     --------------------------------------------------------- */
  var breakEven = {
    id: 'be', name: 'Break-even', icon: '◺',
    blurb: 'Contribution, break-even output, margin of safety, profit — with a chart. Chapter 19.',
    form: function () {
      return field('be_fc', 'Fixed costs', 50000, 'Total overheads for the period', '$') +
             field('be_p',  'Selling price per unit', 8, '', '$') +
             field('be_vc', 'Variable cost per unit', 2, 'Materials + direct labour per unit', '$') +
             field('be_q',  'Current or planned sales', 12000, 'Units sold in the period', 'units');
    },
    calc: function (g) {
      var fc = n(g('be_fc')), p = n(g('be_p')), vc = n(g('be_vc')), q = n(g('be_q'));
      var contrib = p - vc;
      var be = contrib > 0 ? fc / contrib : Infinity;
      var beUp = isFinite(be) ? Math.ceil(be) : Infinity;
      var mos = isFinite(beUp) ? q - beUp : NaN;
      var profit = q * contrib - fc;
      var rev = q * p;
      var out = row('Contribution per unit', money(contrib)) +
        row('Break-even output', isFinite(beUp) ? num(beUp, 0) + ' units' : 'never — price is below variable cost', true) +
        row('Break-even revenue', isFinite(beUp) ? money(beUp * p) : '—') +
        row('Margin of safety', isFinite(mos) ? num(mos, 0) + ' units' : '—') +
        row('Total revenue', money(rev)) +
        row('Total costs', money(fc + q * vc)) +
        row(profit >= 0 ? 'Profit' : 'Loss', money(Math.abs(profit)), true);
      var note = '';
      if (contrib <= 0) {
        note = R.call('trap', 'Selling price is not above variable cost, so every unit sold **increases** the loss. The business can never break even at this price.');
      } else if (isFinite(mos) && mos < 0) {
        note = R.call('trap', 'Current sales of ' + num(q, 0) + ' units are **below** break-even of ' + num(beUp, 0) +
          ' units, so the business is making a loss of ' + money(Math.abs(profit)) + '.');
      } else if (isFinite(mos)) {
        var pctMos = q ? (mos / q * 100) : 0;
        note = R.call('key', 'Sales could fall by **' + num(mos, 0) + ' units (' + pct(pctMos) +
          ')** before a loss is made. In the exam, always round break-even output **up** and give the answer with units and a time period.');
      }
      return { html: out + note, chart: { fc: fc, p: p, vc: vc, q: q, be: beUp } };
    },
    chart: function (d) {
      if (!isFinite(d.be) || d.p <= d.vc) return '';
      var maxQ = Math.max(d.q, d.be) * 1.35 || 100;
      var maxY = Math.max(maxQ * d.p, d.fc + maxQ * d.vc) || 100;
      var W = 640, H = 300, L = 62, B = 34, T = 12, Rt = 14;
      var pw = W - L - Rt, ph = H - T - B;
      function X(q) { return L + (q / maxQ) * pw; }
      function Y(v) { return T + ph - (v / maxY) * ph; }
      var g = '';
      // gridlines
      for (var i = 0; i <= 4; i++) {
        var yv = maxY * i / 4;
        g += '<line x1="' + L + '" y1="' + Y(yv) + '" x2="' + (W - Rt) + '" y2="' + Y(yv) +
             '" stroke="var(--rule)" stroke-width="1"/>' +
             '<text x="' + (L - 7) + '" y="' + (Y(yv) + 4) + '" text-anchor="end" font-size="10" ' +
             'fill="var(--muted)" font-family="var(--mono)">' + (yv >= 1000 ? Math.round(yv / 1000) + 'k' : Math.round(yv)) + '</text>';
      }
      // profit / loss shading
      g += '<polygon points="' + X(0) + ',' + Y(d.fc) + ' ' + X(d.be) + ',' + Y(d.be * d.p) + ' ' + X(0) + ',' + Y(0) +
           '" fill="var(--bad)" opacity=".10"/>';
      g += '<polygon points="' + X(d.be) + ',' + Y(d.be * d.p) + ' ' + X(maxQ) + ',' + Y(maxQ * d.p) + ' ' +
           X(maxQ) + ',' + Y(d.fc + maxQ * d.vc) + '" fill="var(--good)" opacity=".13"/>';
      // lines
      g += '<line x1="' + X(0) + '" y1="' + Y(d.fc) + '" x2="' + X(maxQ) + '" y2="' + Y(d.fc) +
           '" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4"/>';
      g += '<line x1="' + X(0) + '" y1="' + Y(d.fc) + '" x2="' + X(maxQ) + '" y2="' + Y(d.fc + maxQ * d.vc) +
           '" stroke="var(--bad)" stroke-width="2"/>';
      g += '<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(maxQ) + '" y2="' + Y(maxQ * d.p) +
           '" stroke="var(--good)" stroke-width="2"/>';
      // break-even marker
      g += '<line x1="' + X(d.be) + '" y1="' + Y(d.be * d.p) + '" x2="' + X(d.be) + '" y2="' + (T + ph) +
           '" stroke="var(--brand)" stroke-width="1" stroke-dasharray="3 3"/>' +
           '<circle cx="' + X(d.be) + '" cy="' + Y(d.be * d.p) + '" r="4.5" fill="var(--brand)"/>' +
           '<text x="' + X(d.be) + '" y="' + (T + ph + 20) + '" text-anchor="middle" font-size="10" ' +
           'fill="var(--brand)" font-family="var(--mono)">BE ' + num(d.be, 0) + '</text>';
      // current output marker
      if (d.q > 0 && Math.abs(d.q - d.be) > maxQ * 0.04) {
        g += '<line x1="' + X(d.q) + '" y1="' + T + '" x2="' + X(d.q) + '" y2="' + (T + ph) +
             '" stroke="var(--ink-soft)" stroke-width="1" stroke-dasharray="2 4" opacity=".6"/>' +
             '<text x="' + X(d.q) + '" y="' + (T + ph + 20) + '" text-anchor="middle" font-size="10" ' +
             'fill="var(--muted)" font-family="var(--mono)">' + num(d.q, 0) + '</text>';
      }
      // axes
      g += '<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (T + ph) + '" stroke="var(--rule-strong)"/>' +
           '<line x1="' + L + '" y1="' + (T + ph) + '" x2="' + (W - Rt) + '" y2="' + (T + ph) + '" stroke="var(--rule-strong)"/>';
      var legend = '<div class="small muted" style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px">' +
        '<span><b style="color:var(--good)">━</b> Sales revenue</span>' +
        '<span><b style="color:var(--bad)">━</b> Total costs</span>' +
        '<span><b style="color:var(--muted)">╌</b> Fixed costs</span>' +
        '<span><b style="color:var(--brand)">●</b> Break-even point</span></div>';
      return '<div style="overflow-x:auto"><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" ' +
        'style="max-width:' + W + 'px;height:auto" role="img" aria-label="Break-even chart">' + g + '</svg></div>' + legend;
    }
  };

  /* ---------------------------------------------------------
     2. RATIOS
     --------------------------------------------------------- */
  var ratios = {
    id: 'ratio', name: 'Ratio analysis', icon: '%',
    blurb: 'Gross and net profit margin, ROCE, current ratio and acid test — with interpretation. Chapter 26.',
    form: function () {
      return '<h4 style="margin-bottom:10px">Profitability</h4>' +
        field('r_rev', 'Revenue', 1300000, '', '$') +
        field('r_gp', 'Gross profit', 400000, 'Revenue − cost of sales', '$') +
        field('r_np', 'Net profit', 280000, 'After all expenses', '$') +
        field('r_ce', 'Capital employed', 1065000, 'Equity + non-current liabilities', '$') +
        '<h4 style="margin:20px 0 10px">Liquidity</h4>' +
        field('r_ca', 'Current assets', 125000, '', '$') +
        field('r_inv', 'Inventories', 50000, 'Included in current assets above', '$') +
        field('r_cl', 'Current liabilities', 100000, '', '$');
    },
    calc: function (g) {
      var rev = n(g('r_rev')), gp = n(g('r_gp')), np = n(g('r_np')), ce = n(g('r_ce'));
      var ca = n(g('r_ca')), inv = n(g('r_inv')), cl = n(g('r_cl'));
      var gpm = rev ? gp / rev * 100 : NaN;
      var npm = rev ? np / rev * 100 : NaN;
      var roce = ce ? np / ce * 100 : NaN;
      var cur = cl ? ca / cl : NaN;
      var acid = cl ? (ca - inv) / cl : NaN;
      var wc = ca - cl;

      var out = row('Gross profit margin', pct(gpm)) +
        row('Net profit margin', pct(npm)) +
        row('Return on capital employed', pct(roce), true) +
        row('Working capital', money(wc)) +
        row('Current ratio', num(cur)) +
        row('Acid test ratio', num(acid), true);

      var notes = [];
      if (isFinite(gpm) && isFinite(npm)) {
        notes.push('On every $1 of sales the business keeps **' + num(gpm / 100, 2) +
          '** as gross profit and **' + num(npm / 100, 2) + '** as net profit. The gap between them is the overheads.');
      }
      if (isFinite(roce)) {
        notes.push('For every $1 of capital invested, the business earns **' + num(roce / 100, 3) +
          '** of net profit. Compare this with last year and with a competitor — one ROCE figure alone means nothing.');
      }
      var liq = '';
      if (isFinite(cur)) {
        if (cur < 1) liq = R.call('trap', 'A current ratio below 1 means current liabilities **exceed** current assets. The business cannot cover its short-term debts from its short-term assets — a serious liquidity warning.');
        else if (cur > 2) liq = R.call('tip', 'A current ratio above 2 may mean **too much working capital tied up** in cash or stock that is not earning a return.');
        else liq = R.call('key', 'A current ratio between 1.5 and 2 is generally considered safe. Below 1 is dangerous; above 2 may mean idle capital.');
      }
      if (isFinite(acid) && acid < 0.8) {
        liq += R.call('trap', 'An acid test of ' + num(acid) + ' means that without selling any inventories the business could meet only ' +
          pct(acid * 100, 0) + ' of its short-term debts. The wider the gap between the current ratio and the acid test, the more its liquidity depends on selling stock.');
      }
      return { html: out + R.call('key', notes) + liq };
    }
  };

  /* ---------------------------------------------------------
     3. CASH FLOW FORECAST
     --------------------------------------------------------- */
  var cashflow = {
    id: 'cf', name: 'Cash flow forecast', icon: '≋',
    blurb: 'Build a six-month forecast; net cash flow and closing balances calculated for you. Chapter 23.',
    custom: true,
    render: function () {
      var months = ['Month 1','Month 2','Month 3','Month 4','Month 5','Month 6'];
      var h = '<div class="field" style="max-width:220px">' +
        '<label for="cf_open">Opening cash balance ($)</label>' +
        '<input class="inp" id="cf_open" type="number" step="any" value="5000"></div>' +
        '<div class="tbl-wrap"><table><thead><tr><th></th>' +
        months.map(function (m) { return '<th class="num">' + m + '</th>'; }).join('') +
        '</tr></thead><tbody>' +
        '<tr><td><b>Cash inflows</b></td>' + months.map(function (_, i) {
          return '<td><input class="inp cf-in" data-i="' + i + '" type="number" step="any" value="' +
            [20000,20000,27000,33000,30000,30000][i] + '" style="min-width:92px"></td>';
        }).join('') + '</tr>' +
        '<tr><td><b>Cash outflows</b></td>' + months.map(function (_, i) {
          return '<td><input class="inp cf-out" data-i="' + i + '" type="number" step="any" value="' +
            [18000,18000,30000,22000,32000,26000][i] + '" style="min-width:92px"></td>';
        }).join('') + '</tr>' +
        '<tr id="cfRowOpen"><td class="muted">Opening balance</td>' + months.map(function () { return '<td class="num">—</td>'; }).join('') + '</tr>' +
        '<tr id="cfRowNet"><td><b>Net cash flow</b></td>' + months.map(function () { return '<td class="num">—</td>'; }).join('') + '</tr>' +
        '<tr id="cfRowClose"><td><b>Closing balance</b></td>' + months.map(function () { return '<td class="num">—</td>'; }).join('') + '</tr>' +
        '</tbody></table></div><div id="cfNotes"></div>';
      return h;
    },
    update: function (root) {
      var open = n(root.querySelector('#cf_open').value);
      var ins = [].slice.call(root.querySelectorAll('.cf-in')).map(function (e) { return n(e.value); });
      var outs = [].slice.call(root.querySelectorAll('.cf-out')).map(function (e) { return n(e.value); });
      var rowO = root.querySelector('#cfRowOpen').children,
          rowN = root.querySelector('#cfRowNet').children,
          rowC = root.querySelector('#cfRowClose').children;
      var bal = open, worst = Infinity, worstM = 0, negMonths = 0;
      for (var i = 0; i < 6; i++) {
        var net = ins[i] - outs[i];
        var close = bal + net;
        rowO[i + 1].textContent = fmtNeg(bal);
        rowN[i + 1].textContent = fmtNeg(net);
        rowN[i + 1].style.color = net < 0 ? 'var(--bad)' : 'var(--good)';
        rowC[i + 1].textContent = fmtNeg(close);
        rowC[i + 1].style.color = close < 0 ? 'var(--bad)' : 'var(--ink)';
        rowC[i + 1].style.fontWeight = '600';
        if (close < worst) { worst = close; worstM = i + 1; }
        if (close < 0) negMonths++;
        bal = close;
      }
      var notes;
      if (worst < 0) {
        notes = R.call('trap', 'The forecast shows the business overdrawn in **' + negMonths +
          ' of the 6 months**, at its worst in month ' + worstM + ' at **' + fmtNeg(worst) +
          '**. That is the overdraft facility the business must agree with its bank — *in advance*. ' +
          'Going to the bank after exceeding the limit means refusal, or a much higher interest rate.');
      } else if (worst > (Math.max.apply(null, outs) * 3)) {
        notes = R.call('tip', 'The lowest balance is ' + fmtNeg(worst) +
          ' — comfortably positive throughout. A very high cash balance means capital sitting idle; it could repay loans to save interest, or pay creditors early to earn discounts.');
      } else {
        notes = R.call('key', 'The forecast stays positive throughout, with a lowest balance of **' + fmtNeg(worst) +
          '** in month ' + worstM + '. Remember: **each closing balance becomes the next month\'s opening balance** — that carry-forward is where most exam marks are lost.');
      }
      root.querySelector('#cfNotes').innerHTML = notes;
      function fmtNeg(v) {
        var s = '$' + Math.abs(Math.round(v)).toLocaleString();
        return v < 0 ? '(' + s + ')' : s;
      }
    }
  };

  /* ---------------------------------------------------------
     4. COSTS, PROFIT & ADDED VALUE
     --------------------------------------------------------- */
  var costs = {
    id: 'cost', name: 'Costs, profit & added value', icon: '∑',
    blurb: 'Total cost, average cost, added value, mark-up pricing and market share. Chapters 1, 5, 13, 19, 24.',
    form: function () {
      return field('c_fc', 'Fixed costs for the period', 9000000, '', '$') +
             field('c_vc', 'Variable cost per unit', 3750, 'Bought-in materials + direct labour', '$') +
             field('c_q',  'Output / units sold', 4000, '', 'units') +
             field('c_p',  'Selling price per unit', 6000, '', '$') +
             field('c_mat','Bought-in materials per unit', 1500, 'For the added-value calculation', '$') +
             field('c_mkt','Total market sales', 100000000, 'For the market share calculation', '$');
    },
    calc: function (g) {
      var fc = n(g('c_fc')), vc = n(g('c_vc')), q = n(g('c_q')), p = n(g('c_p')),
          mat = n(g('c_mat')), mkt = n(g('c_mkt'));
      var tvc = vc * q, tc = fc + tvc, ac = q ? tc / q : NaN;
      var rev = p * q, gp = rev - tvc, profit = rev - tc;
      var av = p - mat, avTotal = av * q;
      var share = mkt ? rev / mkt * 100 : NaN;
      var markup = ac ? (p - ac) / ac * 100 : NaN;
      var margin = p ? (p - ac) / p * 100 : NaN;
      return { html:
        row('Total variable cost', money(tvc)) +
        row('Total cost', money(tc), true) +
        row('Average cost per unit', money(ac), true) +
        row('Total revenue', money(rev)) +
        row('Profit', money(profit), true) +
        row('Added value per unit', money(av)) +
        row('Total added value', money(avTotal)) +
        row('Mark-up on cost', pct(markup)) +
        row('Profit margin on price', pct(margin)) +
        row('Market share', pct(share)) +
        R.call('key', [
          'Added value of **' + money(av) + '** per unit is **not profit** — out of it the business must still pay wages, rent, power and marketing.',
          'Note the difference between **mark-up** (' + pct(markup) + ', calculated on cost) and **margin** (' + pct(margin) +
          ', calculated on price). Exam questions use mark-up on cost unless they say otherwise.'
        ])
      };
    }
  };

  /* ---------------------------------------------------------
     5. PRODUCTIVITY
     --------------------------------------------------------- */
  var productivity = {
    id: 'prod', name: 'Productivity', icon: '⚙',
    blurb: 'Labour productivity across two years — and whether efficiency actually improved. Chapter 18.',
    form: function () {
      return '<h4 style="margin-bottom:10px">Year 1</h4>' +
        field('p_o1', 'Output', 10000, '', 'units') +
        field('p_e1', 'Employees', 30, '', 'people') +
        '<h4 style="margin:20px 0 10px">Year 2</h4>' +
        field('p_o2', 'Output', 25000, '', 'units') +
        field('p_e2', 'Employees', 50, '', 'people');
    },
    calc: function (g) {
      var o1 = n(g('p_o1')), e1 = n(g('p_e1')), o2 = n(g('p_o2')), e2 = n(g('p_e2'));
      var p1 = e1 ? o1 / e1 : NaN, p2 = e2 ? o2 / e2 : NaN;
      var dProd = (isFinite(p1) && p1) ? (p2 - p1) / p1 * 100 : NaN;
      var dOut = o1 ? (o2 - o1) / o1 * 100 : NaN;
      var note;
      if (!isFinite(dProd)) note = '';
      else if (dProd > 1) {
        note = R.call('key', 'Output rose **' + pct(dOut) + '** and productivity rose **' + pct(dProd) +
          '** — the business is genuinely more efficient, so cost per unit should have fallen.');
      } else if (dProd < -1) {
        note = R.call('trap', 'Output rose **' + pct(dOut) + '** but productivity **fell ' + pct(Math.abs(dProd)) +
          '**. More is being produced only because more people were hired — efficiency has got worse and cost per unit will have risen.');
      } else {
        note = R.call('trap', 'Output changed by **' + pct(dOut) + '** but productivity is essentially **unchanged**. ' +
          'The extra output came entirely from extra workers, so the wage bill rose in step with output and cost per unit did not improve. ' +
          '**Production is not productivity** — this distinction is examined constantly.');
      }
      return { html:
        row('Year 1 productivity', num(p1) + ' units per worker') +
        row('Year 2 productivity', num(p2) + ' units per worker', true) +
        row('Change in output', pct(dOut)) +
        row('Change in productivity', pct(dProd), true) + note
      };
    }
  };

  /* ---------------------------------------------------------
     6. EXCHANGE RATES
     --------------------------------------------------------- */
  var fx = {
    id: 'fx', name: 'Exchange rates', icon: '⇄',
    blurb: 'What an appreciation or depreciation does to an exporter and an importer. Chapter 29.',
    form: function () {
      return field('x_r1', 'Old exchange rate', 1.6, '1 unit of home currency = this much foreign currency', '') +
             field('x_r2', 'New exchange rate', 2.0, '', '') +
             field('x_exp', 'Export price in HOME currency', 300, 'What the business wants to earn per unit', '$') +
             field('x_imp', 'Import cost in FOREIGN currency', 250, 'What the supplier charges per unit', '');
    },
    calc: function (g) {
      var r1 = n(g('x_r1')), r2 = n(g('x_r2')), ex = n(g('x_exp')), im = n(g('x_imp'));
      var dir = r2 > r1 ? 'APPRECIATED' : r2 < r1 ? 'DEPRECIATED' : 'unchanged';
      var chg = r1 ? (r2 - r1) / r1 * 100 : NaN;
      var ef1 = ex * r1, ef2 = ex * r2;
      var ih1 = r1 ? im / r1 : NaN, ih2 = r2 ? im / r2 : NaN;
      var note;
      if (dir === 'APPRECIATED') {
        note = R.call('key', [
          'The home currency has **appreciated ' + pct(Math.abs(chg)) + '**.',
          '**Exporter — bad news.** To earn the same ' + money(ex) + ' the foreign price must rise from ' +
          num(ef1) + ' to ' + num(ef2) + ' foreign units, which will probably reduce sales. Holding the foreign price at ' +
          num(ef1) + ' instead means earning only ' + money(r2 ? ef1 / r2 : 0) + ' per unit.',
          '**Importer — good news.** The same supply now costs ' + money(ih2) + ' instead of ' + money(ih1) + ' — costs fall.'
        ]);
      } else if (dir === 'DEPRECIATED') {
        note = R.call('key', [
          'The home currency has **depreciated ' + pct(Math.abs(chg)) + '**.',
          '**Exporter — good news.** The foreign price can fall from ' + num(ef1) + ' to ' + num(ef2) +
          ' foreign units while still earning ' + money(ex) + ' per unit, so exports become more competitive.',
          '**Importer — bad news.** The same supply now costs ' + money(ih2) + ' instead of ' + money(ih1) + ' — costs rise.',
          'A business that **exports finished goods but imports its materials** is hit both ways. The net effect depends on how much value it adds at home — say that in the exam.'
        ]);
      } else { note = ''; }
      return { html:
        row('Direction', dir === 'unchanged' ? 'No change' : dir, true) +
        row('Size of change', pct(chg)) +
        row('Export price abroad — before', num(ef1)) +
        row('Export price abroad — after', num(ef2), true) +
        row('Import cost at home — before', money(ih1)) +
        row('Import cost at home — after', money(ih2), true) + note
      };
    }
  };

  window.TOOLS = [breakEven, ratios, cashflow, costs, productivity, fx];
  window.ToolUtil = { n: n, money: money, num: num, pct: pct, field: field, row: row };
})();
