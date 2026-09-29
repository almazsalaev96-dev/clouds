/* PetWants theme — vanilla JS, no dependencies. */
(function () {
  'use strict';

  var PW = window.PetWants || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function formatMoney(cents) {
    var format = PW.moneyFormat || '${{amount}}';
    var value = (cents / 100);
    function withDelims(n, decimals, thousands, dec) {
      var parts = n.toFixed(decimals).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return parts.join(dec);
    }
    return format.replace(/\{\{\s*(\w+)\s*\}\}/, function (_, key) {
      switch (key) {
        case 'amount_no_decimals': return withDelims(value, 0, ',', '.');
        case 'amount_with_comma_separator': return withDelims(value, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return withDelims(value, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return withDelims(value, 2, "'", '.');
        default: return withDelims(value, 2, ',', '.');
      }
    });
  }

  function toast(msg) {
    var el = $('#Toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('is-visible'); }, 2600);
  }
  PW.toast = toast;

  /* ---------------------------------------------------------------- Drawers */
  var lastFocus = null;
  function openDrawer(id) {
    var d = document.getElementById(id);
    if (!d) return;
    lastFocus = document.activeElement;
    d.classList.add('is-open');
    d.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    $$('[aria-controls="' + id + '"]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
    var focusable = $('.drawer__close, a, button, input', $('.drawer__panel', d));
    if (focusable) setTimeout(function () { focusable.focus(); }, 60);
  }
  function closeDrawer(d) {
    if (!d) return;
    d.classList.remove('is-open');
    d.setAttribute('aria-hidden', 'true');
    if (!$('.drawer.is-open, .modal.is-open')) document.body.classList.remove('is-locked');
    $$('[aria-controls="' + d.id + '"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  PW.openDrawer = openDrawer;

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-drawer-open]');
    if (opener) { e.preventDefault(); openDrawer(opener.getAttribute('data-drawer-open')); return; }
    var closer = e.target.closest('[data-drawer-close]');
    if (closer) { closeDrawer(closer.closest('.drawer')); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    $$('.drawer.is-open').forEach(closeDrawer);
    $$('.modal.is-open').forEach(closeModal);
    closeMega();
    closeLightbox();
  });

  /* ---------------------------------------------------------------- Header */
  var header = $('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function closeMega(except) {
    $$('.header-nav__item.is-open').forEach(function (li) {
      if (li === except) return;
      li.classList.remove('is-open');
      var b = $('button', li);
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  $$('[data-mega-nav] > .header-nav__item').forEach(function (li) {
    var btn = $(':scope > button', li);
    if (!btn) return;
    var timer;
    var open = function () {
      clearTimeout(timer);
      closeMega(li);
      li.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    };
    var close = function () {
      timer = setTimeout(function () { li.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }, 140);
    };
    btn.addEventListener('click', function () { li.classList.contains('is-open') ? (li.classList.remove('is-open'), btn.setAttribute('aria-expanded', 'false')) : open(); });
    if (window.matchMedia('(hover: hover)').matches) {
      li.addEventListener('mouseenter', function () { timer = setTimeout(open, 90); });
      li.addEventListener('mouseleave', function () { clearTimeout(timer); close(); });
    }
    li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) close(); });
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('[data-mega-nav]')) closeMega(); });

  /* ---------------------------------------------------------------- Announcement rotator */
  $$('[data-rotator]').forEach(function (r) {
    var items = $$('.announcement__item', r);
    if (items.length < 2 || reduceMotion) return;
    var i = 0, paused = false;
    r.addEventListener('mouseenter', function () { paused = true; });
    r.addEventListener('mouseleave', function () { paused = false; });
    setInterval(function () {
      if (paused || document.hidden) return;
      items[i].classList.remove('is-active');
      i = (i + 1) % items.length;
      items[i].classList.add('is-active');
    }, parseInt(r.dataset.interval, 10) || 5000);
  });

  /* ---------------------------------------------------------------- Hero slider */
  $$('[data-slider]').forEach(function (slider) {
    var track = $('[data-slider-track]', slider);
    var slides = track ? track.children : [];
    var dots = $$('[data-slider-dot]', slider);
    var pauseBtn = $('[data-slider-pause]', slider);
    if (slides.length < 2) return;
    var index = 0, timer = null, playing = slider.dataset.autoplay === 'true' && !reduceMotion;
    var interval = parseInt(slider.dataset.interval, 10) || 6000;

    function go(n) {
      index = (n + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-100 * index) + '%)';
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); d.setAttribute('aria-current', i === index ? 'true' : 'false'); });
      Array.prototype.forEach.call(slides, function (s, i) {
        s.setAttribute('aria-hidden', i === index ? 'false' : 'true');
        $$('a, button', s).forEach(function (el) { el.tabIndex = i === index ? 0 : -1; });
      });
    }
    function play() { stop(); if (playing) timer = setInterval(function () { if (!document.hidden) go(index + 1); }, interval); }
    function stop() { clearInterval(timer); }

    $('[data-slider-prev]', slider).addEventListener('click', function () { go(index - 1); play(); });
    $('[data-slider-next]', slider).addEventListener('click', function () { go(index + 1); play(); });
    dots.forEach(function (d) { d.addEventListener('click', function () { go(parseInt(d.dataset.sliderDot, 10)); play(); }); });
    if (pauseBtn) {
      if (!playing) pauseBtn.hidden = true;
      pauseBtn.addEventListener('click', function () {
        playing = !playing;
        pauseBtn.setAttribute('aria-label', playing ? 'Pause slideshow' : 'Play slideshow');
        pauseBtn.innerHTML = playing
          ? '<svg class="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>'
          : '<svg class="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>';
        playing ? play() : stop();
      });
    }
    slider.addEventListener('mouseenter', stop);
    slider.addEventListener('mouseleave', play);
    slider.addEventListener('focusin', stop);

    var startX = null;
    track.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; stop(); }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      startX = null; play();
    });
    go(0); play();
  });

  /* ---------------------------------------------------------------- Carousels */
  function initCarousel(c) {
    if (c._init) return; c._init = true;
    var track = $('[data-carousel-track]', c);
    var prev = $('[data-carousel-prev]', c), next = $('[data-carousel-next]', c);
    if (!track) return;
    function update() {
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    }
    function step(dir) { track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: reduceMotion ? 'auto' : 'smooth' }); }
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
    track.addEventListener('scroll', debounce(update, 60), { passive: true });
    window.addEventListener('resize', debounce(update, 120));
    update();
  }
  $$('[data-carousel]').forEach(initCarousel);

  /* ---------------------------------------------------------------- Favorites (per-browser) */
  function initFavorites(root) {
    var favs = store('pw-favs') || [];
    $$('[data-fav]', root).forEach(function (b) {
      if (b._init) return; b._init = true;
      b.setAttribute('aria-pressed', favs.indexOf(b.dataset.fav) > -1 ? 'true' : 'false');
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        favs = store('pw-favs') || [];
        var i = favs.indexOf(b.dataset.fav);
        if (i > -1) { favs.splice(i, 1); toast('Removed from favorites'); } else { favs.push(b.dataset.fav); toast('Saved to favorites ♥'); }
        store('pw-favs', favs);
        $$('[data-fav="' + b.dataset.fav + '"]').forEach(function (x) { x.setAttribute('aria-pressed', i > -1 ? 'false' : 'true'); });
      });
    });
  }
  initFavorites();

  /* ---------------------------------------------------------------- Predictive search */
  $$('[data-predictive-search]').forEach(function (form) {
    var input = $('input[type="search"]', form);
    var box = $('[data-predictive-results]', form);
    if (!input || !box) return;
    var controller;
    var esc = function (s) { return String(s || '').replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

    function close() { box.classList.remove('is-open'); input.setAttribute('aria-expanded', 'false'); }
    function render(data, q) {
      var r = (data && data.resources && data.resources.results) || {};
      var html = '';
      if (r.queries && r.queries.length) {
        html += '<div class="predictive__group"><div class="predictive__title">Suggestions</div>';
        r.queries.slice(0, 4).forEach(function (s) { html += '<a class="predictive__item" role="option" href="' + esc(s.url) + '">' + (s.styled_text || esc(s.text)) + '</a>'; });
        html += '</div>';
      }
      if (r.collections && r.collections.length) {
        html += '<div class="predictive__group"><div class="predictive__title">Categories</div>';
        r.collections.slice(0, 3).forEach(function (c) { html += '<a class="predictive__item" role="option" href="' + esc(c.url) + '">' + esc(c.title) + '</a>'; });
        html += '</div>';
      }
      if (r.products && r.products.length) {
        html += '<div class="predictive__group"><div class="predictive__title">Products</div>';
        r.products.slice(0, 6).forEach(function (p) {
          var img = p.featured_image && p.featured_image.url ? '<img src="' + esc(p.featured_image.url) + (p.featured_image.url.indexOf('?') > -1 ? '&' : '?') + 'width=120" alt="" loading="lazy" width="48" height="48">' : '';
          html += '<a class="predictive__item" role="option" href="' + esc(p.url) + '">' + img + '<span>' + esc(p.title) + '<small>' + (p.vendor ? esc(p.vendor) + ' · ' : '') + formatMoney(Math.round(parseFloat(p.price) * 100)) + '</small></span></a>';
        });
        html += '</div>';
      }
      if (!html) html = '<div class="predictive__group"><div class="predictive__item">No matches for “' + esc(q) + '”</div></div>';
      html += '<a class="predictive__all" href="' + (PW.routes.root || '/').replace(/\/$/, '') + '/search?q=' + encodeURIComponent(q) + '&options%5Bprefix%5D=last">See all results for “' + esc(q) + '” →</a>';
      box.innerHTML = html;
      box.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
    }
    var run = debounce(function () {
      var q = input.value.trim();
      if (q.length < 2) { close(); return; }
      if (controller) controller.abort();
      controller = 'AbortController' in window ? new AbortController() : null;
      var url = PW.routes.predictiveSearch + '.json?q=' + encodeURIComponent(q) +
        '&resources[type]=product,collection,query&resources[limit]=6&resources[options][unavailable_products]=last';
      fetch(url, controller ? { signal: controller.signal } : {})
        .then(function (r) { return r.json(); })
        .then(function (d) { render(d, q); })
        .catch(function () {});
    }, 180);
    input.addEventListener('input', run);
    input.addEventListener('focus', function () { if (input.value.trim().length >= 2) run(); });
    input.addEventListener('keydown', function (e) {
      var items = $$('.predictive__item[href], .predictive__all', box);
      if (!items.length || !box.classList.contains('is-open')) return;
      var cur = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[0].focus(); }
      if (e.key === 'Escape') close();
      if (cur > -1) return;
    });
    box.addEventListener('keydown', function (e) {
      var items = $$('.predictive__item[href], .predictive__all', box);
      var cur = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (items[cur + 1] || items[0]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); cur <= 0 ? input.focus() : items[cur - 1].focus(); }
      if (e.key === 'Escape') { close(); input.focus(); }
    });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) close(); });
  });

  /* ---------------------------------------------------------------- Cart */
  function cartSectionIds() {
    var ids = [];
    if ($('#CartDrawer')) ids.push('cart-drawer');
    var page = $('[data-cart-page]');
    if (page) {
      var sec = page.closest('.shopify-section');
      if (sec) ids.push(sec.id.replace('shopify-section-', ''));
    }
    return ids;
  }

  function applySections(sections) {
    if (!sections) return;
    Object.keys(sections).forEach(function (id) {
      var html = sections[id];
      if (!html) return;
      var doc = new DOMParser().parseFromString(html, 'text/html');
      if (id === 'cart-drawer') {
        var fresh = $('[data-cart-drawer-inner]', doc), cur = $('[data-cart-drawer-inner]');
        if (fresh && cur) cur.innerHTML = fresh.innerHTML;
      } else {
        var target = document.getElementById('shopify-section-' + id);
        var src = doc.getElementById('shopify-section-' + id) || doc.body.firstElementChild;
        if (target && src) target.innerHTML = src.innerHTML;
      }
    });
    bindCartUI();
  }

  function refreshCartBadge(cart) {
    if (cart) return paintBadge(cart);
    return fetch(PW.routes.cart + '.js').then(function (r) { return r.json(); }).then(paintBadge);
  }
  function paintBadge(cart) {
    $$('[data-cart-count]').forEach(function (el) { el.textContent = cart.item_count; el.dataset.count = cart.item_count; });
    $$('[data-cart-total]').forEach(function (el) { el.textContent = formatMoney(cart.total_price); });
    $$('[data-cart-open]').forEach(function (el) { el.setAttribute('aria-label', 'Cart, ' + cart.item_count + (cart.item_count === 1 ? ' item' : ' items')); });
    return cart;
  }

  function changeLine(key, qty, row) {
    if (row) row.classList.add('is-updating');
    return fetch(PW.routes.cartChange + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: key, quantity: qty, sections: cartSectionIds().join(','), sections_url: window.location.pathname })
    })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        if (cart.status && cart.description) { toast(cart.description); if (row) row.classList.remove('is-updating'); return; }
        applySections(cart.sections);
        refreshCartBadge(cart);
      })
      .catch(function () { window.location.reload(); });
  }

  function bindCartUI() {
    $$('[data-qty-change]').forEach(function (b) {
      if (b._init) return; b._init = true;
      b.addEventListener('click', function () {
        changeLine(b.dataset.qtyChange, Math.max(0, parseInt(b.dataset.qty, 10)), b.closest('.cart-item'));
      });
    });
    $$('[data-qty-input]').forEach(function (i) {
      if (i._init) return; i._init = true;
      i.addEventListener('change', function () { changeLine(i.dataset.qtyInput, Math.max(0, parseInt(i.value, 10) || 0), i.closest('.cart-item')); });
    });
    $$('.js-product-form').forEach(bindProductForm);
  }

  var note = $('#CartNote');
  if (note) {
    note.addEventListener('input', debounce(function () {
      fetch(PW.routes.cart + '/update.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: note.value }) });
    }, 400));
  }

  $$('[data-cart-open]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (PW.cartType !== 'drawer' || !$('#CartDrawer')) return;
      e.preventDefault();
      openDrawer('CartDrawer');
    });
  });

  function bindProductForm(form) {
    if (form._init) return; form._init = true;
    form.addEventListener('submit', function (e) {
      if (!window.fetch || !window.FormData) return;
      e.preventDefault();
      var btn = $('[type="submit"][name="add"], [type="submit"]', form);
      if (btn) { btn.classList.add('is-loading'); btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
      var fd = new FormData(form);
      if (!fd.get('selling_plan')) fd.delete('selling_plan');
      var ids = cartSectionIds();
      if (ids.length) { fd.append('sections', ids.join(',')); fd.append('sections_url', window.location.pathname); }
      fetch(PW.routes.cartAdd + '.js', { method: 'POST', headers: { Accept: 'application/javascript', 'X-Requested-With': 'XMLHttpRequest' }, body: fd })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.status) { toast(res.description || res.message || 'Could not add to cart'); return; }
          applySections(res.sections);
          refreshCartBadge();
          if (PW.cartType === 'drawer' && $('#CartDrawer') && !form.closest('#CartDrawer')) {
            openDrawer('CartDrawer');
          } else {
            toast('Added to cart ✓');
          }
        })
        .catch(function () { form.submit(); })
        .finally(function () {
          if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; btn.removeAttribute('aria-busy'); }
        });
    });
  }
  bindCartUI();

  /* ---------------------------------------------------------------- Product page */
  $$('[data-product-section]').forEach(function (section) {
    var jsonEl = $('[data-product-json]', section.parentNode) || $('[data-product-json]');
    if (!jsonEl) return;
    var data = JSON.parse(jsonEl.textContent);
    var form = document.getElementById(section.dataset.formId);
    var idInput = form && $('[data-variant-id]', form);
    var planInput = form && $('[data-selling-plan]', form);
    var addBtn = form && $('[data-add-button]', form);
    var sticky = $('[data-sticky-atc]');
    var current = data.variants.filter(function (v) { return idInput && String(v.id) === idInput.value; })[0] || data.variants[0];

    // Recently viewed tracking
    var recent = (store('pw-recent') || []).filter(function (h) { return h !== data.handle; });
    recent.unshift(data.handle);
    store('pw-recent', recent.slice(0, 16));

    function selectedOptions() {
      return data.options.map(function (_, i) {
        var checked = $('input[data-option-index="' + i + '"]:checked', section);
        return checked ? checked.value : null;
      });
    }
    function findVariant(opts) {
      return data.variants.filter(function (v) { return v.options.every(function (o, i) { return opts[i] === null || o === opts[i]; }); })[0];
    }
    function markAvailability(opts) {
      data.options.forEach(function (_, i) {
        $$('input[data-option-index="' + i + '"]', section).forEach(function (input) {
          var test = opts.slice(); test[i] = input.value;
          var match = data.variants.filter(function (v) { return v.options.every(function (o, j) { return o === test[j]; }); })[0];
          input.classList.toggle('is-unavailable', !match || !match.available);
          var label = input.nextElementSibling;
          if (label) label.title = !match ? 'Unavailable' : (!match.available ? 'Sold out' : '');
        });
        var lbl = $('[data-option-label="' + i + '"]', section);
        if (lbl) lbl.textContent = opts[i] || '';
      });
    }

    function currentPlanId() {
      var mode = $('[data-purchase]:checked', section);
      var sel = $('[data-plan-select]', section);
      if (data.requiresSellingPlan && sel) return sel.value;
      if (mode && mode.value === 'autoship' && sel) return sel.value;
      return '';
    }

    function paintPrice(v) {
      var planId = currentPlanId();
      var wrap = $('[data-price-wrap] [data-price]', section);
      var price = v.price, priceF = v.priceFormatted;
      if (planId && v.plans[planId]) { price = v.plans[planId].price; priceF = v.plans[planId].priceFormatted; }
      if (wrap) {
        var html = '<span class="price__current">' + priceF + '</span>';
        var ref = v.compareAt > v.price ? v.compareAt : (price < v.price ? v.price : 0);
        if (ref > price) {
          html += '<s class="price__compare"><span class="visually-hidden">Regular price</span>' + formatMoney(ref) + '</s>';
          html += '<span class="price__save">Save ' + Math.round((ref - price) * 100 / ref) + '%</span>';
        }
        wrap.innerHTML = html;
        wrap.classList.toggle('price--sale', ref > price);
      }
      var once = $('[data-once-price]', section); if (once) once.textContent = v.priceFormatted;
      var sel = $('[data-plan-select]', section);
      var planPriceEl = $('[data-plan-price]', section), saveEl = $('[data-plan-save]', section);
      if (sel && v.plans[sel.value]) {
        var pp = v.plans[sel.value].price;
        if (planPriceEl) planPriceEl.textContent = v.plans[sel.value].priceFormatted;
        if (saveEl) saveEl.textContent = pp < v.price ? 'Save ' + formatMoney(v.price - pp) + ' (' + Math.round((v.price - pp) * 100 / v.price) + '%) on every order' : '';
      }
      var sp = sticky && $('[data-sticky-price] .price__current', sticky); if (sp) sp.textContent = priceF;
    }

    function paintStock(v) {
      var el = $('[data-stock]', section);
      if (!el) return;
      var low = data.lowStock > 0 && v.inventoryTracked && v.inventory > 0 && v.inventory <= data.lowStock;
      if (!v.available) el.innerHTML = '<div class="stock stock--out"><span class="dot"></span>Currently out of stock</div>';
      else if (low) el.innerHTML = '<div class="stock stock--low"><span class="dot"></span>Only ' + v.inventory + ' left — order soon</div>';
      else el.innerHTML = '<div class="stock stock--in"><span class="dot"></span>In stock</div>';
    }

    function update(v) {
      if (!v) {
        if (addBtn) { addBtn.disabled = true; addBtn.textContent = PW.strings.unavailable; }
        return;
      }
      current = v;
      if (idInput) idInput.value = v.id;
      if (addBtn) { addBtn.disabled = !v.available; addBtn.textContent = v.available ? PW.strings.addToCart : PW.strings.soldOut; }
      var sku = $('[data-sku]', section); if (sku) sku.textContent = v.sku ? 'Item # ' + v.sku : '';
      paintPrice(v); paintStock(v);
      if (v.mediaId) gotoMedia(v.mediaId);
      if (window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', v.id);
        window.history.replaceState({}, '', url.toString());
      }
    }

    $$('input[data-option-index]', section).forEach(function (input) {
      input.addEventListener('change', function () {
        var opts = selectedOptions();
        markAvailability(opts);
        update(findVariant(opts));
      });
    });
    if (data.options.length) markAvailability(selectedOptions());

    // Autoship
    function syncPlan() {
      if (planInput) planInput.value = currentPlanId();
      paintPrice(current);
    }
    $$('[data-purchase]', section).forEach(function (r) { r.addEventListener('change', syncPlan); });
    var planSel = $('[data-plan-select]', section);
    if (planSel) {
      planSel.addEventListener('change', function () {
        var auto = $('[data-purchase="autoship"]', section);
        if (auto) auto.checked = true;
        syncPlan();
      });
    }
    syncPlan();

    // Quantity steppers
    $$('[data-qty-step]', section).forEach(function (b) {
      b.addEventListener('click', function () {
        var input = $('[data-qty-field]', b.parentNode);
        input.value = Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(b.dataset.qtyStep, 10));
      });
    });

    // Gallery
    var slidesEl = $('[data-gallery-slides]', section);
    var thumbs = $$('[data-thumb]', section);
    var count = $('[data-gallery-count]', section);
    function gotoMedia(mediaId) {
      if (!slidesEl) return;
      var slide = $('[data-media-id="' + mediaId + '"]', slidesEl);
      if (slide) slidesEl.scrollTo({ left: slide.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    if (slidesEl) {
      thumbs.forEach(function (t) {
        t.addEventListener('click', function () { gotoMedia(t.dataset.mediaId); });
      });
      slidesEl.addEventListener('scroll', debounce(function () {
        var i = Math.round(slidesEl.scrollLeft / slidesEl.clientWidth);
        thumbs.forEach(function (t, j) { t.setAttribute('aria-current', j === i ? 'true' : 'false'); });
        if (count) count.textContent = (i + 1) + ' / ' + slidesEl.children.length;
      }, 50), { passive: true });
      slidesEl.addEventListener('click', function (e) {
        var img = e.target.closest('img');
        if (!img) return;
        var lb = $('[data-lightbox]');
        var lbImg = $('[data-lightbox-img]');
        if (!lb || !lbImg) return;
        var src = img.currentSrc || img.src;
        lbImg.src = src.replace(/([?&])width=\d+/, '$1width=2000');
        lbImg.alt = img.alt;
        lb.classList.add('is-open');
        document.body.classList.add('is-locked');
        $('[data-lightbox-close]', lb).focus();
      });
    }

    // Sticky add to cart
    if (sticky && form) {
      var stickyBtn = $('[data-sticky-add]', sticky);
      stickyBtn.addEventListener('click', function () {
        if (form.requestSubmit) form.requestSubmit(); else form.submit();
      });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          var visible = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
          sticky.classList.toggle('is-visible', visible);
          sticky.setAttribute('aria-hidden', visible ? 'false' : 'true');
          stickyBtn.tabIndex = visible ? 0 : -1;
        }).observe(form);
      }
    }

    // Delivery estimate (business days)
    var del = $('[data-delivery]', section);
    if (del) {
      var addBiz = function (n) {
        var d = new Date();
        while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; }
        return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      };
      var min = parseInt(del.dataset.min, 10), max = parseInt(del.dataset.max, 10);
      var txt = $('[data-delivery-text]', del);
      if (txt && max > 0) txt.textContent = 'Estimated delivery: ' + (min > 0 && min !== max ? addBiz(min) + ' – ' : '') + addBiz(max);
    }

    // Share
    var share = $('[data-share]', section);
    if (share) {
      share.addEventListener('click', function () {
        var url = share.dataset.url;
        if (navigator.share) navigator.share({ title: share.dataset.title, url: url }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Link copied'); });
      });
    }
  });

  function closeLightbox() {
    var lb = $('[data-lightbox].is-open');
    if (!lb) return;
    lb.classList.remove('is-open');
    if (!$('.drawer.is-open, .modal.is-open')) document.body.classList.remove('is-locked');
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-lightbox-close]') || e.target.matches('[data-lightbox]')) closeLightbox();
  });

  /* ---------------------------------------------------------------- Recommendations */
  $$('[data-recommendations]').forEach(function (el) {
    if (el.querySelector('.carousel')) return;
    var load = function () {
      fetch(el.dataset.url).then(function (r) { return r.text(); }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = $('[data-recommendations]', doc);
        if (fresh && fresh.innerHTML.trim()) {
          el.innerHTML = fresh.innerHTML;
          $$('[data-carousel]', el).forEach(initCarousel);
          initFavorites(el);
          $$('.js-product-form', el).forEach(bindProductForm);
        }
      }).catch(function () {});
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) { if (entries[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '400px' });
      io.observe(el);
    } else load();
  });

  /* ---------------------------------------------------------------- Recently viewed */
  $$('[data-recently-viewed]').forEach(function (el) {
    var track = $('[data-recent-track]', el);
    var current = $('[data-product-json]') ? JSON.parse($('[data-product-json]').textContent).handle : null;
    var handles = (store('pw-recent') || []).filter(function (h) { return h !== current; }).slice(0, parseInt(el.dataset.limit, 10) || 8);
    if (!handles.length || !track) return;
    var root = (PW.routes.root || '/').replace(/\/$/, '');
    Promise.all(handles.map(function (h) {
      return fetch(root + '/products/' + encodeURIComponent(h) + '?section_id=product-card-render')
        .then(function (r) { return r.ok ? r.text() : ''; })
        .catch(function () { return ''; });
    })).then(function (parts) {
      var html = parts.map(function (p) {
        var doc = new DOMParser().parseFromString(p, 'text/html');
        var li = $('li', doc);
        return li ? li.outerHTML : '';
      }).join('');
      if (!html) return;
      track.innerHTML = html;
      el.hidden = false;
      initCarousel($('[data-carousel]', el));
      initFavorites(el);
      $$('.js-product-form', el).forEach(bindProductForm);
    });
  });

  /* ---------------------------------------------------------------- Filters & sorting */
  function submitFacets(form) {
    var params = new URLSearchParams(new FormData(form));
    Array.from(params.keys()).forEach(function (k) { if (params.get(k) === '') params.delete(k); });
    window.location.search = params.toString();
  }
  $$('[data-facets-form]').forEach(function (form) {
    var go = debounce(function () { submitFacets(form); }, 500);
    form.addEventListener('change', function (e) { if (e.target.type === 'checkbox') submitFacets(form); else go(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); submitFacets(form); });
  });
  $$('[data-sort-select]').forEach(function (sel) {
    sel.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sort_by', sel.value);
      url.searchParams.delete('page');
      window.location.href = url.toString();
    });
  });

  /* ---------------------------------------------------------------- Email popup */
  function openModal(m) { m.classList.add('is-open'); document.body.classList.add('is-locked'); var f = $('input[type="email"], [data-modal-close]', m); if (f) setTimeout(function () { f.focus(); }, 60); }
  function closeModal(m) { m.classList.remove('is-open'); if (!$('.drawer.is-open')) document.body.classList.remove('is-locked'); store('pw-popup-seen', Date.now()); }
  var popup = $('[data-email-popup]');
  if (popup) {
    $$('[data-modal-close]', popup).forEach(function (b) { b.addEventListener('click', function () { closeModal(popup); }); });
    var justJoined = window.location.search.indexOf('customer_posted=true') > -1 && window.location.hash.indexOf('EmailPopupForm') > -1;
    var hasError = !!$('.form-message--error', popup);
    if (justJoined || hasError) openModal(popup);
    else if (!store('pw-popup-seen')) setTimeout(function () { if (!$('.drawer.is-open')) openModal(popup); }, (parseInt(popup.dataset.delay, 10) || 12) * 1000);
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]');
    if (!c || !navigator.clipboard) return;
    navigator.clipboard.writeText(c.dataset.copy).then(function () { c.textContent = 'Copied!'; });
  });

  /* ---------------------------------------------------------------- Footer accordions (mobile) */
  if (window.matchMedia('(max-width: 989px)').matches) {
    $$('[data-footer-accordion]').forEach(function (d) { d.removeAttribute('open'); });
  }

  /* ---------------------------------------------------------------- Account helpers */
  var showRecover = $('[data-show-recover]'), hideRecover = $('[data-hide-recover]');
  var loginPanel = $('[data-login-panel]'), recoverPanel = $('[data-recover-panel]');
  function toggleRecover(show) { if (loginPanel && recoverPanel) { loginPanel.hidden = show; recoverPanel.hidden = !show; } }
  if (showRecover) showRecover.addEventListener('click', function (e) { e.preventDefault(); toggleRecover(true); });
  if (hideRecover) hideRecover.addEventListener('click', function (e) { e.preventDefault(); toggleRecover(false); });
  if (window.location.hash === '#recover' || (recoverPanel && $('.form-message', recoverPanel))) toggleRecover(true);
  $$('select[data-default]').forEach(function (s) { if (s.dataset.default) s.value = s.dataset.default; });
})();
