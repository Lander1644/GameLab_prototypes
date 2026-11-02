/* Lógica de "Programa al robot" (versión con bloques estilo Scratch). Sin DOM: se prueba con Node.
 *
 * Nodos del programa:
 *   { t: 'F' } avanzar     { t: 'L' } girar izq.     { t: 'R' } girar der.
 *   { t: 'X' } romper la roca que haya delante (si no hay nada, no pasa nada)
 *   { t: 'FOR', n: 3, body: [...] }            repetir n veces
 *   { t: 'WHILE', cond: 'free', body: [...] }  mientras se cumpla la condición
 *
 * Mapa:  # muro de acero (no se rompe)   X roca (se rompe)   . piso   R robot   G meta   B batería
 * Direcciones: 0 = Norte, 1 = Este, 2 = Sur, 3 = Oeste.
 */
(function (root) {
  'use strict';

  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const DIRS = { N: 0, E: 1, S: 2, W: 3 };
  const MAX_DEPTH = 3;           // bucles anidados permitidos
  const MAX_STEPS = 400;         // tope de acciones: evita que un "mientras" mal hecho dure para siempre
  const FOR_MIN = 2, FOR_MAX = 9;

  const CONDS = {
    free:    'camino libre',
    rock:    'hay una roca',
    wall:    'hay un muro',
    notgoal: 'no llegué a la meta',
  };

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

  function countBlocks(nodes) {
    let c = 0;
    for (const n of nodes) { c++; if (n.body) c += countBlocks(n.body); }
    return c;
  }

  function nodeDepth(n) {         // 0 para bloques simples, 1 + lo más profundo de su interior para bucles
    if (!n.body) return 0;
    let d = 0;
    for (const c of n.body) d = Math.max(d, nodeDepth(c));
    return 1 + d;
  }

  /* Ejecuta el programa y devuelve la traza para animarla.
   * status: win | crash | loop | missing (llegó a la meta sin todas las baterías) | incomplete
   * Si es crash, "reason" dice por qué: wall | rock | steel (romper un muro de acero) */
  function run(lv, program) {
    const L = lv._parsed || (lv._parsed = parseLevel(lv));
    const rocks = new Set();
    L.cells.forEach((row, y) => row.forEach((c, x) => { if (c === 'rock') rocks.add(x + ',' + y); }));
    const left = new Set(L.batteries.map((b) => b.x + ',' + b.y));
    let x = L.start.x, y = L.start.y, dir = L.start.dir;
    let steps = 0, reason = null, touchedGoal = false;
    const trace = [];

    const front = () => {
      const nx = x + DX[dir], ny = y + DY[dir];
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h || L.cells[ny][nx] === 'wall') return { kind: 'wall', x: nx, y: ny };
      if (rocks.has(nx + ',' + ny)) return { kind: 'rock', x: nx, y: ny };
      return { kind: 'free', x: nx, y: ny };
    };
    const cond = (name) => {
      if (name === 'notgoal') return !(x === L.goal.x && y === L.goal.y);
      return front().kind === name;
    };
    const push = (node, ev, extra) => trace.push(Object.assign({ node: node, ev: ev, x: x, y: y, dir: dir }, extra || {}));

    function exec(nodes) {
      for (const node of nodes) {
        if (++steps > MAX_STEPS) return 'loop';
        switch (node.t) {
          case 'L': case 'R':
            dir = (dir + (node.t === 'R' ? 1 : 3)) % 4;
            push(node, 'turn');
            break;
          case 'F': {
            const f = front();
            if (f.kind !== 'free') { reason = f.kind; push(node, 'crash'); return 'crash'; }
            x = f.x; y = f.y;
            let ev = 'move';
            if (left.delete(x + ',' + y)) ev = 'battery';
            if (x === L.goal.x && y === L.goal.y) {
              if (left.size === 0) { push(node, 'goal'); return 'win'; }
              touchedGoal = true;
            }
            push(node, ev);
            break;
          }
          case 'X': {
            const f = front();
            if (f.kind === 'wall') { reason = 'steel'; push(node, 'crash'); return 'crash'; }
            if (f.kind === 'rock') { rocks.delete(f.x + ',' + f.y); push(node, 'break', { bx: f.x, by: f.y }); }
            else push(node, 'swing');
            break;
          }
          case 'FOR':
            for (let i = 0; i < node.n; i++) {
              push(node, 'iter');
              const r = exec(node.body); if (r) return r;
            }
            break;
          case 'WHILE':
            for (;;) {
              const ok = cond(node.cond);
              push(node, 'check', { value: ok });
              if (!ok) break;
              if (++steps > MAX_STEPS) return 'loop';
              const r = exec(node.body); if (r) return r;
            }
            break;
        }
      }
      return null;
    }

    const r = exec(program);
    if (r === 'win') return { status: 'win', trace: trace };
    if (r === 'crash') return { status: 'crash', reason: reason, trace: trace };
    if (r === 'loop') return { status: 'loop', trace: trace };
    const onGoal = x === L.goal.x && y === L.goal.y;
    return { status: onGoal || touchedGoal ? 'missing' : 'incomplete', trace: trace, left: left.size };
  }

  /* Programas en texto (para pruebas):  F L R X   4[F] = repetir 4 veces   ?free[F X] = mientras camino libre
   * Condiciones: free, rock, wall, notgoal */
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
          out.push({ t: 'FOR', n: n, body: body });
        } else if (c === '?') {
          i++;
          let name = '';
          while (/[a-z]/.test(src[i] || '')) name += src[i++];
          if (!CONDS[name]) throw new Error('Condición desconocida: ' + name);
          if (src[i++] !== '[') throw new Error('Se esperaba [ en ' + src);
          const body = seq();
          if (src[i++] !== ']') throw new Error('Falta ] en ' + src);
          out.push({ t: 'WHILE', cond: name, body: body });
        } else if ('FLRX'.includes(c)) { out.push({ t: c }); i++; }
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
    DX: DX, DY: DY, DIRS: DIRS, MAX_DEPTH: MAX_DEPTH, MAX_STEPS: MAX_STEPS, FOR_MIN: FOR_MIN, FOR_MAX: FOR_MAX, CONDS: CONDS,
    parseLevel: parseLevel, countBlocks: countBlocks, nodeDepth: nodeDepth, run: run, parseProgram: parseProgram, starsFor: starsFor,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Robot2Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
