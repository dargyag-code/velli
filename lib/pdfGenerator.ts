import jsPDF from 'jspdf';
import { Clienta, Consulta, RecomendacionProductos } from './types';
import { formatDate, getTratamientoBg, getTratamientoTextColor } from './utils';
import { resolveFotoUrl } from './storage';
import { buildRecomendacionProductos } from './diagnosticEngine';
import { getProfile, updateProfile } from './profile';

// ── Editorial palette (alineado a Mejoras.html · A4 · forest + gold) ──────
// FOREST_DEFAULT es el acento Velli; dentro de generateConsultaPDF se
// shadowea con el color_primario del perfil (marca del salón, paso 2 del
// onboarding) cuando la estilista personalizó su marca.
const FOREST_DEFAULT = '#2D5A27';
const FOREST_DEEP = '#14241A';
const GOLD = '#E8C290';
const GOLD_DEEP = '#B47E4D';
const CREAM = '#F5EDDC';
const CREAM_PAPER = '#FAF5EE';
const PAPER = '#FFFEFB';
const TEXT_DARK = '#1A1814';
const TEXT_GRAY = '#5C544A';
const TEXT_MUTED = '#8C8378';
const TEXT_FAINT = '#B5AB9D';
const BORDER = '#E5DFD2';
const BORDER_SOFT = '#EFE9DB';
const ACCENT_PALE = '#F4F8F2';
const DANGER = '#8E2D2D';

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
): Promise<{ w: number; h: number }> {
  try {
    const resolved = (await resolveFotoUrl(source)) || source;
    const dataUrl = await toDataUrl(resolved);
    const dims = await getImageDimensions(dataUrl);
    const { w, h } = scaleToBounds(dims.w, dims.h, maxW, maxH);
    const format = getImageFormat(dataUrl);
    doc.addImage(dataUrl, format, x, y, w, h);
    return { w, h };
  } catch (err) {
    console.warn('[pdf] no se pudo incrustar foto:', err);
    return { w: 0, h: 0 };
  }
}

// ── Folio + meta helpers ───────────────────────────────────────────────────

function buildFolio(consulta: Consulta): string {
  const year = (consulta.fecha || new Date().toISOString()).slice(0, 4);
  const seq = String(consulta.numeroConsulta || 1).padStart(4, '0');
  return `VLI-${year}-${seq}`;
}

function tipoLabel(tipo?: string): string {
  if (!tipo) return 'Tipo en estudio';
  const t = tipo.toUpperCase();
  if (t.startsWith('1')) return 'Cabello liso';
  if (t.startsWith('2')) return 'Ondulado';
  if (t.startsWith('3')) return 'Rizos definidos';
  if (t.startsWith('4')) return 'Rizos compactos';
  return 'Tipo único';
}

function cap(s: string | undefined): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isHex6(v: string | undefined): v is string {
  return !!v && /^#[0-9A-Fa-f]{6}$/.test(v);
}

// ── Main export ────────────────────────────────────────────────────────────

