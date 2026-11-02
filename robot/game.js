/* Interfaz de "Programa al robot": armado del programa con bloques, animación y niveles.
 * Las reglas del juego están en logic.js y los mapas en levels.js. */
(() => {
  'use strict';
  const Logic = window.RobotLogic;
  const LEVELS = window.ROBOT_LEVELS;
  const $ = (id) => document.getElementById(id);
  const cv = $('board'), g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const STORE = 'gamelab.robot.stars';
  const LABEL = { F: '↑ Avanzar', L: '↰ Girar izq.', R: '↱ Girar der.' };

  let stars = loadStars();
  let li = 0, level, L;
  let program = [], target = program, nextId = 1;
  let busy = false, runId = 0, fast = false;
  let rb = { x: 0, y: 0, ang: 0, dx: 0, dy: 0 };
  let collected = new Set(), particles = [], lastFrame = 0;

  /* ---------- Progreso guardado (si el navegador lo permite) ---------- */

  function loadStars() {
    try { const a = JSON.parse(localStorage.getItem(STORE)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function saveStars() { try { localStorage.setItem(STORE, JSON.stringify(stars)); } catch (e) { /* sin almacenamiento: no pasa nada */ } }

  /* ---------- Niveles ---------- */

  function loadLevel(i) {
    li = i; level = LEVELS[i]; L = Logic.parseLevel(level);
    program = []; target = program;
    $('lvlName').textContent = 'Nivel ' + (i + 1) + ': ' + level.name;
    $('lvlHint').textContent = level.hint;
    $('winOverlay').classList.add('hidden');
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

  /* ---------- Edición del programa ---------- */

  function find(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return { arr: nodes, node: n };
      if (n.t === 'REP') { const r = find(n.body, id); if (r) return r; }
    }
    return null;
  }
  function depthOf(arr, cur, d) {         // cuántos "Repetir" hay alrededor de arr (-1 si ya no existe)
    cur = cur || program; d = d || 0;
    if (cur === arr) return d;
    for (const n of cur) if (n.t === 'REP') { const r = depthOf(arr, n.body, d + 1); if (r >= 0) return r; }
    return -1;
  }

  function edited() { resetRobot(); render(); }

  function add(t) {
    if (busy) return;
    if (Logic.countBlocks(program) >= level.max) { resetRobot(); say('¡Ya usaste todos los bloques de este nivel! Quita alguno o usa «Repetir».', 'warn'); return; }
    if (t === 'REP' && depthOf(target) >= Logic.MAX_DEPTH) { say('Solo se pueden meter ' + Logic.MAX_DEPTH + ' «Repetir» uno dentro de otro.', 'warn'); return; }
    const node = t === 'REP' ? { id: nextId++, t: t, n: 2, body: [] } : { id: nextId++, t: t };
    target.push(node);
    if (t === 'REP') target = node.body;
    edited();
  }

  function removeNode(id) {
    if (busy) return;
    const r = find(program, id); if (!r) return;
    r.arr.splice(r.arr.indexOf(r.node), 1);
    if (depthOf(target) < 0) target = program;
    edited();
  }

  function render() {
    const root = $('program'); root.innerHTML = '';
    if (!program.length) {
      const p = document.createElement('div'); p.className = 'empty';
      p.textContent = 'Tu programa está vacío. Toca los bloques de arriba para empezar.';
      root.append(p);
    } else root.append(buildList(program));
    $('mainHead').classList.toggle('target', target === program);
    const used = Logic.countBlocks(program);
    $('count').textContent = used + ' / ' + level.max + ' bloques';
    $('count').className = used >= level.max ? 'full' : '';
  }

  function buildList(nodes) {
    const list = document.createElement('div'); list.className = 'list';
    for (const n of nodes) {
      const el = document.createElement('div');
      el.className = 'block ' + n.t; el.dataset.id = n.id;
      if (n.t === 'REP') {
        el.innerHTML = '<div class="rephead"><span>⟳ Repetir</span><button class="n" title="Cambiar cuántas veces se repite">' + n.n +
          '×</button><button class="del" aria-label="Quitar bloque">✕</button></div>';
        const body = buildList(n.body); body.classList.add('body');
        if (!n.body.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'Añade instrucciones aquí dentro'; body.append(e); }
        el.append(body);
        if (target === n.body) el.classList.add('target');
      } else {
        el.innerHTML = '<span>' + LABEL[n.t] + '</span><button class="del" aria-label="Quitar bloque">✕</button>';
      }
      list.append(el);
    }
    return list;
  }

  $('program').addEventListener('click', (e) => {
    if (busy) return;
    const blk = e.target.closest('.block'); if (!blk) return;
    const id = +blk.dataset.id, r = find(program, id); if (!r) return;
    if (e.target.closest('.del')) { removeNode(id); return; }
    if (r.node.t === 'REP') {
      if (e.target.closest('.n')) {
        const o = Logic.REP_OPTIONS; r.node.n = o[(o.indexOf(r.node.n) + 1) % o.length];
      } else if (e.target.closest('.rephead')) {
        target = r.node.body;
      } else return;
      edited();
    }
  });
  $('mainHead').addEventListener('click', () => { if (!busy) { target = program; render(); } });
  document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => add(b.dataset.add)));
  $('clear').addEventListener('click', () => { if (busy) return; program = []; target = program; edited(); });
  $('reset').addEventListener('click', () => { resetRobot(); });
  $('run').addEventListener('click', execute);
  $('speed').addEventListener('click', () => { fast = !fast; $('speed').textContent = 'Velocidad: ' + (fast ? 'rápida' : 'normal'); });

  /* ---------- Ejecución animada ---------- */

  function resetRobot() {
    runId++; busy = false;
    rb = { x: L.start.x, y: L.start.y, ang: L.start.dir * Math.PI / 2, dx: 0, dy: 0 };
    collected = new Set(); particles = [];
    document.querySelectorAll('.block.active, .block.err').forEach((b) => b.classList.remove('active', 'err'));
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
        if (mine === runId) fn(ease(k));
        if (k < 1 && mine === runId) requestAnimationFrame(f); else res();
      })(t0);
    });
  }

  function mark(id, cls) {
    document.querySelectorAll('.block.active').forEach((b) => b.classList.remove('active'));
    const el = document.querySelector('.block[data-id="' + id + '"]');
    if (el) { el.classList.add(cls); el.scrollIntoView({ block: 'nearest' }); }
  }

  function sparkle(color, n) {
    const { c, ox, oy } = layout();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 160;
      particles.push({ x: ox + (rb.x + 0.5) * c, y: oy + (rb.y + 0.5) * c, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 1, color: color, r: 3 + Math.random() * 3 });
    }
  }

  async function execute() {
    if (busy) return;
    if (!program.length) { say('Añade al menos una instrucción al programa.', 'warn'); return; }
    resetRobot();
    const mine = runId; busy = true; $('run').disabled = true;
    const res = Logic.run(level, program);
    const sp = fast ? 0.35 : 1;

    for (const st of res.trace) {
      if (mine !== runId) return;
      mark(st.node.id, 'active');
      if (st.ev === 'turn') {
        const a0 = rb.ang, a1 = a0 + (st.node.t === 'R' ? 1 : -1) * Math.PI / 2;
        await tween(380 * sp, (k) => { rb.ang = a0 + (a1 - a0) * k; });
      } else if (st.ev === 'crash') {
        const dir = Math.round(((rb.ang / (Math.PI / 2)) % 4 + 4) % 4);
        const x0 = rb.x, y0 = rb.y;
        await tween(260 * sp, (k) => { rb.x = x0 + Logic.DX[dir] * 0.35 * k; rb.y = y0 + Logic.DY[dir] * 0.35 * k; });
        sparkle('#ff4d6d', 14);
        await tween(260 * sp, (k) => { rb.x = x0 + Logic.DX[dir] * 0.35 * (1 - k); rb.y = y0 + Logic.DY[dir] * 0.35 * (1 - k); });
        document.querySelectorAll('.block.active').forEach((b) => b.classList.remove('active'));
        const el = document.querySelector('.block[data-id="' + st.node.id + '"]'); if (el) el.classList.add('err');
      } else {
        const x0 = rb.x, y0 = rb.y;
        await tween(430 * sp, (k) => { rb.x = x0 + (st.x - x0) * k; rb.y = y0 + (st.y - y0) * k; });
        if (st.ev === 'battery') { collected.add(st.x + ',' + st.y); sparkle('#ffc13d', 16); }
      }
    }
    if (mine !== runId) return;
    busy = false; $('run').disabled = false;
    document.querySelectorAll('.block.active').forEach((b) => b.classList.remove('active'));

    if (res.status === 'win') win();
    else if (res.status === 'crash') say('¡El robot chocó con una pared! Revisa el bloque marcado en rojo y prueba otra vez.', 'bad');
    else if (res.status === 'missing') say('Llegaste a la meta, pero faltan ' + res.left + ' batería(s) ⚡. Pasa por todas antes de llegar.', 'warn');
    else say('El programa terminó y el robot no llegó a la meta. Añade o cambia instrucciones.', 'warn');
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
    $('winBlocks').textContent = 'Usaste ' + used + ' bloques' + (n === 3 ? ': ¡el mínimo posible!' : '. Se puede con ' + par + '. ¿Te animas a intentarlo con menos?');
    $('winLearn').textContent = '💡 ' + level.learn;
    const last = li === LEVELS.length - 1;
    $('next').style.display = last ? 'none' : '';
    if (last) $('winLearn').textContent += ' ¡Completaste todos los niveles!';
    setTimeout(() => { if (!busy) $('winOverlay').classList.remove('hidden'); }, 1300);
  }
  $('next').addEventListener('click', () => loadLevel(Math.min(li + 1, LEVELS.length - 1)));
  $('replay').addEventListener('click', () => loadLevel(li));

  /* ---------- Dibujo ---------- */

  function layout() {
    const c = Math.min(Math.floor((W - 40) / L.w), Math.floor((H - 40) / L.h), 120);
    return { c: c, ox: Math.round((W - c * L.w) / 2), oy: Math.round((H - c * L.h) / 2) };
  }

  function rr(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function drawRobot(px, py, c) {
    g.save(); g.translate(px, py); g.rotate(rb.ang);
    g.fillStyle = '#2a3869'; rr(-0.40 * c, -0.30 * c, 0.12 * c, 0.60 * c, 0.04 * c); g.fill(); rr(0.28 * c, -0.30 * c, 0.12 * c, 0.60 * c, 0.04 * c); g.fill();
    g.fillStyle = '#38e1ff'; rr(-0.30 * c, -0.30 * c, 0.60 * c, 0.60 * c, 0.10 * c); g.fill();
    g.fillStyle = '#1aa7c7'; rr(-0.30 * c, 0.08 * c, 0.60 * c, 0.22 * c, 0.08 * c); g.fill();
    g.fillStyle = '#0a1128'; rr(-0.21 * c, -0.24 * c, 0.42 * c, 0.24 * c, 0.06 * c); g.fill();
    g.fillStyle = '#3dff9a';
    g.beginPath(); g.arc(-0.08 * c, -0.12 * c, 0.045 * c, 0, 7); g.arc(0.08 * c, -0.12 * c, 0.045 * c, 0, 7); g.fill();
    g.fillStyle = '#ffc13d';
    g.beginPath(); g.moveTo(0, -0.46 * c); g.lineTo(-0.1 * c, -0.33 * c); g.lineTo(0.1 * c, -0.33 * c); g.closePath(); g.fill();
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
        if (L.walls[y][x]) {
          g.fillStyle = '#080c1f'; g.fillRect(px, py, c, c);
          g.fillStyle = '#1c2756'; rr(px + 3, py + 3, c - 6, c - 6, 8); g.fill();
          g.fillStyle = '#26356e'; rr(px + 3, py + 3, c - 6, (c - 6) * 0.45, 8); g.fill();
        } else {
          g.fillStyle = '#16204a'; g.fillRect(px, py, c, c);
          g.strokeStyle = '#222f64'; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, c - 2, c - 2);
        }
      }
    }

    // Meta
    const gx = ox + (L.goal.x + 0.5) * c, gy = oy + (L.goal.y + 0.5) * c;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    g.fillStyle = 'rgba(61,255,154,.16)'; g.fillRect(ox + L.goal.x * c + 2, oy + L.goal.y * c + 2, c - 4, c - 4);
    g.strokeStyle = '#3dff9a'; g.lineWidth = 4; g.beginPath(); g.arc(gx, gy, c * (0.34 + 0.04 * pulse), 0, 7); g.stroke();
    g.fillStyle = '#3dff9a'; g.fillRect(gx - 0.03 * c, gy - 0.22 * c, 0.05 * c, 0.44 * c);
    g.beginPath(); g.moveTo(gx + 0.02 * c, gy - 0.22 * c); g.lineTo(gx + 0.24 * c, gy - 0.12 * c); g.lineTo(gx + 0.02 * c, gy - 0.02 * c); g.fill();

    // Baterías
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

    // Partículas (chispas y confeti)
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
    const k = e.key;
    if (k === 'ArrowUp') { add('F'); e.preventDefault(); }
    else if (k === 'ArrowLeft') { add('L'); e.preventDefault(); }
    else if (k === 'ArrowRight') { add('R'); e.preventDefault(); }
    else if (k === 'Backspace') { if (!busy && target.length) { target.pop(); if (depthOf(target) < 0) target = program; edited(); } e.preventDefault(); }
    else if (k === 'Enter' && e.target.tagName !== 'BUTTON') { execute(); e.preventDefault(); }
    else if (k === 'Escape') resetRobot();
  });

  loadLevel(0);
  requestAnimationFrame(frame);
})();
