
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
    if (pregunta.tipo) return Object.assign({}, pregunta);
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

    const reto = Util.mezclar(Quiz.BancoInteractivos)[0];
    Quiz.Estado.preguntasPartida = Util.mezclar(preparadas.slice(0, total - 1).concat([reto]));

    Quiz.Estado.reservaDesempate = preparadas.slice(total - 1);

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
    return pregunta.tipo ? Quiz.Interactivos.validar(pregunta, indiceElegido) : indiceElegido === pregunta.indiceCorrecto;
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
    const interactiva = !!ronda.pregunta.tipo;
    Util.porId('reto').hidden = !interactiva;
    contenedor.hidden = interactiva;
    Util.porId('tema-pregunta').textContent = ronda.pregunta.tema;
    Util.porId('tipo-pregunta').textContent = interactiva ? 'RETO INTERACTIVO · 15 s' : 'ELIGE UNA RESPUESTA';
    Util.porId('question-panel').removeAttribute('data-result');
    if (interactiva) { Quiz.Interactivos.montar(ronda.pregunta); return; }

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
    if (Quiz.Estado.ronda && Quiz.Estado.ronda.pregunta.tipo) { Quiz.Interactivos.habilitar(habilitar); return; }

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
    if (Quiz.Estado.ronda.pregunta.tipo) { Quiz.Interactivos.revelar(); return; }

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
    if (Quiz.Estado.ronda && Quiz.Estado.ronda.pregunta.tipo) { Quiz.Interactivos.reiniciar(); return; }

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

    return p.tipo ? p.explicacion : p.opciones[p.indiceCorrecto];
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
