/* =====================================================================
 * state.js  —  ESTADO CENTRALIZADO DE LA PARTIDA
 * Depende de: config.js
 * ---------------------------------------------------------------------
 * TODAS las variables que cambian durante el juego viven en `Quiz.Estado`.
 * Ningún otro módulo guarda datos de la partida por su cuenta; así es fácil
 * saber qué está pasando y reiniciar todo limpiamente.
 *
 * Hay dos niveles:
 *   - Estado de la PARTIDA  → Quiz.Estado
 *   - Estado de la RONDA    → Quiz.Estado.ronda (se crea nueva en cada pregunta)
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  /** Construye un estado de partida "en blanco". */
  function crearEstadoInicial() {
    return {
      partidaActiva: false,      // false = no se acepta ninguna tecla ni clic
      enDesempate: false,        // true mientras se juegan preguntas de desempate
      esperandoDesempate: false, // true mientras se muestra la pantalla de desempate
      pantalla: 'inicio',        // pantalla visible actualmente
      rondaId: 0,                // sube en cada ronda: sirve para ignorar temporizadores viejos

      jugadores: [
        { nombre: 'Jugador 1', tecla: Quiz.Config.TECLAS[0], puntos: 0 },
        { nombre: 'Jugador 2', tecla: Quiz.Config.TECLAS[1], puntos: 0 }
      ],

      preguntasPartida: [],      // las 10 preguntas elegidas (se fijan una sola vez)
      reservaDesempate: [],      // las 20 restantes, disponibles para desempate
      indiceRonda: 0,            // posición dentro de preguntasPartida (0 a 9)

      ronda: null                // estado de la pregunta en curso (ver crearRonda)
    };
  }

  /**
   * Crea el estado de UNA ronda (una pregunta).
   * Todos los "candados" (flags) que evitan errores viven aquí:
   *   - roboUsado        → garantiza máximo UN intento de robo por pregunta
   *   - puntosOtorgados  → garantiza que los puntos se sumen una sola vez
   *   - turnoProcesado   → garantiza que una respuesta se evalúe una sola vez
   */
  function crearRonda(pregunta) {
    return {
      pregunta: pregunta,
      fase: Quiz.FASES.LECTURA,
      esRobo: false,            // true cuando se está jugando el intento de robo
      roboUsado: false,
      habilitados: [],          // índices de jugadores cuya tecla está activa ahora
      primerJugador: null,      // quién ganó el pulsador original
      jugadorEnTurno: null,     // quién está respondiendo en este momento
      respuestaElegida: null,   // índice de la opción elegida (o null)
      turnoProcesado: false,
      puntosOtorgados: false,
      ganadorRonda: null        // quién acertó (o null si nadie)
    };
  }

  // El objeto Quiz.Estado NUNCA se reemplaza (otros módulos guardan la
  // referencia); solo se vacía y se vuelve a llenar.
  Quiz.Estado = crearEstadoInicial();
  Quiz.crearRonda = crearRonda;

  /** Deja el estado como nuevo. Se usa al reiniciar la partida. */
  Quiz.reiniciarEstado = function () {
    const siguienteRondaId = Quiz.Estado.rondaId + 1; // invalida callbacks antiguos
    Object.assign(Quiz.Estado, crearEstadoInicial());
    Quiz.Estado.rondaId = siguienteRondaId;
  };

})(window.Quiz);
