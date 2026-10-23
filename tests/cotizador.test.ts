import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AJUSTES_EJEMPLO_PLANTILLA,
  CATALOGO_VARIABLES,
  FACTORES_CONSUMO_DEFECTO,
  TEXTO_LEGAL_COTIZACION_PUBLICA,
  anularCotizacion,
  armarEnlaceWhatsAppCotizacion,
  armarMensajeWhatsAppCotizacion,
  calcularComisionYMargen,
  calcularCostoProducto,
  calcularPrecioCotizacion,
  confirmarCobroCotizacion,
  construirMetadataCotizacion,
  corregirCobroCotizacion,
  crearCotizacion,
  derivarCanasDesdePerfil,
  derivarEstadoFibra,
  derivarVariablesDesdeConsulta,
  esUuidValido,
  evaluarAvisosEstandar,
  evaluarBloqueoServicioCotizador,
  extraerIpDesdeHeaders,
  formatearFechaVigencia,
  formatearPrecioCop,
  inferirCategoriaServicio,
  normalizarColorSalon,
  obtenerCotizacionPublica,
  parsearProporcionOxidante,
  publicarPlantillaPrecio,
  redondearPrecio,
  seleccionarReglaComision,
  textoAvisosEstandar,
  urlPublicaCotizacion,
  type ReglaComision,
} from '@/lib/cotizador';

