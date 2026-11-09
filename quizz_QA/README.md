# Duelo de Química · Lobito

Abre `index.html` con doble clic en Chrome, Edge o Firefox. No requiere servidor, instalación ni internet. Conserva las carpetas `js` y `assets` junto al HTML.

## Cómo jugar

1. Lobito da la bienvenida y explica las reglas. Escriban los dos nombres en los atriles.
2. Hay 10 segundos de lectura. En los últimos dos segundos aparece la capa negra al 50 % con «Preparados…» y «Listos…».
3. Cuando desaparece la capa y se muestra «¡PULSEN!», se habilitan A y L durante 10 segundos. Mantener una tecla pulsada no cuenta como una pulsación nueva.
4. El primero en pulsar responde con el ratón: 10 segundos para una opción normal o 15 segundos para el reto interactivo.
5. Un acierto vale 1 punto. Al fallar o agotar el tiempo, el rival puede pulsar su tecla para robar por 2 puntos, con un nuevo turno completo. El reto se limpia para el robo.
6. Cada partida contiene 9 preguntas normales y exactamente 1 reto aleatorio. El desempate usa preguntas normales adicionales.

## Cinco retos

- Tabla periódica: ubicar Au, Na y Cl por grupo y período.
- Higiene: ordenar cinco pasos del lavado de manos. El reto evalúa el orden, no el tiempo real de lavado.
- Material de laboratorio: identificar probeta, matraz Erlenmeyer y vaso de precipitados.
- pH: ordenar 2, 7 y 12 de menor a mayor.
- Agua: colocar dos H y un O en un esquema de conexiones. Las dos H son intercambiables. El dibujo no representa el ángulo molecular real.

Arrastra una ficha a una casilla o selecciona primero la ficha y después su destino. Las fichas y los destinos también funcionan con Tab y Enter/Espacio. Para retirar una ficha, pulsa su casilla. Para intercambiar dos, arrastra una encima de la otra. Puedes reiniciar la colocación durante el turno. Se exige completar todos los espacios antes de confirmar. No se muestran aciertos parciales ni la solución antes de terminar el intento de robo.

## Archivos

- `index.html`: pantallas, estudio, registro y tablero.
- `style.css`: interfaz morada en 2D, botones, atriles, tubos y adaptación móvil.
- `assets/lobito.png`: personaje con fondo transparente.
- `assets/Fredoka.ttf`: tipografía incluida para uso sin internet; licencia OFL en `FONT-LICENSE.txt`.
- `js/bank.js`: las 30 preguntas normales originales, conservadas.
- `js/interactive-bank.js`: contenido y soluciones de los cinco retos.
- `js/interactives.js`: piezas, casillas, arrastre, selección y validación.
- `js/config.js`: tiempos y puntuaciones.
- Los demás módulos conservan la separación original de turnos, temporizadores y estado.

La versión independiente `Duelo_de_Quimica_Jugable.html`, entregada por separado, contiene todos los recursos y funciona sola.

Para pruebas rápidas, abre `index.html?rapido`: lectura de 3 s y turnos de 5 s. Los tiempos normales son 10/10/10 s y 15 s para retos. No uses ese parámetro en la feria.

## Validación

Se verificaron en Chromium el registro y el bloqueo de controles, la cuenta visual, los cinco retos, el arrastre con ratón, el reinicio de piezas, el robo con tablero limpio, el agotamiento del tiempo, el reinicio de partida, una partida completa y el desempate. Se comprobó la selección de exactamente un reto en 500 partidas y el diseño móvil a 390 px sin desbordamiento horizontal. No se detectaron errores de JavaScript durante estas pruebas. No se hizo una prueba física de pantalla táctil.
