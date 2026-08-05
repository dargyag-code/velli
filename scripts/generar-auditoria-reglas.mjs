// ══════════════════════════════════════════════════════════════════════════
// Genera un documento Word de AUDITORÍA de las reglas históricas del motor de
// rizos, tal como viven hoy en la knowledge base (tabla kb_reglas).
//
//   npm run kb:auditoria   →  Auditoria-Reglas-Rizos-v1.0-candidata.docx
//
// FIDELIDAD (no inventa ni completa nada): el contenido de cada ficha es la
// salida EXACTA del evaluador de la KB (lib/kb/evaluador.ts) sobre el seed
// canónico (lib/kb/seed/reglasRizado.ts) — el mismo contenido que la
// migración carga en kb_reglas. Donde la KB no produce contenido, la ficha
// muestra el hueco ("(sin contenido en la knowledge base)"). El documento es
// de SOLO LECTURA: no consulta ni modifica la base de datos.
//
// Las ~40 combinaciones son perfiles-coordenada que recorren las ramas
// distintas del motor (patrón, eje H/P, daño, cuero/salud, express, bandera
// médica). Cada ficha imprime su perfil de entrada completo como
// identificador, y abajo los segmentos resueltos verbatim.
//
// Requiere Node >= 23 (type stripping para importar los .ts del KB).
// ══════════════════════════════════════════════════════════════════════════

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from 'docx';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { evaluarDiagnostico } = await import(
  new URL('../lib/kb/evaluador.ts', import.meta.url)
);
const { REGLAS_RIZADO } = await import(
  new URL('../lib/kb/seed/reglasRizado.ts', import.meta.url)
);
const { WIZARD_INITIAL_DATA } = await import(
  new URL('../lib/types.ts', import.meta.url)
);

// Cantidad de reglas publicadas (todas en el seed lo están) — para la portada.
const TOTAL_REGLAS = REGLAS_RIZADO.length;

// ── Valores de daño/puntas/cuero tal como los almacena la KB ────────────────
const D_MEC = 'Daño mecánico (peinado brusco, ligas, etc.)';
const D_TER = 'Daño térmico (textura alterada por calor)';
const D_QUI = 'Daño químico (decoloración, alisado)';
const D_TRA = 'En transición capilar (dos texturas visibles)';
const P_SEV = 'Puntas abiertas severas (necesita corte)';
const P_LEV = 'Puntas abiertas leves';
const C_GRA = 'Graso (exceso de sebo)';
const C_BUILD = 'Build-up (acumulación de producto)';
const C_CASPA = 'Caspa seca';
const C_DERM = 'Dermatitis seborreica';

// ── Las ~40 combinaciones (perfiles-coordenada) ─────────────────────────────
// `perfil` usa los nombres de campo reales de WizardData. La sección y el
// nombre son etiquetas de la ficha; el perfil es el identificador exacto.

const BASE_MEDIA = { porosidad: 'media', densidad: 'media', grosor: 'medio', elasticidad: 'media' };
const base3B = { tipoRizoPrincipal: '3B', ...BASE_MEDIA };
const base3C = { tipoRizoPrincipal: '3C', ...BASE_MEDIA };