describe('lib/cotizador · 1. Caso exacto del documento (§3) y escenarios de la plantilla', () => {
  it('reproduce exactamente el ejemplo de §3: Tinte completo -> Precio $182.000, Tinte 134,55g ($67.275), Oxidante 201,8ml ($6.055), Insumos $3.000, Comisión $72.800, Margen $32.870', () => {
    const variables = {
      largo: 'medio' as const,
      densidad: 'alta' as const,
      estado: 'sana' as const,
      canas: '50_75' as const,
    };

    // 1. Precio: base $120.000, largo medio (+20%), densidad alta (+15%), canas 50-75% (+$15.000)
    // Estado de la fibra NO ajusta en "Ejemplo · Tinte completo" (igual con 'sana' que vale 0)
    const resPrecio = calcularPrecioCotizacion(
      {
        precioBase: 120000,
        ajustes: AJUSTES_EJEMPLO_PLANTILLA,
        variablesActivas: {
          largo: true,
          densidad: true,
          estado: false,
          canas: true,
        },
        redondeo: 1000,
      },
      variables
    );

    expect(resPrecio.totalSuma).toBe(15000);
    expect(resPrecio.totalPorcentaje).toBe(35);
    expect(resPrecio.precioSinRedondear).toBe(182250);
    expect(resPrecio.precioCalculado).toBe(182000);

    // 2. Costo de producto: 60g × 1.5 (medio) × 1.3 (alta) × 1.15 (canas 50_75) = 134,55g
    const resCosto = calcularCostoProducto({
      variables,
      consumo: {
        usaFormulaColor: true,
        gramosTinteBase: 60,
        factores: FACTORES_CONSUMO_DEFECTO,
        proporcionOxidante: 1.5,
        insumosFijos: 3000,
      },
      productoTinte: {
        id: 'prod-tinte',
        nombre: 'Ejemplo · Tinte 60 g',
        presentacionCantidad: 60,
        unidad: 'g',
        precioCompra: 30000, // $500/g
      },
      productoOxidante: {
        id: 'prod-ox',
        nombre: 'Ejemplo · Oxidante 20 vol',
        presentacionCantidad: 1000,
        unidad: 'ml',
        precioCompra: 30000, // $30/ml
      },
    });

    expect(resCosto.gramosTinte).toBe(134.55);
    expect(resCosto.costoTinte).toBe(67275);
    expect(resCosto.mlOxidanteRedondeado).toBe(201.8);
    expect(resCosto.costoOxidante).toBe(6055);
    expect(resCosto.insumosFijos).toBe(3000);
    expect(resCosto.costoTotal).toBe(76330);
    expect(resCosto.detalle.fuente).toBe('estimada');
    expect(resCosto.detalle.items).toHaveLength(3);

    // 3. Comisión 40% sobre el precio ($72.800) y margen del salón ($32.870, ~18%)
    const resComision = calcularComisionYMargen({
      precio: resPrecio.precioCalculado,
      costoProducto: resCosto.costoTotal,
      regla: {
        tipo: 'porcentaje',
        valor: 40,
        base: 'precio',
      },
    });

    expect(resComision.comision).toBe(72800);
    expect(resComision.margenSalon).toBe(32870);
    expect(Math.round(resComision.margenPorcentaje)).toBe(18);
    // Como 18,06% < 20% (umbral por defecto), se activa la alerta de protección
    expect(resComision.alertaMargenBajo).toBe(true);
  });

  it('reproduce el Escenario 2 de verificar_plantilla.py: Corte sin fórmula de color y Color y mechas con comisión sobre precio_menos_producto', () => {
    // Corte: base 40.000, solo ajusta por largo (extra_largo +60%) -> 64.000
    const precioCorte = calcularPrecioCotizacion(
      {
        precioBase: 40000,
        ajustes: AJUSTES_EJEMPLO_PLANTILLA,
        variablesActivas: {
          largo: true,
          densidad: false,
          estado: false,
          canas: false,
        },
      },
      {
        largo: 'extra_largo',
        densidad: 'baja',
        estado: 'sensibilizada',
        canas: '0_25',
      }
    );
    expect(precioCorte.precioCalculado).toBe(64000);

    const costoCorte = calcularCostoProducto({
      variables: { largo: 'extra_largo', densidad: 'baja', estado: 'sensibilizada', canas: '0_25' },
      consumo: { usaFormulaColor: false, insumosFijos: 0 },
    });
    expect(costoCorte.costoTotal).toBe(0);
    expect(costoCorte.detalle.fuente).toBe('sin_color');

    // Color y mechas: base 150.000, todas las variables activas, Largo (+40%), Media (0%), Procesada (+10.000), Canas 75-100% (+25.000)
    // (150.000 + 35.000) * 1.40 = 259.000
    const varsMechas = {
      largo: 'largo' as const,
      densidad: 'media' as const,
      estado: 'procesada' as const,
      canas: '75_100' as const,
    };
    const precioMechas = calcularPrecioCotizacion(
      {
        precioBase: 150000,
        ajustes: AJUSTES_EJEMPLO_PLANTILLA,
        variablesActivas: ['largo', 'densidad', 'estado', 'canas'],
      },
      varsMechas
    );
    expect(precioMechas.precioCalculado).toBe(259000);

    // Gramos = 90 × 2.0 (largo) × 1.0 (media) × 1.20 (canas 75_100) = 216g
    const costoMechas = calcularCostoProducto({
      variables: varsMechas,
      consumo: {
        usaFormulaColor: true,
        gramosTinteBase: 90,
        insumosFijos: 5000,
      },
      productoTinte: { precioUnitario: 500 },
      productoOxidante: { precioUnitario: 30 },
    });
    expect(costoMechas.gramosTinte).toBe(216);
    expect(costoMechas.costoTinte).toBe(108000);
    expect(costoMechas.costoOxidante).toBe(9720);
    expect(costoMechas.costoTotal).toBe(122720);

    // Dani: 30% en color sobre precio_menos_producto
    const comisionMechas = calcularComisionYMargen({
      precio: precioMechas.precioCalculado,
      costoProducto: costoMechas.costoTotal,
      regla: {
        tipo: 'porcentaje',
        valor: 30,
        base: 'precio_menos_producto',
      },
    });
    expect(comisionMechas.comision).toBe(Math.round((259000 - 122720) * 0.3)); // 40884
    expect(comisionMechas.margenSalon).toBe(259000 - 122720 - 40884); // 95396
    expect(comisionMechas.alertaMargenBajo).toBe(false);
  });

  it('soporta fuente precisa (`formula_final` con múltiples componentes de CO-05)', () => {
    // Ejemplo: 1/2 tubo de base natural (30g) + 1/2 tubo de reflejo (30g) con proporción 1:1,5
    const res = calcularCostoProducto({
      variables: { largo: 'medio', densidad: 'alta', canas: '50_75' },
      formulaFinal: {
        proporcion: '1:1,5',
        componentes: [
          {
            descripcion: '7.0 Base natural (CO-05 1/2 tubo)',
            gramos: 30,
            producto: { id: 'tinte-base', presentacionCantidad: 60, precioCompra: 30000 },
          },
          {
            descripcion: '7.1 Cenizo',
            gramos: 30,
            producto: { id: 'tinte-reflejo', presentacionCantidad: 60, precioCompra: 30000 },
          },
        ],
      },
      consumo: { insumosFijos: 3000 },
      productoOxidante: { id: 'ox-20', presentacionCantidad: 1000, precioCompra: 30000 },
    });

    expect(res.detalle.fuente).toBe('precisa');
    expect(res.gramosTinte).toBe(134.55);
    expect(res.costoTinte).toBe(67275);
    expect(res.costoOxidante).toBe(6055);
    expect(res.costoTotal).toBe(76330);
  });
});

