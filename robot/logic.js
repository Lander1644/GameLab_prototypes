/* Lógica del juego "Programa al robot" (sin DOM, probable con Node).
 *
 * Un programa es una lista de nodos:
 *   { t: 'F' }  avanzar      { t: 'L' } girar a la izquierda      { t: 'R' } girar a la derecha
 *   { t: 'REP', n: 3, body: [ ...nodos ] }  repetir n veces
 * Direcciones: 0 = Norte, 1 = Este, 2 = Sur, 3 = Oeste.
 */
(function (root) {
  'use strict';

  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const DIRS = { N: 0, E: 1, S: 2, W: 3 };
  const MAX_DEPTH = 2;          // cuántos "Repetir" se pueden anidar
  const REP_OPTIONS = [2, 3, 4, 5];

  function parseLevel(lv) {
    const rows = lv.map, h = rows.length, w = rows[0].length;
    const walls = [], batteries = [];
    let goal = null, start = null;
    for (let y = 0; y < h; y++) {
      if (rows[y].length !== w) throw new Error('Mapa irregular en la fila ' + y + ' de "' + lv.name + '"');
      walls.push([]);
      for (let x = 0; x < w; x++) {
        const c = rows[y][x];
        walls[y].push(c === '#');
        if (c === 'G') goal = { x: x, y: y };
        if (c === 'B') batteries.push({ x: x, y: y });
        if (c === 'R') start = { x: x, y: y, dir: DIRS[lv.facing] };
      }
    }
    if (!goal || !start) throw new Error('El nivel "' + lv.name + '" necesita R y G');
    return { w: w, h: h, walls: walls, batteries: batteries, goal: goal, start: start };
  }

  function countBlocks(nodes) {
    let c = 0;
    for (const n of nodes) { c++; if (n.t === 'REP') c += countBlocks(n.body); }
    return c;
  }

  function expand(nodes, out) {
    for (const n of nodes) {
      if (n.t === 'REP') for (let i = 0; i < n.n; i++) expand(n.body, out);
      else out.push(n);
    }
    return out;
  }

  /* Ejecuta el programa y devuelve la traza completa para animarla.
   * status: 'win' | 'crash' | 'missing' (llegó a la meta sin todas las baterías) | 'incomplete' */
  function run(lv, program) {
    const L = lv._parsed || (lv._parsed = parseLevel(lv));
    let x = L.start.x, y = L.start.y, dir = L.start.dir;
    const left = new Set(L.batteries.map((b) => b.x + ',' + b.y));
    const trace = [];
    let touchedGoalEarly = false;

    for (const node of expand(program, [])) {
      if (node.t === 'L' || node.t === 'R') {
        dir = (dir + (node.t === 'R' ? 1 : 3)) % 4;
        trace.push({ node: node, x: x, y: y, dir: dir, ev: 'turn' });
        continue;
      }
      const nx = x + DX[dir], ny = y + DY[dir];
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h || L.walls[ny][nx]) {
        trace.push({ node: node, x: x, y: y, dir: dir, ev: 'crash' });
        return { status: 'crash', trace: trace };
      }
      x = nx; y = ny;
      let ev = 'move';
      if (left.delete(x + ',' + y)) ev = 'battery';
      if (x === L.goal.x && y === L.goal.y) {
        if (left.size === 0) {
          trace.push({ node: node, x: x, y: y, dir: dir, ev: 'goal' });
          return { status: 'win', trace: trace };
        }
        touchedGoalEarly = true;
      }
      trace.push({ node: node, x: x, y: y, dir: dir, ev: ev });
    }
    const onGoal = x === L.goal.x && y === L.goal.y;
    return { status: onGoal || touchedGoalEarly ? 'missing' : 'incomplete', trace: trace, left: left.size };
  }

  /* Lee programas escritos en texto: "4[F] R 2[F L]" (útil para pruebas). */
  function parseProgram(src) {
    let i = 0;
    function seq() {
      const out = [];
      while (i < src.length && src[i] !== ']') {
        const c = src[i];
        if (c === ' ') { i++; continue; }
        if (c >= '0' && c <= '9') {
          let n = 0;
          while (src[i] >= '0' && src[i] <= '9') n = n * 10 + (+src[i++]);
          if (src[i++] !== '[') throw new Error('Se esperaba [ en ' + src);
          const body = seq();
          if (src[i++] !== ']') throw new Error('Falta ] en ' + src);
          out.push({ t: 'REP', n: n, body: body });
        } else if (c === 'F' || c === 'L' || c === 'R') { out.push({ t: c }); i++; }
        else throw new Error('Carácter inesperado "' + c + '" en ' + src);
      }
      return out;
    }
    const p = seq();
    if (i < src.length) throw new Error('Sobra ] en ' + src);
    return p;
  }

  function starsFor(blocks, par) {
    return blocks <= par ? 3 : blocks <= par + 2 ? 2 : 1;
  }

  const api = {
    DX: DX, DY: DY, DIRS: DIRS, MAX_DEPTH: MAX_DEPTH, REP_OPTIONS: REP_OPTIONS,
    parseLevel: parseLevel, countBlocks: countBlocks, run: run, parseProgram: parseProgram, starsFor: starsFor,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RobotLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
