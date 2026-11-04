import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const TOP_N = 10;
const MIN_LEN = 3;
const MAX_LEN = 80;
const POLL_MS = 30000;

const $ = (sel) => document.querySelector(sel);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------------------
// Anonymous voter id (one per browser)
// ---------------------------------------------------------------------------

const VOTER_ID = (() => {
  const fresh = () => (crypto.randomUUID ? crypto.randomUUID() : fallbackUUID());
  try {
    let id = localStorage.getItem('toohighto:voter');
    if (!id) { id = fresh(); localStorage.setItem('toohighto:voter', id); }
    return id;
  } catch {
    return fresh();
  }
})();

function fallbackUUID() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Backends: Supabase when configured, otherwise a localStorage demo
// ---------------------------------------------------------------------------

const MESSAGES = {
  TOO_SHORT: `Needs at least ${MIN_LEN} characters.`,
  TOO_LONG: `Keep it under ${MAX_LEN} characters.`,
  DUPLICATE: 'Someone already reported that one. Go vote it higher!',
  NOT_FOUND: 'That statement drifted out of orbit.',
  BAD_VOTE: 'That vote did not compute.',
};

function friendly(err) {
  const msg = String(err?.message || err || '');
  for (const code of Object.keys(MESSAGES)) if (msg.includes(code)) return MESSAGES[code];
  return 'Lost contact with mission control. Try again.';
}

function normalize(text) {
  return text.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ')
    .replace(/^too high to\s*/i, '').trim();
}

function rankSort(a, b) {
  return b.score - a.score || new Date(a.created_at) - new Date(b.created_at);
}

function newestFirst(a, b) {
  return new Date(b.created_at) - new Date(a.created_at);
}

function splitLists(top, recent) {
  const topIds = new Set(top.map((s) => s.id));
  return { top, fresh: recent.filter((s) => !topIds.has(s.id)).slice(0, TOP_N) };
}

async function supabaseBackend() {
  const { createClient } = await import(SUPABASE_JS);
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const cols = 'id,body,score,created_at';
  return {
    async list() {
      const [top, recent] = await Promise.all([
        db.from('statements').select(cols)
          .order('score', { ascending: false }).order('created_at', { ascending: true }).limit(TOP_N),
        db.from('statements').select(cols)
          .order('created_at', { ascending: false }).limit(TOP_N * 2),
      ]);
      if (top.error) throw top.error;
      if (recent.error) throw recent.error;
      return splitLists(top.data, recent.data);
    },
    async myVotes() {
      const { data, error } = await db.rpc('my_votes', { p_voter_id: VOTER_ID });
      if (error) throw error;
      return new Map(data.map((r) => [r.statement_id, r.value]));
    },
    async vote(id, value) {
      const { error } = await db.rpc('cast_vote', { p_statement_id: id, p_voter_id: VOTER_ID, p_value: value });
      if (error) throw error;
    },
    async submit(body) {
      const { error } = await db.rpc('submit_statement', { p_body: body });
      if (error) throw error;
    },
  };
}

const DEMO_SEED = [
  'blow leaves', 'shovel', 'pick up takeout', 'smoke more weed', 'vote', 'watch sports',
  'give out Halloween candy', 'cook hot dogs', 'leave my closet for fear of seeing my work phone',
  'be out of the fetal position', 'properly achieve the fetal position',
  'send a text about the dreams I had when I was high',
].map((body) => [body, 1]);

