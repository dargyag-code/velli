// ══════════════════════════════════════════════════════════════════════════
// Tablas universales de colorimetría — la física del color, estable entre
// marcas. Todo lo que depende del fabricante vive en kb_marcas.carta.
//
// FUENTE: sección 4.1 de la VALIDACIÓN técnica firmada (escala
// homologada para Latinoamérica). Donde la Entrega 3 §3.2 difiere, MANDA
// la validación — dos divergencias reales:
//   1. La Entrega 3 agrupa los niveles 1–3 como "Rojo"; la validación desglosa el
//      nivel 1 como "Rojo profundo" y deja 2 y 3 como "Rojo".
//   2. La validación añade la columna de denominación común latinoamericana (la
//      notación con la que la estilista pide el tubo en cabina).
//
// El resto (pares de neutralización, notación de reflejos y oxidantes) sale
// de la Entrega 3 §3.3–3.5, que la validación no corrigió.
// ══════════════════════════════════════════════════════════════════════════

export type NivelTono = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const NIVELES: NivelTono[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface FilaAltura {
  nivel: NivelTono;
  /** Nombre técnico de la altura (validación 4.1, columna 2). */
  nombre: string;
  /** Pigmento residual que aflora al aclarar hasta este nivel. */
  fondoAclaracion: string;
  /** Contra-reflejo neutralizante primario. */
  neutralizante: string;
  /** Denominación común en Latinoamérica: cómo se pide el reflejo en cabina. */
  denominacionLatam: string;
}

// Tabla 4.1 de la validación técnica, VERBATIM. No editar sin una decisión de producto.
export const TABLA_ALTURAS: readonly FilaAltura[] = [
  { nivel: 1,  nombre: 'Negro',              fondoAclaracion: 'Rojo profundo',        neutralizante: 'Verde / Mate',                        denominacionLatam: '.7 / .13' },
  { nivel: 2,  nombre: 'Moreno muy oscuro',  fondoAclaracion: 'Rojo',                 neutralizante: 'Verde / Mate',                        denominacionLatam: '.7' },
  { nivel: 3,  nombre: 'Castaño oscuro',     fondoAclaracion: 'Rojo',                 neutralizante: 'Verde / Mate',                        denominacionLatam: '.7' },
  { nivel: 4,  nombre: 'Castaño medio',      fondoAclaracion: 'Rojo-Anaranjado',      neutralizante: 'Verde Azulado',                       denominacionLatam: '.71 / .17' },
  { nivel: 5,  nombre: 'Castaño claro',      fondoAclaracion: 'Anaranjado-Rojo',      neutralizante: 'Azul Verdoso',                        denominacionLatam: '.17 / .1' },
  { nivel: 6,  nombre: 'Rubio oscuro',       fondoAclaracion: 'Anaranjado',           neutralizante: 'Azul (Ceniza)',                       denominacionLatam: '.1' },
  { nivel: 7,  nombre: 'Rubio medio',        fondoAclaracion: 'Anaranjado-Amarillo',  neutralizante: 'Azul Violáceo',                       denominacionLatam: '.12' },
  { nivel: 8,  nombre: 'Rubio claro',        fondoAclaracion: 'Amarillo',             neutralizante: 'Violeta (Nacarado / Malva)',          denominacionLatam: '.2' },
  { nivel: 9,  nombre: 'Rubio muy claro',    fondoAclaracion: 'Amarillo claro',       neutralizante: 'Violeta Suave (Nacarado)',            denominacionLatam: '.2 / .02' },
  { nivel: 10, nombre: 'Rubio clarísimo',    fondoAclaracion: 'Amarillo muy pálido',  neutralizante: 'Violeta ultra suave / Matizador',     denominacionLatam: '.21 / Platino' },
] as const;

export function filaAltura(nivel: NivelTono): FilaAltura {
  const f = TABLA_ALTURAS.find((x) => x.nivel === nivel);
  if (!f) throw new Error(`Nivel de tono fuera de la escala 1–10: ${nivel}`);
  return f;
}

// ── Rueda: pares de neutralización (Entrega 3 §3.3) ───────────────────────
// Regla mental: el neutralizante vive al frente en la rueda. Neutralizar
// apaga; reforzar el vecino aviva. Toda matización es dosificación.

export interface ParNeutralizacion {
  pigmento: string;
  neutralizaCon: string;
}

export const PARES_NEUTRALIZACION: readonly ParNeutralizacion[] = [
  { pigmento: 'Amarillo',           neutralizaCon: 'Violeta' },
  { pigmento: 'Anaranjado',         neutralizaCon: 'Azul' },
  { pigmento: 'Rojo',               neutralizaCon: 'Verde' },
  { pigmento: 'Verdoso',            neutralizaCon: 'Rojo / caoba suave' },
  { pigmento: 'Amarillo anaranjado', neutralizaCon: 'Azul violáceo' },
] as const;

// ── Notación de reflejos (Entrega 3 §3.4) ─────────────────────────────────
// El entero es la altura; los decimales son reflejos: el primero domina, el
// segundo acompaña. De .7 en adelante VARÍA POR MARCA — se lee de la carta.

export interface Reflejo {
  digito: string;
  nombre: string;
  pigmento: string;
  nota?: string;
}

export const REFLEJOS_BASE: readonly Reflejo[] = [
  { digito: '.1', nombre: 'Ceniza',          pigmento: 'Azul / azul-violeta', nota: 'El neutralizante del anaranjado' },
  { digito: '.2', nombre: 'Irisado / perla', pigmento: 'Violeta',             nota: 'El neutralizante del amarillo' },
  { digito: '.3', nombre: 'Dorado',          pigmento: 'Amarillo',            nota: 'Calidez luminosa' },
  { digito: '.4', nombre: 'Cobrizo',         pigmento: 'Anaranjado',          nota: 'Calidez intensa' },
  { digito: '.5', nombre: 'Caoba',           pigmento: 'Rojo violáceo',       nota: 'Profundidad cálida' },
  { digito: '.6', nombre: 'Rojo',            pigmento: 'Rojo',                nota: 'Máxima intensidad cálida' },
] as const;

/** De .7 en adelante la notación es propiedad de cada fabricante. */
export const REFLEJO_DEPENDE_DE_MARCA =
  'De .7 en adelante (mate, marrón, beige o metálicos) la notación varía por marca: se lee de la carta técnica cargada.';

// ── Oxidantes (Entrega 3 §3.5) ────────────────────────────────────────────

export type Volumen = 10 | 20 | 30 | 40;

export interface Oxidante {
  volumen: Volumen;
  concentracion: string;
  /** Niveles que aclara, como rango [min, max]. */
  aclara: [number, number];
  usoTipico: string;
  /** true → exige advertencia reforzada en pantalla. */
  restringido?: boolean;
}

export const OXIDANTES: readonly Oxidante[] = [
  { volumen: 10, concentracion: '3 %',  aclara: [0, 1], usoTipico: 'Tono sobre tono, oscurecer, matizar, baño de color' },
  { volumen: 20, concentracion: '6 %',  aclara: [1, 2], usoTipico: 'Cobertura de canas, coloración estándar' },
  { volumen: 30, concentracion: '9 %',  aclara: [2, 3], usoTipico: 'Aclaraciones medias sobre cabello natural' },
  {
    volumen: 40, concentracion: '12 %', aclara: [3, 4],
    usoTipico: 'Uso restringido: máxima agresión. Ampliamente desaconsejado en aplicación directa sobre cuero cabelludo',
    restringido: true,
  },
] as const;

export function oxidante(volumen: Volumen): Oxidante {
  const o = OXIDANTES.find((x) => x.volumen === volumen);
  if (!o) throw new Error(`Volumen fuera de tabla: ${volumen}`);
  return o;
}

/**
 * CO-03 · El volumen lo deciden los niveles a mover. Devuelve el oxidante
 * MÍNIMO que cubre la distancia pedida ("nunca más volumen del necesario").
 * La tabla de la marca puede corregirlo hacia abajo; nunca hacia arriba sin
 * advertencia.
 *
 * Sin niveles que mover se usa 10 vol, que es el revelador de DEPÓSITO (tono
 * sobre tono, oscurecer, matizar). Su "0–1 nivel" de la tabla es aclarado
 * incidental, no una vía de aclaración: en cuanto hay que subir aunque sea
 * un nivel, el mínimo profesional es 20 vol — el estándar de coloración.
 */
export function volumenParaNiveles(niveles: number): Volumen {
  if (niveles <= 0) return 10;
  const encontrado = OXIDANTES.find((o) => o.aclara[0] >= 1 && niveles <= o.aclara[1]);
  return (encontrado?.volumen ?? 40) as Volumen;
}

// ── Temperatura del objetivo ──────────────────────────────────────────────

export type Temperatura = 'frio' | 'neutro' | 'calido';

/**
 * CO-04 · Neutralizar (o aprovechar) el fondo de aclaración. Frío neutraliza
 * el fondo; cálido lo aprovecha; neutro equilibra sin apagar del todo.
 */
export function tratamientoDelFondo(
  nivelObjetivo: NivelTono,
  temperatura: Temperatura
): { fondo: string; accion: 'neutralizar' | 'aprovechar' | 'equilibrar'; reflejo: string } {
  const fila = filaAltura(nivelObjetivo);
  if (temperatura === 'frio') {
    return { fondo: fila.fondoAclaracion, accion: 'neutralizar', reflejo: fila.neutralizante };
  }
  if (temperatura === 'calido') {
    return {
      fondo: fila.fondoAclaracion,
      accion: 'aprovechar',
      reflejo: 'Reflejo cálido en el sentido del fondo (dorado .3 / cobrizo .4 según carta)',
    };
  }
  return {
    fondo: fila.fondoAclaracion,
    accion: 'equilibrar',
    reflejo: `Natural (.0/N) con toque de ${fila.neutralizante} dosificado`,
  };
}
