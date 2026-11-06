/* =====================================================================
 * buzzers.js  —  PULSADORES VIRTUALES (teclas A y L)
 * Depende de: config.js, state.js, utils.js, players.js, screens.js,
 *             timers.js, questions.js
 * Llama a (en tiempo de ejecución): answers.js → iniciarTurnoRespuesta
 *                                   game.js    → alAgotarseTiempoPulsadores
 * ---------------------------------------------------------------------
 * Decide quién gana el derecho a responder. Se usa dos veces por pregunta
 * como máximo: el pulsador normal (ambas teclas) y el pulsador de robo
 * (solo la tecla del rival).
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  const FASES = Quiz.FASES;

  /**
   * Habilita las teclas de los jugadores indicados y arranca los 10 segundos.
   * `habilitados` es un arreglo de índices, por ejemplo [0, 1] o [1].
   */
  function activarPulsadores(habilitados, etiquetaTemporizador) {
    const ronda = Quiz.Estado.ronda;
    ronda.habilitados = habilitados.slice();
    ronda.fase = FASES.PULSADORES;      // a partir de aquí detectarTeclaPresionada acepta teclas
    ronda.jugadorEnTurno = null;

    [0, 1].forEach(function (i) {
      if (habilitados.indexOf(i) !== -1) {
        Quiz.Jugadores.mostrarEstadoTecla(i, '¡LISTO! (' + Quiz.Estado.jugadores[i].tecla.toUpperCase() + ')', 'lista');
      } else {
        Quiz.Jugadores.mostrarEstadoTecla(i, 'Bloqueada', 'bloqueada');
      }
    });

    Quiz.Temporizadores.iniciarTemporizadorPulsadores(function () {
      Quiz.Juego.alAgotarseTiempoPulsadores();
    }, etiquetaTemporizador);
  }

  /** Cierra los pulsadores: ninguna tecla será aceptada hasta nuevo aviso. */
  function desactivarPulsadores() {
    const ronda = Quiz.Estado.ronda;
    if (!ronda) { return; }
    ronda.habilitados = [];
    [0, 1].forEach(function (i) {
      Quiz.Jugadores.mostrarEstadoTecla(i, 'Bloqueada', 'bloqueada');
    });
  }

  /**
   * Escucha cada tecla del teclado (la conecta script.js a `keydown`).
   * Solo actúa si TODAS estas condiciones se cumplen:
   *   - hay una partida activa y una ronda en curso;
   *   - la ronda está en fase PULSADORES (no durante la lectura, ni después de que alguien pulsó);
   *   - la tecla es A o L (sin Ctrl/Alt/Cmd);
   *   - no es una repetición automática por mantener la tecla apretada;
   *   - la tecla de ese jugador está habilitada (en el robo solo la del rival).
   */
  function detectarTeclaPresionada(evento) {
    if (evento.repeat) { return; }                                   // tecla mantenida: se ignora
    if (evento.ctrlKey || evento.altKey || evento.metaKey) { return; }

    const estado = Quiz.Estado;
    if (!estado.partidaActiva || !estado.ronda) { return; }
    if (estado.ronda.fase !== FASES.PULSADORES) { return; }

    const indice = Quiz.Config.TECLAS.indexOf(String(evento.key).toLowerCase());
    if (indice === -1) { return; }                                   // otra tecla cualquiera
    if (estado.ronda.habilitados.indexOf(indice) === -1) { return; } // tecla no habilitada

    registrarPrimerJugador(indice);
  }

  /**
   * Registra al jugador que pulsó primero y le da el turno.
   *
   * CONTROL DE PULSACIONES SIMULTÁNEAS:
   * JavaScript atiende los eventos de teclado uno por uno, nunca a la vez.
   * Lo primero que hace esta función es cambiar la fase de la ronda; por eso,
   * cuando llega la tecla del otro jugador (aunque sea un milisegundo después)
   * detectarTeclaPresionada ya ve una fase distinta y la descarta.
   * Esta misma función sirve para el robo: ahí "el primero" es el único
   * jugador habilitado.
   */
  function registrarPrimerJugador(indice) {
    const ronda = Quiz.Estado.ronda;
    if (ronda.fase !== FASES.PULSADORES) { return false; } // segunda barrera de seguridad

    // 1) Cerrar la puerta inmediatamente.
    ronda.fase = FASES.TRANSICION;
    ronda.habilitados = [];
    ronda.jugadorEnTurno = indice;
    if (!ronda.esRobo) { ronda.primerJugador = indice; }

    // 2) Detener el temporizador de pulsadores.
    Quiz.Temporizadores.detenerTemporizadores();

    // 3) Avisar en pantalla.
    const nombre = Quiz.Estado.jugadores[indice].nombre.toUpperCase();
    Quiz.Pantallas.mostrarMensaje(
      ronda.esRobo ? '¡' + nombre + ' INTENTA ROBAR LA PREGUNTA!' : '¡' + nombre + ' HA PRESIONADO PRIMERO!',
      'pulsador'
    );
    Quiz.Jugadores.mostrarJugadorActivo(indice);
    Quiz.Jugadores.mostrarEstadoTecla(indice, '¡PULSÓ!', 'activa');
    Quiz.Jugadores.mostrarEstadoTecla(Quiz.Util.rival(indice), 'Esperando', 'bloqueada');

    // 4) Pasar a la selección de respuesta.
    Quiz.Respuestas.iniciarTurnoRespuesta(indice);
    return true;
  }

  /**
   * Abre la oportunidad de robo: solo la tecla del rival queda activa.
   * Devuelve false (y no hace nada) si ya se había usado el robo en esta
   * pregunta → así cada pregunta tiene como máximo UNA oportunidad de robo.
   */
  function activarPulsadorDeRobo() {
    const ronda = Quiz.Estado.ronda;
    if (ronda.roboUsado || ronda.primerJugador === null) { return false; }

    ronda.roboUsado = true;
    ronda.esRobo = true;
    ronda.respuestaElegida = null;

    const ladron = Quiz.Util.rival(ronda.primerJugador);
    const jugador = Quiz.Estado.jugadores[ladron];

    Quiz.Preguntas.limpiarMarcas();
    Quiz.Preguntas.habilitarOpciones(false);
    Quiz.Jugadores.mostrarJugadorActivo(ladron);
    Quiz.Pantallas.mostrarMensaje(
      '¡Oportunidad de robo para ' + jugador.nombre + '! Presiona la tecla ' + jugador.tecla.toUpperCase() + ' (vale 2 puntos)',
      'robo'
    );
    activarPulsadores([ladron], 'Robo: ¡presiona ' + jugador.tecla.toUpperCase() + '!');
    return true;
  }

  Quiz.Pulsadores = {
    activarPulsadores: activarPulsadores,
    desactivarPulsadores: desactivarPulsadores,
    detectarTeclaPresionada: detectarTeclaPresionada,
    registrarPrimerJugador: registrarPrimerJugador,
    activarPulsadorDeRobo: activarPulsadorDeRobo
  };

})(window.Quiz);
