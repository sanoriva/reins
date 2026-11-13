/**
 * Datos de partida de Vitalia, todos inventados: ningún paciente, médico ni centro existe. Las fechas se
 * calculan a partir de hoy, para que la demo siempre tenga citas próximas y huecos libres.
 */

export interface Patient {
  id: string;
  name: string;
  birthYear: number;
  cardNumber: string;
  centerId: string;
  doctorId: string;
}

export interface Specialty {
  slug: string;
  name: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  centerId: string;
}

export interface Center {
  id: string;
  name: string;
  kind: 'centro-de-salud' | 'especialidades' | 'hospital';
  address: string;
  town: string;
  phone: string;
  hours: { days: string; open: string }[];
  services: string[];
}

export interface Slot {
  id: string;
  doctorId: string;
  /** Local time, no zone: 2026-11-14T10:30. */
  start: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  start: string;
  reason: string;
  status: 'confirmada' | 'realizada' | 'anulada';
}

export interface Report {
  id: string;
  patientId: string;
  title: string;
  kind: 'consulta' | 'analisis' | 'urgencias' | 'revision';
  date: string;
  doctorId: string;
  summary: string;
  html: string;
  glossary: { term: string; meaning: string }[];
  previous: { date: string; name: string; result: string }[];
}

export interface Prescription {
  id: string;
  patientId: string;
  medicine: string;
  purpose: string;
  dose: string;
  times: string[];
  until: string;
  renewalRequested: boolean;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  tone: 'info' | 'aviso';
}

export interface Episode {
  date: string;
  title: string;
  detail: string;
}

/* ---------- Fechas relativas a hoy ---------- */

const today = new Date();
today.setHours(0, 0, 0, 0);
const day = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d;
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const at = (offset: number, time: string) => `${iso(day(offset))}T${time}`;

/* ---------- Catálogo ---------- */

export const SPECIALTIES: Specialty[] = [
  { slug: 'medicina-de-familia', name: 'Medicina de familia' },
  { slug: 'enfermeria', name: 'Enfermería' },
  { slug: 'cardiologia', name: 'Cardiología' },
  { slug: 'dermatologia', name: 'Dermatología' },
  { slug: 'oftalmologia', name: 'Oftalmología' },
  { slug: 'traumatologia', name: 'Traumatología' },
];

export const CENTERS: Center[] = [
  {
    id: 'rio-tajo',
    name: 'Centro de Salud Río Tajo',
    kind: 'centro-de-salud',
    address: 'Calle del Olmo, 14',
    town: 'Getafe',
    phone: '900 100 214',
    hours: [
      { days: 'Lunes a viernes', open: '8:00 – 21:00' },
      { days: 'Sábados', open: '9:00 – 14:00 (solo urgencias)' },
      { days: 'Domingos y festivos', open: 'Cerrado' },
    ],
    services: ['Medicina de familia', 'Enfermería', 'Pediatría', 'Extracciones de 8:00 a 10:00'],
  },
  {
    id: 'las-moreras',
    name: 'Centro de Salud Las Moreras',
    kind: 'centro-de-salud',
    address: 'Avenida de los Almendros, 3',
    town: 'Leganés',
    phone: '900 100 377',
    hours: [
      { days: 'Lunes a viernes', open: '8:00 – 20:00' },
      { days: 'Sábados, domingos y festivos', open: 'Cerrado' },
    ],
    services: ['Medicina de familia', 'Enfermería', 'Fisioterapia'],
  },
  {
    id: 'especialidades-norte',
    name: 'Centro de Especialidades Vitalia Norte',
    kind: 'especialidades',
    address: 'Paseo de la Ribera, 88',
    town: 'Alcobendas',
    phone: '900 100 512',
    hours: [
      { days: 'Lunes a jueves', open: '8:00 – 20:30' },
      { days: 'Viernes', open: '8:00 – 15:00' },
      { days: 'Fines de semana', open: 'Cerrado' },
    ],
    services: ['Cardiología', 'Dermatología', 'Oftalmología', 'Traumatología', 'Radiología'],
  },
  {
    id: 'hospital-sur',
    name: 'Hospital Vitalia Sur',
    kind: 'hospital',
    address: 'Carretera de la Vega, km 2',
    town: 'Getafe',
    phone: '900 100 900',
    hours: [
      { days: 'Urgencias', open: 'Todos los días, 24 horas' },
      { days: 'Consultas externas', open: 'Lunes a viernes, 8:00 – 15:00' },
    ],
    services: ['Urgencias', 'Cardiología', 'Traumatología', 'Análisis clínicos', 'Hospital de día'],
  },
  {
    id: 'san-isidro',
    name: 'Centro de Salud San Isidro',
    kind: 'centro-de-salud',
    address: 'Plaza del Mercado, 1',
    town: 'Madrid',
    phone: '900 100 640',
    hours: [
      { days: 'Lunes a viernes', open: '8:00 – 21:00' },
      { days: 'Sábados', open: '9:00 – 14:00' },
    ],
    services: ['Medicina de familia', 'Enfermería', 'Matrona', 'Odontología'],
  },
];

