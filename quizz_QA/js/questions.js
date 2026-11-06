
/* =====================================================================
 * questions.js — LÓGICA DE PREGUNTAS
 * Depende de: config.js, utils.js, bank.js, state.js
 * ===================================================================== */

(function (Quiz) {
  'use strict';

  const Util = Quiz.Util;

  // Incisos visuales de las respuestas.
  const SIMBOLOS = ['A', 'B', 'C', 'D'];


  // ---------------------------------------------------------------------
  // SELECCIÓN ALEATORIA
  // ---------------------------------------------------------------------

  function mezclarOpciones(pregunta) {
    const opciones = Util.mezclar(pregunta.opciones);

    return {
      id: pregunta.id,
      tema: pregunta.tema,
      enunciado: pregunta.enunciado,
      opciones: opciones,
      indiceCorrecto: opciones.indexOf(pregunta.respuesta)
    };
  }


  function seleccionarPreguntasAleatorias() {
    const total = Quiz.Config.PREGUNTAS_POR_PARTIDA;

    const preparadas = Util.mezclar(Quiz.BancoPreguntas)
      .map(mezclarOpciones);

    Quiz.Estado.preguntasPartida = preparadas.slice(0, total);

    Quiz.Estado.reservaDesempate = preparadas.slice(total);

    Quiz.Estado.indiceRonda = 0;
  }


  function obtenerPreguntaDesempate() {
    const estado = Quiz.Estado;

    if (estado.reservaDesempate.length === 0) {

      const ultimaId = estado.ronda
        ? estado.ronda.pregunta.id
        : null;

      estado.reservaDesempate = Util.mezclar(Quiz.BancoPreguntas)
        .filter(function (p) {
          return p.id !== ultimaId;
        })
        .map(mezclarOpciones);
    }

    return estado.reservaDesempate.shift();
  }


  // ---------------------------------------------------------------------
  // VALIDACIÓN
  // ---------------------------------------------------------------------

  function validarRespuesta(pregunta, indiceElegido) {
    return indiceElegido === pregunta.indiceCorrecto;
  }


  // ---------------------------------------------------------------------
  // VISTA DE LA PREGUNTA
  // ---------------------------------------------------------------------

  function obtenerBotonesOpciones() {
    return Array.prototype.slice.call(
      document.querySelectorAll('#opciones .opcion')
    );
  }


  function mostrarPregunta(ronda) {

    const contenedor = Util.porId('opciones');

    Util.porId('enunciado').textContent =
      ronda.pregunta.enunciado;

    contenedor.innerHTML = '';

    ronda.pregunta.opciones.forEach(function (texto, i) {

      const boton = document.createElement('button');

      boton.type = 'button';
      boton.className = 'opcion opcion-' + i + ' bloqueada';
      boton.dataset.indice = String(i);
      boton.disabled = true;


      // Inciso A, B, C o D
      const simbolo = document.createElement('span');

      simbolo.className = 'simbolo';
      simbolo.textContent = SIMBOLOS[i] || '';


      // Texto de la respuesta
      const etiqueta = document.createElement('span');

      etiqueta.className = 'texto-opcion';
      etiqueta.textContent = texto;


      boton.appendChild(simbolo);
      boton.appendChild(etiqueta);

      contenedor.appendChild(boton);

    });
  }


  // ---------------------------------------------------------------------
  // ACTIVAR O BLOQUEAR OPCIONES
  // ---------------------------------------------------------------------

  function habilitarOpciones(habilitar) {

    obtenerBotonesOpciones().forEach(function (boton) {

      boton.disabled = !habilitar;

      boton.classList.toggle('bloqueada', !habilitar);

      boton.classList.toggle('habilitada', habilitar);

    });
  }


  // ---------------------------------------------------------------------
  // SELECCIÓN DE RESPUESTAS
  // ---------------------------------------------------------------------

  function marcarSeleccion(indice) {

    const boton = obtenerBotonesOpciones()[indice];

    if (boton) {
      boton.classList.add('seleccionada');
    }
  }


  function marcarIncorrecta(indice) {

    const boton = obtenerBotonesOpciones()[indice];

    if (boton) {
      boton.classList.remove('seleccionada');
      boton.classList.add('incorrecta');
    }
  }


  // ---------------------------------------------------------------------
  // MOSTRAR RESPUESTA CORRECTA
  // ---------------------------------------------------------------------

  function mostrarRespuestaCorrecta() {

    const correcta = Quiz.Estado.ronda.pregunta.indiceCorrecto;

    obtenerBotonesOpciones().forEach(function (boton, i) {

      boton.classList.remove('seleccionada');

      if (i === correcta) {
        boton.classList.add('correcta');
      } else if (!boton.classList.contains('incorrecta')) {
        boton.classList.add('descartada');
      }

    });
  }


  // ---------------------------------------------------------------------
  // LIMPIAR MARCAS
  // ---------------------------------------------------------------------

  function limpiarMarcas() {

    obtenerBotonesOpciones().forEach(function (boton) {

      boton.classList.remove(
        'seleccionada',
        'incorrecta',
        'correcta',
        'descartada'
      );

    });
  }


  // ---------------------------------------------------------------------
  // TEXTO DE LA RESPUESTA CORRECTA
  // ---------------------------------------------------------------------

  function textoRespuestaCorrecta() {

    const p = Quiz.Estado.ronda.pregunta;

    return p.opciones[p.indiceCorrecto];
  }


  // ---------------------------------------------------------------------
  // EXPORTAR FUNCIONES
  // ---------------------------------------------------------------------

  Quiz.Preguntas = {

    seleccionarPreguntasAleatorias: seleccionarPreguntasAleatorias,

    obtenerPreguntaDesempate: obtenerPreguntaDesempate,

    mezclarOpciones: mezclarOpciones,

    mostrarPregunta: mostrarPregunta,

    validarRespuesta: validarRespuesta,

    habilitarOpciones: habilitarOpciones,

    marcarSeleccion: marcarSeleccion,

    marcarIncorrecta: marcarIncorrecta,

    mostrarRespuestaCorrecta: mostrarRespuestaCorrecta,

    limpiarMarcas: limpiarMarcas,

    textoRespuestaCorrecta: textoRespuestaCorrecta

  };

})(window.Quiz);
