import jsPDF from 'jspdf';
import { Clienta, Consulta, RecomendacionProductos } from './types';
import { formatDate, getTratamientoBg, getTratamientoTextColor } from './utils';
import { resolveFotoUrl } from './storage';
import { buildRecomendacionProductos } from './diagnosticEngine';

const GREEN = '#2D5A27';
const AMBER = '#C9956B';
const LIGHT_GREEN = '#EEF5ED';
const TEXT_DARK = '#2D2D2D';
const TEXT_GRAY = '#666666';

// ── Image helpers ──────────────────────────────────────────────────────────

function getImageFormat(source: string): string {
  if (source.includes('image/png') || /\.png(\?|$)/i.test(source)) return 'PNG';
  if (source.includes('image/webp') || /\.webp(\?|$)/i.test(source)) return 'WEBP';
  return 'JPEG';
}

function scaleToBounds(nw: number, nh: number, maxW: number, maxH: number): { w: number; h: number } {
  if (nw <= 0 || nh <= 0) return { w: maxW, h: maxH };
  const ratio = Math.min(maxW / nw, maxH / nh);
  return { w: nw * ratio, h: nh * ratio };
}

async function toDataUrl(source: string): Promise<string> {
  if (source.startsWith('data:')) return source;
  const res = await fetch(source, { mode: 'cors' });
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function getImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    } catch {
      resolve({ w: 1, h: 1 });
    }
  });
}

async function addPhotoToDoc(
  doc: jsPDF,
  source: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number
): Promise<number> {
  try {
    const resolved = (await resolveFotoUrl(source)) || source;
    const dataUrl = await toDataUrl(resolved);
    const dims = await getImageDimensions(dataUrl);
    const { w, h } = scaleToBounds(dims.w, dims.h, maxW, maxH);
    const format = getImageFormat(dataUrl);
    doc.addImage(dataUrl, format, x, y, w, h);
    return h;
  } catch (err) {
    console.warn('[pdf] no se pudo incrustar foto:', err);
    return 0;
  }
}

// ── One-line summary ───────────────────────────────────────────────────────

function buildOneLiner(consulta: Consulta): string {
  const tipo = consulta.tipoRizoPrincipal || '—';
  const por = consulta.porosidad ? `, porosidad ${consulta.porosidad}` : '';
  const trat = consulta.resultado?.tratamientoPrincipal || '';
  if (trat) return `Cabello ${tipo}${por} — requiere ${trat.toLowerCase()}`;
  return `Cabello tipo ${tipo}${por}`;
}

