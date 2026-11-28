// ══════════════════════════════════════════════════════════════════════════
// Cultura de Datos Veli · De «Sin Báscula» a «Precisión con Datos»
// ══════════════════════════════════════════════════════════════════════════

import type { VerticalSalon } from '@/lib/flags/verticales';

export const LEMA_CULTURA_DATOS_VELI =
  'Cada dato cuenta. Lo que mides, lo puedes comprender. Lo que comprendes, lo puedes mejorar.';

export interface NivelPrecisionOperativa {
  readonly id: 'nivel_1_sin_bascula' | 'nivel_2_precision_datos';
  readonly etiqueta: string;
  readonly resumen: string;
  readonly requiereHardwarePropietario: false;
  readonly herramientas: readonly string[];
}

export const NIVELES_PRECISION_VELI: readonly NivelPrecisionOperativa[] = [
  {
    id: 'nivel_1_sin_bascula',
    etiqueta: 'Nivel 1 · Sin Báscula (arranque inmediato)',
    resumen:
      'Cotiza y protege tu margen desde el primer día en cazos (30 g), tubos (60 g) y onzas (30 ml) con ajustes rápidos de ±5 g en silla.',
    requiereHardwarePropietario: false,
    herramientas: ['Cazo medidor estándar (30 g)', 'Tubos graduados (60 g)', 'Dosificador en onzas (30 ml)'],
  },
  {
    id: 'nivel_2_precision_datos',
    etiqueta: 'Nivel 2 · Precisión con Datos (opcional, a tu ritmo)',
    resumen:
      'Cuando quieras afinar aún más tus costos y tiempos reales, apóyate en herramientas comunes y económicas. Veli jamás exige básculas Bluetooth propietarias.',
    requiereHardwarePropietario: false,
    herramientas: [
      'Gramera digital común de mesa ($25.000–$45.000 COP)',
      'Cinta métrica flexible en centímetros (cm)',
      'Registro de hora real de inicio, pose y cierre en agenda',
    ],
  },
] as const;

export interface GuiaMedicionVertical {
  readonly vertical: VerticalSalon;
  readonly nombreVertical: string;
  readonly titulo: string;
  readonly queMedir: readonly string[];
  readonly herramientasSimples: readonly string[];
  readonly beneficioNegocio: string;
  readonly notaTecnicaRigor: string;
}

