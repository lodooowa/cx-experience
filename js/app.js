(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const labels = {
    type: { standard: 'Punkt styku', critical: 'Punkt krytyczny', success: 'Pozytywny moment', choice: 'Moment decyzji' },
    scene: { audio: 'Świadomość', web: 'Odkrywanie', configurator: 'Konfiguracja', alert: 'Trudność', dealer: 'Dealer', drive: 'Jazda próbna', message: 'Komunikacja', calendar: 'Rezerwacja', options: 'Wybór', document: 'Dokument' },
    perspective: { customer: 'Klient', dealer: 'Dealer', importer: 'Importer' }
  };
  const validTypes = Object.keys(labels.type);
  const validScenes = Object.keys(labels.scene);
  const state = { journey: null, index: 0, persona: null, perspective: 'customer', playing: null };
  const personas = window.CX_PERSONAS;
  const journeys = window.CX_JOURNEYS;

  function showError(message) {
    $('app').hidden = true;
    $('errorScreen').hidden = false;
    $('errorText').textContent = message;
  }

  function validateData() {
    if (!Array.isArray(personas) || !personas.length || !Array.isArray(journeys) || !journeys.length) {
      throw Error('data/personas.js, data/journeys.js: nie znaleziono tablic CX_PERSONAS lub CX_JOURNEYS.');
    }
    const personaIds = new Set();
    for (const persona of personas) {
      if (!persona.id || !persona.name || personaIds.has(persona.id)) throw Error('data/personas.js: niepoprawne lub powtórzone ID persony: ' + persona.id);
      personaIds.add(persona.id);
    }
    const journeyIds = new Set();
    for (const journey of journeys) {
      if (!journey.id || journeyIds.has(journey.id) || !personaIds.has(journey.personaId)) throw Error('data/journeys.js: Niepoprawne ID ścieżki lub brak persony: ' + journey.id);
      journeyIds.add(journey.id);
      if (!Array.isArray(journey.steps) || !journey.steps.length) throw Error('data/journeys.js: Ścieżka ' + journey.id + ' nie ma touchpointów.');
      const ids = new Set();
      for (const step of journey.steps) {
        if (!step.id || ids.has(step.id) || !step.title) throw Error('data/journeys.js: Powtórzone ID lub brak tytułu punktu w ' + journey.id);
        ids.add(step.id);
        if (!validTypes.includes(step.type || 'standard')) throw Error('data/journeys.js: Nieznany typ punktu: ' + step.type + ' (' + step.id + ')');
        if (step.scene && !validScenes.includes(step.scene)) throw Error('data/journeys.js: Nieznana scena: ' + step.scene + ' (' + step.id + ')');
        if (step.emotion !== undefined && step.emotion !== null && step.emotion !== '' && (!Number.isFinite(Number(step.emotion)) || Number(step.emotion) < 1 || Number(step.emotion) > 5)) {
          throw Error('data/journeys.js: Emocja musi mieścić się w zakresie 1–5: ' + step.id);
        }
      }
      for (const step of journey.steps) {
        for (const branch of step.branches || []) {
          if (!branch.label || !ids.has(branch.target)) throw Error('data/journeys.js: Niepoprawna gałąź w ścieżce ' + journey.id + ': ' + (branch.target || step.id));
        }
      }
    }
  }

  function observerOptions(journey) {
    const options = ['customer', 'dealer', 'importer'];
    return options.filter(role => role === 'customer' || journey.steps.every(step => step.perspectives && step.perspectives[role] && step.perspectives[role].description));
  }

  function currentCopy(step) {
    return state.perspective === 'customer' ? step : step.perspectives[state.perspective];
  }

  function fillSelect(select, values) {
    select.replaceChildren(...values);
  }

  function stop() {
    if (state.playing) clearInterval(state.playing);
    state.playing = null;
    $('play').textContent = '▶ Odtwarzaj';
  }

  function selectPersona(id) {
    stop();
    state.persona = personas.find(persona => persona.id === id) || personas[0];
    $('persona').value = state.persona.id;
    const available = journeys.filter(journey => journey.personaId === state.persona.id);
    fillSelect($('journey'), available.map(journey => new Option(journey.title, journey.id)));
    if (!available.length) return showError('Brak ścieżek przypisanych do persony ' + state.persona.name);
    selectJourney(available[0].id);
  }

  function selectJourney(id) {
    stop();
    state.journey = journeys.find(journey => journey.id === id) || journeys[0];
    state.index = 0;
    state.perspective = 'customer';
    $('journey').value = state.journey.id;
    const options = observerOptions(state.journey);
    fillSelect($('perspective'), options.map(role => new Option(labels.perspective[role], role)));
    $('perspective').disabled = options.length < 2;
    render();
  }

  function setDrawer(open) {
    const wasHidden = $('detailDrawer').hidden;
    $('workspace').classList.toggle('has-drawer', open);
    $('detailDrawer').hidden = !open;
    if (open) { if (wasHidden) $('closeDetails').focus(); }
    else {
      const selected = $('graphNodes').querySelector(`[data-step="${state.index}"]`);
      if (selected) selected.focus();
    }
  }

  function selectStep(index, openDetails = false) {
    if (!state.journey) return;
    state.index = Math.max(0, Math.min(index, state.journey.steps.length - 1));
    if (openDetails) setDrawer(true);
    render();
  }

  function render() {
    if (!state.journey) return;
    const step = state.journey.steps[state.index];
    const copy = currentCopy(step);
    $('journeyCaption').textContent = state.journey.title;
    $('journeySubtitle').textContent = state.journey.subtitle || '';
    $('currentPosition').textContent = `${String(state.index + 1).padStart(2, '0')} / ${String(state.journey.steps.length).padStart(2, '0')}`;
    $('currentTitle').textContent = copy.title || step.title;
    $('currentDescription').textContent = copy.description || '';
    $('currentType').textContent = labels.type[step.type || 'standard'];
    $('currentType').className = 'type-pill ' + (step.type || 'standard');
    $('currentScene').textContent = labels.scene[step.scene] || 'Doświadczenie';
    $('selectedEmotion').textContent = step.emotion === undefined || step.emotion === null || step.emotion === '' ? 'Brak danych o emocjach klienta' : `Emocje klienta · ${step.emotion} / 5`;
    $('drawerPerspective').textContent = labels.perspective[state.perspective].toUpperCase();
    $('prev').disabled = state.index === 0;
    $('next').disabled = state.index === state.journey.steps.length - 1;
    $('play').disabled = state.journey.steps.length < 2;
    renderGraph();
    renderChart();
    renderDetails();
    centerSelected();
  }

  function centerSelected() {
    const node = $('graphNodes').querySelector(`[data-step="${state.index}"]`);
    const scroller = document.querySelector('.graph-scroll');
    if (!node || !scroller) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left: node.offsetLeft + node.offsetWidth / 2 - scroller.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
  }

  function graphEdges(steps) {
    const branchTargets = new Set(steps.flatMap(step => (step.branches || []).map(branch => branch.target)));
    const edges = [];
    steps.forEach((step, index) => {
      if (step.branches && step.branches.length) {
        step.branches.forEach(branch => edges.push({ from: step.id, to: branch.target, label: branch.label, branch: true }));
      } else {
        const next = steps.slice(index + 1).find(candidate => !branchTargets.has(candidate.id));
        if (next) edges.push({ from: step.id, to: next.id, branch: false });
      }
    });
    return edges;
  }

  function renderGraph() {
    const steps = state.journey.steps;
    $('graphNodes').innerHTML = steps.map((step, index) => {
      const type = step.type || 'standard';
      const copy = currentCopy(step);
      return `<button class="journey-node ${type} ${index === state.index ? 'selected' : ''}" data-step="${index}" aria-pressed="${index === state.index}">
        <span class="node-top"><span>${String(index + 1).padStart(2, '0')}</span><span>${esc(labels.type[type])}</span></span>
        <span class="node-scene">${window.CX.sceneSvg(step)}</span>
        <strong>${esc(copy.title || step.title)}</strong><span class="node-description">${esc(copy.description || '')}</span>
        ${step.branches && step.branches.length ? '<span class="node-choice">Wybierz wariant w szczegółach ↗</span>' : ''}
      </button>`;
    }).join('');
    $('graphNodes').querySelectorAll('[data-step]').forEach(button => {
      button.addEventListener('click', () => selectStep(Number(button.dataset.step), true));
    });
    requestAnimationFrame(drawGraphEdges);
  }

  function drawGraphEdges() {
    const map = $('journeyMap');
    const layer = $('graphEdges');
    const bounds = map.getBoundingClientRect();
    layer.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    layer.setAttribute('width', bounds.width);
    layer.setAttribute('height', bounds.height);
    if (!bounds.width || !bounds.height) return;
    const paths = graphEdges(state.journey.steps).map((edge, index) => {
      const from = $('graphNodes').querySelectorAll('[data-step]')[state.journey.steps.findIndex(step => step.id === edge.from)];
      const to = $('graphNodes').querySelectorAll('[data-step]')[state.journey.steps.findIndex(step => step.id === edge.to)];
      if (!from || !to) return '';
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - bounds.left;
      const y1 = a.top + a.height / 2 - bounds.top;
      const x2 = b.left + b.width / 2 - bounds.left;
      const y2 = b.top + b.height / 2 - bounds.top;
      const bend = Math.max(35, Math.abs(x2 - x1) * .32);
      const d = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
      const id = `journey-edge-${index}`;
      return `<path id="${id}" class="graph-edge ${edge.branch ? 'branch' : ''}" d="${d}" marker-end="url(#edgeArrow)"/>${edge.label ? `<text class="edge-label"><textPath href="#${id}" startOffset="50%">${esc(edge.label)}</textPath></text>` : ''}`;
    }).join('');
    layer.innerHTML = `<defs><marker id="edgeArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>${paths}`;
  }

  let lastChartWidth = 0;

  function chartWidth() {
    return Math.max($('emotionChart').parentElement.clientWidth, $('graphNodes').scrollWidth + 24);
  }

  function renderChart() {
    const steps = state.journey.steps;
    const chart = $('emotionChart');
    const W = chartWidth() || 1100, H = 240, top = 28, bottom = 48;
    chart.setAttribute('viewBox', `0 0 ${W} ${H}`);
    chart.style.width = `${W}px`;
    lastChartWidth = W;
    const nodes = $('graphNodes').querySelectorAll('[data-step]');
    const canvasLeft = $('journeyMap').getBoundingClientRect().left;
    const shift = document.querySelector('.graph-scroll').getBoundingClientRect().left - chart.parentElement.getBoundingClientRect().left;
    const measured = steps.map((step, index) => ({ step, index, value: Number(step.emotion) }))
      .filter(item => item.step.emotion !== undefined && item.step.emotion !== null && item.step.emotion !== '' && Number.isFinite(item.value) && item.value >= 1 && item.value <= 5);
    const x = index => {
      if (!nodes[index]) return W / 2;
      const box = nodes[index].getBoundingClientRect();
      return box.left + box.width / 2 - canvasLeft + shift;
    };
    const y = value => top + (5 - value) * (H - top - bottom) / 4;
    const measuredIds = new Set(measured.map(item => item.step.id));
    const byId = new Map(steps.map((step, index) => [step.id, { step, index }]));
    const lines = graphEdges(steps).filter(edge => measuredIds.has(edge.from) && measuredIds.has(edge.to)).map(edge => {
      const from = byId.get(edge.from), to = byId.get(edge.to);
      return `<path class="emotion-line ${edge.branch ? 'branch' : ''}" d="M ${x(from.index)} ${y(Number(from.step.emotion))} L ${x(to.index)} ${y(Number(to.step.emotion))}"/>`;
    }).join('');
    const points = measured.map(({ step, index, value }) => `<g class="chart-point ${index === state.index ? 'selected' : ''}" data-chart="${index}" tabindex="0" role="button" aria-label="Punkt ${index + 1}: ${esc(step.title)}, emocja klienta ${value} z 5"><circle cx="${x(index)}" cy="${y(value)}" r="${index === state.index ? 10 : 7}"/><text x="${x(index)}" y="${H - 12}" text-anchor="middle">${String(index + 1).padStart(2, '0')}</text></g>`).join('');
    $('emotionChart').innerHTML = `<defs><linearGradient id="emotionLine"><stop stop-color="var(--brand-primary)"/><stop offset="1" stop-color="var(--brand-accent)"/></linearGradient></defs>
      ${[1, 2, 3, 4, 5].map(value => `<line class="chart-grid" x1="0" x2="${W}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-scale" x="14" y="${y(value) + 4}">${value}</text>`).join('')}
      ${lines}${points}`;
    $('emotionEmpty').hidden = measured.length > 0;
    $('emotionChart').querySelectorAll('[data-chart]').forEach(point => {
      point.addEventListener('click', () => selectStep(Number(point.dataset.chart), true));
      point.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); point.click(); }
      });
    });
  }

  function detailList(title, value, tone = '') {
    const items = (Array.isArray(value) ? value : value ? [value] : []).filter(item => typeof item === 'string' && item.trim());
    return items.length ? `<div class="detail-section"><h3>${title}</h3><ul class="detail-list ${tone}">${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : '';
  }

  function renderDetails() {
    const step = state.journey.steps[state.index];
    const copy = currentCopy(step);
    const type = step.type || 'standard';
    const fields = copy === step ? step : copy;
    $('detailBody').innerHTML = `<div class="detail-kicker">MOMENT ${String(state.index + 1).padStart(2, '0')} · ${esc(labels.type[type])}</div>
      <div class="detail-scene">${window.CX.sceneSvg(step)}</div>
      <h2 id="detailTitle">${esc(copy.title || step.title)}</h2><p class="detail-lead">${esc(copy.description || '')}</p>
      ${fields.quote ? `<div class="detail-section"><h3>${state.perspective === 'customer' ? 'Głos klienta · DEMO' : 'Cytat · DEMO'}</h3><blockquote>„${esc(fields.quote)}”</blockquote></div>` : ''}
      ${fields.insight ? `<div class="detail-section"><h3>Kontekst / opis</h3><p>${esc(fields.insight)}</p></div>` : ''}
      ${detailList('Na co zwrócić uwagę', fields.attention)}
      ${fields.emotionImpact ? `<div class="detail-section"><h3>Wpływ na emocje klienta</h3><p>${esc(fields.emotionImpact)}</p></div>` : ''}
      ${detailList('Jakich błędów unikać', fields.avoid, 'avoid')}
      ${detailList('Potencjalne ryzyka', fields.risks, 'risk')}
      ${fields.action ? `<div class="detail-section"><h3>Kierunek działania</h3><p>${esc(fields.action)}</p></div>` : ''}
      <div class="detail-section"><h3>Obszary odpowiedzialności</h3><div class="detail-tags">${(fields.owner || []).map(owner => `<span>${esc(owner)}</span>`).join('') || '<span>Nie określono</span>'}</div></div>
      ${step.branches && step.branches.length ? `<div class="detail-section"><h3>Wybierz wariant</h3><div class="detail-branches">${step.branches.map(branch => `<button type="button" data-branch="${esc(branch.target)}">${esc(branch.label)} →</button>`).join('')}</div></div>` : ''}
      <div class="detail-navigation"><button id="drawerPrev" type="button" ${state.index === 0 ? 'disabled' : ''}>← Poprzedni</button><button id="drawerNext" type="button" ${state.index === state.journey.steps.length - 1 ? 'disabled' : ''}>Następny →</button></div>`;
    $('detailBody').querySelectorAll('[data-branch]').forEach(button => button.addEventListener('click', () => {
      const index = state.journey.steps.findIndex(candidate => candidate.id === button.dataset.branch);
      if (index >= 0) selectStep(index, true);
    }));
    // przebudowa panelu gubi fokus: wraca na ten sam przycisk, a gdy jest już nieaktywny (koniec ścieżki), na zamknięcie
    const navigate = (id, delta) => () => {
      selectStep(state.index + delta, true);
      const again = $(id);
      (again && !again.disabled ? again : $('closeDetails')).focus();
    };
    $('drawerPrev').addEventListener('click', navigate('drawerPrev', -1));
    $('drawerNext').addEventListener('click', navigate('drawerNext', 1));
  }

  function play() {
    if (state.playing) return stop();
    if (state.index === state.journey.steps.length - 1) { state.index = 0; render(); }
    $('play').textContent = '■ Zatrzymaj';
    state.playing = setInterval(() => {
      if (state.index >= state.journey.steps.length - 1) return stop();
      selectStep(state.index + 1);
    }, 5200);
  }

  function init() {
    validateData();
    fillSelect($('persona'), personas.map(persona => new Option(persona.name, persona.id)));
    $('persona').addEventListener('change', () => selectPersona($('persona').value));
    $('journey').addEventListener('change', () => selectJourney($('journey').value));
    $('perspective').addEventListener('change', () => { state.perspective = $('perspective').value; render(); });
    $('prev').addEventListener('click', () => { stop(); selectStep(state.index - 1); });
    $('next').addEventListener('click', () => { stop(); selectStep(state.index + 1); });
    $('play').addEventListener('click', play);
    $('closeDetails').addEventListener('click', () => setDrawer(false));
    $('toggleEmotions').addEventListener('click', event => {
      const button = event.currentTarget;
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      $('emotionContent').hidden = expanded;
      button.innerHTML = expanded ? 'Rozwiń wykres <span>⌄</span>' : 'Zwiń wykres <span>⌃</span>';
    });
    $('fullscreen').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
    const relayout = () => {
      drawGraphEdges();
      if ($('emotionChart').parentElement.clientWidth && chartWidth() !== lastChartWidth) renderChart();
    };
    window.addEventListener('resize', relayout);
    document.querySelector('.graph-scroll').addEventListener('scroll', event => { $('emotionChart').parentElement.scrollLeft = event.currentTarget.scrollLeft; });
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(relayout);
      observer.observe($('journeyMap'));
      observer.observe($('emotionChart').parentElement);
      observer.observe($('graphNodes'));
    }
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !$('detailDrawer').hidden) { setDrawer(false); return; }
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName) || !$('detailDrawer').hidden) return;
      if (event.key === 'ArrowRight') { stop(); selectStep(state.index + 1); }
      if (event.key === 'ArrowLeft') { stop(); selectStep(state.index - 1); }
    });
    selectPersona(personas[0].id);
  }

  try { init(); } catch (error) { showError(error.message); console.error('CX data error:', error); }
})();
