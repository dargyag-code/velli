// ══════════════════════════════════════════════════════════════════════════
// Motor Puro de «Madurez de Datos del Negocio» (v1)
//
// Evalúa 5 dimensiones operativas reales premiando COMPLETITUD, CONSISTENCIA,
// ACTUALIDAD (<= 45 días) y VERIFICACIÓN REAL frente a valores semilla por
// defecto — nunca premiando simplemente volumen bruto de registros vacíos.
// Exclusivo para vistas administrativas (`owner` / `manager`); jamás se expone
// en `/s/[slug]`, `/c/[token]` ni al rol `specialist`.
// ══════════════════════════════════════════════════════════════════════════

export type NivelMadurezDatos = 'inicial' | 'en_progreso' | 'calibrado' | 'avanzado';

export type ClaveDimensionMadurez =
  | 'costos_productos'
  | 'consumo_real'
  | 'tiempos_ejecucion'
  | 'historial_clientes'
  | 'rentabilidad_servicio';

export interface ServicioMadurezSnapshot {
  readonly id: string;
  readonly activo: boolean;
  readonly duracionMinutos?: number | null;
  readonly tienePlantillaPrecio: boolean;
  readonly precioBaseCop: number;
  readonly usaQuimicaOSinBascula: boolean;
}

export interface ProductoMadurezSnapshot {
  readonly id: string;
  readonly activo: boolean;
  readonly precioCompraCop: number;
  readonly presentacionCantidad: number;
  readonly precioActualizadoAt?: string | null;
  readonly esSemillaSinRevisar?: boolean;
}

export interface CotizacionCerradaMadurezSnapshot {
  readonly id: string;
  readonly cobradoAt: string;
  readonly precioCobradoCop: number;
  readonly costoProductoCop: number;
  readonly comisionCop: number;
  readonly registroConsumoEnSilla: boolean;
}

export interface ClienteMadurezSnapshot {
  readonly id: string;
  readonly tieneContacto: boolean;
  readonly tieneFichaONotasTecnicas: boolean;
  readonly ultimaVisitaAt?: string | null;
}

export interface InputMadurezDatosNegocio {
  readonly servicios: readonly ServicioMadurezSnapshot[];
  readonly productos: readonly ProductoMadurezSnapshot[];
  readonly cotizacionesCobradas: readonly CotizacionCerradaMadurezSnapshot[];
  readonly citasCompletadasRecientes: number;
  readonly clientes: readonly ClienteMadurezSnapshot[];
  readonly tieneReglaComisionActiva: boolean;
  readonly ahora?: Date;
}

export interface DimensionMadurezResultado {
  readonly clave: ClaveDimensionMadurez;
  readonly etiqueta: string;
  readonly puntaje: number; // 0..100 entero
  readonly peso: number; // suma 1.0
  readonly resumenEstado: string;
  readonly accionSugerida: {
    readonly titulo: string;
    readonly descripcion: string;
    readonly accionHref: string;
    readonly accionLabel: string;
  };
}

export interface RecomendacionPrioritariaMadurez {
  readonly dimensionClave: ClaveDimensionMadurez;
  readonly titulo: string;
  readonly descripcion: string;
  readonly accionHref: string;
  readonly accionLabel: string;
}

export interface ResultadoMadurezDatosNegocio {
  readonly puntajeGlobal: number; // 0..100 entero
  readonly nivel: NivelMadurezDatos;
  readonly etiquetaNivel: string;
  readonly dimensiones: readonly DimensionMadurezResultado[];
  readonly recomendacionPrioritaria: RecomendacionPrioritariaMadurez;
}

const VENTANA_ACTUALIDAD_MS = 45 * 86_400_000; // 45 días

function clamp100(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.max(0, Math.min(100, Math.round(valor)));
}

function esFechaReciente(iso: string | null | undefined, ahora: Date): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return false;
  const diff = ahora.getTime() - ms;
  return diff >= -86_400_000 && diff <= VENTANA_ACTUALIDAD_MS;
}

function resolverNivel(puntaje: number): { nivel: NivelMadurezDatos; etiquetaNivel: string } {
  if (puntaje >= 80) return { nivel: 'avanzado', etiquetaNivel: 'Avanzado · Decisiones con precisión' };
  if (puntaje >= 60) return { nivel: 'calibrado', etiquetaNivel: 'Calibrado · Base operativa confiable' };
  if (puntaje >= 35) return { nivel: 'en_progreso', etiquetaNivel: 'En progreso · Afinando mediciones' };
  return { nivel: 'inicial', etiquetaNivel: 'Inicial · Arrancando con estimaciones' };
}

