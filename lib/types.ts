export interface Clienta {
  id: string;
  nombre: string;
  edad: number;
  telefono: string;
  email?: string;
  fechaRegistro: string;
  alergias?: string;
  condicionesMedicas?: string;
  medicamentos?: string;
  embarazo: boolean;
  nivelEstres: 'bajo' | 'medio' | 'alto';
  tipoRizoPrincipal?: string;
  ultimaVisita?: string;
  totalVisitas: number;
}

export interface ProductosActuales {
  shampoo?: string;
  acondicionador?: string;
  mascarilla?: string;
  leaveIn?: string;
  gel?: string;
  aceites?: string;
}

export interface CronogramaResult {
  semana1: string;
  semana2: string;
  semana3: string;
  semana4: string;
}

export interface CuidadoCasaResult {
  diaLavado: string[];
  nocturno: string[];
  refresh: string[];
  evitar: string[];
}

export interface ResultadoConsulta {
  tratamientoPrincipal: string;
  tratamientosAdicionales: string[];
  cronograma: CronogramaResult;
  tecnicaDefinicion: string;
  tecnicaDescripcion: string;
  metodoSecado: string;
  productosPonto: string[];
  cuidadoCasa: CuidadoCasaResult;
  intervaloSugerido: string;
  notasAdicionales: string[];
}

export interface Consulta {
  id: string;
  clientaId: string;
  fecha: string;
  numeroConsulta: number;

  // Paso 1: Historial
  quimicos: string[];
  ultimoQuimico?: string;
  usoCalor: string[];
  frecuenciaCalor: string;
  usaProtectorTermico: boolean;
  frecuenciaLavado: string;
  metodoLavado: string;
  productosActuales: ProductosActuales;
  problemas: string[];
  otroProblema?: string;

  // Paso 2: Tipo de rizo
  tipoRizoPrincipal: string;
  tiposSecundarios?: string[];
  zonasCambio?: string;

  // Paso 3: Diagnóstico técnico (opcionales en modo express)
  porosidad?: 'baja' | 'media' | 'alta';
  porosidadObs?: string;
  densidad?: 'baja' | 'media' | 'alta';
  grosor?: 'fino' | 'medio' | 'grueso';
  elasticidad?: 'baja' | 'media' | 'alta';
  balanceHP?: 'hidratacion' | 'nutricion' | 'proteina' | 'equilibrado';

  // Paso 4: Cuero cabelludo y daño (opcionales en borrador)
  estadoCueroCabelludo: string[];
  obsCueroCabelludo?: string;
  estadoPuntas?: string;
  tipoDano: string[];
  lineaDemarcacion?: string;

  // Paso 5: Salud
  alergias?: string;
  condicionesMedicas?: string;
  medicamentos?: string;
  embarazo: boolean;
  nivelEstres: string;

  // Resultado
  resultado: ResultadoConsulta;

  // Post-consulta
  satisfaccion?: 'muy_satisfecha' | 'satisfecha' | 'parcial' | 'necesita_ajustes';
  notasEstilista?: string;
  proximaCita?: string;

  // Metadata de captura estandarizada
  captureMetadata?: CaptureMetadata;

  // Modo borrador (diagnóstico express sin detalles opcionales)
  esBorrador?: boolean;
}

export type TipoRizo = '1A' | '1B' | '1C' | '2A' | '2B' | '2C' | '3A' | '3B' | '3C' | '4A' | '4B' | '4C';

// ── Captura estandarizada ──────────────────────────────────────────────────

export type EstadoCabelloFoto = 'seco_natural' | 'humedo' | 'con_producto' | 'recien_lavado';
export type AnguloCaptura = 'frontal' | 'lateral' | 'corona';

export interface CaptureMetadata {
  estadoCabello: EstadoCabelloFoto;
  qualityScore: number;
  qualityDesglose: {
    luz: number;
    distancia: number;
    enfoque: number;
    angulos: number;
  };
  fotos: Array<{
    angulo: AnguloCaptura;
    timestamp: string;
    luminanciaPromedio: number;
    sharpnessScore: number;
    faceRatio: number;
    resolucion: { width: number; height: number };
    formato: 'webp' | 'jpeg';
    flashActivo: boolean;
    orientacion: 'portrait' | 'landscape';
  }>;
  dispositivo: {
    userAgent: string;
    platform: string;
    screenWidth: number;
    screenHeight: number;
  };
  ubicacion?: {
    ciudad?: string;
    pais?: string;
    latApprox?: number;
    lonApprox?: number;
  };
}

export interface WizardData {
  // Paso 0
  clientaId?: string;
  nombre: string;
  edad: string;
  telefono: string;
  email: string;

  // Paso 1
  quimicos: string[];
  ultimoQuimico: string;
  usoCalor: string[];
  frecuenciaCalor: string;
  usaProtectorTermico: boolean;
  frecuenciaLavado: string;
  metodoLavado: string;
  productosActuales: ProductosActuales;
  problemas: string[];
  otroProblema: string;

  // Paso 2
  tipoRizoPrincipal: string;
  tiposSecundarios: string[];
  zonasCambio: string;
  captureMetadata?: CaptureMetadata;

  // Paso 3
  porosidad: string;
  porosidadObs: string;
  densidad: string;
  grosor: string;
  elasticidad: string;
  balanceHP: string;

  // Paso 4
  estadoCueroCabelludo: string[];
  obsCueroCabelludo: string;
  estadoPuntas: string;
  tipoDano: string[];
  lineaDemarcacion: string;

  // Paso 5
  alergias: string;
  condicionesMedicas: string;
  medicamentos: string;
  embarazo: boolean;
  nivelEstres: string;
}

export const WIZARD_INITIAL_DATA: WizardData = {
  nombre: '',
  edad: '',
  telefono: '',
  email: '',
  quimicos: [],
  ultimoQuimico: '',
  usoCalor: [],
  frecuenciaCalor: '',
  usaProtectorTermico: false,
  frecuenciaLavado: '',
  metodoLavado: '',
  productosActuales: {},
  problemas: [],
  otroProblema: '',
  tipoRizoPrincipal: '',
  tiposSecundarios: [],
  zonasCambio: '',
  porosidad: '',
  porosidadObs: '',
  densidad: '',
  grosor: '',
  elasticidad: '',
  balanceHP: '',
  estadoCueroCabelludo: [],
  obsCueroCabelludo: '',
  estadoPuntas: '',
  tipoDano: [],
  lineaDemarcacion: '',
  alergias: '',
  condicionesMedicas: '',
  medicamentos: '',
  embarazo: false,
  nivelEstres: '',
};
