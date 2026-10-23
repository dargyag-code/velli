import { describe, expect, it } from 'vitest';
import {
  AJUSTES_EJEMPLO_PLANTILLA,
  CATALOGO_VARIABLES,
  FACTORES_CONSUMO_DEFECTO,
  calcularComisionYMargen,
  calcularCostoProducto,
  calcularPrecioCotizacion,
  derivarCanasDesdePerfil,
  derivarEstadoFibra,
  derivarVariablesDesdeConsulta,
  evaluarAvisosEstandar,
  parsearProporcionOxidante,
  redondearPrecio,
  seleccionarReglaComision,
  textoAvisosEstandar,
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