const COMBINACIONES = [
  // ── A · Patrón por tipo de rizo (baseline medio, sin daño) ──────────────
  { cod: 'A1', sec: 'A · Patrón por tipo de rizo', nombre: 'Liso 1A', perfil: { tipoRizoPrincipal: '1A', ...BASE_MEDIA } },
  { cod: 'A2', sec: 'A · Patrón por tipo de rizo', nombre: 'Liso 1B', perfil: { tipoRizoPrincipal: '1B', ...BASE_MEDIA } },
  { cod: 'A3', sec: 'A · Patrón por tipo de rizo', nombre: 'Liso 1C', perfil: { tipoRizoPrincipal: '1C', ...BASE_MEDIA } },
  { cod: 'A4', sec: 'A · Patrón por tipo de rizo', nombre: 'Ondulado 2A', perfil: { tipoRizoPrincipal: '2A', ...BASE_MEDIA } },
  { cod: 'A5', sec: 'A · Patrón por tipo de rizo', nombre: 'Ondulado 2B', perfil: { tipoRizoPrincipal: '2B', ...BASE_MEDIA } },
  { cod: 'A6', sec: 'A · Patrón por tipo de rizo', nombre: 'Ondulado 2C', perfil: { tipoRizoPrincipal: '2C', ...BASE_MEDIA } },
  { cod: 'A7', sec: 'A · Patrón por tipo de rizo', nombre: 'Rizado 3A', perfil: { tipoRizoPrincipal: '3A', ...BASE_MEDIA } },
  { cod: 'A8', sec: 'A · Patrón por tipo de rizo', nombre: 'Rizado 3B', perfil: { tipoRizoPrincipal: '3B', ...BASE_MEDIA } },
  { cod: 'A9', sec: 'A · Patrón por tipo de rizo', nombre: 'Rizado 3C', perfil: { tipoRizoPrincipal: '3C', ...BASE_MEDIA } },
  { cod: 'A10', sec: 'A · Patrón por tipo de rizo', nombre: 'Afro 4A', perfil: { tipoRizoPrincipal: '4A', ...BASE_MEDIA } },
  { cod: 'A11', sec: 'A · Patrón por tipo de rizo', nombre: 'Afro 4B', perfil: { tipoRizoPrincipal: '4B', ...BASE_MEDIA } },
  { cod: 'A12', sec: 'A · Patrón por tipo de rizo', nombre: 'Afro 4C', perfil: { tipoRizoPrincipal: '4C', ...BASE_MEDIA } },

  // ── B · Variantes de patrón sensibles (técnica/densidad/grosor/porosidad) ─
  { cod: 'B1', sec: 'B · Variantes de patrón', nombre: 'Rizado 3B · grosor fino (técnica shingling suave)', perfil: { tipoRizoPrincipal: '3B', ...BASE_MEDIA, grosor: 'fino' } },
  { cod: 'B2', sec: 'B · Variantes de patrón', nombre: 'Afro 4B · densidad alta (twist out)', perfil: { tipoRizoPrincipal: '4B', ...BASE_MEDIA, densidad: 'alta' } },
  { cod: 'B3', sec: 'B · Variantes de patrón', nombre: 'Afro 4C · densidad alta (twist out)', perfil: { tipoRizoPrincipal: '4C', ...BASE_MEDIA, densidad: 'alta' } },
  { cod: 'B4', sec: 'B · Variantes de patrón', nombre: 'Afro 4C · porosidad alta (método LOC)', perfil: { tipoRizoPrincipal: '4C', ...BASE_MEDIA, porosidad: 'alta' } },
  { cod: 'B5', sec: 'B · Variantes de patrón', nombre: 'Liso 1A · porosidad alta (sellado de puntas)', perfil: { tipoRizoPrincipal: '1A', ...BASE_MEDIA, porosidad: 'alta' } },

  // ── C · Eje hidratación/proteína · necesidad principal (sobre 3B) ───────
  { cod: 'C1', sec: 'C · Eje H/P · necesidad principal', nombre: '3B · elasticidad baja → Reconstrucción', perfil: { ...base3B, elasticidad: 'baja' } },
  { cod: 'C2', sec: 'C · Eje H/P · necesidad principal', nombre: '3B · balance Proteína → Reconstrucción', perfil: { ...base3B, balanceHP: 'proteina' } },
  { cod: 'C3', sec: 'C · Eje H/P · necesidad principal', nombre: '3B · porosidad alta → Hidratación + Nutrición', perfil: { ...base3B, porosidad: 'alta' } },
  { cod: 'C4', sec: 'C · Eje H/P · necesidad principal', nombre: '3B · porosidad baja → Nutrición (inferida)', perfil: { ...base3B, porosidad: 'baja' } },
  { cod: 'C5', sec: 'C · Eje H/P · necesidad principal', nombre: '3B · balance Equilibrado → Mantenimiento', perfil: { ...base3B, balanceHP: 'equilibrado' } },
  { cod: 'C6', sec: 'C · Eje H/P · necesidad principal', nombre: '3B · balance Nutrición (explícito)', perfil: { ...base3B, balanceHP: 'nutricion' } },

  // ── D · Daño y puntas (sobre 3C) ────────────────────────────────────────
  { cod: 'D1', sec: 'D · Daño y puntas', nombre: '3C · daño químico', perfil: { ...base3C, tipoDano: [D_QUI] } },
  { cod: 'D2', sec: 'D · Daño y puntas', nombre: '3C · daño térmico', perfil: { ...base3C, tipoDano: [D_TER] } },
  { cod: 'D3', sec: 'D · Daño y puntas', nombre: '3C · transición capilar + línea de demarcación', perfil: { ...base3C, tipoDano: [D_TRA], lineaDemarcacion: 'A la altura de las orejas' } },
  { cod: 'D4', sec: 'D · Daño y puntas', nombre: '3C · puntas abiertas severas (sin daño marcado)', perfil: { ...base3C, estadoPuntas: P_SEV } },
  { cod: 'D5', sec: 'D · Daño y puntas', nombre: '3C · daño químico + puntas severas (corte + urgente)', perfil: { ...base3C, tipoDano: [D_QUI], estadoPuntas: P_SEV } },
  { cod: 'D6', sec: 'D · Daño y puntas', nombre: '3C · daño químico + elasticidad baja (daño severo)', perfil: { ...base3C, tipoDano: [D_QUI], elasticidad: 'baja' } },

  // ── E · Cuero cabelludo y salud (sobre 3B) ──────────────────────────────
  { cod: 'E1', sec: 'E · Cuero cabelludo y salud', nombre: '3B · cuero graso + build-up (detox)', perfil: { ...base3B, estadoCueroCabelludo: [C_GRA, C_BUILD] } },
  { cod: 'E2', sec: 'E · Cuero cabelludo y salud', nombre: '3B · caspa seca', perfil: { ...base3B, estadoCueroCabelludo: [C_CASPA] } },
  { cod: 'E3', sec: 'E · Cuero cabelludo y salud', nombre: '3B · dermatitis seborreica', perfil: { ...base3B, estadoCueroCabelludo: [C_DERM] } },
  { cod: 'E4', sec: 'E · Cuero cabelludo y salud', nombre: '3B · embarazo / lactancia', perfil: { ...base3B }, salud: { embarazo: true } },
  { cod: 'E5', sec: 'E · Cuero cabelludo y salud', nombre: '3B · caída excesiva + estrés alto', perfil: { ...base3B, problemas: ['Caída excesiva'] }, salud: { nivelEstres: 'alto' } },
  { cod: 'E6', sec: 'E · Cuero cabelludo y salud', nombre: '3B · porosidad baja + build-up (clarificación)', perfil: { ...base3B, porosidad: 'baja', estadoCueroCabelludo: [C_BUILD] } },
  { cod: 'E7', sec: 'E · Cuero cabelludo y salud', nombre: '3B · frizz excesivo (problema)', perfil: { ...base3B, problemas: ['Frizz excesivo'] } },

  // ── F · Modo express y casos límite ─────────────────────────────────────
  { cod: 'F1', sec: 'F · Modo express y casos límite', nombre: 'Express: solo tipo 3A (resto en blanco)', perfil: { tipoRizoPrincipal: '3A' } },
  { cod: 'F2', sec: 'F · Modo express y casos límite', nombre: 'Sin tipo de rizo (rama por defecto)', perfil: {} },

  // ── G · Bandera médica · seguridad (deriva SIEMPRE) ─────────────────────
  { cod: 'G1', sec: 'G · Bandera médica (seguridad)', nombre: 'Señales de alopecia (placas) → derivación', perfil: { tipoRizoPrincipal: '1A', ...BASE_MEDIA }, perfilExtendido: { senalesAlopecia: ['placas_sin_cabello'] } },
  { cod: 'G2', sec: 'G · Bandera médica (seguridad)', nombre: 'Dermatitis severa (cuero) → derivación', perfil: { tipoRizoPrincipal: '3B', ...BASE_MEDIA, porosidad: 'alta' }, perfilExtendido: { tipoCueroCabelludo: 'dermatitis_severa' } },
];

