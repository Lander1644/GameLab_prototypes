/* Niveles de "Programa al robot (Python)".
 *
 * Mapa:  #  muro de acero (NO se rompe)   X  roca (se rompe)   .  piso
 *        R  robot (inicio)   G  meta   B  batería
 * facing:  N, E, S, W   (hacia dónde mira el robot al empezar)
 * start:   código Python que aparece ya escrito en el editor al abrir el nivel
 * par:     nº de líneas de código de la solución de referencia (para las estrellas:
 *          3★ = igual o menos; 2★ = hasta 1,5×; 1★ = el resto). Cuentan las líneas con
 *          código (se ignoran las vacías y los comentarios).
 *
 * Para agregar un nivel: añade un objeto aquí y, si quieres validarlo, una solución de
 * referencia en tools/test-robot_py.js.
 */
(function (root) {
  'use strict';

  const LEVELS = [
    {
      name: 'Primeros pasos',
      goal: 'Lleva el robot hasta la meta (G).',
      learn: 'avanzar() da un paso adelante. Un bucle for repite una acción un número fijo de veces.',
      facing: 'E', par: 2,
      start: '# Lleva el robot a la meta.\n# avanzar() da un paso adelante.\nfor i in range(6):\n    avanzar()\n',
      map: [
        '#########',
        '#R.....G#',
        '#########',
      ],
    },
    {
      name: 'Giros',
      goal: 'Gira para doblar la esquina.',
      learn: 'girar_derecha() y girar_izquierda() hacen girar al robot sobre su sitio. Luego avanza hacia donde mira.',
      facing: 'E', par: 5,
      start: '# Avanza, gira y vuelve a avanzar.\nfor i in range(3):\n    avanzar()\ngirar_derecha()\navanzar()\navanzar()\n',
      map: [
        '######',
        '#R...#',
        '####.#',
        '####G#',
        '######',
      ],
    },
    {
      name: 'Una roca en el camino',
      goal: 'Rompe la roca 🪨 que bloquea el paso.',
      learn: 'romper() destruye la roca que haya justo delante. Si no hay nada, no pasa nada.',
      facing: 'E', par: 6,
      start: '# Hay una roca en el camino.\navanzar()\nromper()\navanzar()\ngirar_derecha()\navanzar()\navanzar()\n',
      map: [
        '#####',
        '#R.X#',
        '###.#',
        '###G#',
        '#####',
      ],
    },
    {
      name: 'Muros de acero',
      goal: 'Los muros grises no se rompen: rodéalos.',
      learn: 'Unos obstáculos se rompen (rocas) y otros no (acero). Un buen programa distingue los casos.',
      facing: 'S', par: 9,
      start: '# El muro del centro es de acero (no se rompe).\n# Baja, gira y rompe solo la roca.\navanzar()\navanzar()\ngirar_izquierda()\nromper()\navanzar()\navanzar()\ngirar_izquierda()\navanzar()\navanzar()\n',
      map: [
        '#####',
        '#R#G#',
        '#.#.#',
        '#.X.#',
        '#####',
      ],
    },
    {
      name: 'Mientras haya camino',
      goal: 'El pasillo es muy largo para contar los pasos.',
      learn: 'Un bucle while repite MIENTRAS se cumpla una condición. en_meta() es True cuando el robot ya está en la meta.',
      facing: 'E', par: 2,
      start: '# No cuentes los pasos: avanza hasta llegar.\nwhile not en_meta():\n    avanzar()\n',
      map: [
        '##############',
        '#R..........G#',
        '##############',
      ],
    },
    {
      name: 'Pasillo de rocas',
      goal: 'Rocas por todas partes: combínalo todo.',
      learn: 'romper() delante de una casilla vacía no hace nada, así que puedes ponerlo siempre dentro del while.',
      facing: 'E', par: 3,
      start: '# Mientras no llegues a la meta: rompe (si hay roca) y avanza.\nwhile not en_meta():\n    romper()\n    avanzar()\n',
      map: [
        '##############',
        '#R.X..XX.X..G#',
        '##############',
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.ROBOT_PY_LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
