// Definición de edificios y puntos limpios de entrega en CU2 BUAP
window.CU2_BUILDINGS = [
  {
    id: 'stu',
    code: 'STU',
    name: 'Nodo de Transferencia STU',
    faculty: 'Transporte y Movilidad Universitaria',
    description: 'Paradero oficial de autobuses BUAP (Salidas hacia Puebla / Llegadas). Punto de mayor afluencia en recesos.',
    icon: 'fa-bus',
    topPercent: 47,
    leftPercent: 50,
    safePoints: [
      'Andén Central de Salidas STU',
      'Andén de Llegadas STU (frente a torniquetes)',
      'Plaza cívica frente al nodo'
    ]
  },
  {
    id: 'ema3',
    code: 'EMA 3',
    name: 'EMA 3 - Cómputo 1 (ICC)',
    faculty: 'Ing. en Ciencias de la Computación',
    description: 'Edificio sede de Ciencias de la Computación, Tecnologías de la Información y Software. Laboratorios de cómputo.',
    icon: 'fa-laptop-code',
    topPercent: 59,
    leftPercent: 74,
    safePoints: [
      'Explanada exterior EMA 3 (frente al pasillo central)',
      'Bancas metálicas entre EMA 3 y EMA 4',
      'Lobby planta baja EMA 3'
    ]
  },
  {
    id: 'ema4',
    code: 'EMA 4',
    name: 'EMA 4 - Cómputo 2',
    faculty: 'Ciencias de la Computación / TI',
    description: 'Aulas de programación, redes y sistemas embebidos.',
    icon: 'fa-microchip',
    topPercent: 64,
    leftPercent: 74,
    safePoints: [
      'Jardineras exteriores EMA 4',
      'Pasillo techado nivel 1'
    ]
  },
  {
    id: 'ccs1',
    code: 'CCS 1',
    name: 'CCS 1 - Complejo Salud & Servicios',
    faculty: 'Ciencias de la Salud / Comedor',
    description: 'Servicios comunitarios, cafetería central y áreas de convivencia social.',
    icon: 'fa-utensils',
    topPercent: 43,
    leftPercent: 76,
    safePoints: [
      'Mesas exteriores de convivencia',
      'Rampa de acceso oriente CCS1'
    ]
  },
  {
    id: 'fcq1',
    code: 'FCQ 1',
    name: 'FCQ 1 - Ciencias Químicas',
    faculty: 'Facultad de Ciencias Químicas',
    description: 'Laboratorios de química, bioquímica y áreas de análisis.',
    icon: 'fa-flask',
    topPercent: 34,
    leftPercent: 31,
    safePoints: [
      'Plaza frontal FCQ1',
      'Pasillo divisorio con FCE1'
    ]
  },
  {
    id: 'fce1',
    code: 'FCE 1',
    name: 'FCE 1 - Electrónica y Ciencias',
    faculty: 'Facultad de Ciencias de la Electrónica',
    description: 'Aulas de mecatrónica, telecomunicaciones y física aplicada.',
    icon: 'fa-bolt',
    topPercent: 40,
    leftPercent: 36,
    safePoints: [
      'Bancas frente a FCE1',
      'Andador peatonal central'
    ]
  },
  {
    id: 'ema1_2',
    code: 'EMA 1-2',
    name: 'EMA 1 & EMA 2 - Multiaulas Norte',
    faculty: 'Aulas Multidisciplinarias Norte',
    description: 'Tronco común y materias teóricas generales.',
    icon: 'fa-chalkboard-teacher',
    topPercent: 25,
    leftPercent: 64,
    safePoints: [
      'Plaza norte de acceso peatonal',
      'Corredor verde EMA 1'
    ]
  },
  {
    id: 'ema5_8',
    code: 'EMA 5-8',
    name: 'EMA 5 a EMA 8 - Multiaulas Sur',
    faculty: 'Aulas Multidisciplinarias Sur',
    description: 'Gran complejo de aulas escalonadas del sector sur.',
    icon: 'fa-layer-group',
    topPercent: 74,
    leftPercent: 74,
    safePoints: [
      'Bancas entre EMA 5 y 6',
      'Explanada abierta EMA 7 y 8'
    ]
  },
  {
    id: 'ema9_10',
    code: 'EMA 9-10',
    name: 'EMA 9 & 10 - Multidisciplinario Poniente',
    faculty: 'Áreas de Proyecto y Diseño',
    description: 'Complejo de aulas de diseño, proyectos y talleres grupales.',
    icon: 'fa-cube',
    topPercent: 68,
    leftPercent: 42,
    safePoints: [
      'Jardín interior EMA 9',
      'Acceso poniente frente al circuito'
    ]
  },
  {
    id: 'val_labs',
    code: 'VAL 1-5',
    name: 'VAL 1 a 5 - Talleres y Laboratorios',
    faculty: 'Ingenierías y Ciencias de Materiales',
    description: 'Laboratorios pesados, prototipado y talleres de manufactura.',
    icon: 'fa-cogs',
    topPercent: 20,
    leftPercent: 26,
    safePoints: [
      'Explanada de pruebas VAL',
      'Entrada por acceso vehicular 2'
    ]
  },
  {
    id: 'ing1',
    code: 'ING 1',
    name: 'ING 1 - Edificio Mayor de Ingenierías',
    faculty: 'Ingeniería Civil / Mecánica / Industrial',
    description: 'Auditorio, laboratorios avanzados y posgrados de ingeniería.',
    icon: 'fa-hard-hat',
    topPercent: 94,
    leftPercent: 47,
    safePoints: [
      'Explanada principal ING 1',
      'Andador conmemorativo Lobos'
    ]
  },
  {
    id: 'deportes',
    code: 'DEPORTES',
    name: 'Canchas Deportivas CU2',
    faculty: 'Complejo Deportivo Universitario',
    description: 'Canchas de usos múltiples, vestidores y áreas de acondicionamiento físico.',
    icon: 'fa-basketball-ball',
    topPercent: 92,
    leftPercent: 27,
    safePoints: [
      'Gradas de la cancha central',
      'Bancas de sombra junto a vestidores'
    ]
  }
];