function demoBackend() {
  const KEY = 'toohighto:demo';
  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved?.statements) return saved;
    } catch { /* fall through to seed */ }
    const now = Date.now();
    return {
      statements: DEMO_SEED.map(([body, base], i) => ({
        id: `demo-${i}`, body, base, created_at: new Date(now - (DEMO_SEED.length - i) * 60000 - (base ? 864e5 : 0)).toISOString(),
      })),
      votes: {},
    };
  };
  let state = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* memory only */ } };
  const withScore = (s) => ({ id: s.id, body: s.body, created_at: s.created_at, score: s.base + (state.votes[s.id] || 0) });

  return {
    demo: true,
    async list() {
      const all = state.statements.map(withScore);
      return splitLists([...all].sort(rankSort).slice(0, TOP_N), [...all].sort(newestFirst));
    },
    async myVotes() { return new Map(Object.entries(state.votes)); },
    async vote(id, value) {
      if (!state.statements.some((s) => s.id === id)) throw new Error('NOT_FOUND');
      if (value === 0) delete state.votes[id]; else state.votes[id] = value;
      save();
    },
    async submit(raw) {
      const body = normalize(raw);
      if (body.length < MIN_LEN) throw new Error('TOO_SHORT');
      if (body.length > MAX_LEN) throw new Error('TOO_LONG');
      if (state.statements.some((s) => s.body.toLowerCase() === body.toLowerCase())) throw new Error('DUPLICATE');
      state.statements.push({ id: `demo-${Date.now()}`, body, base: 0, created_at: new Date().toISOString() });
      save();
    },
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function rung(s, index, kind) {
  const mine = state.votes.get(s.id) || 0;
  const isTop = kind === 'top';
  const li = el('li', { class: `rung${isTop && index === 0 ? ' peak' : ''}`, 'data-id': s.id });
  // Stencil hull marking, e.g. "TH-01 · PEAK HIGHNESS"
  const serial = isTop ? `TH-${String(index + 1).padStart(2, '0')}${index === 0 ? ' · PEAK HIGHNESS' : ''}` : 'TH-INBOUND';

  const stmt = el('p', { class: 'stmt' }, el('span', { class: 'pre' }, 'Too high to '), s.body);

  const label = `Too high to ${s.body}`;
  const vote = el('div', { class: 'vote' },
    el('button', { type: 'button', class: 'up', 'data-vote': '1', 'aria-pressed': String(mine === 1), 'aria-label': `Higher: ${label}`, title: 'Higher' }, '▲'),
    el('span', { class: 'score', 'aria-label': `Score ${s.score}` }, String(s.score)),
    el('button', { type: 'button', class: 'down', 'data-vote': '-1', 'aria-pressed': String(mine === -1), 'aria-label': `Lower: ${label}`, title: 'Lower' }, '▼'),
  );

  li.append(el('span', { class: 'serial', 'aria-hidden': 'true' }, serial));
  li.append(el('span', { class: 'rank','aria-label': isTop ? `Rank ${index + 1}` : 'New' }, isTop ? `#${index + 1}` : 'NEW'), stmt, vote);
  return li;
}

function positions() {
  const map = new Map();
  for (const li of document.querySelectorAll('.rung[data-id]')) map.set(li.dataset.id, li.getBoundingClientRect().top);
  return map;
}

function flip(before) {
  if (reducedMotion.matches) return;
  for (const li of document.querySelectorAll('.rung[data-id]')) {
    const old = before.get(li.dataset.id);
    if (old === undefined) continue;
    const dy = old - li.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

function render() {
  const before = positions();
  const top = $('#top');
  const fresh = $('#fresh');
  top.replaceChildren(...(state.top.length
    ? state.top.map((s, i) => rung(s, i, 'top'))
    : [el('li', { class: 'empty' }, 'No reports yet. Be the first to file one below.')]));
  fresh.replaceChildren(...(state.fresh.length
    ? state.fresh.map((s, i) => rung(s, i, 'fresh'))
    : [el('li', { class: 'empty' }, 'Nothing new on the launchpad. Submit one above.')]));
  flip(before);
}

// ---------------------------------------------------------------------------
// State + actions
// ---------------------------------------------------------------------------

const state = { top: [], fresh: [], votes: new Map() };
const pending = new Set();
let backend;

async function refresh() {
  const [lists, votes] = await Promise.all([backend.list(), backend.myVotes()]);
  if (pending.size) return; // don't clobber an optimistic update mid-flight
  Object.assign(state, lists, { votes });
  render();
}

// Re-rank locally so the chart reacts instantly; the server is re-read after.
function applyLocalVote(id, delta) {
  const all = [...state.top, ...state.fresh].map((s) => (s.id === id ? { ...s, score: s.score + delta } : s));
  all.sort(rankSort);
  const top = all.slice(0, TOP_N);
  const fresh = all.slice(TOP_N).sort(newestFirst);
  Object.assign(state, { top, fresh });
}

async function onVote(e) {
  const btn = e.target.closest('button[data-vote]');
  if (!btn) return;
  const id = btn.closest('.rung').dataset.id;
  if (pending.has(id)) return;

  const old = state.votes.get(id) || 0;
  const clicked = Number(btn.dataset.vote);
  const next = old === clicked ? 0 : clicked;

  pending.add(id);
  if (next) state.votes.set(id, next); else state.votes.delete(id);
  applyLocalVote(id, next - old);
  render();

  try {
    await backend.vote(id, next);
  } catch (err) {
    toast(friendly(err));
  } finally {
    pending.delete(id);
    refresh().catch(() => {});
  }
}

async function onSubmit(e) {
  e.preventDefault();
  const input = $('#entry');
  const btn = e.target.querySelector('button');
  const body = normalize(input.value);
  if (body.length < MIN_LEN) return toast(MESSAGES.TOO_SHORT);
  if (body.length > MAX_LEN) return toast(MESSAGES.TOO_LONG);

  btn.disabled = true;
  try {
    await backend.submit(body);
    input.value = '';
    updateCount();
    toast('Launched! Find it in New Arrivals.');
    await refresh();
  } catch (err) {
    toast(friendly(err));
  } finally {
    btn.disabled = false;
  }
}

function updateCount() {
  $('#count').textContent = String($('#entry').value.length);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main() {
  $('#top').addEventListener('click', onVote);
  $('#fresh').addEventListener('click', onVote);
  $('#submit-form').addEventListener('submit', onSubmit);
  $('#entry').addEventListener('input', updateCount);

  try {
    backend = SUPABASE_URL && SUPABASE_ANON_KEY ? await supabaseBackend() : demoBackend();
  } catch (err) {
    console.error(err);
    backend = demoBackend();
    toast('Could not reach the database. Running in demo mode.');
  }
  if (backend.demo) $('#demo-note').hidden = false;

  try {
    await refresh();
  } catch (err) {
    console.error(err);
    $('#top').replaceChildren(el('li', { class: 'empty' }, 'Lost contact with mission control. Refresh to try again.'));
  }

  setInterval(() => {
    if (document.visibilityState === 'visible') refresh().catch(() => {});
  }, POLL_MS);
}

main();