export const DOCTORS: Doctor[] = [
  { id: 'ortega', name: 'Dr. Javier Ortega', specialty: 'medicina-de-familia', centerId: 'rio-tajo' },
  { id: 'pardo', name: 'Dra. Lucía Pardo', specialty: 'medicina-de-familia', centerId: 'rio-tajo' },
  { id: 'gil', name: 'Marta Gil, enfermera', specialty: 'enfermeria', centerId: 'rio-tajo' },
  { id: 'molina', name: 'Dr. Andrés Molina', specialty: 'cardiologia', centerId: 'especialidades-norte' },
  { id: 'saez', name: 'Dra. Elena Sáez', specialty: 'dermatologia', centerId: 'especialidades-norte' },
  { id: 'ibarra', name: 'Dra. Sofía Ibarra', specialty: 'oftalmologia', centerId: 'especialidades-norte' },
  { id: 'castro', name: 'Dr. Rubén Castro', specialty: 'traumatologia', centerId: 'hospital-sur' },
];

export const PATIENTS: Patient[] = [
  { id: 'carmen', name: 'Carmen García López', birthYear: 1958, cardNumber: 'VTL 0042 8813', centerId: 'rio-tajo', doctorId: 'ortega' },
  { id: 'antonio', name: 'Antonio Ruiz Navarro', birthYear: 1949, cardNumber: 'VTL 0019 2207', centerId: 'las-moreras', doctorId: 'pardo' },
];

/* ---------- Huecos libres de las próximas dos semanas ---------- */

/** Una regla sencilla y repetible para que unos huecos estén libres y otros no. */
const taken = (doctorIndex: number, dayOffset: number, slotIndex: number) => (doctorIndex * 7 + dayOffset * 3 + slotIndex * 5) % 4 === 0;

export function generateSlots(): Slot[] {
  const morning = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00'];
  const afternoon = ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30'];
  const slots: Slot[] = [];
  DOCTORS.forEach((doctor, d) => {
    for (let offset = 1; offset <= 14; offset++) {
      const weekday = day(offset).getDay();
      if (weekday === 0 || weekday === 6) continue;
      const times = (offset + d) % 2 === 0 ? [...morning, ...afternoon] : morning;
      times.forEach((time, i) => {
        if (!taken(d, offset, i)) slots.push({ id: `${doctor.id}-${iso(day(offset))}-${time.replace(':', '')}`, doctorId: doctor.id, start: at(offset, time) });
      });
    }
  });
  return slots;
}

/* ---------- Lo de Carmen ---------- */

export function generateAppointments(): Appointment[] {
  return [
    { id: 'c-101', patientId: 'carmen', doctorId: 'ortega', start: at(3, '10:30'), reason: 'Revisión de la tensión', status: 'confirmada' },
    { id: 'c-102', patientId: 'carmen', doctorId: 'molina', start: at(9, '12:00'), reason: 'Control del electrocardiograma', status: 'confirmada' },
    { id: 'c-090', patientId: 'carmen', doctorId: 'gil', start: at(-12, '09:00'), reason: 'Análisis de sangre en ayunas', status: 'realizada' },
    { id: 'c-085', patientId: 'carmen', doctorId: 'molina', start: at(-40, '11:30'), reason: 'Primera consulta por palpitaciones', status: 'realizada' },
    { id: 'c-080', patientId: 'carmen', doctorId: 'ibarra', start: at(-75, '17:00'), reason: 'Revisión de la vista', status: 'realizada' },
    { id: 'a-201', patientId: 'antonio', doctorId: 'pardo', start: at(5, '09:30'), reason: 'Renovación de recetas', status: 'confirmada' },
  ];
}

