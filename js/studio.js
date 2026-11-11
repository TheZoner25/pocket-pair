/* Pocket Pair Studio: 32x32 pixel drawing board, device preview, send, local library. */
(function () {
  'use strict';
  const W = 32, H = 32, CELL = 10, LIBKEY = 'pp-library';
  // 16 colours picked from the device art, so drawings sit well on the pixel screen
  const PAL = ['#1b1626', '#f4eefa', '#ff6f91', '#ffb3c4', '#d23b3b', '#ff9a4d', '#ffd36b', '#f0c9a6',
               '#8a5a3c', '#5aa36b', '#4fe0d2', '#9fd0ff', '#3c79d6', '#7d5ab8', '#8a83a0', '#3a2f48'];
  let px = new Array(W * H).fill(-1), color = 2, tool = 'pen', mirror = false, undo = [], drawing = false, last = null;
  let board, bctx, prev, pctx, msg;

  const $ = s => document.querySelector(s);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(LIBKEY) || '[]'); } catch (e) { return []; } },
    set(v) { try { localStorage.setItem(LIBKEY, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  function toArt() { return { w: W, h: H, p: PAL.slice(), d: px.map(i => (i < 0 ? '.' : i.toString(36))).join('') }; }
  function fromArt(a) { const out = new Array(W * H).fill(-1); if (!a || !a.d) return out; for (let i = 0; i < Math.min(a.d.length, W * H); i++) { const c = a.d[i]; out[i] = c === '.' ? -1 : parseInt(c, 36); } return out; }
  const blank = () => px.every(v => v < 0);

  function render() {
    bctx.fillStyle = '#0f0b14'; bctx.fillRect(0, 0, W * CELL, H * CELL);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = px[y * W + x];
      if (i >= 0) { bctx.fillStyle = PAL[i]; bctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
      else if ((x + y) & 1) { bctx.fillStyle = '#16111d'; bctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
    }
    bctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 1; i < W; i++) { bctx.fillRect(i * CELL, 0, 1, H * CELL); bctx.fillRect(0, i * CELL, W * CELL, 1); }
    if (mirror) { bctx.fillStyle = 'rgba(216,178,92,.55)'; bctx.fillRect(W * CELL / 2 - 1, 0, 2, H * CELL); }
    renderPreview();
  }
  // draw the art the way the partner's device will show it (engine's artView)
  function renderPreview() {
    if (typeof artView !== 'function') return;
    const keep = g; g = pctx;
    g.fillStyle = '#000'; g.fillRect(0, 0, 160, 128);
    hud(DEV[NET.partner || 'her']); artView({ art: toArt(), from: NET.me || 'rocky', at: clockStr }, 99); ticker(DEV[NET.partner || 'her']);
    g = keep;
  }

  function cellAt(e) {
    const r = board.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / r.width * W), y: Math.floor((e.clientY - r.top) / r.height * H) };
  }
  function put(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const v = tool === 'eraser' ? -1 : color;
    px[y * W + x] = v; if (mirror) px[y * W + (W - 1 - x)] = v;
  }
  function line(a, b) { // Bresenham, so fast strokes leave no gaps
    let x0 = a.x, y0 = a.y; const dx = Math.abs(b.x - x0), dy = -Math.abs(b.y - y0), sx = x0 < b.x ? 1 : -1, sy = y0 < b.y ? 1 : -1; let err = dx + dy;
    for (;;) { put(x0, y0); if (x0 === b.x && y0 === b.y) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function fill(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const from = px[y * W + x], to = color; if (from === to) return;
    const st = [[x, y]];
    while (st.length) { const [cx, cy] = st.pop(); if (cx < 0 || cy < 0 || cx >= W || cy >= H || px[cy * W + cx] !== from) continue; px[cy * W + cx] = to; st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]); }
  }
  function snapshot() { undo.push(px.slice()); if (undo.length > 40) undo.shift(); }

  function onDown(e) {
    e.preventDefault(); board.setPointerCapture(e.pointerId); snapshot();
    const c = cellAt(e);
    if (tool === 'fill') { fill(c.x, c.y); if (mirror) fill(W - 1 - c.x, c.y); render(); return; }
    drawing = true; last = c; put(c.x, c.y); render();
  }
  function onMove(e) { if (!drawing) return; const c = cellAt(e); if (last && (c.x !== last.x || c.y !== last.y)) { line(last, c); last = c; render(); } }
  function onUp() { drawing = false; last = null; }

  function say(s, ok) { msg.textContent = s; msg.classList.toggle('ok', !!ok); }

  function renderLib() {
    const lib = store.get(), box = $('#lib'); box.innerHTML = '';
    if (!lib.length) { const p = document.createElement('p'); p.className = 'small'; p.textContent = 'Nothing saved yet.'; box.appendChild(p); return; }
    lib.forEach((it, idx) => {
      const wrap = document.createElement('div'); wrap.className = 'item';
      const b = document.createElement('button'); b.className = 'open'; b.setAttribute('aria-label', 'Open drawing ' + (idx + 1));
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      const d = fromArt(it.art); d.forEach((v, i) => { if (v >= 0) { x.fillStyle = PAL[v]; x.fillRect(i % W, (i / W) | 0, 1, 1); } });
      b.appendChild(c); b.addEventListener('click', () => { snapshot(); px = fromArt(it.art); render(); say('Opened from the library.', true); });
      const del = document.createElement('button'); del.className = 'del'; del.textContent = '×'; del.setAttribute('aria-label', 'Delete drawing ' + (idx + 1));
      del.addEventListener('click', () => { const l = store.get(); l.splice(idx, 1); store.set(l); renderLib(); });
      wrap.append(b, del); box.appendChild(wrap);
    });
  }

  window.STUDIO = {
    init() {
      board = $('#st-canvas'); bctx = board.getContext('2d'); prev = $('#st-preview'); pctx = prev.getContext('2d'); msg = $('#st-msg');
      const pal = $('#st-pal');
      PAL.forEach((c, i) => {
        const b = document.createElement('button'); b.className = 'sw-col'; b.style.background = c; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', 'Colour ' + (i + 1)); b.setAttribute('aria-checked', String(i === color));
        b.addEventListener('click', () => { color = i; if (tool === 'eraser') setTool('pen'); pal.querySelectorAll('.sw-col').forEach((x, j) => x.setAttribute('aria-checked', String(j === i))); });
        pal.appendChild(b);
      });
      const setTool = t => { tool = t; document.querySelectorAll('.tool[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t))); };
      document.querySelectorAll('.tool[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
      $('#t-mirror').addEventListener('click', e => { mirror = !mirror; e.currentTarget.setAttribute('aria-pressed', String(mirror)); render(); });
      $('#t-undo').addEventListener('click', () => { if (undo.length) { px = undo.pop(); render(); } });
      $('#t-clear').addEventListener('click', () => { if (blank()) return; snapshot(); px.fill(-1); render(); say('Cleared. Undo brings it back.'); });
      board.addEventListener('pointerdown', onDown); board.addEventListener('pointermove', onMove);
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => board.addEventListener(ev, onUp));
      $('#st-save').addEventListener('click', () => {
        if (blank()) { say('Draw something first.'); return; }
        const l = store.get(); l.unshift({ art: toArt(), at: Date.now() }); if (l.length > 40) l.length = 40;
        say(store.set(l) ? 'Saved to the library.' : 'This browser would not save it.', true); renderLib();
      });
      $('#st-send').addEventListener('click', async e => {
        if (blank()) { say('Draw something first.'); return; }
        const b = e.currentTarget; b.disabled = true; say('Sending…', true);
        const ok = await NET.art(toArt()); b.disabled = false;
        say(ok ? 'Sent. It is waiting in ' + nameOf(NET.partner).toLowerCase().replace(/^./, c => c.toUpperCase()) + '’s inbox.' : 'Not sent. Check the connection and try again.', ok);
      });
      // a little starter drawing so the board isn't empty the first time
      if (!store.get().length) { const h = ['.22..22.', '22222222', '22222222', '.222222.', '..2222..', '...22...']; h.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '2') px[(13 + y) * W + 12 + x] = 2; })); }
      render(); renderLib();
    },
    refresh() { renderPreview(); }
  };
})();