// ── Paleta / estilos ────────────────────────────────────────────────────────
const VERDE = '2D5A27';
const VERDE_PALE = 'EAF1E8';
const AMBAR = 'B47E4D';
const GRIS = '6B6560';
const GRIS_SUAVE = 'CCCCCC';
const HUECO = '9A948C';

const thinBorder = { style: BorderStyle.SINGLE, size: 2, color: GRIS_SUAVE };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

function run(text, opts = {}) {
  return new TextRun({ text, font: 'Calibri', size: opts.size ?? 20, bold: opts.bold, italics: opts.italics, color: opts.color });
}

function p(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing: { after: opts.after ?? 80, before: opts.before ?? 0 },
    alignment: opts.align,
  });
}

function gapPara(texto = '(sin contenido en la knowledge base)') {
  return p([run(texto, { italics: true, color: HUECO, size: 18 })]);
}

function bullets(items, gapText) {
  if (!items || items.length === 0) return [gapPara(gapText)];
  return items.map((t) =>
    new Paragraph({
      children: [run(t, { size: 19 })],
      bullet: { level: 0 },
      spacing: { after: 40 },
    })
  );
}

function segmentoTitulo(texto) {
  return new Paragraph({
    children: [run(texto, { bold: true, size: 20, color: VERDE })],
    spacing: { before: 140, after: 50 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: VERDE_PALE } },
  });
}