describe('lib/cotizador · 2. Derivación de variables, estado de la fibra y avisos del estándar (§1.1)', () => {
  it('expone el catálogo completo de las 4 variables estándar de Velli', () => {
    expect(CATALOGO_VARIABLES.largo.map((o) => o.valor)).toEqual([
      'corto',
      'medio',
      'largo',
      'extra_largo',
    ]);
    expect(CATALOGO_VARIABLES.densidad.map((o) => o.valor)).toEqual(['baja', 'media', 'alta']);
    expect(CATALOGO_VARIABLES.estado.map((o) => o.valor)).toEqual([
      'sana',
      'procesada',
      'sensibilizada',
    ]);
    expect(CATALOGO_VARIABLES.canas.map((o) => o.valor)).toEqual([
      '0_25',
      '25_50',
      '50_75',
      '75_100',
    ]);
  });

  it('deriva el estado de la fibra aplicando la regla de que gana el nivel más alto que se cumpla', () => {
    // Sin datos -> undefined (no inventa)
    expect(derivarEstadoFibra(undefined)).toBeUndefined();
    expect(derivarEstadoFibra({})).toBeUndefined();

    // Sana / virgen: sin química, elasticidad alta, puntas sanas
    expect(
      derivarEstadoFibra({
        quimicos: ['Ninguno'],
        elasticidad: 'alta',
        porosidad: 'media',
        estadoPuntas: 'Puntas sanas (selladas)',
        tipoDano: ['Sin daño visible'],
      })
    ).toBe('sana');

    // Procesada / porosa: química previa o porosidad alta o elasticidad media o daño térmico/mecánico
    expect(
      derivarEstadoFibra({
        quimicos: ['Tinte permanente'],
        elasticidad: 'alta',
        estadoPuntas: 'Puntas sanas (selladas)',
      })
    ).toBe('procesada');

    expect(
      derivarEstadoFibra({
        quimicos: ['Ninguno'],
        porosidad: 'alta',
        elasticidad: 'alta',
      })
    ).toBe('procesada');

    expect(
      derivarEstadoFibra({
        estadoPuntas: 'Puntas abiertas leves',
      })
    ).toBe('procesada');

    // Sensibilizada / muy dañada gana sobre procesada y sana
    expect(
      derivarEstadoFibra({
        quimicos: ['Tinte permanente'],
        porosidad: 'alta',
        elasticidad: 'baja', // <- sube a sensibilizada
        estadoPuntas: 'Puntas abiertas leves',
      })
    ).toBe('sensibilizada');

    expect(
      derivarEstadoFibra({
        elasticidad: 'alta',
        estadoPuntas: 'Puntas abiertas severas (necesita corte)',
      })
    ).toBe('sensibilizada');

    expect(
      derivarEstadoFibra({
        elasticidad: 'alta',
        tipoDano: ['Daño químico (decoloración, alisado)'],
      })
    ).toBe('sensibilizada');
  });

  it('deriva variables desde la consulta marcando origen, dejando vacío lo que falta y pidiendo toque de desempate en `mas_50`', () => {
    // Consulta con densidad, datos de fibra procesada y canas `mas_50`, pero sin largo
    const sinDesempate = derivarVariablesDesdeConsulta({
      densidad: 'alta',
      porosidad: 'alta',
      perfilExtendido: {
        estadoCanas: 'mas_50',
      },
    });

    expect(sinDesempate.variables.largo).toBeUndefined();
    expect(sinDesempate.variables.densidad).toEqual({ valor: 'alta', origen: 'diagnostico' });
    expect(sinDesempate.variables.estado).toEqual({ valor: 'procesada', origen: 'diagnostico' });
    expect(sinDesempate.variables.canas).toBeUndefined();
    expect(sinDesempate.canasPorPrecisar).toBe(true);
    expect(sinDesempate.faltantes).toEqual(['largo', 'canas']);

    // Con el toque de desempate en canas (`50_75`) y selección manual de largo (`medio`)
    const conDesempate = derivarVariablesDesdeConsulta(
      {
        densidad: 'alta',
        porosidad: 'alta',
        perfilExtendido: {
          estadoCanas: 'mas_50',
        },
      },
      {
        desempateCanas: '50_75',
        manuales: { largo: 'medio' },
      }
    );

    expect(conDesempate.variables.largo).toEqual({ valor: 'medio', origen: 'manual' });
    expect(conDesempate.variables.canas).toEqual({ valor: '50_75', origen: 'manual' });
    expect(conDesempate.canasPorPrecisar).toBe(false);
    expect(conDesempate.faltantes).toEqual([]);

    // Con `sin_canas` o `entre_25_50` entra directo como origen 'diagnostico'
    expect(derivarCanasDesdePerfil({ estadoCanas: 'sin_canas' })).toEqual({
      valor: '0_25',
      origen: 'diagnostico',
      porPrecisar: false,
    });
    expect(derivarCanasDesdePerfil({ estadoCanas: 'entre_25_50' })).toEqual({
      valor: '25_50',
      origen: 'diagnostico',
      porPrecisar: false,
    });
  });

  it('devuelve los avisos obligatorios y sugeridos del estándar (Plex/mechón, sellante y prepigmentación)', () => {
    // 1. Fibra sensibilizada en servicio químico -> prueba_mechon_plex obligatorio
    const avisosSensibilizada = evaluarAvisosEstandar({
      estado: 'sensibilizada',
      canas: '50_75',
      categoriaServicio: 'color',
      usaFormulaColor: true,
    });
    expect(avisosSensibilizada).toEqual([
      {
        codigo: 'prueba_mechon_plex',
        mensaje: 'Obligatorio: prueba de mechón y aditivo protector Plex.',
        obligatorio: true,
      },
    ]);
    expect(textoAvisosEstandar(avisosSensibilizada)).toBe(
      'Obligatorio: prueba de mechón y aditivo protector Plex.'
    );

    // En un corte (no químico), fibra sensibilizada no exige prueba de mechón ni Plex
    const avisosCorte = evaluarAvisosEstandar({
      estado: 'sensibilizada',
      canas: '0_25',
      categoriaServicio: 'corte',
      usaFormulaColor: false,
    });
    expect(avisosCorte).toEqual([]);

    // 2. Fibra procesada + canas 75-100% en servicio de color -> sellante + prepigmentación
    const avisosProcesadaYCanas = evaluarAvisosEstandar({
      estado: 'procesada',
      canas: '75_100',
      categoriaServicio: 'color',
      usaFormulaColor: true,
    });
    expect(avisosProcesadaYCanas.map((a) => a.codigo)).toEqual([
      'tratamiento_sellante',
      'prepigmentacion',
    ]);
    expect(textoAvisosEstandar(avisosProcesadaYCanas)).toBe(
      'Sugerir un tratamiento sellante. Técnica de prepigmentación.'
    );
  });
});

