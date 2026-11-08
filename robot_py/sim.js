/* Simulación de "Programa al robot (Python)". Sin DOM: se prueba con Node.
 *   node tools/test-robot_py.js
 *
 * El robot se controla con ACCIONES imperativas (las mismas que luego se exponen a
 * Python a través del intérprete). El control de flujo (for / while / if) lo pone el
 * propio código Python; aquí solo viven los primitivos y las reglas del mundo.
 *
 * Mapa:  #  muro de acero (NO se rompe)   X  roca (se rompe con romper())   .  piso
 *        R  robot (inicio)   G  meta   B  batería (hay que recogerlas todas)
 * facing: hacia dónde mira el robot al empezar (N, E, S, W)
 * Direcciones: 0 = Norte, 1 = Este, 2 = Sur, 3 = Oeste.
 *
 * Modelo "ejecutar y luego animar": el programa Python corre completo llamando a estas
 * acciones, que van anotando una TRAZA; la interfaz (game.js) reproduce la traza paso a paso.
 * Una acción que choca lanza RobotStop (el programa Python se detiene solo); llegar a la
 * meta con todas las baterías también lanza RobotStop con kind 'win'.
 */
(function (root) {
  'use strict';

  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const DIRS = { N: 0, E: 1, S: 2, W: 3 };
  const MAX_STEPS = 600;      // tope de acciones: frena un while que nunca termina

  // Señal de parada del robot. NO es un error de programación: la interfaz y el intérprete
  // la tratan como fin normal. kind: 'win' | 'crash' | 'loop'
  function RobotStop(kind, message) { this.robotStop = true; this.kind = kind; this.message = message || ''; }
  RobotStop.prototype.toString = function () { return 'RobotStop(' + this.kind + '): ' + this.message; };

  function parseLevel(lv) {
    const rows = lv.map, h = rows.length, w = rows[0].length;
    const cells = [], batteries = [];
    let goal = null, start = null;
    for (let y = 0; y < h; y++) {
      if (rows[y].length !== w) throw new Error('Mapa irregular en la fila ' + y + ' de "' + lv.name + '"');
      cells.push([]);
      for (let x = 0; x < w; x++) {
        const c = rows[y][x];
        cells[y].push(c === '#' ? 'wall' : c === 'X' ? 'rock' : 'floor');
        if (c === 'G') goal = { x: x, y: y };
        if (c === 'B') batteries.push({ x: x, y: y });
        if (c === 'R') start = { x: x, y: y, dir: DIRS[lv.facing] };
      }
    }
    if (!goal || !start) throw new Error('El nivel "' + lv.name + '" necesita R y G');
    return { w: w, h: h, cells: cells, batteries: batteries, goal: goal, start: start };
  }

  // Crea un "run": el estado vivo del robot para una partida. La interfaz lee run.trace al final.
  function createRun(lv) {
    const L = parseLevel(lv);
    const rocks = new Set();
    L.cells.forEach((row, y) => row.forEach((c, x) => { if (c === 'rock') rocks.add(x + ',' + y); }));
    return {
      lv: lv, L: L, rocks: rocks,
      left: new Set(L.batteries.map((b) => b.x + ',' + b.y)),
      x: L.start.x, y: L.start.y, dir: L.start.dir,
      steps: 0, status: 'running', reason: null,
      trace: [{ ev: 'start', x: L.start.x, y: L.start.y, dir: L.start.dir }],
    };
  }

  function front(run) {
    const L = run.L, nx = run.x + DX[run.dir], ny = run.y + DY[run.dir];
    if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h || L.cells[ny][nx] === 'wall') return { kind: 'wall', x: nx, y: ny };
    if (run.rocks.has(nx + ',' + ny)) return { kind: 'rock', x: nx, y: ny };
    return { kind: 'free', x: nx, y: ny };
  }

  function push(run, ev, extra) { run.trace.push(Object.assign({ ev: ev, x: run.x, y: run.y, dir: run.dir }, extra || {})); }

  // Cuenta un paso y corta si se pasa del tope (acción "pesada": mueve o gira)
  function tick(run) {
    if (run.status !== 'running') throw new RobotStop(run.status, 'El programa ya había terminado.');
    if (++run.steps > MAX_STEPS) { run.status = 'loop'; push(run, 'loop'); throw new RobotStop('loop', 'El robot hizo demasiadas acciones (¿un bucle que nunca termina?).'); }
  }
  // Cuenta un paso "ligero" para los sensores (frena  while camino_libre(): ...  sin avanzar)
  function sense(run) {
    if (run.status !== 'running') throw new RobotStop(run.status, 'El programa ya había terminado.');
    if (++run.steps > MAX_STEPS) { run.status = 'loop'; throw new RobotStop('loop', 'El robot hizo demasiadas comprobaciones (¿un bucle que nunca termina?).'); }
  }

  /* ---------- Acciones (lo que Python podrá llamar) ---------- */

  function avanzar(run) {
    tick(run);
    const f = front(run);
    if (f.kind !== 'free') {
      run.status = 'crash'; run.reason = f.kind; push(run, 'crash', { kind: f.kind });
      throw new RobotStop('crash', f.kind === 'rock'
        ? 'El robot chocó con una roca. Usa romper() antes de avanzar.'
        : 'El robot chocó con un muro.');
    }
    run.x = f.x; run.y = f.y;
    let ev = 'move';
    if (run.left.delete(run.x + ',' + run.y)) ev = 'battery';
    push(run, ev);
    if (run.x === run.L.goal.x && run.y === run.L.goal.y && run.left.size === 0) {
      run.status = 'win'; push(run, 'goal');
      throw new RobotStop('win', '¡El robot llegó a la meta!');
    }
  }

  function girar(run, delta) { tick(run); run.dir = (run.dir + delta + 4) % 4; push(run, 'turn'); }
  function girarIzquierda(run) { girar(run, -1); }   // antihorario
  function girarDerecha(run) { girar(run, 1); }       // horario

  function romper(run) {
    tick(run);
    const f = front(run);
    if (f.kind === 'wall') {
      run.status = 'crash'; run.reason = 'steel'; push(run, 'crash', { kind: 'steel' });
      throw new RobotStop('crash', 'Ese muro es de acero: no se puede romper.');
    }
    if (f.kind === 'rock') { run.rocks.delete(f.x + ',' + f.y); push(run, 'break', { bx: f.x, by: f.y }); }
    else push(run, 'swing');
  }

  /* ---------- Sensores (devuelven booleanos para if / while) ---------- */
  function caminoLibre(run) { sense(run); return front(run).kind === 'free'; }
  function hayRoca(run) { sense(run); return front(run).kind === 'rock'; }
  function hayPared(run) { sense(run); return front(run).kind === 'wall'; }
  function enMeta(run) { sense(run); return run.x === run.L.goal.x && run.y === run.L.goal.y; }

  /* ---------- Resultado final ---------- */
  // status: win | crash | loop | missing (en la meta sin todas las baterías) | incomplete
  function result(run) {
    if (run.status === 'running') {
      const onGoal = run.x === run.L.goal.x && run.y === run.L.goal.y;
      return { status: onGoal ? (run.left.size ? 'missing' : 'win') : 'incomplete', reason: run.reason, trace: run.trace, left: run.left.size };
    }
    return { status: run.status, reason: run.reason, trace: run.trace, left: run.left.size };
  }

  /* Construye el objeto de API que el intérprete expondrá a Python (ligado a este run).
   * Cada clave es el nombre EXACTO de la función tal como se llamará desde Python.
   * Incluye alias cortos para ser indulgentes con los estudiantes. */
  function pythonApi(run) {
    const a = {
      avanzar: function () { avanzar(run); },
      girar_izquierda: function () { girarIzquierda(run); },
      girar_derecha: function () { girarDerecha(run); },
      romper: function () { romper(run); },
      camino_libre: function () { return caminoLibre(run); },
      hay_roca: function () { return hayRoca(run); },
      hay_pared: function () { return hayPared(run); },
      en_meta: function () { return enMeta(run); },
    };
    a.girar_izq = a.girar_izquierda;   // alias
    a.girar_der = a.girar_derecha;     // alias
    return a;
  }

  // 3 estrellas: código igual o más corto que la referencia; 2: hasta 1,5×; 1: el resto
  function starsFor(lines, par) { return lines <= par ? 3 : lines <= Math.ceil(par * 1.5) ? 2 : 1; }

  const api = {
    DX: DX, DY: DY, DIRS: DIRS, MAX_STEPS: MAX_STEPS, RobotStop: RobotStop,
    parseLevel: parseLevel, createRun: createRun, front: front,
    avanzar: avanzar, girarIzquierda: girarIzquierda, girarDerecha: girarDerecha, romper: romper,
    caminoLibre: caminoLibre, hayRoca: hayRoca, hayPared: hayPared, enMeta: enMeta,
    result: result, pythonApi: pythonApi, starsFor: starsFor,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RobotPySim = api;
})(typeof window !== 'undefined' ? window : globalThis);
