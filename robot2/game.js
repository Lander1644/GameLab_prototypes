/* Interfaz de "Programa al robot" (bloques estilo Scratch): arrastrar y soltar, animación y niveles.
 * Reglas en logic.js, mapas en levels.js. */
(() => {
  'use strict';
  const Logic = window.Robot2Logic;
  const LEVELS = window.ROBOT2_LEVELS;
  const $ = (id) => document.getElementById(id);
  const cv = $('board'), g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const STORE = 'gamelab.robot2.stars';

  const PALETTE = ['F', 'L', 'R', 'X', 'FOR', 'WHILE'];
  const LABEL = { F: '↑ Avanzar', L: '↰ Girar izq.', R: '↱ Girar der.', X: '💥 Romper' };

  let stars = loadStars();
  let li = 0, level, L;
  let program = [], nextId = 1;
  let busy = false, runId = 0, fast = false;
  let rb = { x: 0, y: 0, ang: 0 };
  let collected = new Set(), broken = new Set(), particles = [], lastFrame = 0;
  let drag = null;

  /* ---------- Progreso (si el navegador lo permite) ---------- */

  function loadStars() {
    try { const a = JSON.parse(localStorage.getItem(STORE)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function saveStars() { try { localStorage.setItem(STORE, JSON.stringify(stars)); } catch (e) { /* sin almacenamiento: no pasa nada */ } }

  /* ---------- Niveles ---------- */

  function loadLevel(i) {
    li = i; level = LEVELS[i]; L = Logic.parseLevel(level);
    program = [];
    $('lvlName').textContent = 'Nivel ' + (i + 1) + ': ' + level.name;
    $('lvlHint').textContent = level.hint;
    $('winOverlay').classList.add('hidden');
    buildPalette();
    resetRobot();
    render();
    renderChips();
  }

  function renderChips() {
    const nav = $('chips'); nav.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      b.className = 'chip' + (i === li ? ' active' : '');
      b.innerHTML = '<b>' + (i + 1) + '</b><i>' + (stars[i] ? '★'.repeat(stars[i]) : '·') + '</i>';
      b.title = lv.name;
      b.addEventListener('click', () => loadLevel(i));
      nav.append(b);
    });
  }

  function say(text, kind) { const s = $('status'); s.textContent = text || ''; s.className = kind || ''; }

  /* ---------- Modelo del programa ---------- */

  function newNode(t) {
    const n = { id: nextId++, t: t };
    if (t === 'FOR') { n.n = 3; n.body = []; }
    if (t === 'WHILE') { n.cond = 'free'; n.body = []; }
    return n;
  }

  function find(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return { arr: nodes, node: n };
      if (n.body) { const r = find(n.body, id); if (r) return r; }
    }
    return null;
  }

  function arrOf(slotEl) {
    if (slotEl.dataset.slot === 'root') return program;
    const r = find(program, +slotEl.dataset.slot);
    return r ? r.node.body : null;
  }

  function slotDepth(slotEl) {                  // cuántos bucles rodean a este hueco
    let d = 0;
    for (let el = slotEl.parentElement; el; el = el.parentElement) if (el.classList && el.classList.contains('c')) d++;
    return d;
  }

  /* ---------- Dibujo de bloques (DOM) ---------- */

  function text(s) { const e = document.createElement('span'); e.textContent = s; return e; }

  function blockEl(n, preview) {
    const el = document.createElement('div');
    el.className = 'block ' + n.t + (n.body ? ' c' : ' simple');
    el.dataset.id = n.id;
    if (!n.body) { el.append(text(LABEL[n.t])); return el; }

    const head = document.createElement('div'); head.className = 'chead';
    if (n.t === 'FOR') {
      const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Número de repeticiones');
      for (let k = Logic.FOR_MIN; k <= Logic.FOR_MAX; k++) sel.add(new Option(k, k, false, k === n.n));
      sel.addEventListener('change', () => { n.n = +sel.value; edited(); });
      head.append(text('⟳ repetir'), sel, text('veces'));
    } else {
      const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Condición');
      for (const k of Object.keys(Logic.CONDS)) sel.add(new Option(Logic.CONDS[k], k, false, k === n.cond));
      sel.addEventListener('change', () => { n.cond = sel.value; edited(); });
      head.append(text('↻ mientras'), sel);
    }
    const slot = document.createElement('div'); slot.className = 'slot'; slot.dataset.slot = n.id;
    if (!preview) for (const c of n.body) slot.append(blockEl(c));
    const foot = document.createElement('div'); foot.className = 'cfoot';
    el.append(head, slot, foot);
    return el;
  }

  function render() {
    const root = $('root'); root.innerHTML = '';
    for (const n of program) root.append(blockEl(n));
    const used = Logic.countBlocks(program);
    $('count').textContent = 'Bloques usados: ' + used + ' / ' + level.max;
    $('count').className = used >= level.max ? 'full' : '';
  }

  function buildPalette() {
    const pal = $('palette'); pal.innerHTML = '';
    for (const t of PALETTE) {
      if (!level.allow.includes(t)) continue;
      const wrap = document.createElement('div'); wrap.className = 'pblock'; wrap.dataset.type = t;
      wrap.append(blockEl(newNode(t), true));
      pal.append(wrap);
    }
  }

  function edited() { resetRobot(); render(); }

  /* ---------- Arrastrar y soltar ---------- */

  function dropTarget(x, y) {
    const wr = $('programWrap').getBoundingClientRect();
    if (x < wr.left || x > wr.right || y < wr.top || y > wr.bottom) return null;
    const root = $('root');
    let best = root;
    for (const s of root.querySelectorAll('.slot')) {          // el último que contiene el punto es el más interno
      const r = s.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) best = s;
    }
    const kids = [...best.children].filter((c) => c.classList.contains('block'));
    let idx = kids.length;
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { idx = i; break; }
    }
    return { slotEl: best, idx: idx, kids: kids };
  }

  function indicator(t) {
    let el = document.getElementById('dropInd');
    if (!t) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'dropInd'; el.className = 'drop-ind'; document.body.append(el); }
    const sr = t.slotEl.getBoundingClientRect();
    let y;
    if (!t.kids.length) y = sr.top + 6;
    else if (t.idx < t.kids.length) y = t.kids[t.idx].getBoundingClientRect().top - 3;
    else y = t.kids[t.kids.length - 1].getBoundingClientRect().bottom + 2;
    el.style.left = (sr.left + 4) + 'px'; el.style.width = Math.max(40, sr.width - 8) + 'px'; el.style.top = y + 'px';
  }

  function insertNode(node, t, fromProgram) {
    const arr = t ? arrOf(t.slotEl) : null;
    const needDepth = t ? slotDepth(t.slotEl) + Logic.nodeDepth(node) : 0;
    const total = Logic.countBlocks(program) + Logic.countBlocks([node]);
    if (!arr || needDepth > Logic.MAX_DEPTH || total > level.max) {
      if (fromProgram) program.push(node);                       // no se pierde el bloque: vuelve al final
      if (total > level.max) say('¡Ya usaste todos los bloques de este nivel! Quita alguno o usa un bucle.', 'warn');
      else if (needDepth > Logic.MAX_DEPTH) say('Solo se pueden anidar ' + Logic.MAX_DEPTH + ' bucles.', 'warn');
      return false;
    }
    arr.splice(Math.min(t.idx, arr.length), 0, node);
    return true;
  }

  document.addEventListener('pointerdown', (e) => {
    if (busy) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('select, button, a, input')) return;
    let node, fromProgram = false, src;
    const pal = e.target.closest('.pblock');
    if (pal) { node = newNode(pal.dataset.type); src = pal; }
    else {
      const blk = e.target.closest('#root .block');
      if (!blk) return;
      const slot = e.target.closest('.slot');
      if (slot && blk.contains(slot)) return;                    // clic en el hueco de un bucle, no en su cabecera
      const r = find(program, +blk.dataset.id);
      if (!r) return;
      node = r.node; fromProgram = true; src = blk;
    }
    e.preventDefault();
    const rect = src.getBoundingClientRect();
    drag = { node: node, fromProgram: fromProgram, sx: e.clientX, sy: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, w: rect.width, started: false, ghost: null };
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      drag.started = true;
      if (drag.fromProgram) {
        const r = find(program, drag.node.id);
        r.arr.splice(r.arr.indexOf(drag.node), 1);
        resetRobot(); render();
        $('palette').classList.add('trash');
      }
      const gh = blockEl(drag.node, false); gh.classList.add('ghost');
      gh.style.width = drag.w + 'px';
      document.body.append(gh); drag.ghost = gh;
    }
    drag.ghost.style.left = (e.clientX - drag.offX) + 'px';
    drag.ghost.style.top = (e.clientY - drag.offY) + 'px';
    indicator(dropTarget(e.clientX, e.clientY));
  });

  function endDrag(e, cancelled) {
    if (!drag) return;
    const d = drag; drag = null;
    indicator(null); $('palette').classList.remove('trash');
    if (!d.started) {                                            // clic sin arrastrar en la paleta: añade al final
      if (!d.fromProgram && !cancelled) {
        insertNode(d.node, { slotEl: $('root'), idx: program.length }, false) && edited();
      }
      return;
    }
    d.ghost.remove();
    const t = cancelled ? null : dropTarget(e.clientX, e.clientY);
    if (t) insertNode(d.node, t, d.fromProgram);
    else if (d.fromProgram) say('Bloque eliminado.');
    edited();
  }
  window.addEventListener('pointerup', (e) => endDrag(e, false));
  window.addEventListener('pointercancel', (e) => endDrag(e, true));

  $('root').addEventListener('dblclick', (e) => {
    if (busy || e.target.closest('select')) return;
    const blk = e.target.closest('.block'); if (!blk) return;
    const slot = e.target.closest('.slot'); if (slot && blk.contains(slot)) return;
    const r = find(program, +blk.dataset.id); if (!r) return;
    r.arr.splice(r.arr.indexOf(r.node), 1); edited();
  });

  $('clear').addEventListener('click', () => { if (busy) return; program = []; edited(); });
  $('reset').addEventListener('click', () => resetRobot());
  $('run').addEventListener('click', execute);
  $('speed').addEventListener('click', () => { fast = !fast; $('speed').textContent = 'Velocidad: ' + (fast ? 'rápida' : 'normal'); });

  /* ---------- Ejecución animada ---------- */

  function resetRobot() {
    runId++; busy = false;
    rb = { x: L.start.x, y: L.start.y, ang: L.start.dir * Math.PI / 2 };
    collected = new Set(); broken = new Set(); particles = [];
    document.querySelectorAll('.running, .err, .flash-yes, .flash-no').forEach((b) => b.classList.remove('running', 'err', 'flash-yes', 'flash-no'));
    say('');
    $('run').disabled = false;
  }

  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

  function tween(ms, fn) {
    const mine = runId;
    return new Promise((res) => {
      const t0 = performance.now();
      (function f(now) {
        const k = Math.min(1, (now - t0) / ms);
        if (mine === runId) fn(k);
        if (k < 1 && mine === runId) requestAnimationFrame(f); else res();
      })(t0);
    });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function elOf(node) {                          // lo que se resalta: el bloque o la cabecera del bucle
    const b = document.querySelector('#root .block[data-id="' + node.id + '"]');
    if (!b) return null;
    return node.body ? b.querySelector(':scope > .chead') : b;
  }
  function mark(node) {
    document.querySelectorAll('.running').forEach((b) => b.classList.remove('running'));
    const el = elOf(node);
    if (el) { el.classList.add('running'); el.scrollIntoView({ block: 'nearest' }); }
  }

  function burst(cx, cy, color, n) {            // chispas en coordenadas de celda
    const { c, ox, oy } = layout();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 180;
      particles.push({ x: ox + (cx + 0.5) * c, y: oy + (cy + 0.5) * c, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 70, life: 1, color: color, r: 3 + Math.random() * 4 });
    }
  }

  const dirOf = () => Math.round(((rb.ang / (Math.PI / 2)) % 4 + 4) % 4);

  async function execute() {
    if (busy) return;
    if (!program.length) { say('Arrastra al menos un bloque al programa.', 'warn'); return; }
    resetRobot();
    const mine = runId; busy = true; $('run').disabled = true;
    const res = Logic.run(level, program);
    const sp = fast ? 0.35 : 1;
    const trace = res.status === 'loop' ? res.trace.slice(0, 40) : res.trace;   // un bucle infinito no se anima entero

    for (const st of trace) {
      if (mine !== runId) return;
      mark(st.node);
      const x0 = rb.x, y0 = rb.y, d = dirOf();
      if (st.ev === 'turn') {
        const a0 = rb.ang, a1 = a0 + (st.node.t === 'R' ? 1 : -1) * Math.PI / 2;
        await tween(380 * sp, (k) => { rb.ang = a0 + (a1 - a0) * ease(k); });
      } else if (st.ev === 'iter') {
        await sleep(110 * sp);
      } else if (st.ev === 'check') {
        const el = elOf(st.node); if (el) el.classList.add(st.value ? 'flash-yes' : 'flash-no');
        await sleep(300 * sp);
        if (el) el.classList.remove('flash-yes', 'flash-no');
      } else if (st.ev === 'swing' || st.ev === 'break') {
        let done = false;
        await tween(520 * sp, (k) => {
          const o = Math.sin(k * Math.PI) * 0.22;
          rb.x = x0 + Logic.DX[d] * o; rb.y = y0 + Logic.DY[d] * o;
          if (st.ev === 'break' && !done && k > 0.5) { done = true; broken.add(st.bx + ',' + st.by); burst(st.bx, st.by, '#b57a3d', 22); }
        });
        rb.x = x0; rb.y = y0;
      } else if (st.ev === 'crash') {
        await tween(260 * sp, (k) => { rb.x = x0 + Logic.DX[d] * 0.35 * ease(k); rb.y = y0 + Logic.DY[d] * 0.35 * ease(k); });
        burst(x0 + Logic.DX[d] * 0.6, y0 + Logic.DY[d] * 0.6, st.node.t === 'X' ? '#9fb0ea' : '#ff4d6d', 16);
        await tween(260 * sp, (k) => { rb.x = x0 + Logic.DX[d] * 0.35 * (1 - ease(k)); rb.y = y0 + Logic.DY[d] * 0.35 * (1 - ease(k)); });
        document.querySelectorAll('.running').forEach((b) => b.classList.remove('running'));
        const el = elOf(st.node); if (el) el.classList.add('err');
      } else {                                                  // move | battery | goal
        await tween(430 * sp, (k) => { rb.x = x0 + (st.x - x0) * ease(k); rb.y = y0 + (st.y - y0) * ease(k); });
        if (st.ev === 'battery') { collected.add(st.x + ',' + st.y); burst(st.x, st.y, '#ffc13d', 16); }
      }
    }
    if (mine !== runId) return;
    busy = false; $('run').disabled = false;
    document.querySelectorAll('.running').forEach((b) => b.classList.remove('running'));

    if (res.status === 'win') win();
    else if (res.status === 'crash') {
      const msg = {
        wall: '¡El robot chocó con un muro de acero! Esos muros no se pueden romper: busca otro camino.',
        rock: '¡El robot chocó con una roca! Usa «Romper» antes de avanzar.',
        steel: '¡Ese muro es de acero y no se puede romper! Rodéalo o busca otro camino.',
      };
      say(msg[res.reason], 'bad');
    }
    else if (res.status === 'loop') say('Tu programa nunca termina: revisa la condición del «mientras» (¡el robot se quedó repitiendo!).', 'bad');
    else if (res.status === 'missing') say('Llegaste a la meta, pero faltan ' + res.left + ' batería(s) ⚡. Pasa por todas antes de llegar.', 'warn');
    else say('El programa terminó y el robot no llegó a la meta. Añade o cambia bloques.', 'warn');
  }

  function win() {
    const used = Logic.countBlocks(program);
    const par = Logic.countBlocks(Logic.parseProgram(level.solution));
    const n = Logic.starsFor(used, par);
    stars[li] = Math.max(stars[li] || 0, n); saveStars(); renderChips();
    say('¡Lo lograste!', 'ok');
    for (let i = 0; i < 90; i++) {
      particles.push({ x: W / 2, y: H / 2, vx: (Math.random() - 0.5) * 700, vy: -Math.random() * 600, life: 1.4,
        color: ['#38e1ff', '#3dff9a', '#ffc13d', '#ff4d6d', '#a855f7'][i % 5], r: 4 + Math.random() * 4 });
    }
    $('winStars').innerHTML = '★'.repeat(n) + '<span class="off">' + '★'.repeat(3 - n) + '</span>';
    $('winBlocks').textContent = 'Usaste ' + used + ' bloques' + (n < 3
      ? '. La solución de referencia usa ' + par + '. ¿Te animas a intentarlo con menos?'
      : used < par ? ': ¡mejor que la solución de referencia (' + par + ')!' : ': ¡igual que la solución de referencia!');
    const last = li === LEVELS.length - 1;
    $('winLearn').textContent = '💡 ' + level.learn + (last ? ' ¡Completaste todos los niveles!' : '');
    $('next').style.display = last ? 'none' : '';
    setTimeout(() => { if (!busy) $('winOverlay').classList.remove('hidden'); }, 1300);
  }
  $('next').addEventListener('click', () => loadLevel(Math.min(li + 1, LEVELS.length - 1)));
  $('replay').addEventListener('click', () => loadLevel(li));

  /* ---------- Dibujo del tablero ---------- */

  function layout() {
    const c = Math.min(Math.floor((W - 40) / L.w), Math.floor((H - 40) / L.h), 120);
    return { c: c, ox: Math.round((W - c * L.w) / 2), oy: Math.round((H - c * L.h) / 2) };
  }

  function rr(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function drawSteel(px, py, c) {
    g.fillStyle = '#0b1030'; g.fillRect(px, py, c, c);
    g.fillStyle = '#2d3a6b'; rr(px + 3, py + 3, c - 6, c - 6, 6); g.fill();
    g.fillStyle = '#3d4d86'; rr(px + 3, py + 3, c - 6, (c - 6) * 0.45, 6); g.fill();
    g.strokeStyle = '#6f7fb8'; g.lineWidth = 2; rr(px + 3, py + 3, c - 6, c - 6, 6); g.stroke();
    g.fillStyle = '#9aa8d8';
    for (const [dx, dy] of [[0.18, 0.18], [0.82, 0.18], [0.18, 0.82], [0.82, 0.82]]) { g.beginPath(); g.arc(px + dx * c, py + dy * c, c * 0.035, 0, 7); g.fill(); }
  }

  function drawRock(px, py, c, seed) {
    const cx = px + c / 2, cy = py + c / 2;
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, r = c * (0.33 + 0.07 * Math.sin(seed * 3.1 + i * 2.3));
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9]);
    }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, cy + c * 0.3, c * 0.34, c * 0.1, 0, 0, 7); g.fill();
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    g.fillStyle = '#9a6430'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#5f3c19'; g.stroke();
    g.fillStyle = '#b57a3d'; g.beginPath(); g.ellipse(cx - c * 0.07, cy - c * 0.1, c * 0.17, c * 0.1, -0.4, 0, 7); g.fill();
    g.strokeStyle = '#4a2d12'; g.lineWidth = 2; g.beginPath();
    g.moveTo(cx + c * 0.02, cy - c * 0.12); g.lineTo(cx + c * 0.08, cy + c * 0.02); g.lineTo(cx - c * 0.02, cy + c * 0.12); g.stroke();
  }

  function drawRobot(px, py, c) {
    g.save(); g.translate(px, py); g.rotate(rb.ang);
    g.fillStyle = '#2a3869'; rr(-0.40 * c, -0.30 * c, 0.12 * c, 0.60 * c, 0.04 * c); g.fill(); rr(0.28 * c, -0.30 * c, 0.12 * c, 0.60 * c, 0.04 * c); g.fill();
    g.fillStyle = '#38e1ff'; rr(-0.30 * c, -0.30 * c, 0.60 * c, 0.60 * c, 0.10 * c); g.fill();
    g.fillStyle = '#1aa7c7'; rr(-0.30 * c, 0.08 * c, 0.60 * c, 0.22 * c, 0.08 * c); g.fill();
    g.fillStyle = '#0a1128'; rr(-0.21 * c, -0.24 * c, 0.42 * c, 0.24 * c, 0.06 * c); g.fill();
    g.fillStyle = '#3dff9a';
    g.beginPath(); g.arc(-0.08 * c, -0.12 * c, 0.045 * c, 0, 7); g.arc(0.08 * c, -0.12 * c, 0.045 * c, 0, 7); g.fill();
    g.fillStyle = '#ff6680';                                     // martillo frontal (para romper)
    g.fillRect(-0.04 * c, -0.46 * c, 0.08 * c, 0.16 * c); rr(-0.14 * c, -0.52 * c, 0.28 * c, 0.1 * c, 0.03 * c); g.fill();
    g.strokeStyle = '#e8ecff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0.3 * c); g.lineTo(0, 0.38 * c); g.stroke();
    g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(0, 0.4 * c, 0.035 * c, 0, 7); g.fill();
    g.restore();
  }

  function draw(time, dt) {
    const { c, ox, oy } = layout();
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0d142b'; g.fillRect(0, 0, W, H);

    for (let y = 0; y < L.h; y++) {
      for (let x = 0; x < L.w; x++) {
        const px = ox + x * c, py = oy + y * c;
        if (L.cells[y][x] === 'wall') { drawSteel(px, py, c); continue; }
        g.fillStyle = '#16204a'; g.fillRect(px, py, c, c);
        g.strokeStyle = '#222f64'; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, c - 2, c - 2);
        if (L.cells[y][x] === 'rock' && !broken.has(x + ',' + y)) drawRock(px, py, c, x * 7 + y * 13);
      }
    }

    const gx = ox + (L.goal.x + 0.5) * c, gy = oy + (L.goal.y + 0.5) * c;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    g.fillStyle = 'rgba(61,255,154,.16)'; g.fillRect(ox + L.goal.x * c + 2, oy + L.goal.y * c + 2, c - 4, c - 4);
    g.strokeStyle = '#3dff9a'; g.lineWidth = 4; g.beginPath(); g.arc(gx, gy, c * (0.34 + 0.04 * pulse), 0, 7); g.stroke();
    g.fillStyle = '#3dff9a'; g.fillRect(gx - 0.03 * c, gy - 0.22 * c, 0.05 * c, 0.44 * c);
    g.beginPath(); g.moveTo(gx + 0.02 * c, gy - 0.22 * c); g.lineTo(gx + 0.24 * c, gy - 0.12 * c); g.lineTo(gx + 0.02 * c, gy - 0.02 * c); g.fill();

    for (const b of L.batteries) {
      if (collected.has(b.x + ',' + b.y)) continue;
      const bx = ox + (b.x + 0.5) * c, by = oy + (b.y + 0.5) * c + Math.sin(time * 3 + b.x) * c * 0.03;
      g.fillStyle = 'rgba(255,193,61,.18)'; g.beginPath(); g.arc(bx, by, c * 0.34, 0, 7); g.fill();
      g.fillStyle = '#ffc13d'; rr(bx - 0.14 * c, by - 0.2 * c, 0.28 * c, 0.4 * c, 0.05 * c); g.fill();
      g.fillRect(bx - 0.06 * c, by - 0.27 * c, 0.12 * c, 0.07 * c);
      g.fillStyle = '#3b2a00'; g.beginPath();
      g.moveTo(bx + 0.03 * c, by - 0.13 * c); g.lineTo(bx - 0.07 * c, by + 0.02 * c); g.lineTo(bx, by + 0.02 * c);
      g.lineTo(bx - 0.03 * c, by + 0.14 * c); g.lineTo(bx + 0.07 * c, by - 0.03 * c); g.lineTo(bx, by - 0.03 * c); g.closePath(); g.fill();
    }

    drawRobot(ox + (rb.x + 0.5) * c, oy + (rb.y + 0.5) * c, c);

    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt * 1.2;
      g.globalAlpha = Math.max(0, Math.min(1, p.life)); g.fillStyle = p.color;
      g.fillRect(p.x, p.y, p.r, p.r);
    }
    g.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0); lastFrame = now;
    draw(now / 1000, dt);
    requestAnimationFrame(frame);
  }

  /* ---------- Teclado ---------- */

  document.addEventListener('keydown', (e) => {
    if (!$('winOverlay').classList.contains('hidden')) return;
    if (e.target.closest && e.target.closest('select')) return;
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { execute(); e.preventDefault(); }
    else if (e.key === 'Escape') resetRobot();
    else if (e.key === 'Backspace') { if (!busy && program.length) { program.pop(); edited(); } e.preventDefault(); }
  });

  loadLevel(0);
  requestAnimationFrame(frame);
})();
