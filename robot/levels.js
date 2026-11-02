/* Niveles de "Programa al robot".
 *
 * Mapa:  #  pared    .  piso    R  robot (inicio)    G  meta    B  batería (hay que recogerlas todas)
 * facing: hacia dónde mira el robot al empezar (N, E, S, W)
 * max:       máximo de bloques permitidos (cuenta también los bloques "Repetir")
 * solution:  solución de referencia (la usa tools/test-robot.js; par = bloques de esa solución)
 *            Sintaxis: F avanzar, L izquierda, R derecha, 4[F] = repetir 4 veces
 * Para agregar un nivel: añade un objeto aquí y corre  node tools/test-robot.js
 */
(function (root) {
  'use strict';

  const LEVELS = [
    {
      name: 'Primer paso',
      hint: 'Un programa es una lista de instrucciones que se ejecutan en orden. Lleva al robot hasta la meta.',
      learn: 'Un programa es una secuencia de instrucciones: el robot hace exactamente lo que le dices, ni más ni menos.',
      facing: 'E', max: 6,
      solution: '4[F]',
      map: [
        '#######',
        '#R...G#',
        '#######',
      ],
    },
    {
      name: 'Doblando esquinas',
      hint: 'El robot solo gira sobre su eje: usa «Girar» antes de avanzar en otra dirección.',
      learn: 'Girar cambia hacia dónde mira el robot. El orden de las instrucciones lo cambia todo.',
      facing: 'E', max: 8,
      solution: '2[F F R]',
      map: [
        '#####',
        '#R..#',
        '###.#',
        '###G#',
        '#####',
      ],
    },
    {
      name: 'La escalera',
      hint: 'Tienes pocos bloques. Fíjate en el patrón: ¿qué se repite una y otra vez?',
      learn: 'Un bucle repite instrucciones: ¡menos bloques para el mismo resultado!',
      facing: 'E', max: 8,
      solution: '3[F R F L]',
      map: [
        '#######',
        '#R.####',
        '##..###',
        '###..##',
        '####G##',
        '#######',
      ],
    },
    {
      name: 'Baterías',
      hint: 'El robot necesita recoger todas las baterías ⚡ antes de llegar a la meta.',
      learn: 'Un programa puede tener varios objetivos: pasar por la batería y además llegar a la meta.',
      facing: 'E', max: 10,
      solution: '2[F F 2[F F R]]',
      map: [
        '#########',
        '#R..B...#',
        '#####.###',
        '#G....###',
        '#########',
      ],
    },
    {
      name: 'Escalera doble',
      hint: 'Cada escalón mide dos casillas. Un bucle puede tener otro bucle dentro: toca el bloque «Repetir» para añadir cosas adentro.',
      learn: 'Puedes meter un bucle dentro de otro. Los programadores lo hacen todo el tiempo.',
      facing: 'E', max: 9,
      solution: '2[2[F] R 2[F] L]',
      map: [
        '#######',
        '#R..###',
        '###.###',
        '###...#',
        '#####.#',
        '#####G#',
        '#######',
      ],
    },
    {
      name: 'La serpiente',
      hint: 'Recoge las dos baterías y llega a la meta. Los giros se repiten de dos en dos.',
      learn: 'Descomponer un problema grande en partes que se repiten es la clave para programar bien.',
      facing: 'E', max: 12,
      solution: '2[F F R] 3[F F L]',
      map: [
        '#####',
        '#R..#',
        '###.#',
        '#B..#',
        '#.###',
        '#.BG#',
        '#####',
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.ROBOT_LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
