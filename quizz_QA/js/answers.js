/* =====================================================================
 * answers.js  —  MECÁNICA DE RESPUESTAS Y PUNTOS
 * Depende de: config.js, state.js, utils.js, players.js, screens.js,
 *             timers.js, questions.js
 * Llama a (en tiempo de ejecución): game.js → alResolverTurno
 * ---------------------------------------------------------------------
 * Gestiona el "turno de respuesta" de un jugador (ya sea el que ganó el
 * pulsador o el que roba):
 *     iniciarTurnoRespuesta → seleccionarRespuesta → (suspenso) →
 *     procesarRespuesta → procesarRespuestaCorrecta / ...Incorrecta
 *
 * Este módulo NO decide qué pasa después (robo, siguiente pregunta...):
 * solo informa el resultado a game.js con `alResolverTurno`.
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  const FASES = Quiz.FASES;

  /** Nombre del jugador en turno (atajo para los mensajes). */
  function nombreDe(indice) {
    return Quiz.Estado.jugadores[indice].nombre;
  }

  /** Abre las opciones para el jugador que ganó el pulsador (o el robo) y arranca sus 10 segundos. */
  function iniciarTurnoRespuesta(indiceJugador) {
    const ronda = Quiz.Estado.ronda;
    ronda.fase = FASES.RESPUESTA;
    ronda.jugadorEnTurno = indiceJugador;
    ronda.respuestaElegida = null;
    ronda.turnoProcesado = false;     // este turno todavía no se ha evaluado

    Quiz.Preguntas.habilitarOpciones(true);
    Quiz.Temporizadores.iniciarTemporizadorRespuesta(
      alAgotarseTiempoRespuesta,
      'Responde ' + nombreDe(indiceJugador)
    );
  }

  /**
   * El jugador hizo clic en una opción.
   * Solo cuenta si estamos en fase RESPUESTA y todavía no se eligió nada:
   * así un segundo clic (o un clic fuera de turno) no hace nada.
   */
  function seleccionarRespuesta(indiceOpcion) {
    const ronda = Quiz.Estado.ronda;
    if (!Quiz.Estado.partidaActiva || !ronda) { return; }
    if (ronda.fase !== FASES.RESPUESTA) { return; }
    if (ronda.respuestaElegida !== null) { return; }
    if (indiceOpcion < 0 || indiceOpcion >= ronda.pregunta.opciones.length) { return; }

    ronda.respuestaElegida = indiceOpcion;
    ronda.fase = FASES.SUSPENSO;                       // cierra la puerta a más clics
    Quiz.Temporizadores.detenerTemporizadores();       // se detiene el reloj de respuesta

    Quiz.Preguntas.habilitarOpciones(false);           // se bloquean las demás opciones
    Quiz.Preguntas.marcarSeleccion(indiceOpcion);
    Quiz.Pantallas.limpiarTemporizador('Revisando respuesta...');
    Quiz.Pantallas.mostrarMensaje('La respuesta correcta es...', 'suspenso');

    // Suspenso: tras unos segundos se revela el resultado.
    Quiz.Temporizadores.iniciarPausa(Quiz.Config.TIEMPOS.SUSPENSO, procesarRespuesta);
  }

  /** Se acabaron los 10 segundos sin elegir opción: cuenta como respuesta incorrecta. */
  function alAgotarseTiempoRespuesta() {
    const ronda = Quiz.Estado.ronda;
    if (!ronda || ronda.fase !== FASES.RESPUESTA) { return; }
    if (ronda.turnoProcesado) { return; }
    ronda.turnoProcesado = true;
    procesarRespuestaIncorrecta(true);
  }

  /**
   * Evalúa la opción elegida. `turnoProcesado` garantiza que un mismo
   * turno se evalúe UNA sola vez (y por tanto que los puntos no se sumen dos veces).
   */
  function procesarRespuesta() {
    const ronda = Quiz.Estado.ronda;
    if (!Quiz.Estado.partidaActiva || !ronda) { return; }
    if (ronda.fase !== FASES.SUSPENSO || ronda.turnoProcesado) { return; }
    ronda.turnoProcesado = true;
    ronda.fase = FASES.TRANSICION;

    if (Quiz.Preguntas.validarRespuesta(ronda.pregunta, ronda.respuestaElegida)) {
      procesarRespuestaCorrecta();
    } else {
      procesarRespuestaIncorrecta(false);
    }
  }

  /** Acierto: +1 punto (turno normal) o +2 (robo). */
  function procesarRespuestaCorrecta() {
    const ronda = Quiz.Estado.ronda;
    const jugador = ronda.jugadorEnTurno;
    const puntos = ronda.esRobo ? Quiz.Config.PUNTOS.ROBO : Quiz.Config.PUNTOS.ACIERTO;

    otorgarPuntos(jugador, puntos);
    ronda.ganadorRonda = jugador;

    Quiz.Jugadores.actualizarPuntuaciones();
    Quiz.Preguntas.mostrarRespuestaCorrecta();
    Quiz.Pantallas.mostrarMensaje(
      ronda.esRobo
        ? '¡' + nombreDe(jugador).toUpperCase() + ' ROBÓ LA PREGUNTA! +' + puntos + ' puntos'
        : '¡Correcto, ' + nombreDe(jugador) + '! +' + puntos + ' punto',
      ronda.esRobo ? 'robo' : 'exito'
    );

    Quiz.Juego.alResolverTurno({ tipo: 'acierto', jugador: jugador });
  }

  /**
   * Fallo (opción equivocada) o tiempo agotado.
   * - Turno normal: NO se revela la respuesta, porque el rival todavía puede robar.
   * - Turno de robo: se revela la respuesta, y la pregunta termina.
   */
  function procesarRespuestaIncorrecta(tiempoAgotado) {
    const ronda = Quiz.Estado.ronda;
    const jugador = ronda.jugadorEnTurno;
    ronda.fase = FASES.TRANSICION;
    Quiz.Preguntas.habilitarOpciones(false);
    Quiz.Pantallas.limpiarTemporizador('');

    if (!tiempoAgotado) { Quiz.Preguntas.marcarIncorrecta(ronda.respuestaElegida); }

    const causa = tiempoAgotado ? '¡Se acabó el tiempo, ' + nombreDe(jugador) + '!' : 'Respuesta incorrecta, ' + nombreDe(jugador) + '.';

    if (ronda.esRobo) {
      Quiz.Preguntas.mostrarRespuestaCorrecta();
      Quiz.Pantallas.mostrarMensaje(causa + ' La respuesta correcta era: ' + Quiz.Preguntas.textoRespuestaCorrecta(), 'error');
    } else {
      Quiz.Pantallas.mostrarMensaje(causa + ' ' + nombreDe(Quiz.Util.rival(jugador)) + ' tendrá oportunidad de robar.', 'error');
    }

    Quiz.Juego.alResolverTurno({ tipo: tiempoAgotado ? 'tiempo' : 'fallo', jugador: jugador });
  }

  /**
   * Suma puntos a un jugador. SOLO modifica datos (no toca la pantalla).
   * `puntosOtorgados` impide sumar más de una vez por pregunta.
   */
  function otorgarPuntos(indiceJugador, puntos) {
    const ronda = Quiz.Estado.ronda;
    if (ronda.puntosOtorgados) { return false; }
    ronda.puntosOtorgados = true;
    Quiz.Estado.jugadores[indiceJugador].puntos += puntos;
    return true;
  }

  Quiz.Respuestas = {
    iniciarTurnoRespuesta: iniciarTurnoRespuesta,
    seleccionarRespuesta: seleccionarRespuesta,
    procesarRespuesta: procesarRespuesta,
    procesarRespuestaCorrecta: procesarRespuestaCorrecta,
    procesarRespuestaIncorrecta: procesarRespuestaIncorrecta,
    otorgarPuntos: otorgarPuntos
  };

})(window.Quiz);