export async function generateConsultaPDF(clienta: Clienta, consulta: Consulta): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 0;

  const addPage = () => {
    doc.addPage();
    y = 20;
    addFooter();
  };

  const checkNewPage = (needed = 20) => {
    if (y + needed > 270) addPage();
  };

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const setFill = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    doc.setFillColor(r, g, b);
  };

  const setTextColor = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    doc.setTextColor(r, g, b);
  };

  const addFooter = () => {
    doc.setFontSize(8);
    setTextColor('#999999');
    doc.setFont('helvetica', 'italic');
    doc.text('Velli Pro • Inteligencia capilar a tu alcance', pageW / 2, 287, { align: 'center' });
  };

  // ── Header ──
  setFill(GREEN);
  doc.rect(0, 0, pageW, 35, 'F');

  doc.setFontSize(20);
  setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.text('Velli', margin, 15);

  doc.setFontSize(10);
  setTextColor(AMBER);
  doc.setFont('helvetica', 'bold');
  doc.text('INTELIGENCIA CAPILAR', margin, 22);

  doc.setFontSize(8);
  setTextColor('#B8D4B5');
  doc.setFont('helvetica', 'italic');
  doc.text('Inteligencia capilar profesional', margin, 28);

  // Date
  doc.setFontSize(9);
  setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'normal');
  doc.text('Diagnóstico Capilar Profesional', pageW - margin, 15, { align: 'right' });
  doc.text(formatDate(consulta.fecha), pageW - margin, 22, { align: 'right' });
  doc.text(`Consulta #${consulta.numeroConsulta}`, pageW - margin, 28, { align: 'right' });

  y = 42;

  // ── Resumen ejecutivo ──────────────────────────────────────────────────────
  // Client name
  doc.setFontSize(18);
  setTextColor(GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text(clienta.nombre, margin, y);
  y += 6;

  doc.setFontSize(9);
  setTextColor(TEXT_GRAY);
  doc.setFont('helvetica', 'normal');
  const infoLine = [
    clienta.edad ? `${clienta.edad} años` : '',
    clienta.telefono ? `Tel: ${clienta.telefono}` : '',
  ].filter(Boolean).join('  |  ');
  if (infoLine) { doc.text(infoLine, margin, y); y += 6; }

  // One-liner summary box
  const oneLiner = buildOneLiner(consulta);
  setFill('#FBF4EC');
  doc.roundedRect(margin, y, pageW - margin * 2, 10, 2, 2, 'F');
  doc.setFontSize(9);
  setTextColor(AMBER);
  doc.setFont('helvetica', 'bold');
  doc.text(oneLiner, margin + 3, y + 6.5);
  y += 14;

  // Hair type + key badges row
  const summaryBadges = [
    { label: 'Tipo', value: consulta.tipoRizoPrincipal || '—' },
    { label: 'Tratamiento', value: consulta.resultado?.tratamientoPrincipal?.split(' ')[0] || '—' },
    { label: 'Porosidad', value: consulta.porosidad || '—' },
    { label: 'Fecha', value: formatDate(consulta.fecha) },
  ];
  const sbW = (pageW - margin * 2) / summaryBadges.length;
  summaryBadges.forEach((b, i) => {
    setFill(i === 0 ? LIGHT_GREEN : '#F9F9F9');
    doc.roundedRect(margin + i * sbW, y, sbW - 1.5, 13, 2, 2, 'F');
    doc.setFontSize(7);
    setTextColor(TEXT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(b.label, margin + i * sbW + sbW / 2, y + 4, { align: 'center' });
    doc.setFontSize(i === 0 ? 11 : 8);
    setTextColor(i === 0 ? GREEN : TEXT_DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(b.value.charAt(0).toUpperCase() + b.value.slice(1), margin + i * sbW + sbW / 2, y + 10, { align: 'center' });
  });
  y += 17;

  // Divider
  setFill(AMBER);
  doc.rect(margin, y, pageW - margin * 2, 0.8, 'F');
  y += 6;

  // ── Section helpers ────────────────────────────────────────────────────────
  const sectionTitle = (title: string) => {
    checkNewPage(15);
    setFill(LIGHT_GREEN);
    doc.rect(margin, y - 4, pageW - margin * 2, 10, 'F');
    doc.setFontSize(11);
    setTextColor(GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 2, y + 2);
    y += 10;
  };

  const bulletItem = (text: string, indent = 0) => {
    checkNewPage(8);
    doc.setFontSize(9);
    setTextColor(TEXT_DARK);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(`• ${text}`, pageW - margin * 2 - indent - 5);
    doc.text(lines, margin + indent + 2, y);
    y += lines.length * 5;
  };

  const labelValue = (label: string, value: string) => {
    checkNewPage(7);
    doc.setFontSize(9);
    setTextColor(TEXT_GRAY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin + 2, y);
    setTextColor(TEXT_DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 35, y);
    y += 6;
  };

  // ── Section 1: Diagnóstico ─────────────────────────────────────────────────
  sectionTitle('1. Diagnóstico Capilar');

  const badges = [
    { label: 'Tipo de Rizo', value: consulta.tipoRizoPrincipal },
    { label: 'Porosidad', value: consulta.porosidad || '—' },
    { label: 'Densidad', value: consulta.densidad || '—' },
    { label: 'Grosor', value: consulta.grosor || '—' },
    { label: 'Elasticidad', value: consulta.elasticidad || '—' },
  ];

  const badgeW = (pageW - margin * 2) / badges.length;
  badges.forEach((b, i) => {
    setFill('#EEF5ED');
    doc.roundedRect(margin + i * badgeW, y, badgeW - 2, 14, 2, 2, 'F');
    doc.setFontSize(7);
    setTextColor(TEXT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(b.label, margin + i * badgeW + badgeW / 2 - 1, y + 4, { align: 'center' });
    doc.setFontSize(9);
    setTextColor(GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text(b.value.charAt(0).toUpperCase() + b.value.slice(1), margin + i * badgeW + badgeW / 2 - 1, y + 10, { align: 'center' });
  });
  y += 18;

  const balanceLabels: Record<string, string> = {
    hidratacion: 'Necesita HIDRATACIÓN',
    nutricion: 'Necesita NUTRICIÓN',
    proteina: 'Necesita PROTEÍNA',
    equilibrado: 'EQUILIBRADO',
  };
  const balanceBg = consulta.balanceHP === 'proteina' ? '#FFEDD5'
    : consulta.balanceHP === 'hidratacion' ? '#DBEAFE'
    : consulta.balanceHP === 'nutricion' ? '#D1FAE5' : '#EDE9FE';
  const balanceText = consulta.balanceHP === 'proteina' ? '#9A3412'
    : consulta.balanceHP === 'hidratacion' ? '#1D4ED8'
    : consulta.balanceHP === 'nutricion' ? '#065F46' : '#5B21B6';

  setFill(balanceBg);
  doc.roundedRect(margin, y, pageW - margin * 2, 10, 3, 3, 'F');
  doc.setFontSize(10);
  setTextColor(balanceText);
  doc.setFont('helvetica', 'bold');
  doc.text(`Balance: ${(consulta.balanceHP ? balanceLabels[consulta.balanceHP] : undefined) || consulta.balanceHP || '—'}`, pageW / 2, y + 7, { align: 'center' });
  y += 15;

  if (consulta.problemas.length) {
    doc.setFontSize(9);
    setTextColor(TEXT_GRAY);
    doc.setFont('helvetica', 'bold');
    doc.text('Problemas detectados:', margin + 2, y);
    y += 5;
    consulta.problemas.forEach((p) => bulletItem(p));
  }
  y += 3;

  // ── Section 2: Treatment ───────────────────────────────────────────────────
  sectionTitle('2. Tratamiento Recomendado');

  const tratBg = getTratamientoBg(consulta.resultado.tratamientoPrincipal);
  const tratColor = getTratamientoTextColor(consulta.resultado.tratamientoPrincipal);
  setFill(tratBg);
  doc.roundedRect(margin, y, pageW - margin * 2, 10, 3, 3, 'F');
  doc.setFontSize(11);
  setTextColor(tratColor);
  doc.setFont('helvetica', 'bold');
  doc.text(consulta.resultado.tratamientoPrincipal, pageW / 2, y + 7, { align: 'center' });
  y += 15;

  if (consulta.resultado.tratamientosAdicionales.length) {
    doc.setFontSize(9);
    setTextColor(TEXT_GRAY);
    doc.setFont('helvetica', 'bold');
    doc.text('Tratamientos adicionales:', margin + 2, y);
    y += 5;
    consulta.resultado.tratamientosAdicionales.forEach((t) => bulletItem(t));
  }
  y += 3;

  // ── Section 3: Cronograma ──────────────────────────────────────────────────
  sectionTitle('3. Cronograma Capilar — 4 Semanas');

  const semanas = [
    { label: 'Semana 1', value: consulta.resultado.cronograma.semana1 },
    { label: 'Semana 2', value: consulta.resultado.cronograma.semana2 },
    { label: 'Semana 3', value: consulta.resultado.cronograma.semana3 },
    { label: 'Semana 4', value: consulta.resultado.cronograma.semana4 },
  ];
  const semW = (pageW - margin * 2) / 4;
  semanas.forEach((s, i) => {
    const bg = getTratamientoBg(s.value);
    const tc = getTratamientoTextColor(s.value);
    setFill(bg);
    doc.roundedRect(margin + i * semW + 1, y, semW - 3, 18, 2, 2, 'F');
    doc.setFontSize(7);
    setTextColor(TEXT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(s.label, margin + i * semW + semW / 2 - 1, y + 5, { align: 'center' });
    doc.setFontSize(8);
    setTextColor(tc);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(s.value, semW - 6);
    doc.text(lines[0] || s.value, margin + i * semW + semW / 2 - 1, y + 12, { align: 'center' });
  });
  y += 24;

  // ── Section 4: Técnica ─────────────────────────────────────────────────────
  sectionTitle('4. Técnica de Definición');

  setFill('#FBF4EC');
  doc.roundedRect(margin, y, pageW - margin * 2, 8, 2, 2, 'F');
  doc.setFontSize(10);
  setTextColor(AMBER);
  doc.setFont('helvetica', 'bold');
  doc.text(consulta.resultado.tecnicaDefinicion, margin + 3, y + 5);
  y += 12;

  doc.setFontSize(9);
  setTextColor(TEXT_DARK);
  doc.setFont('helvetica', 'normal');
  const tecLines = doc.splitTextToSize(consulta.resultado.tecnicaDescripcion, pageW - margin * 2 - 4);
  checkNewPage(tecLines.length * 5 + 5);
  doc.text(tecLines, margin + 2, y);
  y += tecLines.length * 5 + 4;

  labelValue('Método de secado', consulta.resultado.metodoSecado);
  y += 3;

  // ── Section 5: Routine ─────────────────────────────────────────────────────
  checkNewPage(30);
  sectionTitle('5. Rutina para Casa');

  const routineBlock = (title: string, items: string[]) => {
    checkNewPage(10 + items.length * 6);
    doc.setFontSize(9);
    setTextColor(GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 2, y);
    y += 5;
    items.forEach((item) => bulletItem(item, 2));
    y += 3;
  };

  routineBlock('Día de Lavado', consulta.resultado.cuidadoCasa.diaLavado);
  routineBlock('Mantenimiento Nocturno', consulta.resultado.cuidadoCasa.nocturno);
  routineBlock('Refresh Días 2-3', consulta.resultado.cuidadoCasa.refresh);
  routineBlock('Evitar', consulta.resultado.cuidadoCasa.evitar);

  // ── Section 6: Productos recomendados ──────────────────────────────────────
  checkNewPage(60);
  sectionTitle('6. Productos Recomendados Para Ti');

  // Reconstruye la recomendación estructurada para consultas antiguas que no la tengan.
  const reco: RecomendacionProductos =
    consulta.resultado.recomendacionProductos ??
    buildRecomendacionProductos({
      rizo: consulta.tipoRizoPrincipal,
      porosidad: consulta.porosidad,
      balanceHP: consulta.balanceHP,
      tipoDano: consulta.tipoDano,
      problemas: consulta.problemas,
      estadoCueroCabelludo: consulta.estadoCueroCabelludo,
      embarazo: consulta.embarazo,
    });

  doc.setFontSize(9);
  setTextColor(TEXT_DARK);
  doc.setFont('helvetica', 'normal');
  const introLines = doc.splitTextToSize(
    `Tu cabello tipo ${consulta.tipoRizoPrincipal || '—'} necesita productos con estas características:`,
    pageW - margin * 2 - 4
  );
  doc.text(introLines, margin + 2, y);
  y += introLines.length * 5 + 3;

  // Buscar
  checkNewPage(10 + reco.ingredientesBuscar.length * 5);
  doc.setFontSize(10);
  setTextColor(GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text('DEBES BUSCAR:', margin + 2, y);
  y += 6;
  reco.ingredientesBuscar.forEach((ing) => {
    checkNewPage(8);
    doc.setFontSize(9);
    setTextColor(GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text('✓', margin + 3, y);
    setTextColor(TEXT_DARK);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(ing, pageW - margin * 2 - 10);
    doc.text(lines, margin + 8, y);
    y += lines.length * 5;
  });
  y += 3;

  // Evitar
  checkNewPage(10 + reco.ingredientesEvitar.length * 5);
  doc.setFontSize(10);
  setTextColor('#8E2D2D');
  doc.setFont('helvetica', 'bold');
  doc.text('EVITA:', margin + 2, y);
  y += 6;
  reco.ingredientesEvitar.forEach((ing) => {
    checkNewPage(8);
    doc.setFontSize(9);
    setTextColor('#8E2D2D');
    doc.setFont('helvetica', 'bold');
    doc.text('✗', margin + 3, y);
    setTextColor(TEXT_DARK);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(ing, pageW - margin * 2 - 10);
    doc.text(lines, margin + 8, y);
    y += lines.length * 5;
  });
  y += 4;

  // Rutina
  checkNewPage(12 + reco.rutina.length * 8);
  doc.setFontSize(10);
  setTextColor(GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text('RUTINA RECOMENDADA:', margin + 2, y);
  y += 6;
  reco.rutina.forEach((paso, i) => {
    checkNewPage(10);
    doc.setFontSize(9);
    setTextColor(AMBER);
    doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}.`, margin + 3, y);
    setTextColor(TEXT_DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(paso.producto, margin + 9, y);
    doc.setFont('helvetica', 'normal');
    setTextColor(TEXT_GRAY);
    const cuerpo = ` — ${paso.caracteristicas} · ${paso.frecuencia}`;
    const wrapped = doc.splitTextToSize(cuerpo, pageW - margin * 2 - 35);
    doc.text(wrapped, margin + 9 + doc.getTextWidth(paso.producto), y);
    y += Math.max(5, wrapped.length * 5);
  });
  y += 3;

  // Disclaimer
  checkNewPage(16);
  setFill('#FBF4EC');
  const discLines = doc.splitTextToSize(reco.disclaimer, pageW - margin * 2 - 6);
  const discBoxH = discLines.length * 4.2 + 6;
  doc.roundedRect(margin, y, pageW - margin * 2, discBoxH, 2, 2, 'F');
  doc.setFontSize(8);
  setTextColor(TEXT_GRAY);
  doc.setFont('helvetica', 'italic');
  doc.text(discLines, margin + 3, y + 5);
  y += discBoxH + 4;

  // ── Section 7: Notes ───────────────────────────────────────────────────────
  if (consulta.resultado.notasAdicionales.length) {
    checkNewPage(20);
    sectionTitle('7. Notas Adicionales');
    consulta.resultado.notasAdicionales.forEach((n) => bulletItem(n));
    y += 3;
  }

  // ── Section 8: Estilista notes + satisfaction ──────────────────────────────
  if (consulta.notasEstilista || consulta.satisfaccionEstrellas) {
    checkNewPage(25);
    sectionTitle('8. Notas de la Estilista');
    if (consulta.notasEstilista) {
      const nLines = doc.splitTextToSize(consulta.notasEstilista, pageW - margin * 2 - 4);
      doc.setFontSize(9);
      setTextColor(TEXT_DARK);
      doc.setFont('helvetica', 'normal');
      doc.text(nLines, margin + 2, y);
      y += nLines.length * 5 + 4;
    }
    if (consulta.satisfaccionEstrellas) {
      doc.setFontSize(9);
      setTextColor(AMBER);
      doc.setFont('helvetica', 'bold');
      const stars = '★'.repeat(consulta.satisfaccionEstrellas) + '☆'.repeat(5 - consulta.satisfaccionEstrellas);
      doc.text(`Satisfacción: ${stars} (${consulta.satisfaccionEstrellas}/5)`, margin + 2, y);
      y += 7;
    }
    y += 3;
  }

  // ── Section 9: Next appointment ────────────────────────────────────────────
  checkNewPage(25);
  sectionTitle('9. Próxima Cita');

  setFill(LIGHT_GREEN);
  doc.roundedRect(margin, y, pageW - margin * 2, 16, 3, 3, 'F');
  doc.setFontSize(9);
  setTextColor(TEXT_GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text('Intervalo recomendado:', margin + 4, y + 7);
  doc.setFontSize(10);
  setTextColor(GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text(consulta.resultado.intervaloSugerido, margin + 4, y + 13);

  if (consulta.proximaCita) {
    doc.setFontSize(9);
    setTextColor(TEXT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text('Fecha agendada:', pageW / 2 + 4, y + 7);
    doc.setFontSize(10);
    setTextColor(GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(consulta.proximaCita), pageW / 2 + 4, y + 13);
  }
  y += 22;

  // ── Section 10: Registro fotográfico ──────────────────────────────────────
  const hasAntes = !!consulta.fotoAntes;
  const hasDespues = !!consulta.fotoDespues;
  const hasAnalisis = !!(consulta.fotoAnalisis && consulta.fotoAnalisis.length > 0);

  if (hasAntes || hasDespues || hasAnalisis) {
    addPage();
    sectionTitle('10. Registro Fotográfico');
    y += 2;

    // Before / After side by side
    if (hasAntes || hasDespues) {
      const maxPhotoW = 85;
      const maxPhotoH = 80;
      let rowHeight = 0;

      if (hasAntes) {
        const h = await addPhotoToDoc(doc, consulta.fotoAntes!, margin, y, maxPhotoW, maxPhotoH);
        if (h > rowHeight) rowHeight = h;
        doc.setFontSize(8);
        setTextColor(TEXT_GRAY);
        doc.setFont('helvetica', 'bold');
        doc.text('ANTES', margin + maxPhotoW / 2, y + h + 4, { align: 'center' });
      }

      if (hasDespues) {
        const xD = margin + 90;
        const h = await addPhotoToDoc(doc, consulta.fotoDespues!, xD, y, maxPhotoW, maxPhotoH);
        if (h > rowHeight) rowHeight = h;
        doc.setFontSize(8);
        setTextColor(TEXT_GRAY);
        doc.setFont('helvetica', 'bold');
        doc.text('DESPUÉS', xD + maxPhotoW / 2, y + h + 4, { align: 'center' });
      }

      y += rowHeight + 10;
    }

    // Analysis photos row (up to 3)
    if (hasAnalisis) {
      checkNewPage(65);
      const photoW = 53;
      const photoH = 55;
      const angleLabels = ['Frontal', 'Lateral', 'Corona'];
      let rowH = 0;

      for (let i = 0; i < Math.min(consulta.fotoAnalisis!.length, 3); i++) {
        const xP = margin + i * (photoW + 4);
        const h = await addPhotoToDoc(doc, consulta.fotoAnalisis![i], xP, y, photoW, photoH);
        if (h > rowH) rowH = h;
        doc.setFontSize(7);
        setTextColor(TEXT_GRAY);
        doc.setFont('helvetica', 'normal');
        doc.text(angleLabels[i] || `Foto ${i + 1}`, xP + photoW / 2, y + h + 3, { align: 'center' });
      }
      y += rowH + 8;
    }
  }

  addFooter();
  doc.save(`Velli-${clienta.nombre.replace(/\s+/g, '_')}-${consulta.fecha}.pdf`);
}
