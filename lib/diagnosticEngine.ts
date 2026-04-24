import { WizardData, ResultadoConsulta, CronogramaResult, CuidadoCasaResult, RecomendacionProductos, RutinaPaso } from './types';

const DISCLAIMER_PRODUCTOS =
  'Estas recomendaciones son técnicas y aplican a productos de cualquier marca. Tu estilista puede sugerirte marcas específicas que cumplan con estas características según tu presupuesto y disponibilidad local.';

export interface SaludClienta {
  embarazo?: boolean;
  nivelEstres?: string;
  alergias?: string;
  condicionesMedicas?: string;
  medicamentos?: string;
}

export function generateDiagnosis(data: WizardData, saludClienta?: SaludClienta): ResultadoConsulta {
  // ── Defaults para datos mínimos (modo express) ──
  const tipoRizoPrincipal = data.tipoRizoPrincipal || '';
  const porosidad = data.porosidad || 'media';
  const densidad = data.densidad || 'media';
  const grosor = data.grosor || 'medio';
  const elasticidad = data.elasticidad || 'media';
  const tipoDano = data.tipoDano || [];
  const estadoCueroCabelludo = data.estadoCueroCabelludo || [];
  const estadoPuntas = data.estadoPuntas || '';
  const problemas = data.problemas || [];
  // Datos de salud: priorizar los del perfil de la clienta
  const embarazo = saludClienta?.embarazo ?? false;
  const nivelEstres = saludClienta?.nivelEstres ?? '';

  // Inferir balanceHP si no fue especificado
  let balanceHP = data.balanceHP;
  if (!balanceHP) {
    if (elasticidad === 'baja') balanceHP = 'proteina';
    else if (porosidad === 'alta') balanceHP = 'hidratacion';
    else if (porosidad === 'baja') balanceHP = 'nutricion';
    else balanceHP = 'hidratacion';
  }

  const transicion = tipoDano.includes('En transición capilar (dos texturas visibles)');

  // ── Tratamiento Principal ──
  let tratamientoPrincipal = '';
  const tratamientosAdicionales: string[] = [];
  const notasAdicionales: string[] = [];

  if (balanceHP === 'proteina' || elasticidad === 'baja') {
    tratamientoPrincipal = 'Reconstrucción';
    notasAdicionales.push('Prioridad alta en proteína — usa mascarilla reconstructora con queratina hidrolizada.');
  } else if (balanceHP === 'hidratacion' && porosidad !== 'alta') {
    tratamientoPrincipal = 'Hidratación profunda';
  } else if (balanceHP === 'hidratacion' && porosidad === 'alta') {
    tratamientoPrincipal = 'Hidratación + Nutrición (sellado)';
  } else if (balanceHP === 'nutricion') {
    tratamientoPrincipal = 'Nutrición';
  } else if (balanceHP === 'equilibrado') {
    tratamientoPrincipal = 'Mantenimiento';
  } else {
    tratamientoPrincipal = 'Hidratación + Mantenimiento';
  }

  const danoQuimico = tipoDano.includes('Daño químico (decoloración, alisado)');
  const danoTermico = tipoDano.includes('Daño térmico (textura alterada por calor)');

  if (danoQuimico || danoTermico) {
    tratamientosAdicionales.push('Repolarización capilar');
    if (estadoPuntas === 'Puntas abiertas severas (necesita corte)') {
      notasAdicionales.push('Se recomienda corte de puntas para eliminar el daño severo.');
    }
  }

  const buildUp =
    estadoCueroCabelludo.includes('Build-up (acumulación de producto)') ||
    estadoCueroCabelludo.includes('Graso (exceso de sebo)');

  if (buildUp) {
    tratamientosAdicionales.push('Detox / Clarificación (paso previo al tratamiento)');
  }

  if (transicion) {
    tratamientosAdicionales.push('Tratamiento diferenciado zona natural / zona procesada');
    notasAdicionales.push(
      'Tratar zona natural y zona procesada por separado. Recomendar corte progresivo de la zona química.'
    );
    if (data.lineaDemarcacion) {
      notasAdicionales.push(`Línea de demarcación: ${data.lineaDemarcacion}`);
    }
  }

  // ── Cronograma 4 semanas ──
  let cronograma: CronogramaResult;

  const hasSevereDamage =
    estadoPuntas === 'Puntas abiertas severas (necesita corte)' || (danoQuimico && elasticidad === 'baja');

  if (tratamientoPrincipal === 'Reconstrucción') {
    if (hasSevereDamage) {
      cronograma = {
        semana1: 'Reconstrucción',
        semana2: 'Hidratación',
        semana3: 'Nutrición',
        semana4: 'Reconstrucción',
      };
    } else {
      cronograma = {
        semana1: 'Reconstrucción',
        semana2: 'Hidratación',
        semana3: 'Nutrición',
        semana4: 'Hidratación',
      };
    }
  } else if (tratamientoPrincipal === 'Hidratación profunda') {
    cronograma = {
      semana1: 'Hidratación',
      semana2: 'Hidratación',
      semana3: 'Nutrición',
      semana4: 'Hidratación',
    };
  } else if (tratamientoPrincipal === 'Hidratación + Nutrición (sellado)') {
    cronograma = {
      semana1: 'Hidratación',
      semana2: 'Nutrición',
      semana3: 'Hidratación',
      semana4: 'Nutrición',
    };
  } else if (tratamientoPrincipal === 'Nutrición') {
    cronograma = {
      semana1: 'Nutrición',
      semana2: 'Hidratación',
      semana3: 'Nutrición',
      semana4: 'Hidratación',
    };
  } else {
    // Mantenimiento o default
    cronograma = {
      semana1: 'Hidratación',
      semana2: 'Nutrición',
      semana3: 'Hidratación',
      semana4: 'Nutrición',
    };
  }

  // ── Técnica de Definición ──
  let tecnicaDefinicion = '';
  let tecnicaDescripcion = '';
  let metodoSecado = '';
  let gelRecomendado = '';

  const rizo = tipoRizoPrincipal;

  if (rizo === '1A' || rizo === '1B' || rizo === '1C') {
    tecnicaDefinicion = 'Secado natural';
    tecnicaDescripcion =
      rizo === '1C'
        ? 'Lava con shampoo suave y acondicionador. Aplica leave-in en cabello húmedo y peina de puntas a raíz con peine de dientes anchos. Haz scrunch suave en las puntas para potenciar la ondulación sutil. Deja secar sin tocar para evitar frizz. Si usas calor, aplica protector térmico antes.'
        : 'Lava con shampoo suave y acondicionador hidratante. Aplica leave-in en cabello húmedo y peina con peine de dientes anchos. Deja secar sin tocar para máximo brillo y sin frizz. Evita frotar con la toalla — usa microinfibra o camiseta de algodón.';
    metodoSecado = 'Secado natural o difusor en frío';
    gelRecomendado = '';
  } else if (rizo === '2A' || rizo === '2B') {
    tecnicaDefinicion = 'Scrunch';
    tecnicaDescripcion =
      'Aplica crema de peinar en el cabello húmedo. Distribuye con rake (peine de dientes anchos) de puntas a raíz. Luego haz scrunch (aprieta el cabello de abajo hacia arriba) para reforzar las ondas. Deja secar sin tocar.';
    metodoSecado = 'Difusor en calor bajo o secado al aire libre';
    gelRecomendado = 'Gel definidor liviano';
  } else if (rizo === '2C' || rizo === '3A') {
    tecnicaDefinicion = 'Rake & Shake + Scrunch';
    tecnicaDescripcion =
      'Aplica crema de peinar sección por sección. Pasa el peine de dientes anchos (rake) de medios a puntas para separar rizos. Agita las puntas suavemente (shake) para activar el patrón. Finaliza con scrunch para compactar el gel.';
    metodoSecado = 'Difusor en calor medio';
    gelRecomendado = 'Gel definidor o crema de peinar';
  } else if (rizo === '3B' || rizo === '3C') {
    if (grosor === 'fino') {
      tecnicaDefinicion = 'Shingling suave';
      tecnicaDescripcion =
        'Divide el cabello en secciones pequeñas. Aplica crema de peinar rizo por rizo, deslizando los dedos desde la raíz hasta las puntas. Evita productos muy pesados que aplanen el volumen.';
      metodoSecado = 'Difusor en calor bajo';
    } else {
      tecnicaDefinicion = 'Praying Hands + Scrunch';
      tecnicaDescripcion =
        'Frota la crema de peinar entre las palmas y aplica deslizando ambas manos hacia abajo por cada sección (como si rezaras con el cabello dentro). Luego haz scrunch para compactar el rizo. Aplica gel encima con scrunch final.';
      metodoSecado = 'Difusor en calor bajo-medio';
    }
    gelRecomendado = 'Crema de peinar + gel definidor';
  } else if (rizo === '4A') {
    tecnicaDefinicion = 'Shingling';
    tecnicaDescripcion =
      'Divide el cabello en secciones pequeñas. Aplica gel cremoso afro rizo por rizo, deslizando los dedos desde raíz hasta punta para definir cada espiral. Trabaja con el cabello muy húmedo para mejor agarre.';
    metodoSecado = 'Difusor en calor bajo o secado al aire libre';
    gelRecomendado = 'Gel cremoso afro + crema de peinar';
  } else if (rizo === '4B' || rizo === '4C') {
    tecnicaDefinicion = densidad === 'alta' ? 'Twist Out' : 'Finger Coils o Shingling';
    tecnicaDescripcion =
      rizo === '4B'
        ? 'Divide en secciones. Aplica gel cremoso y forma twist (trenzas de 2 hilos) en cada sección. Deja secar completamente antes de soltar. Para día 2-3: twist-out para revivir la definición.'
        : 'Divide en secciones muy pequeñas. Envuelve cada sección alrededor de tu dedo con gel cremoso para crear una espiral. Deja secar sin tocar. Es laborioso pero da la máxima definición al tipo 4C.';
    metodoSecado = 'Secado al aire libre preferible (el calor puede dañar la estructura)';
    gelRecomendado = 'Gel cremoso afro';

    if (densidad === 'alta') {
      notasAdicionales.push('Para día 2-3: Twist Out para revivir la definición sin relavar.');
    }
    notasAdicionales.push('Sella SIEMPRE con aceite después de aplicar el gel para retener humedad.');
  } else {
    tecnicaDefinicion = 'Rake & Shake + Scrunch';
    tecnicaDescripcion =
      'Aplica crema de peinar sección por sección con peine de dientes anchos. Agita puntas y compacta con scrunch.';
    metodoSecado = 'Difusor en calor bajo o aire libre';
    gelRecomendado = 'Gel definidor';
  }

  // ── Productos recomendados (resumen para vistas in-app) ──
  const productosPonto: string[] = [];
  const tratReconstructor = balanceHP === 'proteina' || elasticidad === 'baja' || danoQuimico || danoTermico;
  productosPonto.push(
    tratReconstructor
      ? 'Mascarilla reconstructora con queratina hidrolizada (base del cronograma)'
      : 'Mascarilla hidratante / nutritiva alternada según cronograma'
  );

  if (['1A', '1B', '1C'].includes(rizo)) {
    productosPonto.push('Leave-in ligero (aplicar de medios a puntas, evitar raíz)');
    if (porosidad === 'alta') {
      productosPonto.push('Aceite ligero (jojoba o almendras) en puntas para sellar');
    }
  } else if (['2A', '2B', '2C', '3A'].includes(rizo)) {
    productosPonto.push('Crema de peinar de textura media (sin sulfatos ni parabenos)');
    productosPonto.push('Gel definidor ligero con proteínas de trigo o seda (sin alcohol)');
    if (porosidad === 'alta') {
      productosPonto.push('Aceite medio (argán o jojoba) como sellador final');
    }
  } else if (['3B', '3C'].includes(rizo)) {
    productosPonto.push('Crema de peinar nutritiva e hidratante con humectantes (glicerina, aloe vera)');
    productosPonto.push('Gel definidor con proteínas vegetales, sin alcohol secante');
    if (porosidad === 'alta') {
      productosPonto.push('Aceite sellador (argán, jojoba o coco según porosidad)');
    }
  } else {
    // 4A, 4B, 4C
    productosPonto.push('Gel cremoso denso para máxima definición (con humectantes y proteínas vegetales)');
    productosPonto.push('Crema de peinar de alta densidad con mantecas (karité, cacao)');
    productosPonto.push('Aceite sellador pesado (ricino, coco u oliva) — método LOC/LCO obligatorio');
  }

  if (tratReconstructor) {
    notasAdicionales.push(
      'Mascarilla reconstructora: dejar actuar 20-30 min con calor (gorro térmico) para máxima reconstrucción.'
    );
  }

  // ── Recomendación estructurada de productos (PDF) ──
  const recomendacionProductos = buildRecomendacionProductos({
    rizo,
    porosidad,
    balanceHP,
    tipoDano,
    problemas,
    estadoCueroCabelludo,
    embarazo,
  });

  // ── Cuidado en Casa ──
  const diaLavado: string[] = [
    'Detangle en secciones con el acondicionador puesto (sin enjuagar)',
    'Aplica mascarilla / tratamiento según cronograma',
    'Enjuaga con agua fría para cerrar la cutícula',
    'Aplica leave-in en cabello húmedo',
    'Aplica crema de peinar + gel con la técnica indicada',
    'Seca con toalla de microfibra o camiseta de algodón (sin frotar)',
    'Usa difusor o deja secar al aire',
  ];

  const nocturno: string[] = [
    'Usa bonnet de satín o funda de almohada de seda para dormir',
    'Haz una piña suelta (ponytail en la coronilla sin apretar) para conservar los rizos',
    'Si el cabello está muy seco, aplica 1-2 gotas de aceite en las puntas antes del bonnet',
  ];

  const refresh: string[] = [
    'Mezcla agua + leave-in en spray (proporción 50/50)',
    'Aplica en secciones y scruncha suavemente',
    'Si los rizos perdieron forma: aplica un poco de gel fresco y scruncha',
    'Seca con difusor en frío o deja secar al aire',
  ];

  const evitar: string[] = [
    'Cepillar el cabello en seco (rompe los rizos y genera frizz)',
    'Toalla de algodón (usa microfibra o camiseta)',
    'Dormir sin protección (bonnet o funda de satín)',
    'Calor directo sin protector térmico',
  ];

  // Reglas específicas de porosidad
  if (porosidad === 'baja') {
    evitar.push('Aceites pesados (coco, ricino) — se acumulan en cutícula cerrada');
    diaLavado.push('Aplica mascarilla con gorro térmico para abrir la cutícula y permitir absorción');
    notasAdicionales.push('Porosidad baja: clarifica 1 vez al mes para remover acumulación de producto.');
  } else if (porosidad === 'alta') {
    diaLavado.push('Aplica técnica LOC o LCO: Leave-in → Oil (aceite) → Cream (crema) para retener humedad');
    evitar.push('Calor directo (agrava la apertura de cutícula)');
    notasAdicionales.push(
      'Porosidad alta: sella SIEMPRE con aceite o manteca después de hidratar para retener la humedad.'
    );
    notasAdicionales.push('Usa leave-in cremoso (no en spray) para mayor nutrición.');
  }

  // Cuero cabelludo
  const tieneCaspa =
    estadoCueroCabelludo.includes('Caspa seca') ||
    estadoCueroCabelludo.includes('Dermatitis seborreica');

  if (tieneCaspa) {
    notasAdicionales.push('Cuero cabelludo: considerar shampoo medicado 1x por semana.');
    notasAdicionales.push('Si la caspa persiste más de 4 semanas, consultar dermatólogo.');
  }

  if (embarazo) {
    notasAdicionales.push('Embarazo/lactancia: evitar keratina y productos con formol. Preferir ingredientes naturales.');
  }

  const tieneCaida = problemas.includes('Caída excesiva');
  if (tieneCaida) {
    notasAdicionales.push(
      'Caída excesiva: puede tener causa interna (estrés, anemia, tiroides, postparto). Recomendar consulta médica si persiste más de 3 meses.'
    );
    evitar.push('Peinados tensos (colas apretadas, trenzas pegadas al cuero cabelludo)');
  }

  if (nivelEstres === 'alto') {
    notasAdicionales.push('Nivel de estrés alto: puede contribuir a la caída y fragilidad del cabello.');
  }

  // ── Intervalo de cita ──
  let intervaloSugerido = '';
  if (
    estadoPuntas === 'Puntas abiertas severas (necesita corte)' ||
    tratamientoPrincipal === 'Reconstrucción' ||
    danoQuimico
  ) {
    intervaloSugerido = 'Regresar en 2 semanas (seguimiento urgente)';
  } else if (tratamientoPrincipal !== 'Mantenimiento') {
    intervaloSugerido = 'Regresar en 3-4 semanas';
  } else {
    intervaloSugerido = 'Regresar en 6-8 semanas';
  }

  const cuidadoCasa: CuidadoCasaResult = { diaLavado, nocturno, refresh, evitar };

  return {
    tratamientoPrincipal,
    tratamientosAdicionales,
    cronograma,
    tecnicaDefinicion,
    tecnicaDescripcion,
    metodoSecado,
    productosPonto,
    recomendacionProductos,
    cuidadoCasa,
    intervaloSugerido,
    notasAdicionales,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder de recomendación estructurada (usada por el PDF)
// ─────────────────────────────────────────────────────────────────────────────
export interface BuildRecomendacionParams {
  rizo: string;
  porosidad?: string;
  balanceHP?: string;
  tipoDano?: string[];
  problemas?: string[];
  estadoCueroCabelludo?: string[];
  embarazo?: boolean;
}

function frecuenciaLavadoBase(rizo: string): string {
  if (['1A', '1B', '1C'].includes(rizo)) return '2-3 veces por semana';
  if (['2A', '2B', '2C'].includes(rizo)) return '2 veces por semana';
  if (['3A', '3B', '3C'].includes(rizo)) return '1-2 veces por semana';
  return '1 vez por semana';
}

export function buildRecomendacionProductos(p: BuildRecomendacionParams): RecomendacionProductos {
  const rizo = p.rizo || '';
  const porosidad = p.porosidad || 'media';
  const balanceHP = p.balanceHP || '';
  const tipoDano = p.tipoDano || [];
  const problemas = p.problemas || [];
  const cuero = p.estadoCueroCabelludo || [];
  const embarazo = !!p.embarazo;

  const isLiso = ['1A', '1B', '1C'].includes(rizo);
  const isOndulado = ['2A', '2B', '2C'].includes(rizo);
  const isRizado = ['3A', '3B', '3C'].includes(rizo);
  const isAfro = ['4A', '4B', '4C'].includes(rizo);

  const buscar = new Set<string>();
  const evitar = new Set<string>();

  // Base universal
  evitar.add('Sulfatos agresivos (SLS, SLES)');
  evitar.add('Parabenos fuertes');
  evitar.add('Alcoholes secantes (alcohol denat., isopropílico)');
  evitar.add('Siliconas no solubles en agua');

  // Por tipo de cabello
  if (isLiso) {
    buscar.add('Humectantes ligeros (glicerina, aloe vera, panthenol)');
    buscar.add('Aceites ligeros (jojoba, almendras) en poca cantidad, solo puntas');
    buscar.add('Mascarillas hidratantes ligeras');
    evitar.add('Mantecas densas en raíz (apelmazan el cabello liso)');
    evitar.add('Cremas de peinar muy pesadas');
  }
  if (isOndulado) {
    buscar.add('Cremas de peinar de textura media');
    buscar.add('Humectantes (glicerina, aloe vera, miel)');
    buscar.add('Geles definidores ligeros (activan la onda sin cast pesado)');
    evitar.add('Productos muy densos que aplasten la onda');
  }
  if (isRizado) {
    buscar.add('Cremas de peinar nutritivas e hidratantes');
    buscar.add('Geles definidores con proteínas de trigo o seda');
    buscar.add('Aceites medios (argán, jojoba)');
    buscar.add('Mantecas medias (cacao, mango)');
  }
  if (isAfro) {
    buscar.add('Cremas de peinar densas y nutritivas');
    buscar.add('Mantecas densas (karité, cacao, mango)');
    buscar.add('Aceites pesados (ricino, coco, oliva) para sellado');
    buscar.add('Geles cremosos para máxima definición');
    buscar.add('Mascarillas con proteínas vegetales (trigo, soja)');
    buscar.add('Método LOC o LCO (leave-in + aceite + crema)');
  }

  // Porosidad
  if (porosidad === 'alta') {
    buscar.add('Ingredientes selladores (mantecas y aceites pesados)');
    buscar.add('Productos con pH ácido (ayudan a cerrar la cutícula)');
    evitar.add('Humectantes puros en climas húmedos (provocan frizz)');
    evitar.add('Calor directo sin protector térmico');
  } else if (porosidad === 'baja') {
    buscar.add('Productos ligeros a base de agua');
    evitar.add('Proteínas en exceso (rigidez y quiebre)');
    evitar.add('Aceites pesados (coco, ricino) — no penetran, se acumulan');
  }

  // Daño / quiebre
  const hayDano = tipoDano.length > 0 || balanceHP === 'proteina';
  if (hayDano) {
    buscar.add('Proteínas hidrolizadas (queratina, seda, trigo)');
    buscar.add('Tratamientos reconstructores con aminoácidos');
  }

  // Frizz
  const tieneFrizz = problemas.some((x) => /frizz/i.test(x));
  if (tieneFrizz) {
    buscar.add('Combinación de humectantes + selladores (método LOC/LCO)');
  }

  // Cuero cabelludo
  const cueroGraso = cuero.includes('Graso (exceso de sebo)') || cuero.includes('Build-up (acumulación de producto)');
  const cueroSeco = cuero.some((x) => /seco|caspa/i.test(x));
  if (cueroGraso) {
    buscar.add('Champús con árbol de té, menta o salvia (equilibran el sebo)');
  }
  if (cueroSeco) {
    buscar.add('Champús suaves sin sulfatos y masajes con aceites ligeros');
  }

  // Embarazo / lactancia
  if (embarazo) {
    evitar.add('Formol y derivados (alisados progresivos, keratina con formol)');
    evitar.add('Fragancias sintéticas intensas');
  }

  // ── Rutina de 6 pasos ──
  const frecLav = frecuenciaLavadoBase(rizo);

  const champuCaract = cueroGraso
    ? 'sin sulfatos agresivos, con árbol de té o menta'
    : cueroSeco
    ? 'suave sin sulfatos, hidratante'
    : 'sin sulfatos agresivos, con tensoactivos suaves';

  const acondCaract = isAfro || isRizado
    ? 'nutritivo e hidratante con humectantes y mantecas'
    : isOndulado
    ? 'ligero con humectantes (glicerina, aloe vera)'
    : 'muy ligero, sin siliconas pesadas';

  const mascarillaCaract = hayDano
    ? 'reconstructora con queratina hidrolizada y aminoácidos'
    : balanceHP === 'hidratacion'
    ? 'hidratante con humectantes (glicerina, aloe vera, miel)'
    : balanceHP === 'nutricion'
    ? 'nutritiva con mantecas y aceites vegetales'
    : 'alternar hidratante y nutritiva según cronograma';

  const leaveInCaract = isLiso
    ? 'ligero en spray, aplicar solo en medios y puntas'
    : isAfro
    ? 'cremoso denso, aplicar de raíz a puntas'
    : isRizado
    ? 'cremoso de textura media'
    : 'cremoso ligero';

  const defProducto = isAfro
    ? 'Gel cremoso afro'
    : isRizado
    ? 'Gel definidor'
    : isOndulado
    ? 'Gel definidor ligero'
    : 'Definidor (opcional)';
  const defCaract = isAfro
    ? 'cremoso denso para máxima definición, con proteínas vegetales'
    : isRizado
    ? 'con proteínas de trigo o seda, sin alcohol secante'
    : isOndulado
    ? 'ligero, activa la onda sin cast pesado'
    : 'muy ligero, solo si necesita control extra en puntas';

  const aceiteTipo = porosidad === 'alta'
    ? 'pesado (ricino, coco u oliva)'
    : porosidad === 'baja'
    ? 'ligero (jojoba o almendras)'
    : 'medio (argán o jojoba)';
  const aceiteFrec = isAfro || porosidad === 'alta'
    ? 'cada lavado (obligatorio para sellar)'
    : isLiso
    ? '1-2 veces por semana, solo en puntas'
    : '2-3 veces por semana';

  const rutina: RutinaPaso[] = [
    { producto: 'Champú', caracteristicas: champuCaract, frecuencia: frecLav },
    { producto: 'Acondicionador', caracteristicas: acondCaract, frecuencia: 'cada lavado' },
    { producto: 'Mascarilla', caracteristicas: mascarillaCaract, frecuencia: '1 vez por semana' },
    { producto: 'Leave-in', caracteristicas: leaveInCaract, frecuencia: 'cada lavado' },
    { producto: defProducto, caracteristicas: defCaract, frecuencia: 'cada lavado' },
    { producto: 'Aceite sellador', caracteristicas: aceiteTipo, frecuencia: aceiteFrec },
  ];

  return {
    ingredientesBuscar: Array.from(buscar),
    ingredientesEvitar: Array.from(evitar),
    rutina,
    disclaimer: DISCLAIMER_PRODUCTOS,
  };
}

export function getTratamientoPrincipalExplicacion(tratamiento: string, data: WizardData): string {
  const { porosidad, elasticidad, balanceHP } = data;

  if (tratamiento === 'Reconstrucción') {
    return `Tu cabello muestra signos de debilidad estructural: ${
      elasticidad === 'baja' ? 'baja elasticidad (se rompe al estirarse)' : ''
    }${balanceHP === 'proteina' ? ', necesita proteína urgente' : ''}. La reconstrucción aporta aminoácidos y queratina hidrolizada para reconstruir la fibra capilar desde adentro.`;
  }
  if (tratamiento === 'Hidratación profunda') {
    return `Tu cabello está pidiendo agua: se siente seco, áspero y el frizz es un síntoma de sed. La porosidad ${porosidad} permite una buena absorción. La hidratación profunda restaura el contenido de agua dentro de la fibra capilar.`;
  }
  if (tratamiento === 'Hidratación + Nutrición (sellado)') {
    return `Tu cabello absorbe la humedad rápido pero también la pierde rápido (porosidad alta). Necesita hidratación SEGUIDA de nutrición (aceites/mantecas) que sellan la cutícula abierta y retienen el agua dentro de la fibra.`;
  }
  if (tratamiento === 'Nutrición') {
    return `Tu cabello necesita aceites y mantecas para sellar y dar brillo. La cutícula está en buen estado pero pierde nutrición. Los aceites vegetales penetran la fibra y sellan la cutícula para un cabello lustroso y flexible.`;
  }
  if (tratamiento === 'Mantenimiento') {
    return `¡Excelente noticia! Tu cabello está en buen equilibrio. Solo necesita mantenimiento regular para conservar su salud: alternar hidratación y nutrición cada semana para mantener el balance.`;
  }
  return `Tratamiento personalizado basado en las características únicas de tu cabello. Seguir el cronograma de 4 semanas para ver resultados óptimos.`;
}
