import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATALOGO_MAESTRO_COLOMBIA } from '@/lib/catalogos/catalogoMaestroColombia';
import {
  AVISO_TRANSPARENCIA_MUESTRA_INTERMEDIA,
  CIUDADES_COLOMBIA,
  calcularPrecioContextualColombia,
  inferirCodigoCiudadColombia,
  validarTerminosRestringidosColombia,
} from '@/lib/catalogos/referenciasMercadoColombia';
import {
  GUIA_MEDICION_POR_VERTICAL,
  LEMA_CULTURA_DATOS_VELI,
  NIVELES_PRECISION_VELI,
} from '@/lib/datos/culturaDatos';
import { calcularMadurezDatosNegocio } from '@/lib/datos/madurezDatos';
import { VERTICALES } from '@/lib/flags/verticales';

const ROOT = path.resolve(__dirname, '..');

describe('Fase P0 · Precios contextuales, guardarraíles preventivos y Madurez de Datos', () => {
  it('calcula precios contextuales coherentes en ciudades principales vs intermedias y emite aviso en muestra baja', () => {
    expect(CIUDADES_COLOMBIA.length).toBe(16); // 15 ciudades + OTRA
    expect(inferirCodigoCiudadColombia('El Poblado, Medellín')).toBe('MED');
    expect(inferirCodigoCiudadColombia('Duitama')).toBe('TUN');
    expect(inferirCodigoCiudadColombia('Popayán')).toBe('OTRA');

    const balayage = CATALOGO_MAESTRO_COLOMBIA.find((p) => p.id === 'hair-balayage-completo')!;
    const fade = CATALOGO_MAESTRO_COLOMBIA.find((p) => p.id === 'barber-corte-fade')!;
    const novia = CATALOGO_MAESTRO_COLOMBIA.find(
      (p) => p.id === 'lounge-paquete-novia-completo'
    )!;

    // Bogotá (principal, muestra alta -> sin aviso de transparencia)
    const bogStd = calcularPrecioContextualColombia({
      procedimiento: balayage,
      cityCode: 'BOG',
      segmento: 'estandar',
    });
    expect(bogStd.confidenceLevel).toBe('high');
    expect(bogStd.avisoTransparencia).toBeNull();
    expect(bogStd.precioSugeridoCop).toBe(420_000);
    expect(bogStd.rangoMinCop).toBeLessThanOrEqual(bogStd.precioSugeridoCop);
    expect(bogStd.precioSugeridoCop).toBeLessThanOrEqual(bogStd.rangoMaxCop);

    // Tunja en barbería tiene muestra directa verificada (n=9, high -> sin aviso), tarifa menor que Bogotá
    const tunBarber = calcularPrecioContextualColombia({
      procedimiento: fade,
      cityCode: 'TUN',
      segmento: 'estandar',
    });
    expect(tunBarber.confidenceLevel).toBe('high');
    expect(tunBarber.avisoTransparencia).toBeNull();
    expect(tunBarber.precioSugeridoCop).toBeLessThan(35_000);
    expect(tunBarber.precioSugeridoCop % 1000).toBe(0);

    // Cartagena en beauty_lounge tiene índice superior (1.08) pero celda directa n=0 -> emite aviso explícito
    const ctgNovia = calcularPrecioContextualColombia({
      procedimiento: novia,
      cityCode: 'CTG',
      segmento: 'estandar',
    });
    expect(ctgNovia.indiceCiudad).toBeGreaterThan(1.0);
    expect(ctgNovia.confidenceLevel).toBe('low');
    expect(ctgNovia.avisoTransparencia).toBe(AVISO_TRANSPARENCIA_MUESTRA_INTERMEDIA);

    // Ciudad genérica OTRA siempre emite aviso transparente
    const otra = calcularPrecioContextualColombia({
      procedimiento: balayage,
      cityCode: 'OTRA',
      segmento: 'economico',
    });
    expect(otra.avisoTransparencia).toBe(AVISO_TRANSPARENCIA_MUESTRA_INTERMEDIA);
    expect(otra.precioSugeridoCop).toBe(otra.rangoMinCop);
  });

  it('bloquea sustancias prohibidas (biopolímeros, formol, MMA, TPO, DMPT) sin falsos positivos en servicios legales', () => {
    const prohibidos = [
      'Aplicación de biopolímeros en glúteos',
      'Relleno con silicona líquida',
      'Keratina brasileña con formol puro',
      'Alisado con formaldehído al 2%',
      'Monómero MMA económico',
      'Base semipermanente con TPO',
      'Acrílico líquido con DMPT',
    ];

    for (const texto of prohibidos) {
      const res = validarTerminosRestringidosColombia(texto);
      expect(res.permitido, `Debe bloquear: ${texto}`).toBe(false);
      expect(res.orientacionPreventiva).toMatch(/no constituye asesoría jurídica/i);
    }

    const permitidosLegitimos = [
      'Keratina orgánica sin formol',
      'Alisado progresivo libre de formaldehído',
      'Base Rubber libre de TPO y HEMA',
      'Gel constructor TPO free',
      'Monómero profesional 100% EMA libre de MMA',
      'Tratamiento capilar postoperatorio e inflamación',
      'Manicura rusa combinada + semipermanente',
    ];

    for (const texto of permitidosLegitimos) {
      const res = validarTerminosRestringidosColombia(texto);
      expect(res.permitido, `No debe dar falso positivo en: ${texto}`).toBe(true);
      expect(res.orientacionPreventiva).toBeNull();
    }
  });

  it('define la cultura de datos en las 5 verticales sin hardware propietario y distingue largo, densidad y grosor', () => {
    expect(LEMA_CULTURA_DATOS_VELI).toContain('Cada dato cuenta');
    expect(NIVELES_PRECISION_VELI.every((n) => n.requiereHardwarePropietario === false)).toBe(true);

    for (const v of VERTICALES) {
      expect(GUIA_MEDICION_POR_VERTICAL[v]).toBeDefined();
      expect(GUIA_MEDICION_POR_VERTICAL[v].queMedir.length).toBeGreaterThanOrEqual(3);
    }

    const notaHair = GUIA_MEDICION_POR_VERTICAL.hair_studio.notaTecnicaRigor;
    expect(notaHair).toMatch(/largo.*cm/i);
    expect(notaHair).toMatch(/densidad capilar/i);
    expect(notaHair).toMatch(/grosor de hebra/i);
  });

  it('calcula Madurez de Datos premiando completitud, vigencia <=45 días y verificación real sobre volumen viejo', () => {
    const ahora = new Date('2026-11-27T12:00:00Z');

    // Salón recién creado con puros valores semilla sin revisar y datos viejos (>90 días)
    const salonInmaduroConMuchosRegistrosViejos = calcularMadurezDatosNegocio({
      ahora,
      tieneReglaComisionActiva: false,
      citasCompletadasRecientes: 0,
      servicios: Array.from({ length: 25 }, (_, i) => ({
        id: `s-${i}`,
        activo: true,
        duracionMinutos: null,
        tienePlantillaPrecio: false,
        precioBaseCop: 0,
        usaQuimicaOSinBascula: true,
      })),
      productos: Array.from({ length: 20 }, (_, i) => ({
        id: `p-${i}`,
        activo: true,
        precioCompraCop: 30000,
        presentacionCantidad: 60,
        precioActualizadoAt: '2026-06-01T00:00:00Z', // obsoleto >45d
        esSemillaSinRevisar: true,
      })),
      cotizacionesCobradas: Array.from({ length: 30 }, (_, i) => ({
        id: `c-${i}`,
        cobradoAt: '2026-07-01T00:00:00Z', // fuera de ventana 45d
        precioCobradoCop: 120000,
        costoProductoCop: 0,
        comisionCop: 0,
        registroConsumoEnSilla: false,
      })),
      clientes: Array.from({ length: 40 }, (_, i) => ({
        id: `cl-${i}`,
        tieneContacto: false,
        tieneFichaONotasTecnicas: false,
        ultimaVisitaAt: '2026-05-01T00:00:00Z',
      })),
    });

    expect(salonInmaduroConMuchosRegistrosViejos.puntajeGlobal).toBeLessThan(20);
    expect(salonInmaduroConMuchosRegistrosViejos.nivel).toBe('inicial');
    expect(salonInmaduroConMuchosRegistrosViejos.recomendacionPrioritaria.accionHref).toBe(
      '/configuracion/precios'
    );

    // Estudio pequeño (6 servicios) pero 100% verificado y actualizado en los últimos 15 días
    const estudioPequenoBienCalibrado = calcularMadurezDatosNegocio({
      ahora,
      tieneReglaComisionActiva: true,
      citasCompletadasRecientes: 8,
      servicios: Array.from({ length: 6 }, (_, i) => ({
        id: `s-ok-${i}`,
        activo: true,
        duracionMinutos: 90,
        tienePlantillaPrecio: true,
        precioBaseCop: 150000,
        usaQuimicaOSinBascula: true,
      })),
      productos: Array.from({ length: 5 }, (_, i) => ({
        id: `p-ok-${i}`,
        activo: true,
        precioCompraCop: 32000,
        presentacionCantidad: 60,
        precioActualizadoAt: '2026-11-20T00:00:00Z',
        esSemillaSinRevisar: false,
      })),
      cotizacionesCobradas: Array.from({ length: 6 }, (_, i) => ({
        id: `c-ok-${i}`,
        cobradoAt: '2026-11-22T00:00:00Z',
        precioCobradoCop: 240000,
        costoProductoCop: 35000,
        comisionCop: 82000,
        registroConsumoEnSilla: true,
      })),
      clientes: Array.from({ length: 6 }, (_, i) => ({
        id: `cl-ok-${i}`,
        tieneContacto: true,
        tieneFichaONotasTecnicas: true,
        ultimaVisitaAt: '2026-11-22T00:00:00Z',
      })),
    });

    expect(estudioPequenoBienCalibrado.puntajeGlobal).toBeGreaterThanOrEqual(85);
    expect(estudioPequenoBienCalibrado.nivel).toBe('avanzado');
    expect(estudioPequenoBienCalibrado.dimensiones).toHaveLength(5);
  });

  it('aísla estrictamente Madurez de Datos fuera de /s/[slug], /c/[token] y vistas de specialist', () => {
    const layoutReportes = readFileSync(path.join(ROOT, 'app/reportes/layout.tsx'), 'utf8');
    expect(layoutReportes).toContain('protegerRutaSoloAdminEnServidor');

    const archivosPublicosYOperativos = [
      'app/s/[slug]/page.tsx',
      'components/vitrina/VitrinaPublicaClient.tsx',
      'app/c/[token]/page.tsx',
      'app/page.tsx',
      'app/agenda/page.tsx',
    ];

    for (const rel of archivosPublicosYOperativos) {
      const contenido = readFileSync(path.join(ROOT, rel), 'utf8');
      expect(contenido, `${rel} no debe importar madurezDatos`).not.toContain('madurezDatos');
      expect(contenido, `${rel} no debe renderizar TarjetaMadurezDatos`).not.toContain(
        'TarjetaMadurezDatos'
      );
    }
  });
});
