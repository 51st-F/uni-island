const UI = {
  map: '全景', list: '清單', time: '時間', tour: '導覽', labels: '名牌', paths: '動線', about: '關於',
  start: '開始導覽', explore: '自己逛逛', services: '服務', connections: '動線', sources: '出處', official: '前往官網',
  pause: '暫停', play: '播放', prev: '上一站', next: '下一站', exit: '結束', replay: '重播',
  index: 'THE ISLAND INDEX', indexSub: (n, m) => `${n} 座島・${m} 項服務`, pick: '點一格，進入那座島。',
  history: '公司沿革', close: '關閉', checked: '資料查核日期', noWebgl: '你的瀏覽器無法顯示 3D 地圖，先以清單呈現。',
  tourTitle: '一位投資人的一生',
  begin: '怎麼開始', caution: '注意事項', tip: '小知識',
};
const STEP_MS = 6500;

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hasWebGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();

const data = await fetch('data/island.json').then((r) => r.json());
const byId = Object.fromEntries(data.islands.map((i) => [i.id, i]));
const cat = Object.fromEntries(data.categories.map((c) => [c.id, c]));
const src = Object.fromEntries(data.sources.map((s) => [s.id, s]));

const state = {
  view: hasWebGL ? 'map' : 'list',
  selected: null,
  labels: true,
  paths: true,
  tour: null, // { step, playing, timer }
};

let world = null;
if (hasWebGL) {
  // canvas textures (ticker, departure board) need their glyphs loaded before they're drawn
  const fontsLoaded = Promise.all([
    document.fonts.load('bold 40px "JetBrains Mono"', 'UNI ISLAND API'),
    document.fonts.load('bold 40px "Noto Sans TC"', '證券港金贏島好探統起發指紐約香上海東京'),
  ]).catch(() => {});
  await Promise.race([fontsLoaded, new Promise((r) => setTimeout(r, 3000))]);
  const { createWorld } = await import('./scene.js');
  world = createWorld($('#stage'), data, {
    onPick: (id) => { if (state.tour) stopTour(); select(id); },
    onHover: (id) => { $('#hint').textContent = id ? `${byId[id].no} ${byId[id].name}` : UI.pick; },
  });
} else {
  document.body.classList.add('no-webgl');
}

// ---------- rendering ----------

function renderChrome() {
  const t = UI, m = data.meta;
  document.title = `${m.title}｜${m.projectName}`;
  $('#brand-title').textContent = m.title;
  $('#views').innerHTML = ['map', 'list', 'time'].map((v) => `<button type="button" data-view="${v}" aria-pressed="${state.view === v}" ${v === 'map' && !hasWebGL ? 'disabled' : ''}>${t[v]}</button>`).join('');
  $('#tools').innerHTML = `
    <button type="button" data-act="tour" ${hasWebGL ? '' : 'disabled'}>${t.tour}</button>
    <button type="button" data-act="labels" aria-pressed="${state.labels}" ${hasWebGL ? '' : 'disabled'}>${t.labels}</button>
    <button type="button" data-act="paths" aria-pressed="${state.paths}" ${hasWebGL ? '' : 'disabled'}>${t.paths}</button>
    <button type="button" data-act="about">${t.about}</button>`;
  $('#unofficial').textContent = m.unofficial;
  $('#hint').textContent = t.pick;

  const items = data.islands.reduce((s, i) => s + i.items.length, 0);
  $('#hero').innerHTML = `
    <p class="eyebrow">${esc(m.eyebrow)} <span>${esc(m.projectTag)}</span></p>
    <p class="hero-num">${String(data.islands.length).padStart(2, '0')}<small>${esc(t.indexSub(data.islands.length, items))}</small></p>
    <h1>${m.heroTitle}</h1>
    <p class="hero-sub">${m.heroSub}</p>
    <p class="hero-warn">${esc(m.unofficial)}</p>
    <div class="hero-actions">
      ${hasWebGL ? `<button type="button" class="primary" data-act="tour">${t.start}</button>` : ''}
      <button type="button" data-act="explore">${hasWebGL ? t.explore : t.list}</button>
    </div>
    ${hasWebGL ? '' : `<p class="hero-warn">${esc(t.noWebgl)}</p>`}`;

  $('#legend').innerHTML = data.categories.map((c) => `<span style="--cat:${c.color}">${esc(c.name)}</span>`).join('');
  world?.setLabelText((i) => `<span class="no">${i.no}</span>${esc(i.name)}`);
}

