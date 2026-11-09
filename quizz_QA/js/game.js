/* =====================================================================
 * game.js  —  FLUJO DE LA PARTIDA (el "director de orquesta")
 * Depende de: todos los módulos anteriores.
 * ---------------------------------------------------------------------
 * Este módulo decide QUÉ SIGUE en cada momento: iniciar partida, iniciar
 * ronda, abrir el robo, pasar a la siguiente pregunta, desempatar y
 * terminar. No calcula puntos ni dibuja detalles: delega en los demás.
 *
 * Mapa de una ronda:
 *
 *   iniciarRonda
 *     └─ lectura (10 s) ──► alTerminarLectura ──► pulsadores (10 s)
 *           ├─ nadie pulsa ─► alAgotarseTiempoPulsadores ─► finalizarRonda
 *           └─ alguien pulsa ─► Respuestas.iniciarTurnoRespuesta
 *                 └─► Respuestas informa con alResolverTurno:
 *                       · acierto ──────────────► finalizarRonda
 *                       · fallo y aún sin robo ─► activarPulsadorDeRobo (rival, 10 s)
 *                       · fallo en el robo ─────► finalizarRonda
 *   finalizarRonda ─► (pausa) ─► siguientePregunta ─► iniciarRonda ... o fin
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  const FASES = Quiz.FASES;

  // ---------------------------------------------------------------------
  // INICIO Y REINICIO
  // ---------------------------------------------------------------------

  /** Arranca una partida nueva (se llama después de registrar los nombres). */
  function iniciarPartida() {
    Quiz.Temporizadores.detenerTemporizadores();
    const estado = Quiz.Estado;
    estado.partidaActiva = true;
    estado.enDesempate = false;
    estado.esperandoDesempate = false;
    estado.jugadores.forEach(function (j) { j.puntos = 0; });

    // La selección de las 10 preguntas se hace UNA sola vez, aquí.
    Quiz.Preguntas.seleccionarPreguntasAleatorias();

    Quiz.Jugadores.actualizarPuntuaciones();
    iniciarRonda(estado.preguntasPartida[0]);
  }

  /**
   * Deja TODO como nuevo: temporizadores detenidos, puntos en cero,
   * preguntas usadas olvidadas, selecciones borradas y formulario vacío.
   * Después vuelve a la pantalla de registro.
   */
  function reiniciarPartida() {
    Quiz.Temporizadores.detenerTemporizadores();
    Quiz.reiniciarEstado();                // también invalida cualquier temporizador viejo
    Quiz.Jugadores.limpiarFormulario();
    Quiz.Jugadores.actualizarPuntuaciones();
    Quiz.Pantallas.mostrarRegistroJugadores();
  }

  // ---------------------------------------------------------------------
  // RONDAS
  // ---------------------------------------------------------------------

  /** Texto que se muestra arriba: "Pregunta 3 de 10" o "Pregunta de desempate". */
  function textoDeRonda() {
    if (Quiz.Estado.enDesempate) { return 'Pregunta de desempate'; }
    return 'Pregunta ' + (Quiz.Estado.indiceRonda + 1) + ' de ' + Quiz.Estado.preguntasPartida.length;
  }

  /** Prepara y arranca una ronda con la pregunta recibida. */
  function iniciarRonda(pregunta) {
    // 1) Limpiar todo rastro de la ronda anterior.
    Quiz.Temporizadores.detenerTemporizadores();
    Quiz.Estado.rondaId++;                          // los temporizadores de la ronda anterior quedan inválidos
    Quiz.Estado.ronda = Quiz.crearRonda(pregunta);  // banderas nuevas: sin robo, sin puntos, sin respuesta

    // 2) Dibujar la pregunta (opciones bloqueadas durante la lectura).
    Quiz.Pantallas.mostrarPantallaJuego();
    Quiz.Pantallas.mostrarRonda(textoDeRonda(), Quiz.Estado.enDesempate);
    Quiz.Preguntas.mostrarPregunta(Quiz.Estado.ronda);
    Quiz.Jugadores.actualizarPuntuaciones();
    Quiz.Jugadores.mostrarJugadorActivo(null);
    Quiz.Jugadores.mostrarEstadoTecla(0, 'Tecla bloqueada', 'bloqueada');
    Quiz.Jugadores.mostrarEstadoTecla(1, 'Tecla bloqueada', 'bloqueada');
    Quiz.Pantallas.mostrarMensaje('Lee la pregunta con atención... las teclas se activarán al terminar el tiempo de lectura.', 'info');

    // 3) Comienza el tiempo de lectura (10 s).
    Quiz.Temporizadores.iniciarTemporizadorLectura(alTerminarLectura);
  }

  /** Terminó la lectura: se habilitan las teclas de AMBOS jugadores. */
  function alTerminarLectura() {
    const ronda = Quiz.Estado.ronda;
    if (!ronda || ronda.fase !== FASES.LECTURA) { return; }
    if (Quiz.Estudio) Quiz.Estudio.pulsen();
    const t = Quiz.Estado.jugadores.map(function (j) { return j.tecla.toUpperCase(); });
    Quiz.Pantallas.mostrarMensaje('¡PULSEN! ' + Quiz.Estado.jugadores[0].nombre + ': ' + t[0] +
      '   |   ' + Quiz.Estado.jugadores[1].nombre + ': ' + t[1], 'pulsador');
    Quiz.Pulsadores.activarPulsadores([0, 1]);
  }

  /**
   * Se acabaron los 10 segundos de pulsadores sin que nadie pulsara
   * (en el pulsador normal o en el de robo).
   */
  function alAgotarseTiempoPulsadores() {
    const ronda = Quiz.Estado.ronda;
    if (!ronda || ronda.fase !== FASES.PULSADORES) { return; }

    ronda.fase = FASES.TRANSICION;
    Quiz.Pulsadores.desactivarPulsadores();
    Quiz.Preguntas.mostrarRespuestaCorrecta();
    Quiz.Pantallas.mostrarMensaje(
      (ronda.esRobo ? 'Nadie robó la pregunta.' : 'Nadie presionó a tiempo.') +
      ' La respuesta correcta era: ' + Quiz.Preguntas.textoRespuestaCorrecta(),
      'error'
    );
    finalizarRonda();
  }

  /**
   * answers.js nos avisa aquí cuando un turno de respuesta terminó.
   * `resultado` = { tipo: 'acierto' | 'fallo' | 'tiempo', jugador: índice }
   */
  function alResolverTurno(resultado) {
    const ronda = Quiz.Estado.ronda;
    if (!ronda) { return; }

    // Acierto: la pregunta termina.
    if (resultado.tipo === 'acierto') { finalizarRonda(); return; }

    // Fallo del primer jugador y el robo todavía no se ha usado: se abre el robo
    // después de una pausa para que se alcance a leer el mensaje.
    if (!ronda.esRobo && !ronda.roboUsado) {
      Quiz.Temporizadores.iniciarPausa(Quiz.Config.TIEMPOS.PAUSA_MENSAJE, function () {
        if (Quiz.Estado.ronda !== ronda || ronda.fase !== FASES.TRANSICION) { return; }
        Quiz.Pulsadores.activarPulsadorDeRobo();
      });
      return;
    }

    // Fallo en el robo: ya no hay más oportunidades en esta pregunta.
    finalizarRonda();
  }

  /** Cierra la ronda y, tras una pausa para leer el resultado, pasa a lo siguiente. */
  function finalizarRonda() {
    const ronda = Quiz.Estado.ronda;
    ronda.fase = FASES.TERMINADA;
    Quiz.Temporizadores.detenerTemporizadores();
    Quiz.Pantallas.limpiarTemporizador('Siguiente pregunta en breve...');
    Quiz.Jugadores.mostrarEstadoTecla(0, '', 'bloqueada');
    Quiz.Jugadores.mostrarEstadoTecla(1, '', 'bloqueada');
    Quiz.Temporizadores.iniciarPausa(Quiz.Config.TIEMPOS.PAUSA_FIN_RONDA, siguientePregunta);
  }

  /** Decide si hay otra pregunta, si hay que comprobar empate, o si se acabó. */
  function siguientePregunta() {
    const estado = Quiz.Estado;
    if (!estado.partidaActiva) { return; } // la partida ya terminó o se reinició

    if (estado.enDesempate) { resolverRondaDesempate(); return; }

    estado.indiceRonda++;
    if (estado.indiceRonda < estado.preguntasPartida.length) {
      iniciarRonda(estado.preguntasPartida[estado.indiceRonda]);
    } else {
      verificarEmpate();
    }
  }

  // ---------------------------------------------------------------------
  // FINAL Y DESEMPATE
  // ---------------------------------------------------------------------

  /** Devuelve el índice del jugador con más puntos, o null si hay empate. */
  function calcularGanador() {
    const a = Quiz.Estado.jugadores[0].puntos;
    const b = Quiz.Estado.jugadores[1].puntos;
    if (a > b) { return 0; }
    if (b > a) { return 1; }
    return null;
  }

  /** Terminadas las 10 preguntas: ¿hay ganador o hay empate? */
  function verificarEmpate() {
    if (calcularGanador() === null) {
      iniciarDesempate(false);
    } else {
      finalizarPartida();
    }
  }

  /**
   * Muestra la pantalla de desempate. La pregunta NO empieza sola:
   * se espera a que se presione el botón (ver comenzarRondaDesempate).
   * `repetido` = true cuando la pregunta de desempate anterior no tuvo acierto.
   */
  function iniciarDesempate(repetido) {
    Quiz.Estado.enDesempate = true;
    Quiz.Estado.esperandoDesempate = true;
    Quiz.Pantallas.mostrarDesempate(repetido);
  }

  /** Botón "Comenzar desempate": saca una pregunta de la reserva y la juega. */
  function comenzarRondaDesempate() {
    const estado = Quiz.Estado;
    // Candado: evita que un doble clic arranque dos preguntas.
    if (!estado.partidaActiva || !estado.enDesempate || !estado.esperandoDesempate) { return; }
    estado.esperandoDesempate = false;
    iniciarRonda(Quiz.Preguntas.obtenerPreguntaDesempate());
  }

  /**
   * Terminó una pregunta de desempate:
   *  - si alguien acertó → ese jugador gana (sus puntos ya se sumaron);
   *  - si nadie acertó   → se muestra de nuevo la pantalla de desempate.
   */
  function resolverRondaDesempate() {
    if (Quiz.Estado.ronda.ganadorRonda !== null) {
      finalizarPartida();
    } else {
      iniciarDesempate(true);
    }
  }

  /** Cierra la partida y muestra la pantalla final. */
  function finalizarPartida() {
    const estado = Quiz.Estado;
    Quiz.Temporizadores.detenerTemporizadores();
    estado.partidaActiva = false;               // a partir de aquí se ignoran teclas y clics
    if (estado.ronda) { estado.ronda.fase = FASES.TERMINADA; }

    const ganador = calcularGanador();
    if (ganador === null) { verificarEmpate(); return; } // por seguridad; no debería ocurrir
    Quiz.Pantallas.mostrarPantallaFinal({ ganador: ganador, porDesempate: estado.enDesempate });
  }

  Quiz.Juego = {
    iniciarPartida: iniciarPartida,
    reiniciarPartida: reiniciarPartida,
    iniciarRonda: iniciarRonda,
    alTerminarLectura: alTerminarLectura,
    alAgotarseTiempoPulsadores: alAgotarseTiempoPulsadores,
    alResolverTurno: alResolverTurno,
    finalizarRonda: finalizarRonda,
    siguientePregunta: siguientePregunta,
    verificarEmpate: verificarEmpate,
    iniciarDesempate: iniciarDesempate,
    comenzarRondaDesempate: comenzarRondaDesempate,
    finalizarPartida: finalizarPartida,
    calcularGanador: calcularGanador
  };

})(window.Quiz);