export const GUIA_MEDICION_POR_VERTICAL: Record<VerticalSalon, GuiaMedicionVertical> = {
  hair_studio: {
    vertical: 'hair_studio',
    nombreVertical: 'Estudio Capilar y Colorimetría',
    titulo: 'Pequeñas mediciones que blindan tu barra de color',
    queMedir: [
      'Gramos reales servidos de decolorante, tinte y matizante (incluyendo reaplicaciones).',
      'Largo real en centímetros desde nuca/coronilla y densidad por sección.',
      'Minutos efectivos de montaje frente a minutos de pose aprovechables.',
    ],
    herramientasSimples: [
      'Gramera digital común de cocina/laboratorio (sin Bluetooth costoso)',
      'Cinta métrica flexible en cm',
      'Temporizador de pose por estación',
    ],
    beneficioNegocio:
      'Evita regalar el segundo bowl de decolorante o el matiz en cabellos largos y abundantes, recuperando hasta +8 puntos de margen neto.',
    notaTecnicaRigor:
      'Distingue siempre 3 variables físicas distintas: el largo se mide en cm con cinta métrica; la densidad capilar es la cantidad de hebras por cm² (volumen al seccionar); y el grosor de hebra (fina, media o gruesa) define la resistencia y absorción química.',
  },
  barber_studio: {
    vertical: 'barber_studio',
    nombreVertical: 'Barbería y Grooming',
    titulo: 'Precisión en tiempos de silla y rotación de clientes',
    queMedir: [
      'Minutos reales por corte fade vs. combo completo con ritual de barba.',
      'Ciclo real de retorno de cada cliente (12, 15 o 21 días).',
      'Consumo mensual de cuchillas, cuelleros, gel de afeitado y pigmentos de canas.',
    ],
    herramientasSimples: [
      'Reloj/cronómetro de estación entre turnos',
      'Conteo semanal de cajas de cuchillas y consumibles',
      'Registro de teléfono WhatsApp en cada atención',
    ],
    beneficioNegocio:
      'Detectar 10 minutos muertos por turno libera 1 a 2 citas extra al día por silla sin subir costos fijos.',
    notaTecnicaRigor:
      'Separa siempre los servicios express (15–30 min) de los rituales con vaporozono (60–90 min) para no bloquear huecos rentables en viernes y sábado.',
  },
  nail_bar: {
    vertical: 'nail_bar',
    nombreVertical: 'Uñas, Cejas y Pestañas',
    titulo: 'Control de estructuras por largo, kits monodosis y tiempos de mesa',
    queMedir: [
      'Rendimiento real de cada frasco de monómero, polímero, polygel, base rubber y blíster de pestañas.',
      'Minutos adicionales según largo de estructura (#1–#2 vs. #4+) y nivel de nail art.',
      'Cumplimiento del ciclo de mantenimiento a 18–21 días antes de cobrar set nuevo.',
    ],
    herramientasSimples: [
      'Fecha de apertura escrita en cada envase de gel, adhesivo o polímero',
      'Tabla visual de largos (#1 a #5+) y niveles de decoración en mesa',
      'Higrómetro básico para controlar humedad/temperatura del adhesivo de pestañas',
    ],
    beneficioNegocio:
      'Evita que sets largos o diseños a mano alzada tarden 3 horas cobrándose como set básico y controla el costo real de limas y bolsas de esterilización.',
    notaTecnicaRigor:
      'Verifica siempre que tus geles, bases rubber y esmaltes semipermanentes cuenten con NSOC vigente libre de TPO, DMPT y monómero MMA.',
  },
  spa_estetica: {
    vertical: 'spa_estetica',
    nombreVertical: 'Spa y Centro de Estética',
    titulo: 'Rentabilidad por hora de cabina y adherencia a paquetes',
    queMedir: [
      'Gramos reales de cera por zona corporal y mililitros de ácidos/sueros por protocolo facial.',
      'Tiempo total de cabina incluyendo preparación y desinfección de 10 minutos entre citas.',
      'Porcentaje de sesiones efectivamente asistidas en paquetes corporales o láser.',
    ],
    herramientasSimples: [
      'Gramera digital para pesar perlas de cera por zona (axilas ~18 g vs. piernas ~100 g)',
      'Vasos dosificadores graduados en ml para aceites y gel conductor',
      'Ficha técnica firmada con registro de lote y NSOC/INVIMA de activos',
    ],
    beneficioNegocio:
      'Conocer el costo exacto por minuto de cabina evita vender paquetes con descuentos excesivos que dejan utilidad negativa.',
    notaTecnicaRigor:
      'Mantén separados los protocolos cosméticos/estéticos no invasivos de los procedimientos que exigen habilitación en salud REPS y profesional en RETHUS.',
  },
  beauty_lounge: {
    vertical: 'beauty_lounge',
    nombreVertical: 'Maquillaje, Peinados y Eventos',
    titulo: 'Trazabilidad de kits de alto valor, pruebas y desplazamientos',
    queMedir: [
      'Rendimiento real en aplicaciones de bases HD, fijadores blindados y pares de pestañas.',
      'Minutos reales de preparación de piel + peinado + desplazamientos a domicilio.',
      'Anticipos confirmados para blindar fechas pico de bodas y grados.',
    ],
    herramientasSimples: [
      'Contador de aplicaciones por envase de base/fijador en tu maleta',
      'Separación en agenda de la cita de Prueba (150 min) y la del Evento (180 min)',
      'Tarifario explícito de desplazamiento urbano vs. fuera de ciudad',
    ],
    beneficioNegocio:
      'Impide que el tiempo de transporte o las pruebas previas absorban la ganancia real de los paquetes sociales y nupciales.',
    notaTecnicaRigor:
      'Registra siempre en la ficha del cliente los tonos exactos, tipo de piel y fijación usada durante la prueba para replicarlos con precisión el día del evento.',
  },
};