function celda(text, { bold, color, shade, width, italics, size } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: shade ? { type: ShadingType.CLEAR, fill: shade, color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    borders: cellBorders,
    children: [p([run(text, { bold, color, italics, size: size ?? 18 })], { after: 0 })],
  });
}

function tablaKV(filas) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: filas.map(
      ([k, v]) =>
        new TableRow({
          children: [
            celda(k, { bold: true, shade: VERDE_PALE, width: 32 }),
            celda(v && String(v).length ? String(v) : '—', { width: 68, color: v && String(v).length ? undefined : HUECO }),
          ],
        })
    ),
  });
}

function tablaCronograma(c) {
  const filas = [
    ['Semana 1', c.semana1],
    ['Semana 2', c.semana2],
    ['Semana 3', c.semana3],
    ['Semana 4', c.semana4],
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: filas.map(
      ([k, v]) =>
        new TableRow({
          children: [
            celda(k, { bold: true, shade: VERDE_PALE, width: 22 }),
            celda(v && v.length ? v : '—', { width: 78, color: v && v.length ? undefined : HUECO }),
          ],
        })
    ),
  });
}

function tablaRutina(rutina) {
  const header = new TableRow({
    tableHeader: true,
    children: [
      celda('Paso / Producto', { bold: true, shade: VERDE_PALE, width: 26 }),
      celda('Características', { bold: true, shade: VERDE_PALE, width: 54 }),
      celda('Frecuencia', { bold: true, shade: VERDE_PALE, width: 20 }),
    ],
  });
  const filas = rutina.map(
    (r) =>
      new TableRow({
        children: [
          celda(r.producto || '—', { bold: true, width: 26, color: r.producto ? undefined : HUECO }),
          celda(r.caracteristicas || '—', { width: 54, color: r.caracteristicas ? undefined : HUECO }),
          celda(r.frecuencia || '—', { width: 20, color: r.frecuencia ? undefined : HUECO }),
        ],
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...filas] });
}

function filaDecision() {
  const opt = (txt) =>
    new TableCell({
      width: { size: 33.33, type: WidthType.PERCENTAGE },
      borders: cellBorders,
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
      children: [p([run('☐  ', { size: 24, bold: true }), run(txt, { bold: true, size: 20 })], { after: 0 })],
    });
  const cabecera = new TableRow({
    children: [
      new TableCell({
        columnSpan: 3,
        shading: { type: ShadingType.CLEAR, fill: VERDE, color: 'auto' },
        borders: cellBorders,
        margins: { top: 50, bottom: 50, left: 80, right: 80 },
        children: [p([run('DECISIÓN DE AUDITORÍA', { bold: true, color: 'FFFFFF', size: 18 })], { after: 0 })],
      }),
    ],
  });
  const opciones = new TableRow({ children: [opt('Aprobar'), opt('Corregir'), opt('Eliminar')] });
  const obs = new TableRow({
    children: [
      new TableCell({
        columnSpan: 3,
        borders: cellBorders,
        margins: { top: 80, bottom: 160, left: 80, right: 80 },
        children: [p([run('Observaciones: ', { bold: true, size: 18 }), run('_'.repeat(90), { color: GRIS_SUAVE, size: 18 })], { after: 0 })],
      }),
    ],
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [cabecera, opciones, obs] });
}