describe('lib/cotizador · 3. Precedencia de comisiones y base `precio` vs `precio_menos_producto`', () => {
  const reglas: ReglaComision[] = [
    { id: 'r-salon', estilistaId: null, servicioId: null, tipo: 'porcentaje', valor: 35, base: 'precio' },
    { id: 'r-servicio', estilistaId: null, servicioId: 'srv-color', tipo: 'porcentaje', valor: 30, base: 'precio_menos_producto' },
    { id: 'r-estilista', estilistaId: 'est-caro', servicioId: null, tipo: 'porcentaje', valor: 40, base: 'precio' },
    { id: 'r-especifica', estilistaId: 'est-caro', servicioId: 'srv-color', tipo: 'porcentaje', valor: 45, base: 'precio_menos_producto' },
    { id: 'r-cerrada', estilistaId: 'est-caro', servicioId: 'srv-color', tipo: 'porcentaje', valor: 90, base: 'precio', vigenteHasta: '2026-01-01T00:00:00Z' },
  ];

  it('respeta la jerarquía estilista+servicio > estilista > servicio > salón e ignora reglas cerradas', () => {
    // 1. estilista + servicio
    const s1 = seleccionarReglaComision(reglas, { estilistaId: 'est-caro', servicioId: 'srv-color' });
    expect(s1.alcance).toBe('estilista_servicio');
    expect(s1.regla?.id).toBe('r-especifica');

    // 2. estilista (otro servicio sin regla específica)
    const s2 = seleccionarReglaComision(reglas, { estilistaId: 'est-caro', servicioId: 'srv-corte' });
    expect(s2.alcance).toBe('estilista');
    expect(s2.regla?.id).toBe('r-estilista');

    // 3. servicio (otra estilista sin regla propia)
    const s3 = seleccionarReglaComision(reglas, { estilistaId: 'est-otra', servicioId: 'srv-color' });
    expect(s3.alcance).toBe('servicio');
    expect(s3.regla?.id).toBe('r-servicio');

    // 4. salón (otra estilista y otro servicio)
    const s4 = seleccionarReglaComision(reglas, { estilistaId: 'est-otra', servicioId: 'srv-corte' });
    expect(s4.alcance).toBe('salon');
    expect(s4.regla?.id).toBe('r-salon');
  });

  it('calcula correctamente la diferencia entre base `precio` vs `precio_menos_producto` y soporta comisión fija', () => {
    const sobrePrecio = calcularComisionYMargen({
      precio: 182000,
      costoProducto: 76330,
      regla: { tipo: 'porcentaje', valor: 40, base: 'precio' },
    });
    const sobreNeto = calcularComisionYMargen({
      precio: 182000,
      costoProducto: 76330,
      regla: { tipo: 'porcentaje', valor: 40, base: 'precio_menos_producto' },
    });

    // Sobre precio bruto: 40% de 182.000 = 72.800 -> margen 32.870
    expect(sobrePrecio.comision).toBe(72800);
    expect(sobrePrecio.margenSalon).toBe(32870);

    // Sobre precio menos producto: 40% de (182.000 - 76.330 = 105.670) = 42.268 -> margen 63.402
    expect(sobreNeto.comision).toBe(42268);
    expect(sobreNeto.margenSalon).toBe(63402);
    expect(sobrePrecio.margenConComisionNeta).toBe(63402);

    // Comisión fija
    const fija = calcularComisionYMargen({
      precio: 100000,
      costoProducto: 15000,
      regla: { tipo: 'fijo', valor: 30000 },
    });
    expect(fija.comision).toBe(30000);
    expect(fija.margenSalon).toBe(55000);
    expect(fija.margenPorcentaje).toBe(55);
  });
});