function renderPanel() {
  const panel = $('#panel');
  const i = byId[state.selected];
  if (!i) { panel.hidden = true; return; }
  const t = UI, c = cat[i.category];
  const conns = data.edges.filter((e) => e.a === i.id || e.b === i.id).map((e) => ({ other: byId[e.a === i.id ? e.b : e.a], e }));
  const d = i.details;
  const sources = [...new Set([...i.sources, ...(d ? Object.values(d).flatMap((x) => x.sources) : [])])];
  const cite = (ids) => `<p class="cite">${t.sources}：${ids.map((s) => `<a href="${esc(src[s].url)}" target="_blank" rel="noopener">${esc(src[s].title)}</a>`).join('、')}</p>`;
  const details = !d ? '' : `
    <section class="detail start"><h3>${t.begin}</h3><ol>${d.start.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>${cite(d.start.sources)}</section>
    <section class="detail caution"><h3>${t.caution}</h3><ul>${d.caution.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>${cite(d.caution.sources)}</section>
    <section class="detail tip"><h3>${t.tip}</h3><p class="tip-title">${esc(d.tip.title)}</p><p>${esc(d.tip.body)}</p>
      ${d.tip.table ? `<table>${d.tip.table.map((r, n) => `<tr>${r.map((c) => (n ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</table>` : ''}
      ${cite(d.tip.sources)}</section>`;
  panel.hidden = false;
  panel.style.setProperty('--cat', c.color);
  panel.innerHTML = `
    <header>
      <p class="kicker"><span class="no">${i.no}</span><span class="chip">${esc(c.name)}</span></p>
      <h2>${esc(i.name)}</h2>
      <button type="button" class="x" data-act="close" aria-label="${t.close}">×</button>
    </header>
    <p class="tagline">${esc(i.tagline)}</p>
    <p class="body">${esc(i.body)}</p>
    <h3>${t.services}<span>${i.items.length}</span></h3>
    <ul class="items">${i.items.map((it) => `
      <li>${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">` : '<div>'}
        <strong>${esc(it.name)}</strong><span>${esc(it.desc)}</span>
      ${it.url ? '<i aria-hidden="true">↗</i></a>' : '</div>'}</li>`).join('')}
    </ul>
    ${details}
    <h3>${t.connections}<span>${conns.length}</span></h3>
    <ul class="conns">${conns.map(({ other: o, e }) => `
      <li><button type="button" data-goto="${o.id}" style="--cat:${cat[o.category].color}">
        <strong><span class="no">${o.no}</span>${esc(o.name)}</strong><span>${esc(e.reason)}</span>
      </button></li>`).join('')}
    </ul>
    <h3>${t.sources}</h3>
    <ul class="srcs">${sources.map((s) => `<li><a href="${esc(src[s].url)}" target="_blank" rel="noopener">${esc(src[s].title)}</a></li>`).join('')}</ul>
    <a class="official" href="${esc(i.url)}" target="_blank" rel="noopener">${t.official} ↗</a>`;
  panel.scrollTop = 0;
}

function renderList() {
  $('#list').innerHTML = `
    <header class="sheet-head"><p class="eyebrow">${UI.index}</p><h2>${esc(data.meta.projectName)}</h2>
      ${hasWebGL ? '' : `<p class="hero-warn">${esc(UI.noWebgl)}</p>`}</header>
    ${data.categories.map((c) => `
      <section style="--cat:${c.color}">
        <h3><span class="dot"></span>${esc(c.name)}</h3>
        <div class="cards">${data.islands.filter((i) => i.category === c.id).map((i) => `
          <button type="button" class="card" data-goto="${i.id}">
            <span class="no">${i.no}</span>
            <strong>${esc(i.name)}</strong>
            <span class="tag">${esc(i.tagline)}</span>
            <span class="count">${i.items.length} · ${esc(UI.services)}</span>
          </button>`).join('')}
        </div>
      </section>`).join('')}`;
}

function renderTimeline() {
  $('#timeline').innerHTML = `
    <header class="sheet-head"><p class="eyebrow">TIMELINE</p><h2>${UI.history}</h2></header>
    <ol>${data.timeline.map((ev) => {
      const i = byId[ev.island];
      return `<li style="--cat:${cat[i.category].color}">
        <time>${esc(ev.date)}</time>
        <button type="button" data-goto="${i.id}"><strong>${esc(ev.title)}</strong><span><span class="no">${i.no}</span>${esc(i.name)}</span></button>
        <a href="${esc(src[ev.source].url)}" target="_blank" rel="noopener" class="src">${esc(src[ev.source].title)}</a>
      </li>`;
    }).join('')}</ol>`;
}

function renderAbout() {
  const m = data.meta, t = UI;
  $('#about .content').innerHTML = `
    <p class="eyebrow">${esc(m.eyebrow)}</p>
    <h2>${esc(m.title)}</h2>
    <p>${esc(m.disclaimer)}</p>
    <h3>${t.sources}</h3>
    <ul class="srcs">${data.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>
    <p class="muted">${t.checked}：${esc(m.checkedAt)}</p>`;
}

function renderTourBar() {
  const bar = $('#tourbar');
  if (!state.tour) { bar.hidden = true; return; }
  const t = UI, s = state.tour, step = data.tour[s.step], i = byId[step.island];
  const last = s.step === data.tour.length - 1;
  bar.hidden = false;
  bar.innerHTML = `
    <div class="tb-head"><span class="eyebrow">${t.tourTitle}</span><span class="count">${String(s.step + 1).padStart(2, '0')} / ${String(data.tour.length).padStart(2, '0')}</span></div>
    <p class="tb-text"><span class="no" style="--cat:${cat[i.category].color}">${i.no} ${esc(i.name)}</span>${esc(step.text)}</p>
    <div class="tb-progress"><span style="animation-duration:${STEP_MS}ms" class="${s.playing ? 'run' : ''}"></span></div>
    <div class="tb-ctrl">
      <button type="button" data-tour="prev" ${s.step === 0 ? 'disabled' : ''}>‹ ${t.prev}</button>
      <button type="button" data-tour="toggle">${s.playing ? t.pause : last ? t.replay : t.play}</button>
      <button type="button" data-tour="next" ${last ? 'disabled' : ''}>${t.next} ›</button>
      <button type="button" data-tour="exit">${t.exit}</button>
    </div>`;
}

function renderAll() {
  renderChrome();
  renderPanel();
  renderList();
  renderTimeline();
  renderAbout();
  renderTourBar();
}

// ---------- actions ----------

function setView(v) {
  state.view = v;
  document.body.dataset.view = v;
  document.querySelectorAll('#views button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === v));
}

function select(id, { fly = true, push = true } = {}) {
  state.selected = id && byId[id] ? id : null;
  if (state.selected && hasWebGL) setView('map');
  hideHero();
  world?.select(state.selected, { fly });
  if (!state.selected && fly) world?.home();
  renderPanel();
  document.body.classList.toggle('has-panel', !!state.selected);
  if (push) {
    const h = state.selected ? `#${state.selected}` : ' ';
    history.replaceState(null, '', h === ' ' ? location.pathname + location.search : h);
  }
}

function hideHero() { $('#hero').hidden = true; }

function goStep(n) {
  const s = state.tour;
  s.step = Math.max(0, Math.min(data.tour.length - 1, n));
  clearTimeout(s.timer);
  const ids = data.tour.slice(0, s.step + 1).map((x) => x.island);
  world?.setTrail(ids);
  select(ids[ids.length - 1]);
  if (s.playing) {
    if (s.step < data.tour.length - 1) s.timer = setTimeout(() => goStep(s.step + 1), STEP_MS);
    else s.playing = false;
  }
  renderTourBar();
}
function startTour() {
  stopTour();
  setView('map');
  state.tour = { step: 0, playing: true, timer: 0 };
  document.body.classList.add('touring');
  goStep(0);
}
function stopTour() {
  if (!state.tour) return;
  clearTimeout(state.tour.timer);
  state.tour = null;
  world?.setTrail([]);
  document.body.classList.remove('touring');
  renderTourBar();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button, a');
  if (!b) return;
  if (b.dataset.view) {
    stopTour();
    hideHero();
    select(null, { fly: b.dataset.view === 'map' });
    setView(b.dataset.view);
    return;
  }
  if (b.dataset.goto) {
    stopTour();
    if (hasWebGL) select(b.dataset.goto);
    else { state.selected = b.dataset.goto; renderPanel(); document.body.classList.add('has-panel'); hideHero(); }
    return;
  }
  if (b.dataset.tour) {
    const s = state.tour;
    if (b.dataset.tour === 'exit') { stopTour(); select(null); }
    else if (b.dataset.tour === 'prev') goStep(s.step - 1);
    else if (b.dataset.tour === 'next') goStep(s.step + 1);
    else if (b.dataset.tour === 'toggle') {
      if (!s.playing && s.step === data.tour.length - 1) { s.playing = true; goStep(0); }
      else { s.playing = !s.playing; goStep(s.step); }
    }
    return;
  }
  switch (b.dataset.act) {
    case 'tour': hideHero(); startTour(); break;
    case 'explore': hideHero(); if (!hasWebGL) setView('list'); break;
    case 'labels': state.labels = !state.labels; world?.setLabels(state.labels); b.setAttribute('aria-pressed', state.labels); break;
    case 'paths': state.paths = !state.paths; world?.setEdges(state.paths); b.setAttribute('aria-pressed', state.paths); break;
    case 'about': $('#about').showModal(); break;
    case 'close': if (b.closest('dialog')) b.closest('dialog').close(); else { if (state.tour) stopTour(); select(null); } break;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#about').open) {
    if (state.tour) stopTour();
    if (state.selected) select(null);
  }
  if (state.tour && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) goStep(state.tour.step + (e.key === 'ArrowRight' ? 1 : -1));
});
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id !== state.selected) select(id || null, { push: false }); });

// ---------- boot ----------

renderAll();
setView(state.view);
const initial = location.hash.slice(1);
if (initial && byId[initial]) select(initial, { push: false });
document.body.classList.add('ready');
