/* =====================================================================
 * script.js  —  PUNTO DE ENTRADA (se carga al final)
 * Depende de: todos los módulos.
 * ---------------------------------------------------------------------
 * Aquí se CONECTAN los botones, el teclado y el ratón con los módulos.
 * No contiene reglas del juego.
 *
 * Modo demostración: abre index.html?rapido para acortar los tiempos
 * (útil para probar sin esperar). Sin ese parámetro se usan los tiempos
 * oficiales de config.js.
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  var MODULOS_REQUERIDOS = [
    'Config', 'FASES', 'Util', 'BancoPreguntas', 'Estado', 'Pantallas',
    'Jugadores', 'Preguntas', 'Temporizadores', 'Pulsadores', 'Respuestas', 'Juego'
  ];

  /** Verifica que todos los archivos .js se hayan cargado; si falta alguno, avisa claramente. */
  function verificarModulos() {
    var faltantes = MODULOS_REQUERIDOS.filter(function (nombre) { return !Quiz[nombre]; });
    if (faltantes.length > 0) {
      document.body.innerHTML =
        '<p style="padding:2rem;font:1.2rem sans-serif;color:#fff">Error de carga: faltan los módulos ' +
        faltantes.join(', ') + '. Revisa que todos los archivos de la carpeta js/ existan.</p>';
      return false;
    }
    return true;
  }

  /** Acorta los tiempos si la URL trae ?rapido (solo para pruebas). */
  function aplicarModoRapido() {
    if (!/[?&]rapido\b/.test(window.location.search)) { return; }
    var T = Quiz.Config.TIEMPOS;
    T.LECTURA = 3; T.PULSADORES = 5; T.RESPUESTA = 5;
    T.INTERACTIVA = 5;
    T.SUSPENSO = 1; T.PAUSA_MENSAJE = 1.5; T.PAUSA_FIN_RONDA = 2;
  }

  /** Enlaza un botón (por id) con una función. */
  function alClic(id, funcion) {
    Quiz.Util.porId(id).addEventListener('click', funcion);
  }

  function conectarBotones() {
    alClic('btn-comenzar', Quiz.Pantallas.mostrarInstrucciones);
    alClic('btn-instrucciones-volver', Quiz.Pantallas.mostrarPantallaInicial);
    alClic('btn-instrucciones-continuar', Quiz.Pantallas.mostrarRegistroJugadores);
    alClic('btn-registro-volver', Quiz.Pantallas.mostrarInstrucciones);
    alClic('btn-iniciar-desempate', Quiz.Juego.comenzarRondaDesempate);
    alClic('btn-jugar-de-nuevo', Quiz.Juego.reiniciarPartida);

    // Botón pequeño para cancelar una partida en curso (por si los jugadores se van).
    alClic('btn-cancelar-partida', function () {
      if (window.confirm('¿Cancelar la partida y volver al registro de jugadores?')) {
        Quiz.Juego.reiniciarPartida();
      }
    });
  }

  function conectarRegistro() {
    Quiz.Util.porId('form-registro').addEventListener('submit', function (evento) {
      evento.preventDefault();
      var resultado = Quiz.Jugadores.registrarJugadores(
        Quiz.Util.porId('nombre-jugador-1').value,
        Quiz.Util.porId('nombre-jugador-2').value
      );
      if (!resultado.ok) {
        Quiz.Pantallas.mostrarErrorRegistro(resultado.error);
        return;
      }
      Quiz.Pantallas.mostrarErrorRegistro('');
      document.activeElement.blur();
      Quiz.Juego.iniciarPartida();
    });
  }

  function conectarTeclado() {
    // Un solo "oyente" para todo el juego. Si el foco está en un campo de texto
    // (pantalla de registro) se ignora para poder escribir nombres con A y L.
    document.addEventListener('keydown', function (evento) {
      var destino = evento.target;
      if (destino && (destino.tagName === 'INPUT' || destino.tagName === 'TEXTAREA')) { return; }
      Quiz.Pulsadores.detectarTeclaPresionada(evento);
    });
  }

  function conectarOpciones() {
    // Delegación de eventos: un solo oyente en el contenedor sirve para las 3-4 opciones,
    // aunque se vuelvan a crear en cada pregunta.
    Quiz.Util.porId('opciones').addEventListener('click', function (evento) {
      var boton = evento.target.closest('.opcion');
      if (!boton || boton.disabled) { return; }
      Quiz.Respuestas.seleccionarRespuesta(Number(boton.dataset.indice));
    });
  }

  function iniciar() {
    if (!verificarModulos()) { return; }
    aplicarModoRapido();
    Quiz.Temporizadores.conectarVista(Quiz.Pantallas.mostrarTemporizador);
    conectarBotones();
    conectarRegistro();
    conectarTeclado();
    conectarOpciones();
    Quiz.Jugadores.actualizarPuntuaciones();
    Quiz.Pantallas.mostrarPantallaInicial();
  }

  document.addEventListener('DOMContentLoaded', iniciar);

})(window.Quiz);