describe('lib/cotizador · 4. Alerta de margen bajo y protección de rentabilidad en cabello extra largo con densidad alta', () => {
  it('activa alertaMargenBajo en cabello extra largo con densidad alta y calcula precioSugeridoProteccion y margenConComisionNeta', () => {
    const variables = {
      largo: 'extra_largo' as const,
      densidad: 'alta' as const,
      estado: 'sana' as const,
      canas: '75_100' as const,
    };

    // Precio: (120.000 + 25.000) * (1 + (60 + 15)/100) = 145.000 * 1.75 = 253.750 -> redondeado 254.000
    const resPrecio = calcularPrecioCotizacion(
      {
        precioBase: 120000,
        ajustes: AJUSTES_EJEMPLO_PLANTILLA,
        variablesActivas: { largo: true, densidad: true, estado: false, canas: true },
      },
      variables
    );
    expect(resPrecio.precioCalculado).toBe(254000);

    // Costo: 60g × 3.0 (extra_largo) × 1.3 (alta) × 1.20 (canas 75_100) = 280.8g
    // Tinte: 280.8 × $500 = $140.400
    // Oxidante: 280.8 × 1.5 = 421.2ml × $30 = $12.636
    // Insumos: $3.000 -> Total producto = $156.036
    const resCosto = calcularCostoProducto({
      variables,
      consumo: {
        usaFormulaColor: true,
        gramosTinteBase: 60,
        factores: FACTORES_CONSUMO_DEFECTO,
        proporcionOxidante: 1.5,
        insumosFijos: 3000,
      },
      productoTinte: { presentacionCantidad: 60, precioCompra: 30000 },
      productoOxidante: { presentacionCantidad: 1000, precioCompra: 30000 },
    });

    expect(resCosto.gramosTinte).toBe(280.8);
    expect(resCosto.costoTotal).toBe(156036);

    // Con comisión del 40% sobre el precio ($101.600), el salón pierde dinero:
    // 254.000 - 156.036 - 101.600 = -3.636 (-1.43%)
    const resRentabilidad = calcularComisionYMargen({
      precio: resPrecio.precioCalculado,
      costoProducto: resCosto.costoTotal,
      regla: { tipo: 'porcentaje', valor: 40, base: 'precio' },
      umbralMargenMinimo: 20,
      redondeo: 1000,
    });

    expect(resRentabilidad.comision).toBe(101600);
    expect(resRentabilidad.margenSalon).toBe(-3636);
    expect(resRentabilidad.alertaMargenBajo).toBe(true);

    // Si la comisión se calcula sobre precio_menos_producto:
    // base neta = 254.000 - 156.036 = 97.964 -> comisión 40% = 39.186 -> margen = 58.778
    expect(resRentabilidad.comisionSobrePrecioMenosProducto).toBe(39186);
    expect(resRentabilidad.margenConComisionNeta).toBe(58778);

    // Precio sugerido para mantener 20% de margen con 40% de comisión sobre precio:
    // P_min = 156.036 / (1 - 0.40 - 0.20) = 156.036 / 0.40 = 390.090 -> redondeado hacia arriba a 1.000 = 391.000
    expect(resRentabilidad.precioSugeridoProteccion).toBe(391000);

    // Verificamos que cobrando precioSugeridoProteccion el margen ya cumple >= 20%
    const verificado = calcularComisionYMargen({
      precio: resRentabilidad.precioSugeridoProteccion,
      costoProducto: resCosto.costoTotal,
      regla: { tipo: 'porcentaje', valor: 40, base: 'precio' },
      umbralMargenMinimo: 20,
    });
    expect(verificado.alertaMargenBajo).toBe(false);
    expect(verificado.margenPorcentaje).toBeGreaterThanOrEqual(20);
  });

  it('utilidades auxiliares de redondeo y proporción de oxidante', () => {
    expect(redondearPrecio(182250, 1000)).toBe(182000);
    expect(redondearPrecio(182250, 500)).toBe(182500);
    expect(parsearProporcionOxidante('1:1,5')).toBe(1.5);
    expect(parsearProporcionOxidante('1:2')).toBe(2);
    expect(parsearProporcionOxidante(undefined)).toBe(1.5);
  });
});