// ── Render de una ficha ─────────────────────────────────────────────────────
function fichaCombinacion(combo, idx) {
  const data = { ...WIZARD_INITIAL_DATA, ...combo.perfil, perfilExtendido: combo.perfilExtendido };
  const salud = combo.salud;
  const r = evaluarDiagnostico(REGLAS_RIZADO, data, salud);

  const esDerivacion = r.tratamientoPrincipal === 'Derivación a dermatólogo';
  const out = [];

  // Encabezado de ficha
  out.push(
    new Paragraph({
      children: [
        run(`${combo.cod}`, { bold: true, size: 26, color: AMBAR }),
        run('   ', { size: 26 }),
        run(combo.nombre, { bold: true, size: 26, color: VERDE }),
      ],
      spacing: { before: idx === 0 ? 0 : 60, after: 40 },
      heading: HeadingLevel.HEADING_2,
    })
  );
  out.push(p([run(combo.sec, { italics: true, size: 17, color: GRIS })], { after: 100 }));

  if (esDerivacion) {
    out.push(
      new Paragraph({
        children: [run('⚠  BANDERA MÉDICA — la knowledge base deriva a dermatólogo y NO emite plan de tratamiento.', { bold: true, size: 18, color: AMBAR })],
        spacing: { after: 100 },
        shading: { type: ShadingType.CLEAR, fill: 'FBF1E6', color: 'auto' },
        border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      })
    );
  }

  // Identificador de combinación = perfil de entrada exacto
  out.push(segmentoTitulo('Identificador de combinación · perfil de entrada'));
  const ext = combo.perfilExtendido
    ? Object.entries(combo.perfilExtendido).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')
    : '';
  out.push(
    tablaKV([
      ['Código', combo.cod],
      ['Tipo de rizo', combo.perfil.tipoRizoPrincipal || '— (sin especificar)'],
      ['Porosidad', combo.perfil.porosidad || '— (express → media)'],
      ['Densidad', combo.perfil.densidad || '— (express → media)'],
      ['Grosor', combo.perfil.grosor || '— (express → medio)'],
      ['Elasticidad', combo.perfil.elasticidad || '— (express → media)'],
      ['Balance H/P', combo.perfil.balanceHP || '— (se infiere)'],
      ['Tipo de daño', (combo.perfil.tipoDano || []).join(' · ')],
      ['Estado de puntas', combo.perfil.estadoPuntas || ''],
      ['Cuero cabelludo', (combo.perfil.estadoCueroCabelludo || []).join(' · ')],
      ['Problemas', (combo.perfil.problemas || []).join(' · ')],
      ['Línea de demarcación', combo.perfil.lineaDemarcacion || ''],
      ['Embarazo / lactancia', salud?.embarazo ? 'Sí' : ''],
      ['Nivel de estrés', salud?.nivelEstres || ''],
      ['Perfil extendido', ext],
    ])
  );

  // Segmentos resueltos (verbatim del KB)
  out.push(segmentoTitulo('Tratamiento'));
  out.push(p([run('Principal: ', { bold: true, size: 19 }), run(r.tratamientoPrincipal || '—', { size: 19, color: r.tratamientoPrincipal ? undefined : HUECO })]));
  out.push(p([run('Adicionales:', { bold: true, size: 19 })], { after: 20 }));
  out.push(...bullets(r.tratamientosAdicionales, '(ninguno)'));

  out.push(segmentoTitulo('Cronograma (4 semanas)'));
  out.push(tablaCronograma(r.cronograma));

  out.push(segmentoTitulo('Técnica de definición'));
  out.push(p([run('Definición: ', { bold: true, size: 19 }), run(r.tecnicaDefinicion || '—', { size: 19, color: r.tecnicaDefinicion ? undefined : HUECO })]));
  if (r.tecnicaDescripcion) out.push(p([run('Descripción: ', { bold: true, size: 19 }), run(r.tecnicaDescripcion, { size: 19 })]));
  else out.push(gapPara());
  out.push(p([run('Método de secado: ', { bold: true, size: 19 }), run(r.metodoSecado || '—', { size: 19, color: r.metodoSecado ? undefined : HUECO })]));

  out.push(segmentoTitulo('Productos recomendados (resumen)'));
  out.push(...bullets(r.productosPonto, '(sin contenido en la knowledge base)'));

  const rp = r.recomendacionProductos;
  out.push(segmentoTitulo('Ingredientes a buscar'));
  out.push(...bullets(rp?.ingredientesBuscar, '(sin contenido en la knowledge base)'));
  out.push(segmentoTitulo('Ingredientes a evitar'));
  out.push(...bullets(rp?.ingredientesEvitar, '(sin contenido en la knowledge base)'));

  out.push(segmentoTitulo('Rutina de 6 pasos'));
  if (rp?.rutina?.length) out.push(tablaRutina(rp.rutina));
  else out.push(gapPara());

  out.push(segmentoTitulo('Notas adicionales'));
  out.push(...bullets(r.notasAdicionales, '(sin notas para esta combinación)'));

  out.push(segmentoTitulo('Cuidado en casa'));
  out.push(p([run('Día de lavado', { bold: true, size: 18, color: GRIS })], { after: 20 }));
  out.push(...bullets(r.cuidadoCasa.diaLavado, '(sin contenido)'));
  out.push(p([run('Nocturno', { bold: true, size: 18, color: GRIS })], { after: 20, before: 40 }));
  out.push(...bullets(r.cuidadoCasa.nocturno, '(sin contenido)'));
  out.push(p([run('Refresh (días siguientes)', { bold: true, size: 18, color: GRIS })], { after: 20, before: 40 }));
  out.push(...bullets(r.cuidadoCasa.refresh, '(sin contenido)'));
  out.push(p([run('Evitar', { bold: true, size: 18, color: GRIS })], { after: 20, before: 40 }));
  out.push(...bullets(r.cuidadoCasa.evitar, '(sin contenido)'));

  out.push(segmentoTitulo('Intervalo sugerido de cita'));
  out.push(p([run(r.intervaloSugerido || '—', { size: 19, color: r.intervaloSugerido ? undefined : HUECO })]));

  if (rp?.disclaimer) {
    out.push(segmentoTitulo('Disclaimer de productos'));
    out.push(p([run(rp.disclaimer, { italics: true, size: 17, color: GRIS })]));
  }

  // Fila de decisión
  out.push(p([run('', { size: 6 })], { after: 40 }));
  out.push(filaDecision());

  // Salto de página entre fichas
  out.push(new Paragraph({ children: [], pageBreakBefore: false, spacing: { after: 0 } }));
  out.push(new Paragraph({ children: [new TextRun({ text: '', break: 0 })], pageBreakBefore: false }));
  return out;
}

