/* Vangelo del giorno + L'Evangelo come mi è stato rivelato (Maria Valtorta) */
'use strict';

const EVANGELIZO = 'https://feed.evangelizo.org/v2/reader.php';
const GETBIBLE = 'https://api.getbible.net/v2/riveduta';
const MAX_DAYS = 29;                       // Evangelizo accetta solo date entro ~30 giorni da oggi

const BOOKS = {
  mt: 'Mt', matteo: 'Mt', mat: 'Mt',
  mc: 'Mc', marco: 'Mc', mar: 'Mc', mr: 'Mc',
  lc: 'Lc', luca: 'Lc', luc: 'Lc',
  gv: 'Gv', giovanni: 'Gv', gio: 'Gv', giov: 'Gv',
};
const BOOK_FULL = { Mt: 'Matteo', Mc: 'Marco', Lc: 'Luca', Gv: 'Giovanni' };
const BOOK_NR = { Mt: 40, Mc: 41, Lc: 42, Gv: 43 };

const $ = (id) => document.getElementById(id);
const state = {
  index: null,          // {chapters:[{n,vol,title,refs}], corr:[...]}
  byNum: new Map(),
  volumes: new Map(),   // vol -> Promise<{n: paras[]}>
  date: null,           // Date (mezzanotte locale)
  reading: null,        // {book, segs}
  chapter: null,        // numero capitolo mostrato
};

/* ------------------------------------------------------------------ utilità */

