/* Interfaz de "Programa al robot (Python)": editor, dibujo del mapa, animación y
 * conexión con el intérprete de Python. La simulación vive en sim.js (probable con Node).
 *
 * La EJECUCIÓN DE PYTHON la provee runner.js a través de un único punto de enganche:
 *
 *     window.RobotPy.run(source, api, hooks) -> Promise
 *
 *   source : string  — el código del editor
 *   api    : objeto con las funciones JS que Python podrá llamar (lo arma sim.js):
 *            { avanzar, girar_izquierda, girar_derecha, romper,
 *              camino_libre, hay_roca, hay_pared, en_meta, girar_izq, girar_der }
 *   hooks  : { onOutput(text) }  — para enviar aquí lo que imprima print()
 *
 *   Debe RESOLVER la promesa cuando el programa termina, incluso si se detuvo porque una
 *   acción lanzó la señal de parada del robot (una excepción con .robotStop === true: eso
 *   NO es un error, es que el robot chocó o llegó a la meta). Debe RECHAZAR la promesa solo
 *   ante un error de Python (sintaxis, nombre, etc.) con un Error cuyo .message sea el texto
 *   amigable del error. En ambos casos game.js reproduce run.trace y muestra el resultado.
 */
(() => {
  'use strict';
  const Sim = window.RobotPySim;
  const LEVELS = window.ROBOT_PY_LEVELS;
  const $ = (id) => document.getElementById(id);

  const cv = $('board'), g = cv.getContext('2d');
  const STORE = 'gamelab.robot_py.stars';
  const STEP_MS = 180;        // velocidad de la animación

  let lvlIndex = 0, level = LEVELS[0];
  let view = null, animTimer = null, running = false;
  let stars = loadStars();

  function loadStars() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function saveStars() { try { localStorage.setItem(STORE, JSON.stringify(stars)); } catch (e) {} }

  /* ---------- Vista (estado que se dibuja; se reconstruye al reproducir la traza) ---------- */

  function freshView() {
    const L = Sim.parseLevel(level);
    const rocks = new Set();
    L.cells.forEach((row, y) => row.forEach((c, x) => { if (c === 'rock') rocks.add(x + ',' + y); }));
    return {
      L: L, rocks: rocks,
      batteries: new Set(L.batteries.map((b) => b.x + ',' + b.y)),
      x: L.start.x, y: L.start.y, dir: L.start.dir,
      flash: 0,
    };
  }

  /* ---------- Dibujo ---------- */

  function layout() {
    const L = Sim.parseLevel(level);
    const cell = Math.max(28, Math.min(64, Math.floor(600 / L.w)));
    cv.width = L.w * cell * 2; cv.height = L.h * cell * 2;   // x2 para nitidez
    cv.style.width = Math.min(640, L.w * cell) + 'px';
    return { cell: cell };
  }

  function roundRect(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  let CELL = 48;
  function draw() {
    const v = view, L = v.L, c = CELL;
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#0d142b'; g.fillRect(0, 0, L.w * c, L.h * c);

    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const px = x * c, py = y * c, kind = L.cells[y][x];
      if (kind === 'wall') {
        g.fillStyle = '#28345f'; roundRect(px + 2, py + 2, c - 4, c - 4, 6); g.fill();
        g.strokeStyle = '#3a4a85'; g.lineWidth = 1; g.stroke();
      } else {
        g.fillStyle = '#121a36'; g.fillRect(px, py, c, c);
        g.strokeStyle = '#1d294f'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, c, c);
      }
    }
    // meta
    const G = L.goal;
    g.fillStyle = 'rgba(61,255,154,.16)'; g.fillRect(G.x * c + 3, G.y * c + 3, c - 6, c - 6);
    g.strokeStyle = '#3dff9a'; g.lineWidth = 2; g.setLineDash([5, 4]);
    g.strokeRect(G.x * c + 4, G.y * c + 4, c - 8, c - 8); g.setLineDash([]);
    g.fillStyle = '#3dff9a'; g.font = Math.round(c * 0.5) + 'px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('★', G.x * c + c / 2, G.y * c + c / 2);

    // baterías
    g.font = Math.round(c * 0.5) + 'px system-ui, sans-serif';
    v.batteries.forEach((k) => { const [x, y] = k.split(',').map(Number); g.fillText('⚡', x * c + c / 2, y * c + c / 2); });

    // rocas
    v.rocks.forEach((k) => {
      const [x, y] = k.split(',').map(Number), px = x * c, py = y * c;
      g.fillStyle = '#7a5a3a'; roundRect(px + 6, py + 6, c - 12, c - 12, 8); g.fill();
      g.fillStyle = '#5c4228'; roundRect(px + 10, py + c * 0.45, c - 20, c * 0.3, 5); g.fill();
    });

    // robot
    drawRobot(v.x * c + c / 2, v.y * c + c / 2, c, v.dir);

    if (v.flash > 0) {
      g.fillStyle = 'rgba(255,77,109,' + (0.35 * v.flash) + ')'; g.fillRect(0, 0, L.w * c, L.h * c);
    }
  }

  function drawRobot(cx, cy, c, dir) {
    const r = c * 0.3;
    // cuerpo
    g.fillStyle = '#0a1a2b'; g.strokeStyle = '#38e1ff'; g.lineWidth = 3;
    roundRect(cx - r, cy - r, r * 2, r * 2, 7); g.fill(); g.stroke();
    // ojos
    g.fillStyle = '#38e1ff';
    g.beginPath(); g.arc(cx - r * 0.4, cy - r * 0.15, r * 0.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + r * 0.4, cy - r * 0.15, r * 0.2, 0, Math.PI * 2); g.fill();
    // flecha de dirección
    const ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][dir];
    const nx = cx + Math.cos(ang) * (r + 7), ny = cy + Math.sin(ang) * (r + 7);
    g.fillStyle = '#7aeaff';
    g.save(); g.translate(nx, ny); g.rotate(ang);
    g.beginPath(); g.moveTo(6, 0); g.lineTo(-5, -6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
  }

  /* ---------- Consola ---------- */
  function consoleClear() { $('console').innerHTML = ''; }
  function consolePrint(text, cls) {
    const d = document.createElement('div');
    d.className = 'l ' + (cls || 'sys'); d.textContent = text;
    $('console').appendChild(d); $('console').scrollTop = $('console').scrollHeight;
  }

  /* ---------- Carga de nivel ---------- */
  function setStarsEl(el, n) { el.innerHTML = n ? ('★'.repeat(n) + '<span class="off">' + '★'.repeat(3 - n) + '</span>') : ''; }

  function loadLevel(i) {
    stopAnim();
    lvlIndex = (i + LEVELS.length) % LEVELS.length;
    level = LEVELS[lvlIndex];
    CELL = layout().cell;
    view = freshView();
    $('levelTag').textContent = 'Nivel ' + (lvlIndex + 1) + '/' + LEVELS.length;
    $('lvlName').textContent = level.name;
    $('lvlGoal').textContent = level.goal;
    $('learnTip').textContent = level.learn;
    $('code').value = level.start;
    setStarsEl($('levelStars'), stars[lvlIndex] || 0);
    $('prevLvl').disabled = lvlIndex === 0;
    $('nextLvl').disabled = lvlIndex === LEVELS.length - 1;
    consoleClear(); consolePrint('Escribe tu programa y pulsa ▶ Ejecutar.', 'sys');
    draw();
  }

  /* ---------- Ejecución: pide al intérprete que corra el código, luego anima ---------- */

  function setRunning(on) {
    running = on;
    $('run').disabled = on; $('stop').disabled = !on;
    $('prevLvl').disabled = on || lvlIndex === 0;
    $('nextLvl').disabled = on || lvlIndex === LEVELS.length - 1;
  }

  function runProgram() {
    if (running) return;
    const src = $('code').value;
    consoleClear();
    view = freshView(); draw();

    if (!window.RobotPy || typeof window.RobotPy.run !== 'function' || window.RobotPy.stub) {
      consolePrint('⚠ El intérprete de Python todavía no está conectado.', 'bad');
      consolePrint('   Pide a Claude Code que complete runner.js siguiendo INTERPRETE_PROMPT.md.', 'sys');
      return;
    }

    const run = Sim.createRun(level);
    const api = Sim.pythonApi(run);
    setRunning(true);
    consolePrint('▶ Ejecutando…', 'sys');

    Promise.resolve()
      .then(() => window.RobotPy.run(src, api, { onOutput: (t) => consolePrint(String(t).replace(/\n$/, ''), 'out') }))
      .then(() => animateTrace(run, null))
      .catch((err) => {
        // Si es la señal de parada del robot, no es error; anima normal.
        if (err && err.robotStop) animateTrace(run, null);
        else animateTrace(run, err);
      });
  }

  function animateTrace(run, err) {
    const tr = run.trace;
    view = freshView();
    let i = 0;
    stopAnim();
    animTimer = setInterval(() => {
      if (view.flash > 0) view.flash = Math.max(0, view.flash - 0.25);
      if (i >= tr.length) {
        if (view.flash <= 0) { stopAnim(); outcome(run, err); return; }
        draw(); return;
      }
      applyStep(tr[i]); i++; draw();
    }, STEP_MS);
  }

  function applyStep(s) {
    switch (s.ev) {
      case 'start': view.x = s.x; view.y = s.y; view.dir = s.dir; break;
      case 'turn': view.dir = s.dir; break;
      case 'move': view.x = s.x; view.y = s.y; break;
      case 'battery': view.x = s.x; view.y = s.y; view.batteries.delete(s.x + ',' + s.y); break;
      case 'goal': view.x = s.x; view.y = s.y; break;
      case 'break': view.rocks.delete(s.bx + ',' + s.by); break;
      case 'swing': break;
      case 'crash': view.flash = 1; break;
      case 'loop': view.flash = 1; break;
    }
  }

  function stopAnim() { if (animTimer) { clearInterval(animTimer); animTimer = null; } }

  function outcome(run, err) {
    setRunning(false);
    const r = Sim.result(run);
    if (err) {
      consolePrint('🐍 Error en tu código: ' + (err.message || err), 'bad');
      return;
    }
    if (r.status === 'win') {
      const lines = codeLines($('code').value);
      const st = Sim.starsFor(lines, level.par);
      if (st > (stars[lvlIndex] || 0)) { stars[lvlIndex] = st; saveStars(); }
      setStarsEl($('levelStars'), stars[lvlIndex] || st);
      consolePrint('✅ ¡Nivel resuelto! ' + lines + ' líneas de código → ' + st + ' de 3 estrellas.', 'ok');
      showWin(st, lines);
    } else if (r.status === 'crash') {
      consolePrint('💥 ' + crashText(r.reason), 'bad');
    } else if (r.status === 'loop') {
      consolePrint('🔁 El robot hizo demasiadas acciones (¿un bucle que nunca termina?).', 'bad');
    } else if (r.status === 'missing') {
      consolePrint('🔋 Llegaste a la meta, pero faltan baterías por recoger.', 'bad');
    } else {
      consolePrint('⛳ El programa terminó, pero el robot no llegó a la meta.', 'bad');
    }
  }

  function crashText(reason) {
    if (reason === 'rock') return 'El robot chocó con una roca. Usa romper() antes de avanzar.';
    if (reason === 'steel') return 'El robot intentó romper un muro de acero (no se puede).';
    return 'El robot chocó con un muro.';
  }

  function codeLines(src) {
    return src.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter((l) => l.length > 0).length;
  }

  function showWin(st, lines) {
    $('winStars').innerHTML = '★'.repeat(st) + '<span class="off">' + '★'.repeat(3 - st) + '</span>';
    $('winText').textContent = st === 3
      ? '¡Perfecto! Resolviste el nivel con ' + lines + ' líneas.'
      : 'Resuelto con ' + lines + ' líneas. Prueba a usar bucles para hacerlo más corto y ganar las 3 estrellas.';
    $('winNext').style.display = lvlIndex < LEVELS.length - 1 ? '' : 'none';
    $('winOverlay').classList.remove('hidden');
  }

  /* ---------- Eventos ---------- */

  $('run').addEventListener('click', runProgram);
  $('stop').addEventListener('click', () => { stopAnim(); setRunning(false); view = freshView(); draw(); consolePrint('⏹ Detenido.', 'sys'); });
  $('reset').addEventListener('click', () => { stopAnim(); setRunning(false); view = freshView(); draw(); consoleClear(); consolePrint('Robot reiniciado.', 'sys'); });
  $('resetCode').addEventListener('click', () => { $('code').value = level.start; $('code').focus(); });
  $('prevLvl').addEventListener('click', () => loadLevel(lvlIndex - 1));
  $('nextLvl').addEventListener('click', () => loadLevel(lvlIndex + 1));
  $('begin').addEventListener('click', () => { $('startOverlay').classList.add('hidden'); $('code').focus(); });
  $('winAgain').addEventListener('click', () => $('winOverlay').classList.add('hidden'));
  $('winNext').addEventListener('click', () => { $('winOverlay').classList.add('hidden'); loadLevel(lvlIndex + 1); });

  // Tab inserta 4 espacios (Python usa sangría)
  $('code').addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const t = e.target, s = t.selectionStart, en = t.selectionEnd;
      t.value = t.value.slice(0, s) + '    ' + t.value.slice(en);
      t.selectionStart = t.selectionEnd = s + 4;
    }
    if ((e.key === 'Enter') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runProgram(); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.id === 'code') return;
    if (e.key === 'Escape' && !$('winOverlay').classList.contains('hidden')) $('winOverlay').classList.add('hidden');
  });
  window.addEventListener('resize', () => { CELL = layout().cell; draw(); });

  loadLevel(0);
})();