// ── Portada ─────────────────────────────────────────────────────────────────
function portada() {
  const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  return [
    new Paragraph({ children: [], spacing: { before: 1800 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [run('AUDITORÍA', { bold: true, size: 64, color: VERDE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [run('Reglas históricas del motor de rizos', { size: 30, color: '2D2D2D' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [run('(v1.0 candidata)', { italics: true, size: 26, color: AMBAR })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [run('Velli Pro · Knowledge base del diagnóstico', { size: 20, color: GRIS })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [run(fecha, { size: 20, color: GRIS })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 900 },
      children: [run(`${COMBINACIONES.length} combinaciones · ${TOTAL_REGLAS} reglas en kb_reglas`, { size: 20, color: GRIS })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
      shading: { type: ShadingType.CLEAR, fill: VERDE_PALE, color: 'auto' },
      children: [run('  Documento de SOLO LECTURA — no consulta ni modifica la base de datos.  ', { size: 18, color: VERDE, bold: true })],
    }),
    new Paragraph({ children: [], pageBreakBefore: true }),
  ];
}

// ── Metodología + índice ────────────────────────────────────────────────────
function metodologia() {
  const out = [];
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 120 }, children: [run('Cómo leer esta auditoría', { bold: true, size: 30, color: VERDE })] }));

  const parr = (txt) => out.push(p([run(txt, { size: 20 })], { after: 120 }));
  parr('Cada ficha corresponde a una combinación de diagnóstico: un perfil de clienta (tipo de rizo + porosidad + elasticidad + daño + cuero cabelludo + salud) y la recomendación que el motor produce hoy para ese perfil, reunida en sus segmentos: tratamiento, cronograma, técnica, productos, ingredientes, rutina de 6 pasos, notas, cuidado en casa e intervalo.');
  parr('Fidelidad: el contenido de cada segmento es la salida EXACTA de la knowledge base (tabla kb_reglas) evaluada sobre ese perfil. No se ha añadido, parafraseado ni completado nada. Donde la knowledge base no produce contenido, la ficha lo muestra como hueco — en gris e itálica: "(sin contenido en la knowledge base)". Esos huecos son parte de la auditoría: reflejan lo que la regla histórica deja vacío.');
  parr('Fuente: seed canónico lib/kb/seed/reglasRizado.ts, que es el contenido idéntico cargado en kb_reglas por la migración del knowledge base (la prueba de regresión garantiza que reproduce el motor histórico exactamente). Las combinaciones son perfiles-coordenada elegidos para recorrer las ramas distintas del motor; cada ficha imprime su perfil de entrada completo como identificador.');
  parr('Decisión: al pie de cada ficha hay una fila para marcar Aprobar / Corregir / Eliminar y anotar observaciones. Es el registro de validación para declarar la v1.0 definitiva.');

  out.push(new Paragraph({
    spacing: { before: 80, after: 200 },
    shading: { type: ShadingType.CLEAR, fill: 'FBF1E6', color: 'auto' },
    border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
    children: [run('  Seguridad: las combinaciones con bandera médica (sección G) muestran cómo la knowledge base deriva SIEMPRE a dermatólogo y no emite plan — verificar que esa salvaguarda es correcta.  ', { size: 18, color: AMBAR })],
  }));

  // Índice
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 120 }, children: [run('Índice de combinaciones', { bold: true, size: 28, color: VERDE })] }));
  const header = new TableRow({
    tableHeader: true,
    children: [
      celda('Cód.', { bold: true, shade: VERDE_PALE, width: 10 }),
      celda('Combinación', { bold: true, shade: VERDE_PALE, width: 62 }),
      celda('Sección', { bold: true, shade: VERDE_PALE, width: 28 }),
    ],
  });
  const filas = COMBINACIONES.map(
    (c) =>
      new TableRow({
        children: [
          celda(c.cod, { bold: true, width: 10 }),
          celda(c.nombre, { width: 62 }),
          celda(c.sec.split(' · ')[0], { width: 28 }),
        ],
      })
  );
  out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...filas] }));
  out.push(new Paragraph({ children: [], pageBreakBefore: true }));
  return out;
}

// ── Ensamblar documento ─────────────────────────────────────────────────────
const cuerpo = [];
COMBINACIONES.forEach((combo, i) => {
  cuerpo.push(...fichaCombinacion(combo, i));
  if (i < COMBINACIONES.length - 1) {
    cuerpo.push(new Paragraph({ children: [], pageBreakBefore: true }));
  }
});

const doc = new Document({
  creator: 'Velli Pro · generador de auditoría KB',
  title: 'Auditoría — Reglas históricas del motor de rizos (v1.0 candidata)',
  description: 'Generado desde kb_reglas (seed canónico). Documento de solo lectura.',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 20 } } },
  },
  sections: [
    { children: portada() },
    { children: metodologia() },
    { children: cuerpo },
  ],
});

const buffer = await Packer.toBuffer(doc);
const destino = path.join(raiz, 'Auditoria-Reglas-Rizos-v1.0-candidata.docx');
writeFileSync(destino, buffer);
console.log(`OK → ${destino}`);
console.log(`  ${COMBINACIONES.length} fichas de combinación · fuente: kb_reglas (${TOTAL_REGLAS} reglas) · ${(buffer.length / 1024).toFixed(0)} KB`);
