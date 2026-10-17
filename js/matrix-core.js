(() => {
  'use strict';

  // Wspólne dla widoków macierzy (matrix.html, priorytety.html, radar.html): walidacja, indeksy i panel szczegółów.
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const data = window.CX_MATRIX;
  const marks = { niezaopiekowany: '!', do_poprawy: '▲', ok: '✓', brak_oceny: '–' };
  const levels = ['niski', 'średni', 'wysoki'];
  const queueRatings = ['niezaopiekowany', 'do_poprawy'];
  const mx = { data, $, esc, marks, levels, queueRatings, tpIndex: new Map(), order: new Map(), ratingKeys: [], matrixKeys: [], maxWeeks: 1 };

  mx.showError = message => {
    $('app').hidden = true;
    $('errorScreen').hidden = false;
    $('errorText').textContent = message;
  };

  function validate() {
    if (!data || !Array.isArray(data.touchpoints) || !Array.isArray(data.features) || !Array.isArray(data.actions) || !Array.isArray(data.processes) || !data.labels) {
      throw Error('data/matrix.js: brak window.CX_MATRIX z polami labels, processes, touchpoints, features, actions.');
    }
    if (!data.processes.length || !data.labels.matrix || !Object.keys(data.labels.matrix).length) throw Error('data/matrix.js: processes i labels.matrix nie mogą być puste.');
    for (const group of ['matrix', 'rating', 'monitoring', 'featureType', 'actionKind']) {
      if (!data.labels[group] || typeof data.labels[group] !== 'object') throw Error('data/matrix.js: brak słownika labels.' + group);
    }
    const known = (group, key) => Object.prototype.hasOwnProperty.call(data.labels[group], key);
    const ids = new Set();
    for (const tp of data.touchpoints) {
      if (!tp.id || !tp.title || ids.has(tp.id)) throw Error('data/matrix.js: brak lub powtórzone ID punktu: ' + tp.id);
      ids.add(tp.id);
      if (!known('matrix', tp.matrix)) throw Error('data/matrix.js: nieznana macierz "' + tp.matrix + '" (' + tp.id + ')');
      if (tp.subtype !== undefined && !(data.labels.subtype && Object.prototype.hasOwnProperty.call(data.labels.subtype, tp.subtype))) throw Error('data/matrix.js: nieznany podtyp "' + tp.subtype + '" (' + tp.id + ')');
      if (!known('rating', tp.rating)) throw Error('data/matrix.js: nieznana ocena "' + tp.rating + '" (' + tp.id + ')');
      if (!data.processes.includes(tp.process)) throw Error('data/matrix.js: proces "' + tp.process + '" spoza listy processes (' + tp.id + ')');
      if (tp.care !== null && tp.care !== undefined && !(Number.isInteger(tp.care) && tp.care >= 1 && tp.care <= 5)) throw Error('data/matrix.js: zaopiekowanie musi być 1–5 lub null (' + tp.id + ')');
      if (tp.emotionValue !== null && tp.emotionValue !== undefined && !(Number.isInteger(tp.emotionValue) && tp.emotionValue >= 1 && tp.emotionValue <= 5)) throw Error('data/matrix.js: emocja musi być 1–5 lub null (' + tp.id + ')');
    }
    const itemIds = new Set();
    for (const item of [...data.features, ...data.actions]) {
      if (!item.id || itemIds.has(item.id)) throw Error('data/matrix.js: brak lub powtórzone ID cechy/akcji: ' + item.id);
      itemIds.add(item.id);
    }
    for (const item of data.features) {
      if (!ids.has(item.touchpointId)) throw Error('data/matrix.js: cecha ' + item.id + ' wskazuje nieistniejący punkt ' + item.touchpointId);
      if (!known('featureType', item.type)) throw Error('data/matrix.js: nieznany typ cechy "' + item.type + '" (' + item.id + ')');
    }
    for (const item of data.actions) {
      if (!ids.has(item.touchpointId)) throw Error('data/matrix.js: akcja ' + item.id + ' wskazuje nieistniejący punkt ' + item.touchpointId);
      if (!known('actionKind', item.kind)) throw Error('data/matrix.js: nieznany rodzaj akcji "' + item.kind + '" (' + item.id + ')');
      if (!Number.isFinite(item.weeks) || item.weeks < 0) throw Error('data/matrix.js: weeks musi być liczbą tygodni (' + item.id + ')');
      for (const key of ['cost', 'risk', 'gain']) if (!levels.includes(item[key])) throw Error('data/matrix.js: ' + key + ' musi być: ' + levels.join(', ') + ' (' + item.id + ')');
    }
  }

  mx.init = () => {
    validate();
    mx.subtypeKeys = Object.keys(data.labels.subtype || {});
    mx.rings = [];
    for (const m of Object.keys(data.labels.matrix)) {
      const own = data.touchpoints.filter(tp => tp.matrix === m);
      if (own.some(tp => !tp.subtype)) mx.rings.push({ key: m, label: data.labels.matrix[m], matrix: m });
      for (const k of mx.subtypeKeys) if (own.some(tp => tp.subtype === k)) mx.rings.push({ key: m + '/' + k, label: data.labels.subtype[k], matrix: m });
    }
    mx.ratingKeys = Object.keys(data.labels.rating);
    mx.matrixKeys = Object.keys(data.labels.matrix);
    mx.maxWeeks = Math.max(1, ...data.actions.map(a => a.weeks));
    data.touchpoints.forEach((tp, index) => { mx.tpIndex.set(tp.id, tp); mx.order.set(tp.id, data.processes.indexOf(tp.process) * 100000 + index); });
    if ($('demoPill')) $('demoPill').hidden = data.status !== 'DEMO';
    const toolbar = document.querySelector('.matrix-toolbar');
    if (toolbar) {
      const sync = () => document.documentElement.style.setProperty('--toolbar-h', toolbar.offsetHeight + 'px');
      sync();
      if (window.ResizeObserver) new ResizeObserver(sync).observe(toolbar); else window.addEventListener('resize', sync);
    }
  };

  // Pierścień (podtyp) punktu: macierz albo macierz/podtyp.
  mx.ringKey = tp => tp.subtype ? tp.matrix + '/' + tp.subtype : tp.matrix;
  mx.ringOf = tp => mx.rings.find(r => r.key === mx.ringKey(tp));
  mx.passSub = (tp, set) => !tp.subtype || set.has(tp.subtype);
  mx.subChipsHtml = (selected, pool) => mx.subtypeKeys.map(key => `<button type="button" class="chip chip-sub" data-sub="${esc(key)}" aria-pressed="${selected.has(key)}">${esc(data.labels.subtype[key])} <b>${pool.filter(tp => tp.subtype === key).length}</b></button>`).join('');
  // Przełącza klucz w zbiorze po kliknięciu chipa [attr] w kontenerze, wywołuje onChange i oddaje fokus chipowi.
  mx.bindToggle = (container, attr, set, onChange) => container.addEventListener('click', event => {
    const chip = event.target.closest(`[data-${attr}]`);
    if (!chip) return;
    const key = chip.dataset[attr];
    set.has(key) ? set.delete(key) : set.add(key);
    onChange();
    const again = container.querySelector(`[data-${attr}="${CSS.escape(key)}"]`);
    if (again) again.focus();
  });
  mx.ratingLabel = key => data.labels.rating[key];
  mx.matrixLabel = key => data.labels.matrix[key];
  mx.emotionText = tp => tp.emotionValue ? `${tp.emotion ? tp.emotion + ' ' : ''}(${tp.emotionValue}/5)` : 'brak danych';
  mx.reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Kolejność omawiania: najpierw niezaopiekowane, potem do poprawy; w obrębie oceny jak w danych (proces, punkt).
  mx.sortQueue = list => list.filter(tp => queueRatings.includes(tp.rating))
    .sort((a, b) => queueRatings.indexOf(a.rating) - queueRatings.indexOf(b.rating) || mx.order.get(a.id) - mx.order.get(b.id));

  mx.chipsHtml = (selected, pool) => mx.ratingKeys.map(key => `<button type="button" class="chip rating-${esc(key)}" data-rating="${esc(key)}" aria-pressed="${selected.has(key)}"><span class="mark" aria-hidden="true">${esc(marks[key] || '')}</span>${esc(mx.ratingLabel(key))} <b>${pool.filter(tp => tp.rating === key).length}</b></button>`).join('');

  mx.meter = (label, value, tone) => {
    const level = levels.indexOf(value) + 1;
    return `<div class="metric"><span class="metric-label">${esc(label)}</span><span class="meter ${tone} lvl-${level}" role="img" aria-label="${esc(label)}: ${esc(value)}">${[1, 2, 3].map(n => `<i class="${n <= level ? 'on' : ''}"></i>`).join('')}</span><b>${esc(value)}</b></div>`;
  };

  mx.actionCard = a => {
    const demo = data.status === 'DEMO' ? ' (DEMO)' : '';
    const width = Math.max(4, Math.round(a.weeks / mx.maxWeeks * 100));
    return `<div class="action-card kind-${esc(a.kind)}"><span class="action-kind">${esc(data.labels.actionKind[a.kind])}</span><p class="action-text">${esc(a.text)}</p>
      <div class="metrics">${mx.meter('Koszt', a.cost, 'bad-high')}${mx.meter('Ryzyko', a.risk, 'bad-high')}${mx.meter('Zysk', a.gain, 'good-high')}
      <div class="metric"><span class="metric-label">Czas wdrożenia</span><span class="timebar" role="img" aria-label="Około ${esc(a.weeks)} tygodni"><i style="width:${width}%"></i></span><b>ok. ${esc(a.weeks)} tyg.${demo}</b></div></div>
      ${a.implementationRisks ? `<p class="impl-risk"><b>Ryzyka wdrożenia:</b> ${esc(a.implementationRisks)}</p>` : ''}</div>`;
  };

  mx.detailsHtml = tp => {
    const features = data.features.filter(f => f.touchpointId === tp.id);
    const actions = data.actions.filter(a => a.touchpointId === tp.id);
    const ft = type => features.filter(f => f.type === type);
    const list = items => `<ul class="detail-list">${items.map(f => `<li>${esc(f.text)}</li>`).join('')}</ul>`;
    const none = text => `<p class="block-empty">${esc(text)}</p>`;
    const sub = (type, items) => items.length ? `<h4>${esc(data.labels.featureType[type])}</h4>${list(items)}` : '';
    const section = (title, body) => `<section class="detail-section"><h3>${esc(title)}</h3>${body}</section>`;
    const icon = path => `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
    const icons = { '+': icon('M8 3v10M3 8h10'), '−': icon('M3 8h10'), '→': icon('M3 8h10M9 4l4 4-4 4') };
    const block = (cls, mark, title, body) => `<section class="detail-block ${cls}"><h3><span aria-hidden="true">${icons[mark]}</span>${esc(title)}</h3>${body}</section>`;
    const pros = ft('dobra_praktyka'), cons = [ft('blad_typowy'), ft('blad_diagnozowany')], examples = ft('przyklad'), sources = ft('zrodlo');
    let html = `<div class="detail-kicker">${esc(mx.matrixLabel(tp.matrix))}${tp.subtype ? ' · ' + esc(data.labels.subtype[tp.subtype]) : ''} · ${esc(tp.process)}</div><h2>${esc(tp.title)}</h2>
      <section class="assessment rating-${esc(tp.rating)}"><span class="assessment-label">Ocena obecna</span>
        <span class="rating-pill"><span aria-hidden="true">${esc(marks[tp.rating] || '')}</span>${esc(mx.ratingLabel(tp.rating))}</span>
        <div class="detail-meta">${tp.care ? `<span>Zaopiekowanie: <b>${tp.care}/5</b></span>` : ''}<span>Emocja klienta: <b>${esc(mx.emotionText(tp))}</b></span>${tp.emotionImpact ? `<span>${esc(tp.emotionImpact)}</span>` : ''}<span>Monitoring: <b>${esc(data.labels.monitoring[tp.monitoring] || 'brak danych')}</b></span><span>Właściciel: <b>${esc(tp.owner || 'brak danych')}</b></span></div></section>`;
    html += block('pros', '+', 'Plusy: co działa', pros.length ? list(pros) : none('Brak opisanych plusów w danych.'));
    html += block('cons', '−', 'Minusy: co nie działa', cons[0].length || cons[1].length ? sub('blad_typowy', cons[0]) + sub('blad_diagnozowany', cons[1]) : none('Brak opisanych minusów w danych.'));
    html += block('reco', '→', 'Rekomendacja: co robić', actions.length ? actions.map(mx.actionCard).join('') : none('Brak akcji naprawczych w danych.'));
    if (examples.length) html += section(data.labels.featureType.przyklad, list(examples));
    if (sources.length) html += section(data.labels.featureType.zrodlo, `<div class="detail-tags">${sources.map(f => `<span>${esc(f.text)}</span>`).join('')}</div>`);
    return html;
  };

  window.CX = window.CX || {};
  window.CX.mx = mx;
})();