const p = (...paragraphs: string[]) => paragraphs.map((t) => `<p>${t}</p>`).join('\n');

export function generateReports(): Report[] {
  return [
    {
      id: 'cardiologia-palpitaciones',
      patientId: 'carmen',
      title: 'Informe de cardiología: estudio de palpitaciones',
      kind: 'consulta',
      date: iso(day(-40)),
      doctorId: 'molina',
      summary: 'Palpitaciones ocasionales sin arritmia grave. Tensión algo alta: se ajusta el tratamiento.',
      glossary: [
        { term: 'Hipertensión arterial', meaning: 'Tensión de la sangre más alta de lo normal de forma mantenida. Sin tratamiento, cansa al corazón.' },
        { term: 'Electrocardiograma', meaning: 'Prueba sin dolor que registra la actividad eléctrica del corazón con unos electrodos en el pecho.' },
        { term: 'Holter', meaning: 'Aparato pequeño que se lleva puesto 24 horas y graba el ritmo del corazón durante la vida normal.' },
        { term: 'Extrasístole', meaning: 'Latido que llega antes de tiempo. Se nota como un vuelco en el pecho y casi siempre es benigno.' },
        { term: 'Ecocardiograma', meaning: 'Ecografía del corazón: enseña su tamaño, cómo se mueve y cómo funcionan las válvulas.' },
        { term: 'Fracción de eyección', meaning: 'Porcentaje de sangre que el corazón expulsa en cada latido. Lo normal es más del 55 %.' },
        { term: 'Enalapril', meaning: 'Medicamento para bajar la tensión. Relaja las arterias para que la sangre circule con menos presión.' },
        { term: 'Dieta hiposódica', meaning: 'Comer con poca sal, para ayudar a controlar la tensión.' },
      ],
      previous: [
        { date: iso(day(-400)), name: 'Electrocardiograma', result: 'Normal' },
        { date: iso(day(-380)), name: 'Analítica de colesterol', result: 'LDL 162 mg/dl (alto)' },
        { date: iso(day(-300)), name: 'Control de tensión en el centro de salud', result: '148/92 mmHg' },
        { date: iso(day(-210)), name: 'Control de tensión en el centro de salud', result: '142/90 mmHg' },
        { date: iso(day(-120)), name: 'Analítica general', result: 'Glucosa 118 mg/dl' },
        { date: iso(day(-90)), name: 'Control de tensión en el centro de salud', result: '146/91 mmHg' },
        { date: iso(day(-60)), name: 'Electrocardiograma', result: 'Ritmo normal con alguna extrasístole' },
      ],
      html: `
        <h2>Motivo de la consulta</h2>
        ${p(
          'La paciente, de 68 años, acude derivada por su médico de familia por notar <strong>palpitaciones</strong> desde hace unos tres meses. Las describe como «un vuelco en el pecho» que dura unos segundos, sobre todo por la noche y al estar tumbada.',
          'No ha tenido desmayos, dolor en el pecho ni falta de aire. Refiere algo más de cansancio de lo habitual al subir escaleras. Toma desde hace años un tratamiento para la tensión y otro para el azúcar.',
        )}
        <h2>Antecedentes</h2>
        <ul>
          <li><strong>Hipertensión arterial</strong> desde hace ocho años, en tratamiento.</li>
          <li><strong>Diabetes tipo 2</strong> controlada con dieta y metformina.</li>
          <li><strong>Colesterol alto</strong> en tratamiento con atorvastatina.</li>
          <li>No fuma. Bebe un café al día. Camina unos treinta minutos casi todos los días.</li>
        </ul>
        <h2>Exploración</h2>
        ${p(
          'Buen estado general. Tensión arterial en consulta de <strong>146/90 mmHg</strong>, algo por encima de lo deseable. Frecuencia cardiaca de 74 latidos por minuto, rítmica.',
          'La auscultación del corazón y de los pulmones es normal. No hay hinchazón en las piernas.',
        )}
        <h2>Pruebas realizadas</h2>
        ${p(
          'El <strong>electrocardiograma</strong> muestra un ritmo normal, con alguna extrasístole aislada, sin otros hallazgos.',
          'Se colocó un <strong>Holter</strong> de 24 horas. Registra 312 extrasístoles en todo el día, la mayoría por la noche, sin pausas largas ni arritmias peligrosas.',
          'El <strong>ecocardiograma</strong> muestra un corazón de tamaño normal, con buena fuerza de contracción: la fracción de eyección es del 62 %. Las válvulas funcionan bien. Hay un ligero engrosamiento de la pared, propio de la tensión alta mantenida.',
        )}
        <h2>Diagnóstico</h2>
        ${p(
          'Extrasístoles benignas, que explican las palpitaciones. No hay ninguna arritmia grave.',
          'Hipertensión arterial con un control mejorable, que probablemente favorece las extrasístoles y el ligero engrosamiento del corazón.',
        )}
        <h2>Tratamiento y recomendaciones</h2>
        ${p(
          'Se aumenta el <strong>enalapril</strong> a 10 mg, un comprimido por la mañana. Se mantienen la metformina y la atorvastatina como hasta ahora.',
          'Se recomienda una <strong>dieta hiposódica</strong>, es decir, con poca sal; reducir el café de la tarde y seguir caminando a diario.',
          'Conviene tomarse la tensión en casa dos veces por semana, por la mañana, y apuntar los valores para la próxima consulta.',
          'Si nota dolor en el pecho, mareo intenso o palpitaciones que no se pasan en unos minutos, debe acudir a urgencias o llamar al 112.',
        )}
        <h2>Próxima revisión</h2>
        ${p(
          'Nueva consulta en cardiología en unas semanas, con un electrocardiograma de control y los valores de tensión tomados en casa. Su médico de familia revisará la tensión antes, en el centro de salud.',
        )}`,
    },
    {
      id: 'analisis-sangre',
      patientId: 'carmen',
      title: 'Análisis de sangre',
      kind: 'analisis',
      date: iso(day(-12)),
      doctorId: 'gil',
      summary: 'Glucosa y colesterol algo altos; el resto, normal.',
      glossary: [
        { term: 'Glucosa', meaning: 'El azúcar de la sangre. En ayunas, lo normal es menos de 100 mg/dl.' },
        { term: 'Hemoglobina glicosilada', meaning: 'Media del azúcar de los últimos tres meses. En personas con diabetes se busca que esté por debajo del 7 %.' },
        { term: 'Colesterol LDL', meaning: 'El llamado colesterol «malo». Con riesgo cardiovascular conviene que esté por debajo de 100 mg/dl.' },
      ],
      previous: [
        { date: iso(day(-120)), name: 'Analítica general', result: 'Glucosa 118 mg/dl' },
        { date: iso(day(-380)), name: 'Analítica de colesterol', result: 'LDL 162 mg/dl' },
      ],
      html: `
        <h2>Resultados</h2>
        <table>
          <thead><tr><th>Prueba</th><th>Resultado</th><th>Valores normales</th></tr></thead>
          <tbody>
            <tr><td>Glucosa en ayunas</td><td>112 mg/dl</td><td>70 – 100 mg/dl</td></tr>
            <tr><td>Hemoglobina glicosilada</td><td>6,8 %</td><td>menos de 7 % (con diabetes)</td></tr>
            <tr><td>Colesterol total</td><td>198 mg/dl</td><td>menos de 200 mg/dl</td></tr>
            <tr><td>Colesterol LDL</td><td>118 mg/dl</td><td>menos de 100 mg/dl</td></tr>
            <tr><td>Creatinina</td><td>0,9 mg/dl</td><td>0,5 – 1,1 mg/dl</td></tr>
            <tr><td>Potasio</td><td>4,4 mmol/l</td><td>3,5 – 5,1 mmol/l</td></tr>
          </tbody>
        </table>
        <h2>Comentario</h2>
        ${p(
          'La glucosa y la hemoglobina glicosilada están en un rango aceptable para una persona con diabetes. El colesterol LDL ha bajado respecto al último análisis, pero aún está algo por encima del objetivo.',
          'El riñón funciona bien, lo que permite mantener el tratamiento para la tensión sin cambios.',
        )}`,
    },
    {
      id: 'urgencias-esguince',
      patientId: 'carmen',
      title: 'Informe de urgencias: esguince de tobillo',
      kind: 'urgencias',
      date: iso(day(-160)),
      doctorId: 'castro',
      summary: 'Esguince leve de tobillo derecho. Reposo relativo y vendaje.',
      glossary: [
        { term: 'Esguince', meaning: 'Lesión de los ligamentos de una articulación por un giro brusco.' },
        { term: 'Radiografía', meaning: 'Imagen de los huesos con rayos X. Aquí descartó una fractura.' },
      ],
      previous: [],
      html: `
        <h2>Qué pasó</h2>
        ${p('Torcedura del tobillo derecho al bajar un bordillo. Dolor e hinchazón en la parte de fuera del tobillo.')}
        <h2>Pruebas</h2>
        ${p('La <strong>radiografía</strong> no muestra fractura.')}
        <h2>Diagnóstico y tratamiento</h2>
        ${p(
          'Esguince leve. Vendaje compresivo, pierna en alto los primeros días, frío local y paracetamol si hay dolor.',
          'Caminar poco a poco según tolere. Si en una semana no mejora, pedir cita con su médico de familia.',
        )}`,
    },
    {
      id: 'oftalmologia-revision',
      patientId: 'carmen',
      title: 'Revisión de oftalmología',
      kind: 'revision',
      date: iso(day(-75)),
      doctorId: 'ibarra',
      summary: 'Vista estable. Fondo de ojo sin lesiones por la diabetes.',
      glossary: [
        { term: 'Fondo de ojo', meaning: 'Exploración de la parte de atrás del ojo. En la diabetes se mira cada año para detectar lesiones a tiempo.' },
        { term: 'Presbicia', meaning: 'Vista cansada: dificultad para enfocar de cerca con la edad.' },
      ],
      previous: [{ date: iso(day(-440)), name: 'Revisión de oftalmología', result: 'Sin lesiones' }],
      html: `
        <h2>Resultado</h2>
        ${p(
          'La agudeza visual es buena con sus gafas actuales. La <strong>presbicia</strong> no ha cambiado.',
          'El <strong>fondo de ojo</strong> no muestra lesiones por la diabetes. Próxima revisión en un año.',
        )}`,
    },
  ];
}

