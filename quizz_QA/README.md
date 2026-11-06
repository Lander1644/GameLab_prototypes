# Duelo de Química Aplicada

Quiz para dos jugadores (estilo Kahoot) con pulsadores de teclado.
No necesita servidor ni internet: abre `index.html` con doble clic en Chrome, Edge o Firefox.

## Estructura

```
quiz-quimica/
├── index.html        Estructura de las 6 pantallas
├── style.css         Estilos
└── js/               (se cargan en este orden desde index.html)
    ├── config.js     Tiempos, puntos, teclas, fases de la ronda
    ├── utils.js      Auxiliares: mezclar, rival, porId
    ├── bank.js       Banco de 30 preguntas (solo datos)
    ├── state.js      Estado centralizado de partida y ronda
    ├── screens.js    Cambio de pantallas, mensajes, contador visual
    ├── players.js    Registro de nombres y marcador
    ├── questions.js  Selección aleatoria, mezcla de opciones, dibujo y validación
    ├── timers.js     Temporizadores (lectura, pulsadores, respuesta, pausas)
    ├── buzzers.js    Teclas A / L, primer jugador, pulsador de robo
    ├── answers.js    Selección de respuesta, aciertos, fallos y puntos
    ├── game.js       Flujo: partida, rondas, robo, desempate, final, reinicio
    └── script.js     Punto de entrada: conecta botones, teclado y mouse
```

## Cómo se comunican los módulos

`game.js` dirige el flujo. `buzzers.js` y `answers.js` NO deciden qué sigue: avisan a
`game.js` (`alAgotarseTiempoPulsadores`, `alResolverTurno`) y este decide (robo, siguiente
pregunta, desempate). `timers.js` solo cuenta tiempo y llama a la función que se le pasa.
Todo el estado vive en `Quiz.Estado` (`state.js`).

## Personalizar

- **Preguntas:** edita `js/bank.js`. Cada una lleva `id`, `tema`, `enunciado`, `opciones` y
  `respuesta` (el texto exacto de la opción correcta). El orden de las opciones se mezcla solo.
- **Tiempos y puntos:** edita `js/config.js`.
- **Modo prueba:** abre `index.html?rapido` para acortar todos los tiempos.
