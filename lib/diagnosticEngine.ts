import { WizardData, ResultadoConsulta, CronogramaResult, CuidadoCasaResult } from './types';

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
    notasAdicionales.push('Prioridad alta en proteína — usa mascarilla 3 en 1 como tratamiento reconstructor.');
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

  // ── Productos Ponto Hair ──
  const productosPonto: string[] = ['Mascarilla 3 en 1 (base de todo tratamiento)'];

  if (['1A', '1B', '1C'].includes(rizo)) {
    productosPonto.push('Leave-in liviano (aplicar en cabello húmedo de medios a puntas)');
    if (porosidad === 'alta') {
      productosPonto.push('Aceite de sellado (aplicar sobre el leave-in para cerrar la cutícula)');
    }
  } else if (['2A', '2B', '2C', '3A'].includes(rizo)) {
    productosPonto.push('Crema de peinar (aplicar en cabello húmedo, sección por sección)');
    productosPonto.push('Gel definidor (encima de la crema para fijar y reducir frizz)');
    if (porosidad === 'alta') {
      productosPonto.push('Aceite de sellado (aplicar sobre el gel para cerrar la cutícula)');
    }
  } else if (['3B', '3C'].includes(rizo)) {
    productosPonto.push('Crema de peinar (aplicar generosamente, el tipo 3 necesita hidratación)');
    productosPonto.push('Gel definidor (sobre la crema para definición y anti-frizz)');
    if (porosidad === 'alta') {
      productosPonto.push('Aceite de sellado (siempre sellar en porosidad alta)');
    }
  } else {
    // 4A, 4B, 4C
    productosPonto.push('Gel cremoso afro (base para definir el patrón del tipo 4)');
    productosPonto.push('Crema de peinar (hidratación y suavidad)');
    productosPonto.push('Aceite de sellado (obligatorio en tipos 4 para retener humedad)');
  }

  if (balanceHP === 'proteina') {
    notasAdicionales.push(
      'Mascarilla 3 en 1: dejar actuar 20-30 min con calor (gorro térmico) para máxima reconstrucción.'
    );
  }

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
    cuidadoCasa,
    intervaloSugerido,
    notasAdicionales,
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