describe('lib/cotizador · 5. Mensaje de WhatsApp, ruta pública /c/[token], SW (R16), proxy y capa de datos', () => {
  const token = '550e8400-e29b-41d4-a716-446655440000';

  it('arma el mensaje y link wa.me según §4 sin exponer ningún dato clínico ni del diagnóstico', () => {
    expect(formatearPrecioCop(182000)).toBe('$182.000');
    expect(formatearFechaVigencia('2026-11-07')).toBe('07/11/2026');
    expect(urlPublicaCotizacion(token, 'https://velli-three.vercel.app/')).toBe(
      `https://velli-three.vercel.app/c/${token}`
    );

    const texto = armarMensajeWhatsAppCotizacion({
      nombreClienta: 'Laura',
      servicioNombre: 'Tinte completo',
      salonNombre: 'Salón Verde',
      precio: 182000,
      vigenciaHasta: '2026-11-07',
      tokenPublico: token,
      appUrl: 'https://velli-three.vercel.app',
    });

    expect(texto).toBe(
      `Hola Laura, te comparto la cotización de *Tinte completo* en Salón Verde: *$182.000*. Válida hasta el 07/11/2026. https://velli-three.vercel.app/c/${token}`
    );
    expect(texto).not.toMatch(/porosidad|elasticidad|rizo|alopecia|canas|densidad/i);

    const enlace = armarEnlaceWhatsAppCotizacion({
      nombreClienta: 'Laura',
      telefonoClienta: '300 123 4567',
      servicioNombre: 'Tinte completo',
      salonNombre: 'Salón Verde',
      precio: 182000,
      vigenciaHasta: '2026-11-07',
      tokenPublico: token,
    });
    expect(enlace.urlWhatsApp).toContain('https://wa.me/573001234567?text=');
    expect(decodeURIComponent(enlace.urlWhatsApp.split('?text=')[1])).toBe(enlace.mensaje);
  });

  it('excluye /c/ del caché en public/sw.js (R16), abre /c/ en proxy.ts y declara /c/<token> en textos legales (R4, P13)', () => {
    const raiz = path.resolve(__dirname, '..');
    const sw = readFileSync(path.join(raiz, 'public/sw.js'), 'utf8');
    const proxy = readFileSync(path.join(raiz, 'proxy.ts'), 'utf8');
    const privacidad = readFileSync(path.join(raiz, 'app/legal/privacidad/page.tsx'), 'utf8');
    const terminos = readFileSync(path.join(raiz, 'app/legal/terminos/page.tsx'), 'utf8');

    expect(sw).toMatch(/url\.pathname\s*===\s*'\/c'\s*\|\|\s*url\.pathname\.startsWith\('\/c\/'\)/);
    expect(proxy).toMatch(/path\s*===\s*'\/c'\s*\|\|\s*path\.startsWith\('\/c\/'\)/);
    expect(privacidad).toMatch(/\/c\/&lt;token&gt;|\/c\/<token>/);
    expect(privacidad).toMatch(/sin exponer en ningún caso el nombre de la\s+clienta, fotografías ni datos/i);
    expect(terminos).toMatch(/estimaciones vigentes hasta la fecha indicada/i);
    expect(TEXTO_LEGAL_COTIZACION_PUBLICA).toBe(
      'Precio para el servicio descrito, válido hasta la fecha indicada. Puede cambiar si al momento del servicio el cabello requiere un trabajo distinto.'
    );
  });

  it('valida formato UUID antes de consultar la RPC `cotizacion_publica` y mapea la respuesta', async () => {
    expect(esUuidValido(token)).toBe(true);
    expect(esUuidValido('no-es-uuid')).toBe(false);
    expect(esUuidValido('')).toBe(false);
    expect(esUuidValido(null)).toBe(false);

    const rpcMock = vi.fn(async () => ({
      data: [
        {
          salon: 'Salón Esmeralda',
          color_salon: '#1E4D2B',
          servicio: 'Tinte completo',
          precio: 182000,
          moneda: 'COP',
          vigencia_hasta: '2026-11-07',
          vigente: true,
          con_marca_velli: true,
        },
      ],
      error: null,
    }));

    // Con token inválido NO llama a la base de datos
    const invalida = await obtenerCotizacionPublica('token-invalido', { rpc: rpcMock } as unknown as Pick<SupabaseClient, 'rpc'>);
    expect(invalida).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();

    // Con UUID válido llama a la RPC y mapea camelCase
    const valida = await obtenerCotizacionPublica(token, { rpc: rpcMock } as unknown as Pick<SupabaseClient, 'rpc'>);
    expect(rpcMock).toHaveBeenCalledWith('cotizacion_publica', { p_token: token });
    expect(valida).toEqual({
      salon: 'Salón Esmeralda',
      colorSalon: '#1E4D2B',
      servicio: 'Tinte completo',
      precio: 182000,
      moneda: 'COP',
      vigenciaHasta: '2026-11-07',
      vigente: true,
      conMarcaVelli: true,
    });
  });

  it('genera metadatos OpenGraph con `Cotización · {salón}` y muestra marca Velli solo si `conMarcaVelli` es true', () => {
    const metaConMarca = construirMetadataCotizacion({
      salon: 'Salón Esmeralda',
      servicio: 'Tinte completo',
      precio: 182000,
      moneda: 'COP',
      vigenciaHasta: '2026-11-07',
      vigente: true,
      conMarcaVelli: true,
    });
    expect(metaConMarca.title).toBe('Cotización · Salón Esmeralda');
    expect(metaConMarca.description).toContain('Cotización hecha con Velli');
    expect((metaConMarca.openGraph as { siteName?: string })?.siteName).toBe('Velli');
    expect((metaConMarca.robots as { index?: boolean })?.index).toBe(false);

    const metaSinMarca = construirMetadataCotizacion({
      salon: 'Salón Esmeralda',
      servicio: 'Tinte completo',
      precio: 182000,
      moneda: 'COP',
      vigenciaHasta: '2026-11-07',
      vigente: true,
      conMarcaVelli: false,
    });
    expect(metaSinMarca.title).toBe('Cotización · Salón Esmeralda');
    expect(metaSinMarca.description).not.toMatch(/Velli/i);
    expect((metaSinMarca.openGraph as { siteName?: string })?.siteName).toBe('Salón Esmeralda');

    expect(normalizarColorSalon('#123abc')).toBe('#123abc');
    expect(normalizarColorSalon('javascript:alert(1)')).toBe('#2D5A27');
    expect(
      extraerIpDesdeHeaders({
        get: (k) => (k === 'x-forwarded-for' ? '190.1.2.3, 10.0.0.1' : null),
      })
    ).toBe('190.1.2.3');
  });

  it('opera la capa de datos: inferencia de servicios, validación de motivo al ajustar precio y ciclo de cobro/anulación', async () => {
    expect(inferirCategoriaServicio('Color y mechas')).toEqual({
      categoria: 'color',
      usaFormulaColor: true,
    });
    expect(inferirCategoriaServicio('Corte')).toEqual({
      categoria: 'corte',
      usaFormulaColor: false,
    });

    // Si precioCotizado != precioCalculado sin motivo -> rechaza antes de ir a DB
    await expect(
      crearCotizacion({
        servicioNombre: 'Tinte completo',
        precioCalculado: 182000,
        precioCotizado: 160000,
        ajusteManualMotivo: '  ',
        vigenciaHasta: '2026-11-07',
      })
    ).rejects.toThrow(/MOTIVO_REQUERIDO/);

    // Mock de cliente Supabase para verificar llamadas de publicar plantilla, cobro, corrección y anulación
    const filaMock = {
      id: 'cot-1',
      user_id: 'user-1',
      servicio_nombre: 'Tinte completo',
      variables: {},
      precio_calculado: 182000,
      precio_cotizado: 182000,
      vigencia_hasta: '2026-11-07',
      estado: 'cobrada',
      precio_cobrado: 182000,
      diferencia_cobro: 0,
      con_marca_velli: true,
      token_publico: token,
      perfil_extendido: {},
      created_at: '2026-10-23T10:00:00Z',
      updated_at: '2026-10-23T10:05:00Z',
    };

    const updateSpy = vi.fn(() => ({
      eq: () => ({
        select: () => ({
          single: async () => ({ data: filaMock, error: null }),
        }),
      }),
    }));

    const clientMock = {
      rpc: vi.fn(async () => ({ data: 'plantilla-v2', error: null })),
      from: vi.fn(() => ({ update: updateSpy })),
    } as unknown as SupabaseClient;

    const idPlantilla = await publicarPlantillaPrecio(
      { servicioId: 'srv-1', precioBase: 120000 },
      clientMock
    );
    expect(idPlantilla).toBe('plantilla-v2');

    const cobrada = await confirmarCobroCotizacion(
      'cot-1',
      { precioCobrado: 182000 },
      clientMock
    );
    expect(cobrada.estado).toBe('cobrada');
    expect(cobrada.precioCobrado).toBe(182000);

    await corregirCobroCotizacion('cot-1', 190000, clientMock);
    await anularCotizacion('cot-1', clientMock);
    expect(updateSpy).toHaveBeenCalledTimes(3);
  });
});