export function generatePrescriptions(): Prescription[] {
  return [
    { id: 'enalapril', patientId: 'carmen', medicine: 'Enalapril 10 mg', purpose: 'Para la tensión', dose: '1 comprimido', times: ['08:00'], until: iso(day(60)), renewalRequested: false },
    { id: 'metformina', patientId: 'carmen', medicine: 'Metformina 850 mg', purpose: 'Para el azúcar', dose: '1 comprimido con la comida', times: ['09:00', '21:00'], until: iso(day(120)), renewalRequested: false },
    { id: 'atorvastatina', patientId: 'carmen', medicine: 'Atorvastatina 20 mg', purpose: 'Para el colesterol', dose: '1 comprimido', times: ['22:00'], until: iso(day(8)), renewalRequested: false },
    { id: 'paracetamol', patientId: 'carmen', medicine: 'Paracetamol 1 g', purpose: 'Si hay dolor (máximo 3 al día)', dose: '1 comprimido', times: [], until: iso(day(20)), renewalRequested: false },
    { id: 'enalapril-a', patientId: 'antonio', medicine: 'Enalapril 5 mg', purpose: 'Para la tensión', dose: '1 comprimido', times: ['08:00'], until: iso(day(30)), renewalRequested: false },
  ];
}

export const NOTICES: Notice[] = [
  { id: 'gripe', title: 'Campaña de vacunación de la gripe', body: 'Ya puedes vacunarte en tu centro de salud. Pide cita con enfermería.', tone: 'info' },
  { id: 'receta', title: 'Una receta caduca pronto', body: 'Tu tratamiento de atorvastatina termina en 8 días. Puedes pedir la renovación desde Medicación.', tone: 'aviso' },
];

export const HISTORY: Record<string, Episode[]> = {
  carmen: [
    { date: iso(day(-40)), title: 'Extrasístoles benignas', detail: 'Cardiología. Se ajusta el tratamiento de la tensión.' },
    { date: iso(day(-160)), title: 'Esguince leve de tobillo derecho', detail: 'Urgencias del Hospital Vitalia Sur.' },
    { date: iso(day(-900)), title: 'Colesterol alto', detail: 'Inicio de atorvastatina.' },
    { date: iso(day(-1600)), title: 'Diabetes tipo 2', detail: 'Inicio de metformina y dieta.' },
    { date: iso(day(-2900)), title: 'Hipertensión arterial', detail: 'Inicio de tratamiento.' },
    { date: iso(day(-6200)), title: 'Apendicectomía', detail: 'Operación sin complicaciones.' },
  ],
  antonio: [{ date: iso(day(-500)), title: 'Hipertensión arterial', detail: 'Inicio de tratamiento.' }],
};
