/* =====================================================================
 * utils.js  —  FUNCIONES AUXILIARES REUTILIZABLES
 * Depende de: nada.
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  /**
   * Devuelve una COPIA mezclada del arreglo (algoritmo Fisher-Yates).
   * Es imparcial: todas las combinaciones son igual de probables.
   * No modifica el arreglo original (por eso el banco nunca se altera).
   */
  function mezclar(arreglo) {
    const copia = arreglo.slice();
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  /** Dado el índice de un jugador (0 o 1) devuelve el del rival. */
  function rival(indiceJugador) {
    return 1 - indiceJugador;
  }

  /** Atajo para obtener un elemento del DOM por su id. */
  function porId(id) {
    return document.getElementById(id);
  }

  Quiz.Util = { mezclar: mezclar, rival: rival, porId: porId };

})(window.Quiz);
