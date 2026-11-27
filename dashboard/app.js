// Token Radar's dashboard, model radar-4. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail view with the
// model's own inputs, its implied range and the protocol's farm plan with its totals, and the
// live-token comparables the model prices against. A model sandbox lets the reader change the
// growth and momentum weights and watch the board re-rank on the same arithmetic. No network:
// every byte it shows is in data.js, and the farm plan it prints is the very plan main.ts wrote
// to board.json.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', set: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, sandbox: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return 'x' + n.toFixed(2);
  }
  function fmtGas(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n < 10 ? '$' + n.toFixed(2) : '$' + Math.round(n);
  }
  function categoryOf(row) {
    var key = row.category || 'Other';
    for (var i = 0; i < DATA.categories.length; i++) {
      if (DATA.categories[i].category === key) return DATA.categories[i];
    }
    return null;
  }
  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same
  // arithmetic, in the same order main.ts multiplies. The fitted multiple is the row's own (full
  // precision, as main.ts wrote it); the launch likelihood and the momentum tilt are rebuilt from
  // the category's own figures, exactly as the model does.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var cat = categoryOf(row);
    var likelihood = row.launch_likelihood;
    var momentumMult = 1;
    if (cat) {
      var ageTilt = 0.9 + 0.2 * (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days);
      likelihood = (model.likelihood_base + model.likelihood_rate_weight * cat.token_rate) * ageTilt;
      var relative = Math.min(model.momentum_span, Math.max(-model.momentum_span, growth - cat.median_change_7d));
      momentumMult = 1 + (relative / 100) * model.momentum_weight;
    }
    var chainFactor = 1 + model.chain_step * Math.min(Math.max((row.chains || []).length - 1, 0), model.chain_max_steps);
    var rest = growthMult * momentumMult * maturity * likelihood * chainFactor;
    return Math.max(1, Math.round(row.tvl_usd * row.fit_multiple * rest));
  }

  // The model sandbox: the reader's weights, or null when the board shows the submitted
  // model. A sandbox model is the submitted constants with two weights replaced, so the
  // page re-ranks on the same arithmetic main.ts ran, never on a second model.
  function sandboxModel() {
    if (!state.sandbox) return DATA.model;
    var m = {};
    Object.keys(DATA.model).forEach(function (k) { m[k] = DATA.model[k]; });
    m.growth_weight = state.sandbox.growth;
    m.momentum_weight = state.sandbox.momentum;
    return m;
  }

  // A row's implied value under the model in force: the submitted number when the sandbox
  // is off, the same function with the reader's weights when it is on.
  function displayImplied(row) {
    return state.sandbox ? impliedOf(row, sandboxModel()) : row.implied_value_usd;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('set')) state.set = params.get('set');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.set !== 'all') params.set('set', state.set);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.set !== 'all' && r.set !== state.set) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'momentum') { av = a.momentum_multiplier; bv = b.momentum_multiplier; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'likelihood') { av = a.launch_likelihood; bv = b.launch_likelihood; }
      else { av = displayImplied(a); bv = displayImplied(b); }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The board scores every protocol the watchlist rule allows: ' + DATA.above_size + ' rankable protocols above that floor the list leaves out, and ' + DATA.early_size + ' early ones below it. Each is priced on a log-log fit of market cap on TVL over ' + DATA.fit.comparables + ' live tokens, given an implied range from how far those tokens sit from the curve, and tilted by how its week compares with its category\'s week. Every row carries its own farm plan, with its gas and its weeks totalled. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Above the floor, off the list' }), el('b', { text: String(DATA.above_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    function setTab(value, label) {
      return el('button', { type: 'button', 'aria-pressed': state.set === value ? 'true' : 'false', text: label, onclick: function () { state.set = value; writeHash(); render(); } });
    }
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Board set' }), el('div', { class: 'tabs' },
        setTab('all', 'All rows'), setTab('watchlist', 'Watchlist'), setTab('early', 'Early radar'), setTab('above', 'Above floor')
      )),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sandboxPanel() {
    var m = DATA.model;
    var sb = state.sandbox;
    function slider(label, key, min, max, step, value, note) {
      var shown = el('b', { text: Number(value).toFixed(2) });
      var input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label });
      input.addEventListener('input', function () {
        if (!state.sandbox) state.sandbox = { growth: m.growth_weight, momentum: m.momentum_weight };
        state.sandbox[key] = parseFloat(input.value);
        shown.textContent = Number(input.value).toFixed(2);
      });
      input.addEventListener('change', function () { render(); });
      return el('div', { class: 'sandbox-field' },
        el('label', null, el('span', { text: label + ' ' }), shown),
        input,
        el('span', { class: 'sub', text: note })
      );
    }
    var body = sb
      ? el('div', { class: 'sandbox-body' },
          slider('Growth weight', 'growth', 0, 1, 0.05, sb.growth, 'how much a protocol\'s own seven-day growth moves its value'),
          slider('Momentum weight', 'momentum', 0, 0.5, 0.05, sb.momentum, 'how much beating its category\'s week moves its value'),
          el('p', { class: 'sub', text: 'The board below re-ranks live on these weights, with the same fitted curve, maturity, likelihood and chain factor main.ts used. The submitted board is unchanged: reset to see it again.' }),
          el('button', { class: 'button', type: 'button', text: 'Reset to the submitted model', onclick: function () { state.sandbox = null; render(); } })
        )
      : el('p', { class: 'sub', text: 'Change the two weights and watch the board re-rank on the same arithmetic: the fitted curve, maturity, likelihood and chain factor stay as submitted.' });
    return el('section', { class: 'panel sandbox' },
      el('div', { class: 'sandbox-head' },
        el('h2', { text: 'Model sandbox' }),
        sb ? el('span', { class: 'status live', text: 'sandbox on' }) : el('button', { class: 'button primary', type: 'button', text: 'Try different weights', onclick: function () { state.sandbox = { growth: m.growth_weight, momentum: m.momentum_weight }; render(); } })
      ),
      body
    );
  }

  function sortHeader(key, label, cls) {
    return el('th', { scope: 'col', class: cls || null },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.set = 'all'; writeHash(); render(); } })
      ));
    }
    var max = 1;
    list.forEach(function (r) { max = Math.max(max, displayImplied(r)); });
    var tbody = el('tbody');
    list.forEach(function (r, i) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var likClass = r.launch_likelihood >= 1 ? 'lik high' : 'lik';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(state.sandbox ? i + 1 : r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtMult(r.momentum_multiplier) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num ' + likClass, text: fmtMult(r.launch_likelihood) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((displayImplied(r) / max) * 100)) + '%' })),
          el('span', { class: 'implied-figs' },
            el('span', { class: 'num', text: fmtUsd(displayImplied(r)) }),
            el('span', { class: 'range', text: state.sandbox ? 'submitted ' + fmtUsd(r.implied_value_usd) : fmtUsd(r.implied_low_usd) + ' - ' + fmtUsd(r.implied_high_usd) })
          )
        )),
        el('td', null,
          el('span', { class: 'status', text: 'no token' }),
          r.set === 'watchlist' ? el('span', { class: 'status wl', text: 'watchlist' }) : null
        )
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first, each with the implied range the fitted curve\'s residuals span. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank', 'num'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL', 'num'),
            sortHeader('growth', '7d', 'num'),
            sortHeader('momentum', 'Momentum', 'num'),
            sortHeader('age', 'Age', 'num'),
            sortHeader('likelihood', 'Likelihood', 'num'),
            sortHeader('implied', 'Implied value', 'num'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: fmtMult(r.mcap_tvl_multiple) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. Their market-cap-to-TVL multiples are the comparables the fitted curve is built from.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', class: 'num', text: 'TVL' }), el('th', { scope: 'col', class: 'num', text: '7d' }), el('th', { scope: 'col', class: 'num', text: 'Market cap' }), el('th', { scope: 'col', class: 'num', text: 'Mcap / TVL' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var topCats = DATA.categories.slice(0, 10);
    var catBody = el('tbody');
    topCats.forEach(function (c) {
      catBody.appendChild(el('tr', null,
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.protocols) }),
        el('td', { class: 'num', text: String(c.live) }),
        el('td', { class: 'num', text: (c.token_rate * 100).toFixed(0) + '%' }),
        el('td', { class: 'num ' + (c.median_change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(c.median_change_7d) }),
        el('td', { class: 'num', text: fmtMult(c.multiple) }),
        el('td', { class: 'num', text: fmtMult(c.multiple_low) + ' - ' + fmtMult(c.multiple_high) })
      ));
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x fitted_multiple(tvl_usd) x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (1 + clamp(change_7d - category_median_7d, -' + m.momentum_span + ', ' + m.momentum_span + ') / 100 x ' + m.momentum_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x likelihood x (1 + 0.02 x min(chains - 1, 5)) )'
      ),
      el('p', { class: 'sub', text: 'Fitted multiple: log(market cap) = ' + DATA.fit.intercept.toFixed(2) + ' + ' + DATA.fit.slope.toFixed(2) + ' x log(TVL), fitted over the ' + DATA.fit.comparables + ' live-token protocols with a market cap (R² ' + DATA.fit.r2.toFixed(2) + '). A flat multiple misprices size — the smallest live tokens trade near x0.88 of TVL and the largest near x0.05 — so the curve prices a protocol of its own size, clamped to x0.02..x2.50. The implied range prices the same row at the fit\'s residual quartiles, x' + DATA.fit.low_mult.toFixed(2) + ' and x' + DATA.fit.high_mult.toFixed(2) + ': how far live tokens actually sit from the curve, not a confidence trick. Momentum: the protocol\'s seven-day growth against its category\'s median week, so a fall inside a falling category is not read as weakness. Likelihood: (0.60 + 0.80 x token rate of the category) x an age tilt of x0.90..x1.10. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'The ten largest categories by live-token count. The multiple shown is the median market-cap-to-TVL of the category\'s live tokens, for reference: rows are priced on the fitted curve above, not on it.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', class: 'num', text: 'Protocols' }), el('th', { scope: 'col', class: 'num', text: 'Live tokens' }), el('th', { scope: 'col', class: 'num', text: 'Token rate' }), el('th', { scope: 'col', class: 'num', text: 'Median 7d' }), el('th', { scope: 'col', class: 'num', text: 'Multiple' }), el('th', { scope: 'col', class: 'num', text: 'Quartile range' }))),
          catBody
        )
      ),
      el('p', { class: 'note', text: 'The board is every pre-token protocol the watchlist rule allows: the whole watchlist, the rankable protocols above the floor the list leaves out, and every rankable protocol below it. No wrapped, staked or bridged product of a token that already trades is ranked as a protocol still to come. The live-token protocols are set aside with their market caps shown. A protocol below the floor is no worse a subject than one on it: the floor is where the reading started, not where it stops. Each farm plan is built from the protocol\'s own record: its category gives the actions, its cheapest chain gives the gas, its age gives the hold, and the plan totals its own gas and weeks.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = row.farm_steps;
    var recomputed = impliedOf(row, sandboxModel());
    var cat = categoryOf(row);
    var peers = DATA.live.filter(function (r) { return (r.category || 'Other') === (row.category || 'Other'); }).slice(0, 3);
    var inCategory = DATA.rows.filter(function (r) { return (r.category || 'Other') === (row.category || 'Other'); });
    var standing = inCategory.filter(function (r) { return r.rank < row.rank; }).length + 1;
    var span = Math.max(1, row.implied_high_usd - row.implied_low_usd);
    var markerAt = Math.min(100, Math.max(0, Math.round(((row.implied_value_usd - row.implied_low_usd) / span) * 100)));
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' · #' + standing + ' of ' + inCategory.length + ' ' + (row.category || 'Other') + ' rows on this board · ' + (row.set === 'watchlist' ? 'on the watchlist' : row.set === 'above' ? 'above the floor, off the watchlist' : 'an early-radar row below the floor') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Fitted multiple' }), el('b', { class: 'num', text: fmtMult(row.fit_multiple) + (cat ? ' (' + cat.live + ' live in category)' : '') })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Category median week' }), el('b', { class: 'num', text: cat ? fmtPct(cat.median_change_7d) : 'n/a' })),
        el('div', null, el('span', { text: 'Momentum multiplier' }), el('b', { class: 'num', text: String(row.momentum_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Launch likelihood' }), el('b', { class: 'num', text: fmtMult(row.launch_likelihood) })),
        el('div', null, el('span', { text: 'Chain factor' }), el('b', { class: 'num', text: fmtMult(row.chain_factor) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('div', { class: 'rangebar' },
        el('div', { class: 'range-track', 'aria-hidden': 'true' },
          el('i', { class: 'range-fill' }),
          el('i', { class: 'range-mark', style: 'left:' + markerAt + '%' })
        ),
        el('div', { class: 'range-labels' },
          el('span', { text: fmtUsd(row.implied_low_usd) + ' at the fit\'s low quartile' }),
          el('span', { text: fmtUsd(row.implied_high_usd) + ' at the fit\'s high quartile' })
        )
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (state.sandbox ? ' under your sandbox weights (submitted ' + fmtUsd(row.implied_value_usd) + ').' : (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.')) + ' The range is the same row priced at the fit\'s residual quartiles. This is an estimate, not a price.' })
    ));
    if (peers.length > 0) {
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Live comparables in ' + (row.category || 'Other') }),
        el('p', { class: 'sub', text: peers.map(function (p) { return p.name + ' at ' + fmtMult(p.mcap_tvl_multiple) + ' of TVL'; }).join('; ') + '. The fitted curve prices every row from these live tokens; the range is how far they sit from it.' })
      ));
    }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('p', { class: 'plan-total', text: 'Plan total: about ' + fmtGas(row.plan_gas_usd) + ' of gas over about ' + row.plan_weeks + ' weeks on ' + row.plan_chain + ', with $' + row.plan_capital_usd + ' of capital in the position.' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(sandboxPanel());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(el('p', { class: 'foot' },
      el('b', { text: 'About this board: ' }),
      'Snapshot of ' + DATA.rows.length + ' scored protocols from the DefiLlama protocol index, ' + DATA.as_of + '. Implied values are model estimates from TVL, growth, age and category comparables; no token is promised, and a protocol with no rewards program may never issue one.'
    ));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