export async function generateConsultaPDF(clienta: Clienta, consulta: Consulta): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 18;
  const contentW = pageW - margin * 2;

  const folio = buildFolio(consulta);
  const today = formatDate(consulta.fecha);

  // ── Marca del salón (paso 2 del onboarding) ──────────────────────────────
  // El color principal del perfil tiñe los acentos (shadowing de
  // FOREST_DEFAULT); el logo y el nombre del salón visten el header. Sin
  // personalización (o sin red), el PDF sale con la marca Velli de siempre.
  const profile = await getProfile().catch(() => null);
  const colorMarca = profile?.colorPrimario;
  const FOREST = isHex6(colorMarca) ? colorMarca : FOREST_DEFAULT;

  let logo: { dataUrl: string; w: number; h: number } | null = null;
  if (profile?.logoUrl) {
    try {
      const resolved = (await resolveFotoUrl(profile.logoUrl)) || profile.logoUrl;
      const dataUrl = await toDataUrl(resolved);
      const dims = await getImageDimensions(dataUrl);
      const fitted = scaleToBounds(dims.w, dims.h, 12, 12); // caja de 14mm − 1mm de aire
      logo = { dataUrl, ...fitted };
    } catch (err) {
      console.warn('[pdf] no se pudo cargar el logo del salón:', err);
    }
  }

  // ── color helpers ────────────────────────────────────────────────────────
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
  const setStroke = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    doc.setDrawColor(r, g, b);
  };
  const setTextColor = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    doc.setTextColor(r, g, b);
  };

  // ── footer (every page) ──────────────────────────────────────────────────
  const drawFooter = (pageNo: number, totalHint?: number) => {
    const fy = pageH - 22;
    setFill(CREAM_PAPER);
    doc.rect(0, pageH - 22, pageW, 22, 'F');
    setStroke(BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 22, pageW - margin, pageH - 22);

    // QR placeholder (checker)
    const qrSize = 12;
    const qrX = margin;
    const qrY = pageH - 18;
    setFill(PAPER);
    doc.rect(qrX, qrY, qrSize, qrSize, 'F');
    setFill(FOREST);
    const cell = qrSize / 6;
    [0, 1, 2, 3, 4, 5].forEach((i) =>
      [0, 1, 2, 3, 4, 5].forEach((j) => {
        if ((i + j) % 2 === 0) doc.rect(qrX + i * cell, qrY + j * cell, cell, cell, 'F');
      })
    );

    doc.setFontSize(7);
    setTextColor(TEXT_MUTED);
    doc.setFont('helvetica', 'bold');
    doc.text('ESCANEA PARA', qrX + qrSize + 3, qrY + 3.6);
    doc.setFontSize(9);
    setTextColor(TEXT_DARK);
    doc.setFont('times', 'normal');
    doc.text('ver tu plan en la app', qrX + qrSize + 3, qrY + 8);

    doc.setFontSize(7);
    setTextColor(TEXT_FAINT);
    doc.setFont('courier', 'normal');
    const right = `· velli.app · ${folio} · página ${pageNo}${totalHint ? ` de ${totalHint}` : ''} ·`;
    doc.text(right, pageW - margin, fy + 0, { align: 'right', baseline: 'middle' });
  };

  // ── header (first page only) ─────────────────────────────────────────────
  const drawHeader = () => {
    // Forest gradient simulated with two solid bands
    setFill(FOREST_DEEP);
    doc.rect(0, 0, pageW, 56, 'F');
    setFill(FOREST);
    doc.rect(0, 0, pageW * 0.55, 56, 'F');
    // Subtle inner highlight band
    setFill(FOREST_DEEP);
    doc.rect(0, 50, pageW, 6, 'F');

    // Logo block — logo del salón si existe; si no, la "V" de Velli
    const logoBoxW = 14;
    if (logo) {
      setFill('#FFFFFF');
      doc.roundedRect(margin, 10, logoBoxW, logoBoxW, 2, 2, 'F');
      setStroke(GOLD);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin, 10, logoBoxW, logoBoxW, 2, 2, 'S');
      try {
        doc.addImage(
          logo.dataUrl,
          getImageFormat(logo.dataUrl),
          margin + (logoBoxW - logo.w) / 2,
          10 + (logoBoxW - logo.h) / 2,
          logo.w,
          logo.h
        );
      } catch (err) {
        console.warn('[pdf] formato de logo no soportado:', err);
      }
    } else {
      setFill(FOREST_DEEP);
      doc.roundedRect(margin, 10, logoBoxW, logoBoxW, 2, 2, 'F');
      setStroke(GOLD);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin, 10, logoBoxW, logoBoxW, 2, 2, 'S');

      doc.setFont('times', 'italic');
      doc.setFontSize(20);
      setTextColor(GOLD);
      doc.text('V', margin + logoBoxW / 2, 20.5, { align: 'center' });
      setFill(GOLD);
      doc.circle(margin + logoBoxW - 3, 21, 0.6, 'F');
    }

    // Brand wordmark — nombre del salón si existe; si no, la marca Velli
    const nombreMarca = profile?.nombreSalon?.trim();
    if (nombreMarca) {
      doc.setFont('times', 'normal');
      // 42mm reservados a la derecha para el bloque de folio
      const maxBrandW = pageW - margin * 2 - logoBoxW - 4 - 42;
      let brandSize = 15;
      doc.setFontSize(brandSize);
      while (brandSize > 10 && doc.getTextWidth(nombreMarca) > maxBrandW) {
        brandSize -= 1;
        doc.setFontSize(brandSize);
      }
      let brandText = nombreMarca;
      while (brandText.length > 4 && doc.getTextWidth(`${brandText}…`) > maxBrandW) {
        brandText = brandText.slice(0, -1);
      }
      if (brandText !== nombreMarca) brandText += '…';
      setTextColor(CREAM);
      doc.text(brandText, margin + logoBoxW + 4, 17.2);
    } else {
      doc.setFont('times', 'normal');
      doc.setFontSize(15);
      setTextColor(CREAM);
      doc.text('Velli', margin + logoBoxW + 4, 17.2);
      doc.setFont('times', 'italic');
      setTextColor(GOLD);
      doc.text(' · Pro', margin + logoBoxW + 4 + doc.getTextWidth('Velli'), 17.2);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    setTextColor('#D8C9A8');
    doc.text('DIAGNÓSTICO CAPILAR', margin + logoBoxW + 4, 22, { charSpace: 0.6 });

    // Folio (right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    setTextColor('#C9B68F');
    doc.text('FOLIO', pageW - margin, 13.5, { align: 'right', charSpace: 0.6 });
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    setTextColor(GOLD);
    doc.text(folio, pageW - margin, 17.5, { align: 'right' });
    doc.setFontSize(7.5);
    setTextColor('#C9B68F');
    doc.text(today, pageW - margin, 21.2, { align: 'right' });

    // Headline — cliente name (Para, Nombre Apellido)
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    setTextColor(GOLD);
    doc.text('Para,', margin, 33);

    doc.setFont('times', 'normal');
    doc.setFontSize(26);
    setTextColor(CREAM);
    const partes = clienta.nombre.split(' ');
    const main = partes.slice(0, 2).join(' ');
    const tail = partes.slice(2).join(' ');
    doc.text(main, margin, 44);
    if (tail) {
      doc.setFont('times', 'italic');
      setTextColor(GOLD);
      const mainW = doc.getTextWidth(main + ' ');
      doc.setFont('times', 'normal');
      doc.setFontSize(26);
      doc.setFont('times', 'italic');
      doc.text(' ' + tail, margin + mainW - 1, 44);
    }

    // Hair type chip (right)
    const tipo = consulta.tipoRizoPrincipal || '—';
    const lbl = tipoLabel(consulta.tipoRizoPrincipal);
    const chipText = `tipo ${tipo} · ${lbl}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const chipW = doc.getTextWidth(chipText) + 12;
    const chipX = pageW - margin - chipW;
    const chipY = 39;
    setStroke(GOLD);
    doc.setLineWidth(0.3);
    doc.roundedRect(chipX, chipY, chipW, 7.5, 3.5, 3.5, 'S');
    setFill(GOLD);
    doc.circle(chipX + 4, chipY + 3.8, 0.9, 'F');
    setTextColor(GOLD);
    doc.text(chipText, chipX + 7, chipY + 5);

    // ── meta strip ────────────────────────────────────────────────────────
    setFill(CREAM);
    doc.rect(0, 56, pageW, 9, 'F');
    setStroke(BORDER);
    doc.setLineWidth(0.2);
    doc.line(0, 65, pageW, 65);

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    setTextColor(TEXT_GRAY);

    const stripItems: string[] = [];
    if (clienta.telefono) stripItems.push(`· ${clienta.telefono}`);
    if (clienta.edad) stripItems.push(`· ${clienta.edad} años`);
    stripItems.push(`· consulta #${consulta.numeroConsulta}`);
    stripItems.push(`· ${today}`);
    const cellW = contentW / stripItems.length;
    stripItems.forEach((s, i) => {
      doc.text(s, margin + i * cellW, 61);
    });
  };

  // ── pagination state ─────────────────────────────────────────────────────
  let y = 0;
  let pageNo = 1;
  const pageBreakAt = pageH - 30;

  const addNewPage = () => {
    drawFooter(pageNo);
    doc.addPage();
    pageNo += 1;
    y = margin + 6;
    drawFooter(pageNo);
  };

  const need = (h: number) => {
    if (y + h > pageBreakAt) addNewPage();
  };

  // ── editorial section head ───────────────────────────────────────────────
  const sectionHead = (num: string, eyebrow: string, title: string) => {
    need(20);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    setTextColor(TEXT_MUTED);
    doc.text(`· ${num}`, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setTextColor(FOREST);
    doc.text(eyebrow.toUpperCase(), margin + 7, y, { charSpace: 0.7 });

    doc.setFont('times', 'normal');
    doc.setFontSize(15);
    setTextColor(TEXT_DARK);
    doc.text(title, margin, y + 6);

    // gradient line — fade forest → paper across the section width
    const lineY = y + 8.2;
    const segs = 14;
    const seg = contentW / segs;
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const r = Math.round(45 + (255 - 45) * t);
      const g = Math.round(90 + (255 - 90) * t);
      const b = Math.round(39 + (255 - 39) * t);
      doc.setFillColor(r, g, b);
      doc.rect(margin + i * seg, lineY, seg + 0.3, 0.4, 'F');
    }
    y += 12;
  };

  // ── metric card (4-up grid) ──────────────────────────────────────────────
  const metricCard = (
    x: number,
    yy: number,
    w: number,
    h: number,
    label: string,
    value: string,
    sub: string
  ) => {
    setFill(PAPER);
    setStroke(BORDER_SOFT);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, yy, w, h, 1.5, 1.5, 'FD');
    // accent strip
    setFill(FOREST);
    doc.rect(x, yy, 8, 0.6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    setTextColor(TEXT_MUTED);
    doc.text(label.toUpperCase(), x + 3, yy + 4.5, { charSpace: 0.7 });

    doc.setFont('times', 'normal');
    doc.setFontSize(13);
    setTextColor(TEXT_DARK);
    const vLines = doc.splitTextToSize(value, w - 6);
    doc.text(vLines[0] || value, x + 3, yy + 10);

    doc.setFont('times', 'italic');
    doc.setFontSize(7);
    setTextColor(TEXT_MUTED);
    const subLines = doc.splitTextToSize(sub, w - 6);
    doc.text(subLines.slice(0, 2), x + 3, yy + 14);
  };

  // ── editorial chip (used for treatment names) ────────────────────────────
  const editorialChip = (text: string, bg: string, color: string, accent: string) => {
    need(11);
    setFill(bg);
    doc.roundedRect(margin, y, contentW, 9, 2, 2, 'F');
    setFill(accent);
    doc.rect(margin, y, 1.6, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setTextColor(color);
    doc.text(text, margin + 5, y + 6);
    y += 11;
  };

  // ── numbered card list (Routine / Plan items) ────────────────────────────
  const numberedCard = (n: string, title: string, subtitle?: string) => {
    const lines = subtitle ? doc.splitTextToSize(subtitle, contentW - 24) as string[] : [];
    const cardH = Math.max(13, 9 + lines.length * 4);
    need(cardH + 2);

    setFill(PAPER);
    setStroke(BORDER_SOFT);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, y, contentW, cardH, 2, 2, 'FD');

    setFill(CREAM_PAPER);
    doc.roundedRect(margin + 2, y + 2, 9, 9, 1.5, 1.5, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    setTextColor(GOLD_DEEP);
    doc.text(n, margin + 6.5, y + 8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setTextColor(TEXT_DARK);
    doc.text(title, margin + 14, y + 6);

    if (subtitle) {
      doc.setFont('times', 'italic');
      doc.setFontSize(8.5);
      setTextColor(TEXT_GRAY);
      doc.text(lines, margin + 14, y + 10);
    }

    y += cardH + 2;
  };

  // ── recommendations panel (numbered, dashed dividers) ────────────────────
  const recommendationsPanel = (items: string[]) => {
    if (!items.length) return;
    need(14);
    const wrapped = items.map((it) => doc.splitTextToSize(it, contentW - 18) as string[]);
    const totalH = 6 + wrapped.reduce((acc, w) => acc + Math.max(5, w.length * 4) + 2, 0);
    need(totalH + 2);

    setFill(ACCENT_PALE);
    setStroke('#C8DDC4');
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, y, contentW, totalH, 2.5, 2.5, 'FD');

    let yy = y + 5;
    wrapped.forEach((lines, i) => {
      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      setTextColor(FOREST);
      doc.text(String(i + 1).padStart(2, '0'), margin + 4, yy);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setTextColor(TEXT_DARK);
      doc.text(lines, margin + 12, yy);
      yy += Math.max(5, lines.length * 4);

      if (i < wrapped.length - 1) {
        setStroke('#9DBE9A');
        doc.setLineDashPattern([0.6, 0.8], 0);
        doc.setLineWidth(0.2);
        doc.line(margin + 12, yy + 0.5, pageW - margin - 6, yy + 0.5);
        doc.setLineDashPattern([], 0);
        yy += 2;
      }
    });
    y += totalH + 4;
  };

  // ── highlighted line (cuero cabelludo, etc) ──────────────────────────────
  const highlightLine = (label: string, body: string) => {
    const lines = doc.splitTextToSize(`${label} · ${body}`, contentW - 8) as string[];
    const h = 4 + lines.length * 4;
    need(h + 3);
    setFill('#FAF5EE');
    doc.roundedRect(margin, y, contentW, h, 1.5, 1.5, 'F');
    setFill(FOREST);
    doc.rect(margin, y, 1.2, h, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setTextColor(TEXT_GRAY);
    doc.text(lines, margin + 4, y + 5);
    y += h + 3;
  };

  // ── start drawing ────────────────────────────────────────────────────────
  drawHeader();
  y = 72;
  drawFooter(1);

  // ── Section 01 · Análisis ────────────────────────────────────────────────
  sectionHead('01', 'Análisis', 'Lo que vimos en tu cabello');

  const tipo = consulta.tipoRizoPrincipal || '—';
  const cards = [
    { label: 'Tipo de rizo', value: tipo, sub: tipoLabel(consulta.tipoRizoPrincipal) },
    { label: 'Porosidad', value: cap(consulta.porosidad), sub: 'absorción y retención' },
    { label: 'Densidad', value: cap(consulta.densidad), sub: 'hebras por cm²' },
    { label: 'Elasticidad', value: cap(consulta.elasticidad), sub: 'recuperación al estirar' },
  ];
  const gap = 3;
  const cardW = (contentW - gap * 3) / 4;
  const cardH = 18;
  need(cardH + 4);
  cards.forEach((c, i) => {
    metricCard(margin + i * (cardW + gap), y, cardW, cardH, c.label, c.value, c.sub);
  });
  y += cardH + 6;

  // Photo strip — only if any photos
  const photos: { src: string; label: string }[] = [];
  if (consulta.fotoAntes) photos.push({ src: consulta.fotoAntes, label: 'Antes' });
  if (consulta.fotoDespues) photos.push({ src: consulta.fotoDespues, label: 'Después' });
  if (consulta.fotoAnalisis && consulta.fotoAnalisis[0]) {
    photos.push({ src: consulta.fotoAnalisis[0], label: 'Análisis IA' });
  }
  if (photos.length > 0) {
    need(38);
    const slots = Math.min(photos.length, 3);
    const photoGap = 3;
    const slotW = (contentW - photoGap * (slots - 1)) / slots;
    const slotH = 32;
    for (let i = 0; i < slots; i++) {
      const x = margin + i * (slotW + photoGap);
      setFill('#3D2A1C');
      doc.roundedRect(x, y, slotW, slotH, 2, 2, 'F');
      await addPhotoToDoc(doc, photos[i].src, x, y, slotW, slotH);
      // caption gradient
      setFill('#1F1108');
      doc.rect(x, y + slotH - 6, slotW, 6, 'F');
      doc.setFont('courier', 'normal');
      doc.setFontSize(6.5);
      setTextColor('#F0E6D0');
      doc.text(`· ${photos[i].label.toUpperCase()}`, x + 2, y + slotH - 1.8, { charSpace: 0.6 });
    }
    y += slotH + 4;
  }

  // Cuero cabelludo line
  if (consulta.estadoCueroCabelludo?.length) {
    highlightLine('Cuero cabelludo', consulta.estadoCueroCabelludo.join(', '));
  }

  // Balance HP / Problemas (preserved from original)
  const balanceLabels: Record<string, string> = {
    hidratacion: 'Necesita hidratación',
    nutricion: 'Necesita nutrición',
    proteina: 'Necesita proteína',
    equilibrado: 'Equilibrado',
  };
  if (consulta.balanceHP) {
    const bg =
      consulta.balanceHP === 'proteina' ? '#FFEDD5'
      : consulta.balanceHP === 'hidratacion' ? '#DBEAFE'
      : consulta.balanceHP === 'nutricion' ? '#D1FAE5' : '#EDE9FE';
    const tc =
      consulta.balanceHP === 'proteina' ? '#9A3412'
      : consulta.balanceHP === 'hidratacion' ? '#1D4ED8'
      : consulta.balanceHP === 'nutricion' ? '#065F46' : '#5B21B6';
    editorialChip(`Balance HP · ${balanceLabels[consulta.balanceHP]}`, bg, tc, tc);
  }

  if (consulta.problemas?.length) {
    need(8 + consulta.problemas.length * 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setTextColor(TEXT_GRAY);
    doc.text('Problemas detectados', margin, y);
    y += 4;
    consulta.problemas.forEach((p) => {
      need(5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setTextColor(TEXT_DARK);
      const lines = doc.splitTextToSize(`· ${p}`, contentW - 4) as string[];
      doc.text(lines, margin + 2, y);
      y += lines.length * 4;
    });
    y += 3;
  }
  y += 4;

  // ── Section 02 · Tratamiento ─────────────────────────────────────────────
  sectionHead('02', 'Tratamiento', 'Tu plan principal');

  const tratBg = getTratamientoBg(consulta.resultado.tratamientoPrincipal);
  const tratColor = getTratamientoTextColor(consulta.resultado.tratamientoPrincipal);
  editorialChip(consulta.resultado.tratamientoPrincipal, tratBg, tratColor, tratColor);

  if (consulta.resultado.tratamientosAdicionales?.length) {
    need(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setTextColor(TEXT_GRAY);
    doc.text('Tratamientos adicionales', margin, y);
    y += 4;
    consulta.resultado.tratamientosAdicionales.forEach((t, i) => {
      numberedCard(String(i + 1).padStart(2, '0'), t);
    });
  }
  y += 3;

  // ── Section 03 · Cronograma ──────────────────────────────────────────────
  sectionHead('03', 'Cronograma', '4 semanas, paso a paso');
  const semanas = [
    { label: 'Semana 1', value: consulta.resultado.cronograma.semana1 },
    { label: 'Semana 2', value: consulta.resultado.cronograma.semana2 },
    { label: 'Semana 3', value: consulta.resultado.cronograma.semana3 },
    { label: 'Semana 4', value: consulta.resultado.cronograma.semana4 },
  ];
  const sgap = 3;
  const sw = (contentW - sgap * 3) / 4;
  const sh = 22;
  need(sh + 4);
  semanas.forEach((s, i) => {
    const x = margin + i * (sw + sgap);
    const bg = getTratamientoBg(s.value);
    const tc = getTratamientoTextColor(s.value);
    setFill(bg);
    doc.roundedRect(x, y, sw, sh, 2, 2, 'F');
    setFill(tc);
    doc.rect(x, y, sw, 0.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    setTextColor(TEXT_MUTED);
    doc.text(s.label.toUpperCase(), x + 3, y + 4.5, { charSpace: 0.6 });
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    setTextColor(tc);
    const lines = doc.splitTextToSize(s.value, sw - 6) as string[];
    doc.text(lines.slice(0, 3), x + 3, y + 9);
  });
  y += sh + 6;

  // ── Section 04 · Técnica ─────────────────────────────────────────────────
  sectionHead('04', 'Técnica', 'Definición y secado');
  editorialChip(consulta.resultado.tecnicaDefinicion, '#FBF4EC', GOLD_DEEP, GOLD_DEEP);

  const tecLines = doc.splitTextToSize(consulta.resultado.tecnicaDescripcion, contentW - 4) as string[];
  need(tecLines.length * 4 + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setTextColor(TEXT_DARK);
  doc.text(tecLines, margin + 2, y);
  y += tecLines.length * 4 + 3;

  highlightLine('Método de secado', consulta.resultado.metodoSecado);
  y += 2;

  // ── Section 05 · Rutina para casa ────────────────────────────────────────
  sectionHead('05', 'Rutina', 'Cuidado en casa');
  const routineBlocks: { title: string; items: string[] }[] = [
    { title: 'Día de lavado', items: consulta.resultado.cuidadoCasa.diaLavado },
    { title: 'Mantenimiento nocturno', items: consulta.resultado.cuidadoCasa.nocturno },
    { title: 'Refresh días 2-3', items: consulta.resultado.cuidadoCasa.refresh },
    { title: 'Evitar', items: consulta.resultado.cuidadoCasa.evitar },
  ];
  routineBlocks.forEach((blk, i) => {
    if (!blk.items?.length) return;
    need(10 + blk.items.length * 5);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    setTextColor(TEXT_MUTED);
    doc.text(`· ${String(i + 1).padStart(2, '0')}`, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTextColor(FOREST);
    doc.text(blk.title.toUpperCase(), margin + 7, y, { charSpace: 0.6 });
    y += 4.5;
    blk.items.forEach((it) => {
      need(5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setTextColor(TEXT_DARK);
      const lines = doc.splitTextToSize(`· ${it}`, contentW - 6) as string[];
      doc.text(lines, margin + 4, y);
      y += lines.length * 4;
    });
    y += 3;
  });

  // ── Section 06 · Productos recomendados ──────────────────────────────────
  sectionHead('06', 'Productos', 'Para tu rutina diaria');
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

  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  setTextColor(TEXT_GRAY);
  const introLines = doc.splitTextToSize(
    `Para cabello tipo ${tipo}, busca productos con estas características:`,
    contentW - 4
  ) as string[];
  need(introLines.length * 4 + 2);
  doc.text(introLines, margin + 2, y);
  y += introLines.length * 4 + 2;

  // Buscar / Evitar — two columns
  if (reco.ingredientesBuscar?.length || reco.ingredientesEvitar?.length) {
    need(8);
    const colW = (contentW - 4) / 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setTextColor(FOREST);
    doc.text('DEBES BUSCAR', margin, y, { charSpace: 0.7 });
    setTextColor(DANGER);
    doc.text('EVITA', margin + colW + 4, y, { charSpace: 0.7 });
    y += 4;

    const buscar = reco.ingredientesBuscar || [];
    const evitar = reco.ingredientesEvitar || [];
    const rowsCount = Math.max(buscar.length, evitar.length);
    for (let i = 0; i < rowsCount; i++) {
      const b = buscar[i];
      const e = evitar[i];
      const bLines = b ? (doc.splitTextToSize(b, colW - 6) as string[]) : [];
      const eLines = e ? (doc.splitTextToSize(e, colW - 6) as string[]) : [];
      const rowH = Math.max(bLines.length, eLines.length, 1) * 4 + 1;
      need(rowH);
      if (b) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        setTextColor(FOREST);
        doc.text('+', margin, y);
        doc.setFont('helvetica', 'normal');
        setTextColor(TEXT_DARK);
        doc.text(bLines, margin + 4, y);
      }
      if (e) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        setTextColor(DANGER);
        doc.text('×', margin + colW + 4, y);
        doc.setFont('helvetica', 'normal');
        setTextColor(TEXT_DARK);
        doc.text(eLines, margin + colW + 8, y);
      }
      y += rowH;
    }
    y += 3;
  }

  // Rutina recomendada — numbered cards
  if (reco.rutina?.length) {
    need(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setTextColor(FOREST);
    doc.text('RUTINA SUGERIDA', margin, y, { charSpace: 0.7 });
    y += 4;
    reco.rutina.forEach((paso, i) => {
      numberedCard(
        String(i + 1).padStart(2, '0'),
        paso.producto,
        `${paso.caracteristicas} · ${paso.frecuencia}`
      );
    });
  }

  // Disclaimer
  if (reco.disclaimer) {
    const dLines = doc.splitTextToSize(reco.disclaimer, contentW - 8) as string[];
    const dH = dLines.length * 3.5 + 4;
    need(dH + 3);
    setFill('#FBF4EC');
    doc.roundedRect(margin, y, contentW, dH, 1.5, 1.5, 'F');
    doc.setFont('times', 'italic');
    doc.setFontSize(7.5);
    setTextColor(TEXT_GRAY);
    doc.text(dLines, margin + 4, y + 4);
    y += dH + 4;
  }

  // ── Section 07 · Recomendaciones (cuidados que multiplican) ──────────────
  if (consulta.resultado.notasAdicionales?.length) {
    sectionHead('07', 'Cuidados', 'Hábitos que multiplican el resultado');
    recommendationsPanel(consulta.resultado.notasAdicionales);
  }

  // ── Section 08 · Notas de la estilista ───────────────────────────────────
  if (consulta.notasEstilista || consulta.satisfaccion) {
    sectionHead('08', 'Estilista', 'Observaciones del servicio');
    if (consulta.notasEstilista) {
      const nLines = doc.splitTextToSize(consulta.notasEstilista, contentW - 4) as string[];
      need(nLines.length * 4 + 4);
      doc.setFont('times', 'italic');
      doc.setFontSize(10);
      setTextColor(TEXT_GRAY);
      doc.text('"', margin, y + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setTextColor(TEXT_DARK);
      doc.text(nLines, margin + 4, y + 1);
      y += nLines.length * 4 + 4;
    }
    if (consulta.satisfaccion) {
      need(7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      setTextColor(TEXT_MUTED);
      doc.text('SATISFACCIÓN', margin, y, { charSpace: 0.7 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      setTextColor(GOLD_DEEP);
      const stars = '★'.repeat(consulta.satisfaccion) + '☆'.repeat(5 - consulta.satisfaccion);
      doc.text(`${stars}  ${consulta.satisfaccion}/5`, margin + 30, y);
      y += 6;
    }
    y += 3;
  }

  // ── Section 09 · Próxima cita ────────────────────────────────────────────
  sectionHead('09', 'Continuidad', 'Próxima cita');
  need(20);
  setFill(ACCENT_PALE);
  setStroke('#C8DDC4');
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentW, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setTextColor(TEXT_MUTED);
  doc.text('INTERVALO RECOMENDADO', margin + 4, y + 5, { charSpace: 0.7 });
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  setTextColor(FOREST);
  doc.text(consulta.resultado.intervaloSugerido, margin + 4, y + 12);

  if (consulta.proximaCita) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setTextColor(TEXT_MUTED);
    doc.text('FECHA AGENDADA', pageW / 2, y + 5, { charSpace: 0.7 });
    doc.setFont('times', 'italic');
    doc.setFontSize(11);
    setTextColor(FOREST);
    doc.text(formatDate(consulta.proximaCita), pageW / 2, y + 12);
  }
  y += 22;

  // ── Section 10 · Registro fotográfico (full page if needed) ──────────────
  const hasAnalisis = !!(consulta.fotoAnalisis && consulta.fotoAnalisis.length > 1);
  if (hasAnalisis) {
    addNewPage();
    y = margin + 6;
    sectionHead('10', 'Registro', 'Captura del análisis IA');
    const angleLabels = ['Frontal', 'Lateral', 'Corona'];
    const photoGap2 = 3;
    const slots = Math.min(consulta.fotoAnalisis!.length, 3);
    const slotW = (contentW - photoGap2 * (slots - 1)) / slots;
    const slotH = 60;
    need(slotH + 8);
    for (let i = 0; i < slots; i++) {
      const x = margin + i * (slotW + photoGap2);
      setFill('#3D2A1C');
      doc.roundedRect(x, y, slotW, slotH, 2, 2, 'F');
      await addPhotoToDoc(doc, consulta.fotoAnalisis![i], x, y, slotW, slotH);
      setFill('#1F1108');
      doc.rect(x, y + slotH - 7, slotW, 7, 'F');
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      setTextColor('#F0E6D0');
      doc.text(`· ${(angleLabels[i] || `Foto ${i + 1}`).toUpperCase()}`, x + 2.5, y + slotH - 2.4, { charSpace: 0.6 });
    }
    y += slotH + 4;
  }

  // Final footer (with total page count)
  drawFooter(pageNo, pageNo);

  doc.save(`Velli-${clienta.nombre.replace(/\s+/g, '_')}-${consulta.fecha}.pdf`);

  // Checklist de inicio: marcar el primer PDF descargado (una sola vez,
  // fire-and-forget — la descarga jamás se bloquea por esto).
  if (profile && !profile.primerPdfDescargado) {
    updateProfile({ primerPdfDescargado: true }).catch(() => {});
  }
}