export function calcularMadurezDatosNegocio(
  input: InputMadurezDatosNegocio
): ResultadoMadurezDatosNegocio {
  const ahora = input.ahora ?? new Date();
  const serviciosActivos = input.servicios.filter((s) => s.activo);
  const productosActivos = input.productos.filter(
    (p) => p.activo && p.presentacionCantidad > 0 && p.precioCompraCop > 0
  );
  const cobradasRecientes = input.cotizacionesCobradas.filter((c) =>
    esFechaReciente(c.cobradoAt, ahora)
  );

  // 1. Costos de productos e insumos (peso 0.25): completitud + verificación propia + vigencia <=45d
  let scoreCostos = 0;
  if (productosActivos.length > 0) {
    const conPrecioVigente = productosActivos.filter((p) =>
      esFechaReciente(p.precioActualizadoAt, ahora)
    ).length;
    const verificadosPorSalon = productosActivos.filter((p) => !p.esSemillaSinRevisar).length;
    const ratioVigencia = conPrecioVigente / productosActivos.length;
    const ratioVerificados = verificadosPorSalon / productosActivos.length;
    const baseCobertura = Math.min(1, productosActivos.length / 4);
    scoreCostos = clamp100(baseCobertura * 30 + ratioVigencia * 35 + ratioVerificados * 35);
  }

  // 2. Consumo real en silla (peso 0.20): proporción de cierres recientes con consumo verificado/ajustado
  let scoreConsumo = 0;
  if (cobradasRecientes.length > 0) {
    const conConsumo = cobradasRecientes.filter(
      (c) => c.registroConsumoEnSilla || c.costoProductoCop > 0
    ).length;
    const ratioConsumo = conConsumo / cobradasRecientes.length;
    const madurezMuestra = Math.min(1, cobradasRecientes.length / 5);
    scoreConsumo = clamp100(ratioConsumo * 75 + madurezMuestra * 25);
  } else if (serviciosActivos.some((s) => s.tienePlantillaPrecio)) {
    scoreConsumo = 20; // Base teórica configurada, pendiente cierres reales
  }

  // 3. Tiempos de ejecución (peso 0.15): servicios con duración realista (>=15m) + citas completadas recientes
  let scoreTiempos = 0;
  if (serviciosActivos.length > 0) {
    const conDuracionRealista = serviciosActivos.filter(
      (s) => typeof s.duracionMinutos === 'number' && s.duracionMinutos >= 15
    ).length;
    const ratioDuracion = conDuracionRealista / serviciosActivos.length;
    const factorAgendaViva = Math.min(1, Math.max(0, input.citasCompletadasRecientes) / 5);
    scoreTiempos = clamp100(ratioDuracion * 65 + factorAgendaViva * 35);
  }

  // 4. Historial y fichas de clientes (peso 0.15): contacto + ficha técnica + visita reciente <=45d
  let scoreClientes = 0;
  if (input.clientes.length > 0) {
    const conContacto = input.clientes.filter((c) => c.tieneContacto).length / input.clientes.length;
    const conFicha =
      input.clientes.filter((c) => c.tieneFichaONotasTecnicas).length / input.clientes.length;
    const conVisitaReciente =
      input.clientes.filter((c) => esFechaReciente(c.ultimaVisitaAt, ahora)).length /
      input.clientes.length;
    scoreClientes = clamp100(conContacto * 30 + conFicha * 45 + conVisitaReciente * 25);
  }

  // 5. Rentabilidad verificable por servicio (peso 0.25): tarifas activas + comisión activa + cierres con margen > 0
  let scoreRentabilidad = 0;
  if (serviciosActivos.length > 0) {
    const ratioConTarifa =
      serviciosActivos.filter((s) => s.tienePlantillaPrecio && s.precioBaseCop > 0).length /
      serviciosActivos.length;
    const puntosComision = input.tieneReglaComisionActiva ? 25 : 0;
    let puntosCierresSanos = 0;
    if (cobradasRecientes.length > 0) {
      const sanos = cobradasRecientes.filter(
        (c) => c.precioCobradoCop > 0 && c.precioCobradoCop - c.costoProductoCop - c.comisionCop > 0
      ).length;
      puntosCierresSanos = (sanos / cobradasRecientes.length) * 35;
    }
    scoreRentabilidad = clamp100(ratioConTarifa * 40 + puntosComision + puntosCierresSanos);
  }

  const dimensiones: DimensionMadurezResultado[] = [
    {
      clave: 'costos_productos',
      etiqueta: 'Costos de insumos verificados',
      puntaje: scoreCostos,
      peso: 0.25,
      resumenEstado:
        productosActivos.length === 0
          ? 'Sin insumos activos en el catálogo del estudio'
          : `${productosActivos.filter((p) => !p.esSemillaSinRevisar && esFechaReciente(p.precioActualizadoAt, ahora)).length}/${productosActivos.length} insumos verificados (≤45 días)`,
      accionSugerida: {
        titulo: 'Actualiza el costo real de tus envases principales',
        descripcion:
          'Confirma cuánto pagas hoy por tu decolorante, tinte, peróxido o geles en tu factura de distribuidor para que el cálculo $/g y $/ml sea exacto.',
        accionHref: '/configuracion/precios',
        accionLabel: 'Revisar insumos ($/g y $/ml)',
      },
    },
    {
      clave: 'rentabilidad_servicio',
      etiqueta: 'Tarifas, comisión y margen real',
      puntaje: scoreRentabilidad,
      peso: 0.25,
      resumenEstado: `${serviciosActivos.filter((s) => s.tienePlantillaPrecio).length}/${serviciosActivos.length} servicios con tarifa activa${input.tieneReglaComisionActiva ? ' · comisión activa' : ' · sin comisión'}`,
      accionSugerida: {
        titulo: 'Completa tarifas base y regla de comisión del equipo',
        descripcion:
          'Asegura que cada servicio activo tenga tarifa base vigente y comisión configurada para conocer tu utilidad neta real en cada cobro.',
        accionHref: '/configuracion/precios',
        accionLabel: 'Calibrar servicios y comisión',
      },
    },
    {
      clave: 'consumo_real',
      etiqueta: 'Consumo medido en silla',
      puntaje: scoreConsumo,
      peso: 0.2,
      resumenEstado:
        cobradasRecientes.length === 0
          ? 'Pendiente de primeros cierres en los últimos 45 días'
          : `${cobradasRecientes.length} cierre(s) recientes alimentando calibración`,
      accionSugerida: {
        titulo: 'Registra tus próximos servicios desde el Workspace Silla',
        descripcion:
          'Ajusta ±5 g en silla (o valida con una gramera sencilla opcional) antes de cerrar el cobro para detectar desvíos reales frente a la receta teórica.',
        accionHref: '/',
        accionLabel: 'Abrir Workspace Silla',
      },
    },
    {
      clave: 'tiempos_ejecucion',
      etiqueta: 'Duraciones y citas cumplidas',
      puntaje: scoreTiempos,
      peso: 0.15,
      resumenEstado: `${serviciosActivos.filter((s) => (s.duracionMinutos ?? 0) >= 15).length}/${serviciosActivos.length} servicios con minutos definidos`,
      accionSugerida: {
        titulo: 'Asigna duraciones reales a tu menú y cierra citas en Agenda',
        descripcion:
          'Definir los minutos reales por procedimiento evita huecos muertos en tu vitrina /s/[slug] y te permite medir rentabilidad por hora.',
        accionHref: '/agenda',
        accionLabel: 'Ir a Agenda',
      },
    },
    {
      clave: 'historial_clientes',
      etiqueta: 'Fichas técnicas y retorno de clientes',
      puntaje: scoreClientes,
      peso: 0.15,
      resumenEstado:
        input.clientes.length === 0
          ? 'Aún sin fichas de clientes registradas'
          : `${input.clientes.filter((c) => c.tieneFichaONotasTecnicas).length}/${input.clientes.length} clientes con diagnóstico/notas`,
      accionSugerida: {
        titulo: 'Registra diagnóstico y WhatsApp de tus clientes frecuentes',
        descripcion:
          'Guardar historial técnico y teléfono permite anticipar fórmulas antes de sentarse en silla y reactivar visitas a los 30, 45 o 60 días.',
        accionHref: '/clientas',
        accionLabel: 'Abrir directorio de Clientes',
      },
    },
  ];

  const puntajeGlobal = clamp100(
    dimensiones.reduce((acc, d) => acc + d.puntaje * d.peso, 0)
  );
  const { nivel, etiquetaNivel } = resolverNivel(puntajeGlobal);

  // Elegir la única recomendación prioritaria por brecha ponderada `(100 - puntaje) * peso`
  const candidata = [...dimensiones].sort(
    (a, b) => (100 - b.puntaje) * b.peso - (100 - a.puntaje) * a.peso
  )[0];

  return {
    puntajeGlobal,
    nivel,
    etiquetaNivel,
    dimensiones,
    recomendacionPrioritaria: {
      dimensionClave: candidata.clave,
      ...candidata.accionSugerida,
    },
  };
}