describe('lib/cotizador · 7. Guardarraíles legales en el cotizador (§2.1)', () => {
  it('bloquea decoloración ante elasticidad baja pero permite corte y tratamiento', () => {
    const dxElasticidadBaja = { elasticidad: 'baja' as const };
    const bloqueoDeco = evaluarBloqueoServicioCotizador(
      { categoria: 'decoloracion', usaFormulaColor: true },
      dxElasticidadBaja
    );
    expect(bloqueoDeco?.codigo).toBe('elasticidad_baja');

    const bloqueoCorte = evaluarBloqueoServicioCotizador(
      { categoria: 'corte', usaFormulaColor: false },
      dxElasticidadBaja
    );
    expect(bloqueoCorte).toBeNull();

    const bloqueoTratamiento = evaluarBloqueoServicioCotizador(
      { categoria: 'tratamiento', usaFormulaColor: false },
      dxElasticidadBaja
    );
    expect(bloqueoTratamiento).toBeNull();
  });

  it('bloquea cualquier servicio químico ante bandera médica o cuero cabelludo lesionado', () => {
    const dxBandera = { banderaMedicaActiva: true };
    expect(
      evaluarBloqueoServicioCotizador({ categoria: 'color', usaFormulaColor: true }, dxBandera)?.codigo
    ).toBe('bandera_medica');
    expect(
      evaluarBloqueoServicioCotizador({ categoria: 'alisado', usaFormulaColor: false }, dxBandera)?.codigo
    ).toBe('bandera_medica');

    const dxHenna = { hennaOMetales: 'si' as const, pruebaMechonSuperada: false };
    expect(
      evaluarBloqueoServicioCotizador({ categoria: 'color', usaFormulaColor: true }, dxHenna)?.codigo
    ).toBe('henna_metales');
    // Si superó prueba de mechón, el guardarraíl de henna se levanta
    expect(
      evaluarBloqueoServicioCotizador(
        { categoria: 'color', usaFormulaColor: true },
        { hennaOMetales: 'si', pruebaMechonSuperada: true }
      )
    ).toBeNull();
  });
});

