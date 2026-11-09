window.Quiz = window.Quiz || {};

/* =====================================================================
 * config.js  —  CONFIGURACIÓN Y FASES DEL JUEGO
 * Depende de: nada.
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  Quiz.FASES = Object.freeze({
    LECTURA: 'lectura',
    PULSADORES: 'pulsadores',
    RESPUESTA: 'respuesta',
    SUSPENSO: 'suspenso',
    TRANSICION: 'transicion',
    TERMINADA: 'terminada'
  });

  Quiz.Config = {
    PREGUNTAS_POR_PARTIDA: 10,
    TECLAS: ['a', 'l'],
    TICK_MS: 100,
    TIEMPOS: {
      LECTURA: 10,
      PULSADORES: 10,
      RESPUESTA: 10,
      INTERACTIVA: 15,
      SUSPENSO: 1.5,
      PAUSA_MENSAJE: 2,
      PAUSA_FIN_RONDA: 4
    },
    PUNTOS: {
      ACIERTO: 1,
      ROBO: 2
    }
  };

})(window.Quiz);
