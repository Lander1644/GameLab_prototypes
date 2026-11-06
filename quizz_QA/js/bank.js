/* =====================================================================
 * bank.js  —  BANCO DE PREGUNTAS (solo datos, sin lógica)
 * Depende de: nada.
 * ---------------------------------------------------------------------
 * Cada pregunta es un objeto con:
 *   id         → número único
 *   tema       → asignatura o área (solo informativo)
 *   enunciado  → texto de la pregunta
 *   opciones   → arreglo de 3 o 4 textos (todos distintos)
 *   respuesta  → el TEXTO de la opción correcta (debe coincidir exactamente
 *                con una de las opciones)
 *
 * Para agregar o editar preguntas, solo modifica este archivo. El juego
 * se encarga de mezclar el orden de las opciones, así que aquí puedes
 * escribirlas en cualquier orden.
 *
 * Distribución: 30 preguntas (5 Química General, 4 Disoluciones,
 * 4 Inorgánica, 3 Identidad profesional, 3 Matemáticas, 3 Coordinación,
 * 3 Electromagnetismo y Óptica, 2 Física, 3 Cultura científica).
 * ===================================================================== */
(function (Quiz) {
  'use strict';

  Quiz.BancoPreguntas = Object.freeze([
    // ---------- Química General ----------
    {
      id: 1, tema: 'Química General',
      enunciado: '¿Cuál es el símbolo químico del sodio?',
      opciones: ['Na', 'So', 'S', 'Sd'],
      respuesta: 'Na'
    },
    {
      id: 2, tema: 'Química General',
      enunciado: '¿Cuál es el número atómico del carbono?',
      opciones: ['4', '6', '8', '12'],
      respuesta: '6'
    },
    {
      id: 3, tema: 'Química General',
      enunciado: '¿Cuál es el gas más abundante en la atmósfera terrestre?',
      opciones: ['Oxígeno', 'Nitrógeno', 'Dióxido de carbono', 'Argón'],
      respuesta: 'Nitrógeno'
    },
    {
      id: 4, tema: 'Química General',
      enunciado: '¿Cómo se llama el cambio de estado en el que una sustancia pasa directamente de sólido a gas?',
      opciones: ['Fusión', 'Evaporación', 'Sublimación', 'Condensación'],
      respuesta: 'Sublimación'
    },
    {
      id: 5, tema: 'Química General',
      enunciado: '¿Qué tipo de enlace se forma cuando dos átomos no metálicos comparten pares de electrones?',
      opciones: ['Iónico', 'Covalente', 'Metálico', 'Puente de hidrógeno'],
      respuesta: 'Covalente'
    },

    // ---------- Química de Disoluciones ----------
    {
      id: 6, tema: 'Química de Disoluciones',
      enunciado: 'En una disolución, ¿cómo se llama el componente que se encuentra en mayor cantidad?',
      opciones: ['Soluto', 'Disolvente', 'Precipitado', 'Catalizador'],
      respuesta: 'Disolvente'
    },
    {
      id: 7, tema: 'Química de Disoluciones',
      enunciado: '¿Cuál es el pH de una disolución neutra a 25 °C?',
      opciones: ['0', '5', '7', '14'],
      respuesta: '7'
    },
    {
      id: 8, tema: 'Química de Disoluciones',
      enunciado: 'La molaridad (M) de una disolución expresa...',
      opciones: [
        'Los gramos de soluto en 100 g de disolución',
        'Los moles de soluto por litro de disolución',
        'Los moles de soluto por kilogramo de disolvente',
        'El volumen de soluto en 100 mL de disolución'
      ],
      respuesta: 'Los moles de soluto por litro de disolución'
    },
    {
      id: 9, tema: 'Química de Disoluciones',
      enunciado: '¿Cómo se llama la disolución que ya no puede disolver más soluto a una temperatura dada?',
      opciones: ['Diluida', 'Saturada', 'Insaturada', 'Coloidal'],
      respuesta: 'Saturada'
    },

    // ---------- Química Inorgánica ----------
    {
      id: 10, tema: 'Química Inorgánica',
      enunciado: '¿Cuál es la fórmula química del ácido sulfúrico?',
      opciones: ['H₂SO₄', 'HCl', 'HNO₃', 'H₃PO₄'],
      respuesta: 'H₂SO₄'
    },
    {
      id: 11, tema: 'Química Inorgánica',
      enunciado: '¿Cuál es el elemento más electronegativo de la tabla periódica?',
      opciones: ['Oxígeno', 'Cloro', 'Flúor', 'Nitrógeno'],
      respuesta: 'Flúor'
    },
    {
      id: 12, tema: 'Química Inorgánica',
      enunciado: '¿Cómo se conoce a los elementos del grupo 18 de la tabla periódica?',
      opciones: ['Metales alcalinos', 'Halógenos', 'Gases nobles', 'Metales de transición'],
      respuesta: 'Gases nobles'
    },
    {
      id: 13, tema: 'Química Inorgánica',
      enunciado: '¿Cuál es el único metal que se encuentra en estado líquido a temperatura ambiente?',
      opciones: ['Plomo', 'Mercurio', 'Aluminio', 'Cobre'],
      respuesta: 'Mercurio'
    },

    // ---------- Identidad y vinculación profesional ----------
    {
      id: 14, tema: 'Identidad y vinculación profesional',
      enunciado: '¿Qué equipo de protección personal es indispensable para cuidar tus ojos en un laboratorio de química?',
      opciones: ['Lentes de seguridad', 'Guantes de lana', 'Audífonos', 'Gorra'],
      respuesta: 'Lentes de seguridad'
    },
    {
      id: 15, tema: 'Identidad y vinculación profesional',
      enunciado: '¿Qué significan las siglas IUPAC?',
      opciones: [
        'Unión Internacional de Química Pura y Aplicada',
        'Instituto Universal de Productos y Análisis Químicos',
        'Unión Internacional de Procesos Analíticos y Calidad',
        'Instituto Universitario de Plásticos y Aleaciones Comerciales'
      ],
      respuesta: 'Unión Internacional de Química Pura y Aplicada'
    },
    {
      id: 16, tema: 'Identidad y vinculación profesional',
      enunciado: '¿Qué instrumento de vidrio se utiliza para medir un volumen de líquido con alta precisión?',
      opciones: ['Pipeta aforada', 'Vaso de precipitados', 'Matraz Erlenmeyer', 'Embudo de separación'],
      respuesta: 'Pipeta aforada'
    },

    // ---------- Matemáticas y ciencias básicas ----------
    {
      id: 17, tema: 'Matemáticas y ciencias básicas',
      enunciado: '¿Cuál es la derivada de f(x) = x²?',
      opciones: ['x', '2x', 'x²', '2'],
      respuesta: '2x'
    },
    {
      id: 18, tema: 'Matemáticas y ciencias básicas',
      enunciado: '¿Cuál es el valor de log₁₀(1000)?',
      opciones: ['2', '3', '10', '100'],
      respuesta: '3'
    },
    {
      id: 19, tema: 'Matemáticas aplicadas',
      enunciado: '¿Cuál es la media aritmética de los números 2, 4, 6 y 8?',
      opciones: ['4', '5', '6', '20'],
      respuesta: '5'
    },

    // ---------- Química de Coordinación ----------
    {
      id: 20, tema: 'Química de Coordinación',
      enunciado: 'En un compuesto de coordinación, ¿cómo se llaman las moléculas o iones que se unen al ion metálico central?',
      opciones: ['Ligantes', 'Isótopos', 'Radicales', 'Monómeros'],
      respuesta: 'Ligantes'
    },
    {
      id: 21, tema: 'Química de Coordinación',
      enunciado: '¿Cuál es el número de coordinación del cobre en el complejo [Cu(NH₃)₄]²⁺?',
      opciones: ['2', '4', '6', '8'],
      respuesta: '4'
    },
    {
      id: 22, tema: 'Química de Coordinación',
      enunciado: 'La etilendiamina se une al metal mediante dos átomos de nitrógeno. ¿Cómo se clasifica este ligante?',
      opciones: ['Monodentado', 'Bidentado', 'Tridentado', 'Hexadentado'],
      respuesta: 'Bidentado'
    },

    // ---------- Electromagnetismo y Óptica ----------
    {
      id: 23, tema: 'Electromagnetismo y Óptica',
      enunciado: '¿Qué ley relaciona el voltaje, la corriente y la resistencia en un circuito eléctrico?',
      opciones: ['Ley de Ohm', 'Ley de Boyle', 'Ley de Hooke', 'Ley de Charles'],
      respuesta: 'Ley de Ohm'
    },
    {
      id: 24, tema: 'Electromagnetismo y Óptica',
      enunciado: '¿Cómo se llama el fenómeno por el cual la luz cambia de dirección al pasar de un medio a otro, por ejemplo del aire al agua?',
      opciones: ['Refracción', 'Reflexión', 'Difracción', 'Absorción'],
      respuesta: 'Refracción'
    },
    {
      id: 25, tema: 'Electromagnetismo y Óptica',
      enunciado: '¿Cuál es, aproximadamente, la velocidad de la luz en el vacío?',
      opciones: ['300 000 km/s', '340 m/s', '30 000 km/s', '3 000 km/h'],
      respuesta: '300 000 km/s'
    },

    // ---------- Física ----------
    {
      id: 26, tema: 'Física',
      enunciado: '¿Cuál es la unidad de fuerza en el Sistema Internacional de Unidades?',
      opciones: ['Joule', 'Newton', 'Watt', 'Pascal'],
      respuesta: 'Newton'
    },
    {
      id: 27, tema: 'Física',
      enunciado: '¿Cómo se llama la energía que posee un cuerpo debido a su movimiento?',
      opciones: ['Cinética', 'Potencial', 'Química', 'Nuclear'],
      respuesta: 'Cinética'
    },

    // ---------- Cultura científica ----------
    {
      id: 28, tema: 'Cultura científica',
      enunciado: '¿Quién propuso en 1869 una tabla periódica que ordenaba los elementos por su masa atómica y dejaba espacios para elementos aún no descubiertos?',
      opciones: ['Dmitri Mendeléyev', 'John Dalton', 'Antoine Lavoisier', 'Niels Bohr'],
      respuesta: 'Dmitri Mendeléyev'
    },
    {
      id: 29, tema: 'Cultura científica',
      enunciado: '¿Qué científica ganó un Premio Nobel de Física y otro de Química?',
      opciones: ['Marie Curie', 'Rosalind Franklin', 'Lise Meitner', 'Dorothy Hodgkin'],
      respuesta: 'Marie Curie'
    },
    {
      id: 30, tema: 'Cultura científica',
      enunciado: '¿Qué científico mexicano compartió el Premio Nobel de Química de 1995 por sus estudios sobre la capa de ozono?',
      opciones: ['Mario Molina', 'Luis E. Miramontes', 'Manuel Sandoval Vallarta', 'Arturo Rosenblueth'],
      respuesta: 'Mario Molina'
    }
  ]);

})(window.Quiz);