function esc(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function daysFromToday(d) {
  return Math.round((d - today()) / 86400000);
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage non disponibile */ }
}
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
}
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
async function copyText(text) {
  if (window.Android && window.Android.copy) {
    window.Android.copy(text);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

/* ------------------------------------------------------------------ riferimenti biblici */

/**
 * "Lc 11,42-46" | "Matteo 5,1-12a" | "Mt 18,1-5.10" | "Mt 26,14-27,66" | "Gv 3"
 * -> {book:'Lc', segs:[[c1,v1,c2,v2], ...]}  oppure null
 */
function parseRef(str, defaultBook) {
  let s = str.replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '');
  let book = defaultBook || null;
  const m = s.match(/^([A-Za-zÀ-ÿ]+)\.?\s*(.*)$/);
  if (m && BOOKS[norm(m[1])]) {
    book = BOOKS[norm(m[1])];
    s = m[2];
  }
  if (!book) return null;
  s = s.replace(/(\d)[a-e]\b/g, '$1').replace(/\s*-\s*/g, '-').replace(/\s*,\s*/g, ',');
  const segs = [];
  let chap = null;
  for (let part of s.split(/[.;]/)) {
    part = part.trim();
    if (!part) continue;
    const [a, b] = part.split('-');
    let v1;
    if (a.includes(',')) {
      const [c, v] = a.split(',');
      chap = parseInt(c, 10);
      v1 = parseInt(v, 10);
    } else if (chap === null) {           // solo capitolo: "Gv 3" o "Gv 3-4"
      chap = parseInt(a, 10);
      if (Number.isNaN(chap)) return null;
      const c2 = b ? parseInt(b, 10) : chap;
      segs.push([chap, 1, c2, 999]);
      chap = c2;
      continue;
    } else {
      v1 = parseInt(a, 10);
    }
    if (Number.isNaN(chap) || Number.isNaN(v1)) return null;
    if (b === undefined) {
      segs.push([chap, v1, chap, v1]);
    } else if (b.includes(',')) {
      const [c2, v2] = b.split(',').map((x) => parseInt(x, 10));
      segs.push([chap, v1, c2, v2]);
      chap = c2;
    } else {
      segs.push([chap, v1, chap, parseInt(b, 10)]);
    }
  }
  return segs.length ? { book, segs } : null;
}

function formatRef(ref) {
  let out = '';
  let lastChap = null;
  ref.segs.forEach(([c1, v1, c2, v2], i) => {
    const sep = i === 0 ? '' : (c1 === lastChap ? '.' : '; ');
    if (v2 === 999 && v1 === 1) {
      out += sep + (c1 === c2 ? `${c1}` : `${c1}-${c2}`);
    } else {
      const head = c1 === lastChap && i > 0 ? `${v1}` : `${c1},${v1}`;
      const tail = c2 !== c1 ? `-${c2},${v2}` : (v2 !== v1 ? `-${v2}` : '');
      out += sep + head + tail;
    }
    lastChap = c2;
  });
  return `${ref.book} ${out}`;
}

const pos = (c, v) => c * 1000 + v;
function segLen(s) { return pos(s[2], s[3]) - pos(s[0], s[1]) + 1; }
function overlap(a, b) {
  return Math.max(0, Math.min(pos(a[2], a[3]), pos(b[2], b[3])) - Math.max(pos(a[0], a[1]), pos(b[0], b[1])) + 1);
}
function distance(a, b) {
  if (overlap(a, b)) return 0;
  return Math.min(Math.abs(pos(a[0], a[1]) - pos(b[2], b[3])), Math.abs(pos(b[0], b[1]) - pos(a[2], a[3])));
}

/** Capitoli Valtorta che corrispondono a un brano, ordinati per pertinenza. */
function findChapters(ref) {
  const found = new Map();
  const len = ref.segs.reduce((t, s) => t + segLen(s), 0);
  for (const c of state.index.corr) {
    if (c.book !== ref.book) continue;
    let ov = 0;
    for (const a of ref.segs) for (const b of c.segs) ov += overlap(a, b);
    if (!ov) continue;
    const clen = c.segs.reduce((t, s) => t + segLen(s), 0);
    const score = ov / (len + clen - ov);
    const prev = found.get(c.cap);
    if (!prev || score > prev.score) found.set(c.cap, { cap: c.cap, score, ref: c.ref, approx: false });
  }
  let list = [...found.values()].sort((a, b) => b.score - a.score || a.cap - b.cap);
  if (!list.length) {
    // nessuna sovrapposizione: proponi i capitoli più vicini nello stesso Vangelo
    const near = [];
    for (const c of state.index.corr) {
      if (c.book !== ref.book) continue;
      let d = Infinity;
      for (const a of ref.segs) for (const b of c.segs) d = Math.min(d, distance(a, b));
      if (d < 1000) near.push({ cap: c.cap, score: -d, ref: c.ref, approx: true });
    }
    near.sort((a, b) => b.score - a.score);
    const seen = new Set();
    list = near.filter((x) => !seen.has(x.cap) && seen.add(x.cap)).slice(0, 3);
  }
  return list;
}

/* ------------------------------------------------------------------ dati Valtorta */

/* Nel sito pubblico i dati sono cifrati (vedi tools/build_site.py): la chiave arriva dal
   link (#k=...) e resta salvata nel telefono. Nell'APK e in docs/ i dati sono in chiaro. */
class LockedError extends Error {}

async function readData(name) {
  if (state.crypto) {
    const res = await fetch(`data/${name}.bin?v=${state.meta.ver}`);
    if (!res.ok) throw new Error(res.status);
    const buf = await res.arrayBuffer();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buf.slice(0, 12), additionalData: new TextEncoder().encode(name) },
      state.crypto, buf.slice(12));
    const stream = new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  const res = await fetch(`data/${name}.json`);
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function deriveKey(passphrase, meta) {
  const salt = Uint8Array.from(atob(meta.salt), (c) => c.charCodeAt(0));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: meta.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

/** La chiave da un link ("...#k=abcd-efgh") o da una chiave incollata da sola. */
function keyFrom(text) {
  text = String(text || '').trim();
  // "...#k=emv", oppure l'indirizzo breve ".../lectio/emv", oppure la sola chiave
  const m = text.match(/[#&?/]k=([A-Za-z0-9-]+)/) || text.match(/\.github\.io\/[^/]+\/([A-Za-z0-9-]+)\/?(?:[?#].*)?$/);
  if (m) return m[1].toLowerCase();
  return /^[A-Za-z0-9-]{3,}$/.test(text) ? text.toLowerCase() : null;   // maiuscole e minuscole non contano
}

async function loadIndex(passphrase) {
  const metaRes = await fetch('data/meta.json', { cache: 'no-cache' }).catch(() => null);
  if (metaRes && metaRes.ok) {
    state.meta = await metaRes.json();
    if (!passphrase) throw new LockedError('chiave mancante');
    state.crypto = await deriveKey(passphrase, state.meta);
    try {
      state.index = await readData('index');
    } catch (e) {
      state.crypto = null;
      throw e instanceof TypeError ? e : new LockedError('chiave non valida');
    }
  } else {
    state.index = await readData('index');
  }
  state.byNum.clear();
  for (const c of state.index.chapters) state.byNum.set(c.n, c);
}

/** Senza chiave il Vangelo funziona, ma al posto della Valtorta c'è il campo per la chiave. */
function showLocked(msg) {
  state.chapter = null;
  $('matches').innerHTML = '';
  $('chapterTitle').textContent = 'Serve la chiave';
  $('chapterMeta').textContent = '';
  $('prevChapter').disabled = true;
  $('nextChapter').disabled = true;
  $('chapterText').innerHTML = `<div class="unlock"><p>${esc(msg)}</p>
    <form id="unlockForm" autocomplete="off">
      <input id="unlockInput" placeholder="Incolla qui il link o la chiave" autocapitalize="off" spellcheck="false">
      <button class="text-btn primary" type="submit">Apri</button>
    </form></div>`;
  $('unlockForm').addEventListener('submit', (e) => {
    e.preventDefault();
    unlock(keyFrom($('unlockInput').value));
  });
}

async function unlock(passphrase) {
  if (!passphrase) {
    showLocked('Non trovo la chiave: incolla il link completo che hai ricevuto.');
    return;
  }
  try {
    await loadIndex(passphrase);
  } catch (e) {
    showLocked(e instanceof LockedError
      ? 'Chiave non valida: controlla il link che hai ricevuto.'
      : 'Impossibile caricare i dati: controlla la connessione e riprova.');
    return;
  }
  store('chiave', passphrase);
  offerResume();
  showMatches(state.reading);
}

function loadVolume(vol) {
  if (!state.volumes.has(vol)) {
    const p = readData(`vol${String(vol).padStart(2, '0')}`);
    p.catch(() => state.volumes.delete(vol));
    state.volumes.set(vol, p);
  }
  return state.volumes.get(vol);
}

async function chapterParas(n) {
  const info = state.byNum.get(n);
  const vol = await loadVolume(info.vol);
  const paras = vol[n] || [];
  if (!$('noNotes').checked) return paras;
  // note dell'editore tra parentesi, es. "(Si odiano poiché imperversava la seconda guerra mondiale…)"
  return paras.map((p) => p.replace(/\s*\([^()]{18,}\)/g, '').trim()).filter(Boolean);
}

/* ------------------------------------------------------------------ Vangelo del giorno */

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n'), 'text/html');
  return doc.body.textContent.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

async function evangelizo(date, params) {
  const d = ymd(date).replace(/-/g, '');
  const res = await fetch(`${EVANGELIZO}?date=${d}&lang=IT&${params}`);
  const txt = await res.text();
  if (!res.ok || /<html|Error :/i.test(txt)) throw new Error('Data non disponibile');
  return txt;
}

async function fetchDay(date) {
  const key = 'giorno:' + ymd(date);
  const cached = load(key, null);
  if (cached) return cached;
  const [lt, text, lit] = await Promise.all([
    evangelizo(date, 'type=reading_lt&content=GSP'),
    evangelizo(date, 'type=reading&content=GSP'),
    evangelizo(date, 'type=liturgic_t').catch(() => ''),
  ]);
  const title = htmlToText(lt);                         // "Dal Vangelo di Gesù Cristo secondo Luca 11,42-46."
  const m = title.match(/secondo\s+(\S+)\s+(.+)$/i);
  const day = {
    title,
    refText: m ? `${BOOKS[norm(m[1])] || m[1]} ${m[2].replace(/\.$/, '')}` : title,
    text: htmlToText(text),
    liturgy: htmlToText(lit),
  };
  store(key, day);
  pruneDayCache();
  return day;
}

function pruneDayCache() {
  try {
    const limit = ymd(addDays(today(), -40));
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('giorno:') && k.slice(7) < limit) localStorage.removeItem(k);
    }
  } catch (e) { /* niente */ }
}

/* ------------------------------------------------------------------ interfaccia */

function setDateBounds() {
  const inp = $('dateInput');
  inp.min = ymd(addDays(today(), -MAX_DAYS));
  inp.max = ymd(addDays(today(), MAX_DAYS));
}

function renderParas(el, paras, emptyMsg) {
  if (tts.queue.some((q) => el.contains(q.el))) ttsStop();   // il testo in lettura sta per sparire
  if (!paras.length) {
    el.innerHTML = `<p class="empty">${esc(emptyMsg)}</p>`;
    return;
  }
  // ogni frase è un elemento a sé: si evidenzia durante la lettura e si tocca per ascoltare da lì
  el.innerHTML = paras.map((p) => '<p>' + splitSentences(p).map((x) => `<span class="s">${esc(x)}</span>`).join(' ') + '</p>').join('');
}

async function showDate(date, { pushHash = true } = {}) {
  state.date = date;
  $('dateInput').value = ymd(date);
  const off = daysFromToday(date);
  $('prevDay').disabled = off <= -MAX_DAYS;
  $('nextDay').disabled = off >= MAX_DAYS;
  $('todayBtn').disabled = off === 0;
  if (pushHash) setHash(off === 0 ? '' : '#/' + ymd(date));

  const longDate = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('gospelKicker').textContent = off === 0 ? 'Vangelo di oggi' : 'Vangelo di ' + longDate;
  $('liturgy').textContent = longDate;
  $('gospelRef').textContent = '…';
  $('gospelSource').textContent = '';
  renderParas($('gospelText'), [], 'Caricamento del Vangelo…');

  if (Math.abs(off) > MAX_DAYS) {
    $('gospelRef').textContent = 'Data fuori intervallo';
    renderParas($('gospelText'), [], `Il Vangelo del giorno è disponibile solo da ${MAX_DAYS} giorni prima a ${MAX_DAYS} giorni dopo oggi. Puoi comunque cercare un brano qualsiasi con la lente in alto.`);
    showMatches(null);
    return;
  }

  let day;
  try {
    day = await fetchDay(date);
  } catch (e) {
    if (state.date !== date) return;
    $('gospelRef').textContent = 'Vangelo non disponibile';
    renderParas($('gospelText'), [], 'Non è stato possibile scaricare il Vangelo del giorno. Controlla la connessione e riprova tra qualche istante.');
    const retry = document.createElement('button');
    retry.className = 'text-btn primary';
    retry.textContent = 'Riprova';
    retry.addEventListener('click', () => showDate(date, { pushHash: false }));
    $('gospelText').appendChild(retry);
    showMatches(null);
    return;
  }
  if (state.date !== date) return;                    // nel frattempo l'utente ha cambiato data

  $('liturgy').textContent = day.liturgy ? `${longDate} — ${day.liturgy}` : longDate;
  $('gospelRef').textContent = day.title;
  const lines = day.text.split('\n').filter((l) => l && !/^Copyright|vangelodelgiorno|iscrivetevi/i.test(l));
  renderParas($('gospelText'), lines, 'Testo non disponibile.');
  $('gospelSource').textContent = 'Testo liturgico CEI tramite evangelizo.org';
  state.reading = parseRef(day.refText);
  showMatches(state.reading);
}

/** Mostra i capitoli corrispondenti al brano e apre il primo. */
function showMatches(ref, { openFirst = true } = {}) {
  if (!state.index) return;   // manca la chiave: resta il campo per inserirla
  const box = $('matches');
  box.innerHTML = '';
  if (!ref) {
    box.innerHTML = '';
    if (openFirst && !state.chapter) openChapter(load('ultimoCapitolo', 1), { remember: false });
    return;
  }
  const list = findChapters(ref);
  if (!list.length) {
    box.innerHTML = `<div class="notice">Nessun capitolo corrispondente trovato per ${esc(formatRef(ref))}. Usa la ricerca per sceglierne uno.</div>`;
    return;
  }
  if (list[0].approx) {
    box.insertAdjacentHTML('beforeend', `<div class="notice">Per ${esc(formatRef(ref))} non c'è una corrispondenza esatta nella tabella: ecco i capitoli più vicini.</div>`);
  }
  for (const m of list) {
    const info = state.byNum.get(m.cap);
    const b = document.createElement('button');
    b.className = 'match';
    b.dataset.cap = m.cap;
    b.title = `${info.title}\n(corrispondenza: ${m.ref})`;
    b.innerHTML = `<b>Cap. ${m.cap}</b><span class="t">${esc(info.title)}</span>${m.approx ? '<span class="tag">vicino</span>' : ''}`;
    b.addEventListener('click', () => openChapter(m.cap));
    box.appendChild(b);
  }
  if (openFirst) openChapter(list[0].cap, { remember: false });
}

function markActiveMatch() {
  for (const b of document.querySelectorAll('.match')) {
    b.classList.toggle('active', Number(b.dataset.cap) === state.chapter);
  }
}

async function openChapter(n, { remember = true, scroll = false } = {}) {
  if (!state.index) return;
  n = Math.max(1, Math.min(state.index.chapters.length, Number(n) || 1));
  const info = state.byNum.get(n);
  state.chapter = n;
  markActiveMatch();
  $('chapterTitle').textContent = `${n}. ${info.title}`;
  $('chapterMeta').textContent = `Volume ${info.vol}` + (info.refs ? ` · ${info.refs}` : '');
  renderParas($('chapterText'), [], 'Caricamento del capitolo…');
  $('prevChapter').disabled = n <= 1;
  $('nextChapter').disabled = n >= state.index.chapters.length;
  const next = state.byNum.get(n + 1);
  $('nextChapter').textContent = next ? `Continua: cap. ${n + 1} ›` : 'Fine dell\'opera';
  $('nextChapter').title = next ? next.title : '';
  const prev = state.byNum.get(n - 1);
  $('prevChapter').title = prev ? prev.title : '';
  if (remember) {
    store('ultimoCapitolo', n);
    $('resume').hidden = true;
  }
  let paras;
  try {
    paras = await chapterParas(n);
  } catch (e) {
    if (state.chapter === n) renderParas($('chapterText'), [], 'Impossibile caricare il capitolo. Controlla la connessione.');
    return;
  }
  if (state.chapter !== n) return;
  renderParas($('chapterText'), paras, 'Capitolo vuoto.');
  if (scroll) {
    $('valtortaPane').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function gospelAsText() {
  const lines = [...$('gospelText').querySelectorAll('p:not(.empty)')].map((p) => p.textContent.replace(/^\d+\s+/, ''));
  return [$('gospelRef').textContent, '', ...lines].join('\n');
}

async function bothAsText() {
  const n = state.chapter;
  if (!n) return gospelAsText();
  const body = (await chapterParas(n)).join('\n\n');
  return `${gospelAsText()}\n\n\nL'Evangelo come mi è stato rivelato. Capitolo ${n}. ${state.byNum.get(n).title}.\n\n${body}`;
}

async function chapterAsText() {
  const n = state.chapter;
  const info = state.byNum.get(n);
  const paras = await chapterParas(n);
  const body = paras.join('\n\n');
  return $('withTitle').checked ? `Capitolo ${n}. ${info.title}.\n\n${body}` : body;
}

/* ------------------------------------------------------------------ lettura ad alta voce */

const tts = {
  queue: [],            // [{el, src}]
  i: 0,
  playing: false,
  paused: false,
  mode: null,           // 'gospel' | 'valtorta' | 'all'
  session: 0,           // invalida i callback delle frasi interrotte
  rate: load('ttsRate', 1),
  voice: load('ttsVoce', ''),
  wake: null,
};
// Dentro l'APK Android: lettura vocale, condivisione e copia passano dal sistema
const NATIVE = window.Android && window.Android.isApp && window.Android.isApp() ? window.Android : null;
const hasTts = !!NATIVE || 'speechSynthesis' in window;

/** Frasi brevi: Android blocca le frasi lunghe, e così si può evidenziare e saltare. */
function splitSentences(p) {
  const out = [];
  // si spezza solo se dopo la punteggiatura comincia una nuova frase (maiuscola o virgolette)
  for (let x of p.split(/(?<=[.!?…][»"”’)]*)\s+(?=[«"“(A-ZÀ-ÖØ-Þ])/)) {
    x = x.trim();
    if (!x) continue;
    if (x.length > 240) {
      for (const y of x.match(/[^,;:]+(?:[,;:]+|$)\s*/g) || [x]) if (y.trim()) out.push(y.trim());
    } else if (out.length && /^[»"”’)\]]+$/.test(x)) {
      out[out.length - 1] += x;
    } else {
      out.push(x);
    }
  }
  return out;
}

/** Voci italiane come [{id, label}]. */
function italianVoices() {
  if (NATIVE) {
    try { return JSON.parse(NATIVE.voices()); } catch (e) { return []; }
  }
  const all = speechSynthesis.getVoices();
  const it = all.filter((v) => /^it([-_]|$)/i.test(v.lang));
  return (it.length ? it : all).map((v) => ({ id: v.voiceURI, label: v.name.replace(/^(Microsoft|Google)\s+/, '') }));
}

function fillVoices() {
  const sel = $('ttsVoice');
  const voices = italianVoices();
  sel.innerHTML = '<option value="">predefinita</option>' +
    voices.map((v) => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join('');
  sel.value = voices.some((v) => v.id === tts.voice) ? tts.voice : '';
}

const speechText = (el) => el.textContent.replace(/^\d+\s+/, '');   // senza numero di versetto

function showCurrent() {
  clearHighlight();
  const item = tts.queue[tts.i];
  if (!item) return;
  item.el.classList.add('tts-active');
  item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  updatePlayer();
}

/** Eventi dal motore vocale di Android: inizio di ogni frase e fine della lettura. */
window.nativeTtsEvent = (type, i, gen) => {
  if (type === 'voices') {
    fillVoices();
    return;
  }
  if (gen !== tts.session || !tts.playing || tts.paused) return;
  if (type === 'start') {
    tts.i = i;
    showCurrent();
  } else if (type === 'end') {
    ttsFinished();
  }
};

function ttsBuild(mode) {
  const take = (id, src) => [...$(id).querySelectorAll('.s')].map((el) => ({ el, src }));
  const q = [];
  if (mode !== 'valtorta') q.push(...take('gospelText', 'Vangelo'));
  if (mode !== 'gospel') q.push(...take('chapterText', `Valtorta · cap. ${state.chapter}`));
  return q;
}

function ttsStart(mode, from = 0) {
  if (!hasTts) return;
  tts.mode = mode;
  tts.queue = ttsBuild(mode);
  if (!tts.queue.length) {
    toast('Nessun testo da leggere');
    return;
  }
  tts.i = Math.max(0, Math.min(from, tts.queue.length - 1));
  tts.playing = true;
  tts.paused = false;
  keepAwake(true);
  ttsSpeak();
}

function ttsSpeak() {
  const session = ++tts.session;
  const item = tts.queue[tts.i];
  if (!tts.playing || !item) {
    ttsStop();
    return;
  }
  if (NATIVE) {
    // Android mette in coda tutte le frasi: la lettura continua anche a schermo spento
    showCurrent();
    NATIVE.speak(JSON.stringify(tts.queue.map((q) => speechText(q.el))), tts.i, tts.rate, tts.voice || '', session);
    return;
  }
  speechSynthesis.cancel();
  showCurrent();

  const u = new SpeechSynthesisUtterance(speechText(item.el));
  u.lang = 'it-IT';
  u.rate = tts.rate;
  const v = speechSynthesis.getVoices().find((x) => x.voiceURI === tts.voice);
  if (v) u.voice = v;
  u.onend = () => {
    if (session !== tts.session || tts.paused) return;
    if (++tts.i < tts.queue.length) ttsSpeak();
    else ttsFinished();
  };
  u.onerror = (e) => {
    if (session !== tts.session || e.error === 'interrupted' || e.error === 'canceled') return;
    if (++tts.i < tts.queue.length) ttsSpeak();   // frase rifiutata dal motore: passa alla successiva
    else ttsFinished();
  };
  speechSynthesis.speak(u);
}

async function ttsFinished() {
  const n = state.chapter;
  if (tts.mode !== 'gospel' && $('autoNext').checked && state.byNum.has(n + 1)) {
    await openChapter(n + 1);
    if (state.chapter === n + 1) ttsStart('valtorta', 0);
    return;
  }
  ttsStop();
}

function ttsTogglePlay() {
  if (!tts.playing) {
    ttsStart('all', 0);
  } else if (tts.paused) {
    tts.paused = false;
    keepAwake(true);
    ttsSpeak();                       // riprende dalla frase evidenziata
  } else {
    tts.session++;
    tts.paused = true;
    ttsCancel();                      // si riprende dalla frase evidenziata
    keepAwake(false);
    updatePlayer();
  }
}

function ttsSkip(delta) {
  if (!tts.playing) return;
  tts.i = Math.max(0, Math.min(tts.i + delta, tts.queue.length - 1));
  tts.paused = false;
  ttsSpeak();
}

function ttsStop() {
  tts.session++;
  tts.playing = false;
  tts.paused = false;
  tts.queue = [];
  ttsCancel();
  clearHighlight();
  keepAwake(false);
  updatePlayer();
}

function ttsCancel() {
  if (NATIVE) NATIVE.stop();
  else if (hasTts) speechSynthesis.cancel();
}

function clearHighlight() {
  for (const el of document.querySelectorAll('.s.tts-active')) el.classList.remove('tts-active');
}

function updatePlayer() {
  if (!hasTts) return;
  const p = $('player');
  p.classList.toggle('playing', tts.playing && !tts.paused);
  p.classList.toggle('paused', tts.playing && tts.paused);
  const item = tts.queue[tts.i];
  if (!tts.playing || !item) {
    $('ttsLabel').textContent = 'Lettore vocale';
    $('ttsCount').textContent = '';
    $('ttsPreview').textContent = 'Tocca una frase per ascoltarla da lì, oppure premi ▶';
    $('ttsPlay').textContent = '▶ Leggi';
    return;
  }
  $('ttsLabel').textContent = (tts.paused ? 'In pausa · ' : '') + item.src;
  $('ttsCount').textContent = `frase ${tts.i + 1} di ${tts.queue.length}`;
  $('ttsPreview').textContent = item.el.textContent;
  $('ttsPlay').textContent = tts.paused ? '▶ Riprendi' : '❚❚ Pausa';
}

/** Tiene acceso lo schermo durante la lettura (se lo schermo si spegne, il browser smette di leggere). */
async function keepAwake(on) {
  if (NATIVE) return;   // nell'app la lettura prosegue anche a schermo spento
  try {
    if (on && !tts.wake && 'wakeLock' in navigator) {
      tts.wake = await navigator.wakeLock.request('screen');
      tts.wake.addEventListener('release', () => { tts.wake = null; });
    } else if (!on && tts.wake) {
      await tts.wake.release();
      tts.wake = null;
    }
  } catch (e) { /* non supportato o negato */ }
}

function bindTts() {
  if (!hasTts) {
    document.documentElement.classList.add('no-tts');
    return;
  }
  for (const [id, mode] of [['gospelText', 'gospel'], ['chapterText', 'valtorta']]) {
    $(id).addEventListener('click', (e) => {
      const el = e.target.closest('.s');
      if (!el || !window.getSelection().isCollapsed) return;   // non partire mentre si seleziona testo
      ttsStart(mode, [...$(id).querySelectorAll('.s')].indexOf(el));
    });
  }
  $('listenGospel').addEventListener('click', () => ttsStart('gospel'));
  $('listenAll').addEventListener('click', () => ttsStart('all'));
  $('listenChapter').addEventListener('click', () => ttsStart('valtorta'));
  $('ttsPlay').addEventListener('click', ttsTogglePlay);
  $('ttsBack').addEventListener('click', () => ttsSkip(-2));
  $('ttsFwd').addEventListener('click', () => ttsSkip(2));
  $('ttsStop').addEventListener('click', ttsStop);

  $('ttsRate').value = String(tts.rate);
  $('ttsRate').addEventListener('change', (e) => {
    tts.rate = parseFloat(e.target.value) || 1;
    store('ttsRate', tts.rate);
    if (tts.playing && !tts.paused) ttsSpeak();
  });
  fillVoices();
  if (!NATIVE) speechSynthesis.addEventListener('voiceschanged', fillVoices);
  $('ttsVoice').addEventListener('change', (e) => {
    tts.voice = e.target.value;
    store('ttsVoce', tts.voice);
    if (tts.playing && !tts.paused) ttsSpeak();
  });

  $('autoNext').checked = load('letturaContinua', false);
  $('autoNext').addEventListener('change', (e) => store('letturaContinua', e.target.checked));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && tts.playing && !tts.paused) keepAwake(true);
  });
  if (!NATIVE) window.addEventListener('pagehide', () => speechSynthesis.cancel());
  updatePlayer();
}

/* ------------------------------------------------------------------ ricerca */

async function runSearch(q) {
  const out = $('searchResults');
  q = q.trim();
  out.innerHTML = '';
  if (!q) return;

  if (!state.index && !parseRef(q)) {
    out.innerHTML = '<div class="hint">Per cercare nei capitoli della Valtorta serve la chiave.</div>';
    return;
  }

  if (/^\d{1,3}$/.test(q)) {
    openChapter(Number(q), { scroll: true });
    switchTab('valtortaPane');
    closeSearch();
    return;
  }

  const ref = parseRef(q);
  if (ref) {
    closeSearch();
    await showPassage(ref);
    return;
  }

  const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
  const hits = state.index.chapters.filter((c) => {
    const t = norm(c.title);
    return words.every((w) => t.includes(w));
  }).slice(0, 40);
  if (!hits.length) {
    out.innerHTML = '<div class="hint">Nessun capitolo trovato. Prova con un riferimento (es. "Gv 3,1-21") o un numero di capitolo.</div>';
    return;
  }
  for (const c of hits) {
    const b = document.createElement('button');
    b.innerHTML = `<span class="num">${c.n}.</span>${esc(c.title)}`;
    b.addEventListener('click', () => {
      openChapter(c.n, { scroll: true });
      switchTab('valtortaPane');
      closeSearch();
    });
    out.appendChild(b);
  }
}

/** Brano cercato a mano: testo evangelico (Riveduta, dominio pubblico) + capitoli corrispondenti. */
async function showPassage(ref) {
  state.reading = ref;
  setHash('#/brano/' + encodeURIComponent(formatRef(ref)));
  const label = `${BOOK_FULL[ref.book]} ${formatRef(ref).slice(3)}`;
  $('gospelKicker').textContent = 'Brano cercato';
  $('todayBtn').disabled = false;
  $('gospelRef').textContent = label;
  $('liturgy').textContent = '';
  renderParas($('gospelText'), [], 'Caricamento del brano…');
  $('gospelSource').textContent = '';
  showMatches(ref);
  switchTab('valtortaPane');

  try {
    const chapters = new Set();
    for (const [c1, , c2] of ref.segs) for (let c = c1; c <= c2; c++) chapters.add(c);
    const data = {};
    await Promise.all([...chapters].map(async (c) => {
      const r = await fetch(`${GETBIBLE}/${BOOK_NR[ref.book]}/${c}.json`);
      data[c] = (await r.json()).verses;
    }));
    const lines = [];
    for (const [c1, v1, c2, v2] of ref.segs) {
      for (let c = c1; c <= c2; c++) {
        for (const v of data[c] || []) {
          if (pos(c, v.verse) >= pos(c1, v1) && pos(c, v.verse) <= pos(c2, v2)) lines.push(`${v.verse} ${v.text.trim()}`);
        }
      }
    }
    if (state.reading !== ref) return;
    renderParas($('gospelText'), lines, 'Brano non trovato.');
    $('gospelSource').textContent = 'Traduzione Riveduta 1927 (getbible.net). Il testo liturgico CEI è disponibile solo per il Vangelo del giorno.';
  } catch (e) {
    if (state.reading === ref) renderParas($('gospelText'), [], 'Testo evangelico non disponibile offline.');
  }
}

function openSearch() {
  $('searchBar').hidden = false;
  $('searchInput').focus();
}
function closeSearch() {
  $('searchBar').hidden = true;
  $('searchResults').innerHTML = '';
}

/* ------------------------------------------------------------------ schede (telefono) */

function switchTab(id) {
  for (const t of document.querySelectorAll('.tab')) {
    const on = t.dataset.pane === id;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on);
  }
  $('gospelPane').classList.toggle('hidden-mobile', id !== 'gospelPane');
  $('valtortaPane').classList.toggle('hidden-mobile', id !== 'valtortaPane');
}

/* ------------------------------------------------------------------ indirizzo (#) */

let ignoreHash = false;
function setHash(h) {
  if (location.hash === h || (!h && !location.hash)) return;
  ignoreHash = true;
  history.replaceState(null, '', h || location.pathname + location.search);
  ignoreHash = false;
}

function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  let m;
  if ((m = h.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    showDate(new Date(+m[1], +m[2] - 1, +m[3]), { pushHash: false });
  } else if ((m = h.match(/^cap\/(\d+)$/))) {
    showDate(today(), { pushHash: false }).then(() => openChapter(Number(m[1])));
  } else if ((m = h.match(/^brano\/(.+)$/)) && parseRef(m[1])) {
    showPassage(parseRef(m[1]));
  } else {
    showDate(today(), { pushHash: false });
  }
}

/* ------------------------------------------------------------------ avvio */

function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}

function updateThemeButton() {
  const dark = isDark();
  $('themeToggle').textContent = dark ? '☀' : '☾';
  $('themeToggle').title = dark ? 'Modalità giorno' : 'Modalità notte';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#1b1714' : '#5b2a1e';
}

function toggleTheme() {
  const t = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  store('tema', t);
  updateThemeButton();
}

function setFont(px) {
  px = Math.max(14, Math.min(30, px));
  document.documentElement.style.setProperty('--fs', px + 'px');
  store('fontSize', px);
}

function bind() {
  $('prevDay').addEventListener('click', () => showDate(addDays(state.date, -1)));
  $('nextDay').addEventListener('click', () => showDate(addDays(state.date, 1)));
  $('todayBtn').addEventListener('click', () => showDate(today()));
  $('dateInput').addEventListener('change', (e) => {
    const [y, mo, d] = e.target.value.split('-').map(Number);
    if (y) showDate(new Date(y, mo - 1, d));
  });

  $('fontUp').addEventListener('click', () => setFont(load('fontSize', 19) + 1));
  $('themeToggle').addEventListener('click', toggleTheme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeButton);
  updateThemeButton();
  $('fontDown').addEventListener('click', () => setFont(load('fontSize', 19) - 1));

  $('searchToggle').addEventListener('click', () => ($('searchBar').hidden ? openSearch() : closeSearch()));
  $('searchForm').addEventListener('submit', (e) => { e.preventDefault(); runSearch($('searchInput').value); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
  });

  $('prevChapter').addEventListener('click', () => openChapter(state.chapter - 1, { scroll: true }));
  $('nextChapter').addEventListener('click', () => openChapter(state.chapter + 1, { scroll: true }));

  $('copyChapter').addEventListener('click', async () => {
    await copyText(await chapterAsText());
    toast(`Capitolo ${state.chapter} copiato`);
  });
  $('copyGospel').addEventListener('click', async () => {
    await copyText(gospelAsText());
    toast('Vangelo copiato');
  });

  // Vangelo + Valtorta in un solo testo, da mandare a ElevenReader o altre app di lettura
  $('shareBoth').addEventListener('click', async () => {
    const text = await bothAsText();
    if (NATIVE) {
      NATIVE.share($('gospelRef').textContent, text);
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: $('gospelRef').textContent, text });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;   // condivisione annullata dall'utente
      }
    }
    await copyText(text);
    toast('Vangelo e Valtorta copiati: incollali nell\'app di lettura');
  });

  if (NATIVE || navigator.share) {
    $('shareChapter').hidden = false;
    $('shareChapter').addEventListener('click', async () => {
      if (!state.chapter) return;
      const info = state.byNum.get(state.chapter);
      if (NATIVE) {
        NATIVE.share(`${state.chapter}. ${info.title}`, await chapterAsText());
        return;
      }
      try {
        await navigator.share({ title: `${state.chapter}. ${info.title}`, text: await chapterAsText() });
      } catch (e) { /* condivisione annullata */ }
    });
  }

  $('noNotes').checked = load('togliNote', true);
  $('noNotes').addEventListener('change', (e) => {
    store('togliNote', e.target.checked);
    if (state.chapter) openChapter(state.chapter, { remember: false });
  });

  $('withTitle').checked = load('includiTitolo', true);
  $('withTitle').addEventListener('change', (e) => store('includiTitolo', e.target.checked));

  for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => switchTab(t.dataset.pane));
  $('toValtorta').addEventListener('click', () => { switchTab('valtortaPane'); $('valtortaPane').scrollIntoView({ block: 'start' }); });

  window.addEventListener('hashchange', () => {
    if (ignoreHash) return;
    const k = keyFrom(location.hash);   // link con la chiave aperto ad app già aperta
    if (k) {
      history.replaceState(null, '', location.pathname + location.search);
      unlock(k);
      return;
    }
    route();
  });
  // a mezzanotte (o al ritorno sull'app il giorno dopo) aggiorna limiti e "oggi"
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && $('dateInput').min !== ymd(addDays(today(), -MAX_DAYS))) {
      setDateBounds();
      if (!location.hash) showDate(today(), { pushHash: false });
    }
  });
}

