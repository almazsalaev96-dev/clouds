/* ============================================================
   render.js — content block renderer + small HTML helpers
   ============================================================ */
(function () {
  'use strict';

  var SEC_COLOR = { 1:'--s1', 2:'--s2', 3:'--s3', 4:'--s4', 5:'--s5', 6:'--s6' };
  var SEC_WASH  = { 1:'--s1w',2:'--s2w',3:'--s3w',4:'--s4w',5:'--s5w',6:'--s6w' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  /* Lightweight inline markup used inside content strings:
     **bold**  *italic*  `code`  [[term]] = key term highlight  {{$1,000}} = figure */
  function inline(s) {
    if (s == null) return '';
    var t = String(s);
    // escape first, then re-introduce our own markup
    t = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\[\[([^\]]+)\]\]/g, '<b class="kt">$1</b>');
    return t;
  }

  function ul(items, cls) {
    return '<ul' + (cls ? ' class="' + cls + '"' : '') + '>' +
      items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</ul>';
  }
  function ol(items) {
    return '<ol>' + items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</ol>';
  }

  function table(head, rows, opts) {
    opts = opts || {};
    var h = '<thead><tr>' + head.map(function (c, i) {
      return '<th' + (opts.num && opts.num.indexOf(i) > -1 ? ' class="num"' : '') + '>' + inline(c) + '</th>';
    }).join('') + '</tr></thead>';
    var b = '<tbody>' + rows.map(function (r) {
      return '<tr>' + r.map(function (c, i) {
        return '<td' + (opts.num && opts.num.indexOf(i) > -1 ? ' class="num"' : '') + '>' + inline(c) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    return '<div class="tbl-wrap"><table>' + h + b + '</table></div>';
  }

  function defs(pairs) {
    return '<div class="defs">' + pairs.map(function (p) {
      return '<dl class="def"><dt>' + inline(p[0]) + '</dt><dd>' + inline(p[1]) + '</dd></dl>';
    }).join('') + '</div>';
  }

  var CALL_LABEL = { tip:'Exam tip', trap:'Common mistake', key:'Key idea', eg:'Example' };

  function call(kind, text, label) {
    return '<div class="call ' + kind + '"><span class="lb">' +
      esc(label || CALL_LABEL[kind] || kind) + '</span>' +
      (Array.isArray(text) ? text.map(function (p) { return '<p>' + inline(p) + '</p>'; }).join('')
                           : '<p>' + inline(text) + '</p>') + '</div>';
  }

  function proscons(adv, dis, labels) {
    labels = labels || ['Advantages', 'Disadvantages'];
    return '<div class="pc"><div class="adv"><h5>' + esc(labels[0]) + '</h5>' + ul(adv) + '</div>' +
           '<div class="dis"><h5>' + esc(labels[1]) + '</h5>' + ul(dis) + '</div></div>';
  }

  function formula(label, body) {
    return '<div class="formula">' + (label ? '<span class="lbl">' + esc(label) + '</span>' : '') +
      inline(body) + '</div>';
  }

  function worked(title, steps) {
    return '<div class="worked"><div class="wh">' + esc(title) + '</div>' +
      '<div class="wb">' + ol(steps) + '</div></div>';
  }

  /* --- the block dispatcher --- */
  function block(b) {
    switch (b.t) {
      case 'h':       return '<h3>' + inline(b.x) + '</h3>';
      case 'h4':      return '<h4>' + inline(b.x) + '</h4>';
      case 'p':       return '<p>' + inline(b.x) + '</p>';
      case 'ul':      return ul(b.x);
      case 'ol':      return ol(b.x);
      case 'defs':    return defs(b.x);
      case 'table':   return table(b.head, b.rows, { num: b.num });
      case 'pc':      return proscons(b.adv, b.dis, b.labels);
      case 'formula': return formula(b.lbl, b.x);
      case 'worked':  return worked(b.title, b.steps);
      case 'tip': case 'trap': case 'key': case 'eg':
                      return call(b.t, b.x, b.lbl);
      default:        return '';
    }
  }

  function blocks(list) { return (list || []).map(block).join(''); }

  /* --- chapter body --- */
  function chapterBody(ch) {
    var out = '';
    (ch.blocks || []).forEach(function (sec, i) {
      out += '<section class="block" id="b' + i + '">';
      if (sec.h2) out += '<h2>' + inline(sec.h2) + '</h2>';
      out += blocks(sec.c);
      out += '</section>';
    });
    return out;
  }

  function secVar(s, wash) { return 'var(' + (wash ? SEC_WASH[s] : SEC_COLOR[s]) + ')'; }

  window.R = {
    esc: esc, inline: inline, ul: ul, ol: ol, table: table, defs: defs,
    call: call, proscons: proscons, formula: formula, worked: worked,
    block: block, blocks: blocks, chapterBody: chapterBody,
    secVar: secVar, SEC_COLOR: SEC_COLOR, SEC_WASH: SEC_WASH
  };
})();