function offerResume() {
  const last = load('ultimoCapitolo', null);
  if (!last || !state.byNum.has(last)) return;
  const info = state.byNum.get(last);
  const box = $('resume');
  box.innerHTML = `Ultimo capitolo letto: <button type="button">${last}. ${esc(info.title)}</button> — <button type="button" data-next>continua dal ${last + 1}</button>`;
  const [btnLast, btnNext] = box.querySelectorAll('button');
  btnLast.addEventListener('click', () => { openChapter(last, { scroll: true }); switchTab('valtortaPane'); });
  btnNext.addEventListener('click', () => { openChapter(last + 1, { scroll: true }); switchTab('valtortaPane'); });
  box.hidden = false;
}

async function main() {
  setFont(load('fontSize', 19));
  setDateBounds();
  switchTab('gospelPane');
  bind();
  bindTts();
  // la chiave nel link viene salvata e tolta dall'indirizzo visibile
  const fromLink = keyFrom(location.hash);
  if (fromLink) {
    const h = location.hash.replace(/(^#|&)k=[A-Za-z0-9-]+/, '$1').replace(/^#&/, '#').replace(/^#$/, '');
    history.replaceState(null, '', location.pathname + location.search + h);
  }
  const passphrase = fromLink || load('chiave', null);
  try {
    await loadIndex(passphrase);
    if (passphrase) store('chiave', passphrase);
    offerResume();
  } catch (e) {
    if (e instanceof LockedError) {
      showLocked(passphrase
        ? 'La chiave salvata non è più valida: incolla qui il nuovo link che hai ricevuto.'
        : 'Per leggere L\'Evangelo come mi è stato rivelato apri il link con la chiave che hai ricevuto, oppure incollalo qui.');
    } else {
      renderParas($('chapterText'), [], 'Impossibile caricare l\'indice dei capitoli. Controlla la connessione.');
    }
  }
  route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !NATIVE) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

main();
