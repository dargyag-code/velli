// ══════════════════════════════════════════════════════════════════════════
// Seed canónico — FASE 2: liso (tipo 1), ondulado (tipo 2), módulos
// transversales de canas y alopecia, y complementos de tipos 3–4.
//
// Fuentes (fuera del repo desde el 2026-10-22; los originales están en el
// OneDrive del proyecto, Documentos/conocimiento):
//   · Entrega 1 — Velli_Fase2_Liso_Ondulado_BORRADOR_v0.1.docx
//   · Entrega 2 — Velli_Fase2_Canas_Alopecia_BORRADOR_v0.1.docx
//   · Entrega 4 — Velli_Base_Conocimiento_Entrega4_Tipos3y4_BORRADOR_v0.1.docx
//   · Documento de validación técnica — sus correcciones MANDAN sobre los
//     borradores (C-08 y A-02 llevan texto VERBATIM del documento).
//
// TODO el contenido de este archivo entra en estado BORRADOR: se revisa con
// la vista previa del panel /conocimiento y se publica desde ahí. Mientras
// no se publique, producción no cambia (el loader solo lee 'publicada').
//
// Arquitectura transversal (validación técnica, P.7 Entrega 2): canas y
// alopecia NO son tipos de cabello — son módulos que se suman al
// diagnóstico del tipo base. El motor procesa patrón + porosidad + cana +
// alopecia simultáneamente para una única ruta de servicio.
//
// Cronogramas plantilla: las reglas no repiten cronogramas — el segmento
// cronograma matchea por regex sobre el nombre del plan en el tratamiento
// principal (EQ-1, REP-1, REP-2, NUT-1, DEF-1, DEF-2, MANT-1, PROT-1).
//
// Decisiones de fusión (Entrega 4): donde el documento marca FUSIONAR con
// el motor de rizos, aquí solo se agrega el aporte nuevo (notas/cuidados)
// sin duplicar ni reemplazar las reglas existentes del motor — la regla
// del motor manda en caso de conflicto.
//
// import type: el seed se importa también desde Node (scripts/generar-seed-
// kb-sql.mjs) vía type-stripping — no debe tener imports de runtime.
// ══════════════════════════════════════════════════════════════════════════

import type { ReglaKB } from '../tipos';

const B = 'borrador' as const;

const ALISADOS_LEGACY = [
  'Alisado permanente (keratina, formol, japonés)',
  'Relaxer / desrizado químico',
];
const CUERO_GRASO = 'Graso (exceso de sebo)';

// Señales médicas de la guía de reconocimiento en cabina (Entrega 2 §7 +
// banderas de la Entrega 1 §7 y Entrega 4 §8). Cualquiera de estas activa
// la regla de seguridad del evaluador: derivación, jamás plan cosmético.
const SENALES_CAIDA_MEDICAS = [
  'parches_redondos',
  'caida_difusa_subita',
  'raya_ensancha',
  'zonas_lisas_brillantes',
  'cuero_inflamado_pustulas',
];

export const REGLAS_FASE2: ReglaKB[] = [
  // ═══ HECHOS DERIVADOS (prios 200+ — después de los del motor) ══════════
  {
    clave: 'hecho.f2.calor_frecuente',
    segmento: 'hecho',
    prioridad: 200,
    estado: B,
    condiciones: { hecho: 'frecuenciaCalor', op: 'en', valor: ['2-3-semana', 'diario'] },
    salida: { hecho: 'calorFrecuente', valor: true },
    notasInternas: 'Entrega 1 · L-03: tres o más exposiciones semanales a calor.',
  },
  {
    clave: 'hecho.f2.oleosidad_alta',
    segmento: 'hecho',
    prioridad: 201,
    estado: B,
    condiciones: {
      alguna: [
        { hecho: 'ext.grasaRaiz', op: 'en', valor: ['mismo_dia', '1_2_dias'] },
        { hecho: 'ext.tipoCueroCabelludo', op: 'eq', valor: 'graso' },
        { hecho: 'estadoCueroCabelludo', op: 'incluye', valor: CUERO_GRASO },
      ],
    },
    salida: { hecho: 'oleosidadAlta', valor: true },
    notasInternas:
      'Entrega 1 · perfil: oleosidad del cuero cabelludo, protagonista en tipo 1 y frecuente en 2A–2B.',
  },
  {
    clave: 'hecho.f2.alisado_vigente',
    segmento: 'hecho',
    prioridad: 202,
    estado: B,
    condiciones: {
      alguna: [
        { hecho: 'quimicos', op: 'incluyeAlguno', valor: ALISADOS_LEGACY },
        { hecho: 'ext.procesosQuimicos', op: 'incluye', valor: 'alisado' },
      ],
    },
    salida: { hecho: 'alisadoVigente', valor: true },
    notasInternas: 'Entrega 1 · L-06: alisado químico o keratina en el historial.',
  },
  {
    clave: 'hecho.f2.tinte_frecuente',
    segmento: 'hecho',
    prioridad: 203,
    estado: B,
    condiciones: {
      hecho: 'ext.frecuenciaTinte',
      op: 'en',
      valor: ['cada_3_6_semanas', 'cada_8_semanas_o_menos'],
    },
    salida: { hecho: 'tinteFrecuente', valor: true },
    notasInternas:
      'Entrega 1 · L-09 (coloración cada 8 semanas o menos) y Entrega 2 · C-06 (cobertura cada 3–6 semanas).',
  },
  {
    clave: 'hecho.f2.tiene_canas',
    segmento: 'hecho',
    prioridad: 204,
    estado: B,
    condiciones: {
      hecho: 'ext.estadoCanas',
      op: 'en',
      valor: ['menos_25', 'entre_25_50', 'mas_50'],
    },
    salida: { hecho: 'tieneCanas', valor: true },
    notasInternas: 'Entrega 2 · módulo canas: se activa con cualquier porcentaje de canas.',
  },
  {
    clave: 'hecho.f2.canas_25_mas',
    segmento: 'hecho',
    prioridad: 205,
    estado: B,
    condiciones: { hecho: 'ext.estadoCanas', op: 'en', valor: ['entre_25_50', 'mas_50'] },
    salida: { hecho: 'canas25Mas', valor: true },
    notasInternas: 'Entrega 2 · umbral >=25% de canas (C-02, C-06).',
  },
  {
    clave: 'hecho.f2.protector_instalado',
    segmento: 'hecho',
    prioridad: 206,
    estado: B,
    condiciones: {
      hecho: 'ext.protectorEnUso',
      op: 'en',
      valor: ['trenzas', 'twists', 'extensiones'],
    },
    salida: { hecho: 'protectorInstalado', valor: true },
    notasInternas: 'Entrega 4 · T4-05/T4-06: peinado protector instalado.',
  },
  {
    clave: 'hecho.f2.frizz_medio_alto',
    segmento: 'hecho',
    prioridad: 207,
    estado: B,
    condiciones: {
      alguna: [
        { hecho: 'ext.nivelFrizz', op: 'en', valor: ['medio', 'alto'] },
        { hecho: 'tieneFrizz', op: 'verdadero' },
      ],
    },
    salida: { hecho: 'frizzMedioAlto', valor: true },
    notasInternas: 'Entrega 1 · dimensión frizz (protagonista en 1C y tipo 2).',
  },
  {
    clave: 'hecho.f2.buildup_declarado',
    segmento: 'hecho',
    prioridad: 208,
    estado: B,
    condiciones: { hecho: 'ext.acumulacionProducto', op: 'eq', valor: 'si' },
    salida: { hecho: 'buildUp', valor: true },
    notasInternas:
      'Entrega 1 · O-05: build-up declarado en el flujo de ondulado. Reusa el hecho buildUp del motor (fusión): activa el detox existente sin duplicar reglas.',
  },

  // ═══ DERIVACIÓN MÉDICA — banderas rojas nuevas ════════════════════════
  // Guía de reconocimiento en cabina (Entrega 2 §7) + banderas de tipos
  // 3–4 (Entrega 4 §8). Bandera activa = derivación a dermatólogo, JAMÁS
  // plan cosmético — la regla de seguridad del evaluador lo fuerza en
  // código. Las sospechas son orientativas: el diagnóstico es del médico.
  {
    clave: 'derivacion.f2.areata',
    segmento: 'derivacion_medica',
    prioridad: 20,
    estado: B,
    esBanderaMedica: true,
    condiciones: { hecho: 'ext.senalesCaida', op: 'incluye', valor: 'parches_redondos' },
    salida: {
      motivo:
        'Pérdida de cabello en parches redondos u ovalados bien definidos, con piel del parche de aspecto normal y suave.',
      recomendaciones: [
        'Suspender el diagnóstico cosmético de la zona y derivar a dermatología con prontitud (sospecha orientativa: alopecia areata — el diagnóstico corresponde al dermatólogo).',
        'Registrar la observación en el historial; fotografía comparable solo con autorización expresa de la clienta.',
      ],
    },
    notasInternas: 'Entrega 2 · guía de cabina: parches redondos → urgencia alta.',
  },
  {
    clave: 'derivacion.f2.efluvio',
    segmento: 'derivacion_medica',
    prioridad: 21,
    estado: B,
    esBanderaMedica: true,
    condiciones: { hecho: 'ext.senalesCaida', op: 'incluye', valor: 'caida_difusa_subita' },
    salida: {
      motivo:
        'Caída difusa, súbita y abundante en los últimos 1–3 meses (frecuente tras parto, cirugía, enfermedad con fiebre, pérdida de peso brusca o estrés intenso).',
      recomendaciones: [
        'Derivar para evaluación médica (sospecha orientativa: efluvio telógeno — suele ser autolimitado, pero la confirmación es médica).',
        'El salón acompaña solo con cuidado suave: sin tratamientos "anticaída" por cuenta propia.',
      ],
    },
    notasInternas: 'Entrega 2 · guía de cabina: efluvio → urgencia media.',
  },
  {
    clave: 'derivacion.f2.patron',
    segmento: 'derivacion_medica',
    prioridad: 22,
    estado: B,
    esBanderaMedica: true,
    condiciones: { hecho: 'ext.senalesCaida', op: 'incluye', valor: 'raya_ensancha' },
    salida: {
      motivo:
        'Raya que se ensancha de forma progresiva, retroceso de la línea frontal o hebras cada vez más finas en la coronilla.',
      recomendaciones: [
        'Derivar a dermatología (sospecha orientativa: alopecia de patrón): los manejos médicos responden mejor cuanto antes se inician.',
        'Velli no genera plan cosmético "anticaída" para esta condición.',
      ],
    },
    notasInternas: 'Entrega 2 · guía de cabina: alopecia de patrón → urgencia media-alta.',
  },
  {
    clave: 'derivacion.f2.traccion_fibrosis',
    segmento: 'derivacion_medica',
    prioridad: 23,
    estado: B,
    esBanderaMedica: true,
    condiciones: { hecho: 'ext.senalesCaida', op: 'incluye', valor: 'zonas_lisas_brillantes' },
    salida: {
      motivo:
        'Zonas lisas y brillantes sin vello en sienes o línea frontal: señal de fibrosis por tracción, daño que puede volverse permanente.',
      recomendaciones: [
        'Soltar toda tensión de inmediato y derivar a dermatología.',
        'Registrar zona y fecha en el historial para el seguimiento.',
      ],
    },
    notasInternas:
      'Entrega 2 · A-02: la derivación aplica cuando hay zonas lisas y brillantes (fibrosis). La tracción SIN fibrosis no deriva: la atiende el salón (ver nota.f2.a02).',
  },
  {
    clave: 'derivacion.f2.cicatricial',
    segmento: 'derivacion_medica',
    prioridad: 24,
    estado: B,
    esBanderaMedica: true,
    condiciones: { hecho: 'ext.senalesCaida', op: 'incluye', valor: 'cuero_inflamado_pustulas' },
    salida: {
      motivo:
        'Pérdida de cabello acompañada de inflamación, pústulas, dolor, descamación severa o piel lisa y brillante sin poros visibles.',
      recomendaciones: [
        'DERIVACIÓN PRIORITARIA E INMEDIATA (posible alopecia cicatricial u otra condición inflamatoria): el daño folicular puede volverse permanente.',
        'No aplicar tratamientos, masajes ni químicos en la zona.',
      ],
    },
    notasInternas: 'Entrega 2 · guía de cabina: única señal marcada URGENTE.',
  },
  {
    clave: 'derivacion.f2.descamacion_placas',
    segmento: 'derivacion_medica',
    prioridad: 25,
    estado: B,
    esBanderaMedica: true,
    condiciones: { hecho: 'ext.descamacion', op: 'eq', valor: 'placas_enrojecimiento' },
    salida: {
      motivo:
        'Descamación con placas gruesas y adheridas, enrojecimiento, exudado, dolor o picor intenso en el cuero cabelludo.',
      recomendaciones: [
        'No aplicar tratamientos, masajes ni químicos en la zona; derivar a dermatología (posible dermatitis seborreica severa, psoriasis o infección).',
        'Registrar fotos en el historial solo si la clienta lo autoriza.',
      ],
    },
    notasInternas:
      'Entrega 1 · L-08 marca el LÍMITE de la resequedad simple; Entrega 2 · guía de cabina.',
  },
  {
    clave: 'derivacion.f2.protector_lesiones',
    segmento: 'derivacion_medica',
    prioridad: 26,
    estado: B,
    esBanderaMedica: true,
    condiciones: { hecho: 'ext.senalesProtector', op: 'incluye', valor: 'pustulas_lesiones' },
    salida: {
      motivo:
        'Cuero cabelludo comprometido bajo el peinado protector: pústulas o lesiones en la piel.',
      recomendaciones: [
        'Retirar la instalación y derivar a dermatología (protocolo de derivación de la Entrega 2).',
        'No aplicar procesos químicos ni tensión sobre cuero cabelludo con lesiones.',
      ],
    },
    notasInternas: 'Entrega 4 · T4-06 y banderas de tipos 3–4: piel comprometida bajo protector.',
  },
  {
    clave: 'derivacion.f2.a06_bloqueos',
    segmento: 'derivacion_medica',
    prioridad: 90,
    estado: B,
    esBanderaMedica: true,
    condiciones: {
      alguna: [
        { hecho: 'ext.senalesCaida', op: 'incluyeAlguno', valor: SENALES_CAIDA_MEDICAS },
        { hecho: 'ext.descamacion', op: 'eq', valor: 'placas_enrojecimiento' },
        { hecho: 'ext.senalesProtector', op: 'incluye', valor: 'pustulas_lesiones' },
      ],
    },
    salida: {
      motivo: 'Aplican los bloqueos permanentes del motor (regla negativa A-06).',
      recomendaciones: [
        'BLOQUEO A-06 · No generar plan "anticaída" para una condición médica.',
        'BLOQUEO A-06 · No recomendar masajes, estimulantes ni aceites sobre piel enferma, inflamada o lesionada.',
        'BLOQUEO A-06 · No prometer crecimiento ni recuperación de cabello.',
        'BLOQUEO A-06 · No sugerir reemplazar o complementar un tratamiento médico con alternativas "naturales".',
        'BLOQUEO A-06 · No aplicar procesos químicos sobre cuero cabelludo con lesiones.',
        'En su lugar: registro en el historial + derivación + plan de acompañamiento (A-01 a A-05) según el caso.',
      ],
    },
    notasInternas:
      'Entrega 2 · A-06 (regla negativa del motor). Validación técnica: "Regla Negativa Inmutable A-06 ... Es nuestro blindaje legal regional". Se implementa como bandera que suma los bloqueos a toda derivación activa; la imposibilidad de generar plan cosmético la fuerza el evaluador en código (no configurable por datos). Si se agrega una señal médica nueva desde el panel, incluirla también en esta condición.',
  },

  // ═══ TRATAMIENTO PRINCIPAL (primera que matchea) ══════════════════════
  // Prios 1–18: antes de las reglas genéricas del motor (10–60), pero
  // condicionadas por esLiso/esOndulado o ext.* — los tipos 3–4 sin
  // condiciones nuevas siguen cayendo en las reglas del motor, intactas.
  // El nombre del plan lleva el código del cronograma plantilla (EQ-1,
  // REP-1…): el segmento cronograma lo referencia por regex.
  {
    clave: 'tratamiento.f2.rotura_masiva',
    segmento: 'tratamiento_principal',
    prioridad: 1,
    estado: B,
    condiciones: { hecho: 'ext.senalesCaida', op: 'incluye', valor: 'rotura_sin_bulbo' },
    salida: { texto: 'Reconstrucción intensiva (REP-2)' },
    notasInternas:
      'Entrega 2 · A-03: rotura masiva (hebras sin bulbo) es territorio 100% cosmético — REP-2 + suspensión total de la causa + corte sanitario. Transversal a todo tipo.',
  },
  {
    clave: 'tratamiento.f2.protector',
    segmento: 'tratamiento_principal',
    prioridad: 2,
    estado: B,
    condiciones: { hecho: 'protectorInstalado', op: 'verdadero' },
    salida: { texto: 'Cuidado bajo peinado protector (PROT-1)' },
    notasInternas:
      'Entrega 4 · T4-05/T4-06: con protector instalado, la ruta del mes es PROT-1 (ciclo repetible mientras dure la instalación).',
  },
  {
    clave: 'tratamiento.f2.l04_rep2',
    segmento: 'tratamiento_principal',
    prioridad: 3,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'elasticidad', op: 'eq', valor: 'baja' },
      ],
    },
    salida: { texto: 'Reconstrucción intensiva (REP-2)' },
    notasInternas:
      'Entrega 1 · L-04: elasticidad baja = pérdida estructural de proteína, escalón previo al quiebre. Suspender calor y químicos 4 semanas y reevaluar.',
  },
  {
    clave: 'tratamiento.f2.o04_rep2',
    segmento: 'tratamiento_principal',
    prioridad: 4,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'elasticidad', op: 'eq', valor: 'baja' },
      ],
    },
    salida: { texto: 'Reconstrucción intensiva (REP-2)' },
    notasInternas:
      'Entrega 1 · O-04: déficit proteico en patrón ondulado — sin estructura, ninguna técnica de definición funciona. REP-2 adaptado a onda, styling mínimo.',
  },
  {
    clave: 'tratamiento.f2.l06_post_alisado',
    segmento: 'tratamiento_principal',
    prioridad: 5,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'alisadoVigente', op: 'verdadero' },
      ],
    },
    salida: { texto: 'Mantenimiento post-alisado (MANT-1)' },
    notasInternas:
      'Entrega 1 · L-06: alisado o keratina vigente — preservar el proceso y no sobrecargar. Proteína SOLO si la prueba de elasticidad da baja (en ese caso gana L-04/REP-2, prioridad 3).',
  },
  {
    clave: 'tratamiento.f2.o06_transicion',
    segmento: 'tratamiento_principal',
    prioridad: 6,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'transicion', op: 'verdadero' },
      ],
    },
    salida: { texto: 'Transición post-química (REP-1)' },
    notasInternas:
      'Entrega 1 · O-06: dos texturas en la misma hebra. REP-1 completo + cortes programados + cero calor. Las notas del motor para transición se conservan y se suman.',
  },
  {
    clave: 'tratamiento.f2.l03_l09_rep1',
    segmento: 'tratamiento_principal',
    prioridad: 7,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
        {
          alguna: [
            { hecho: 'calorFrecuente', op: 'verdadero' },
            { hecho: 'tinteFrecuente', op: 'verdadero' },
          ],
        },
      ],
    },
    salida: { texto: 'Reparación progresiva (REP-1)' },
    notasInternas:
      'Entrega 1 · L-03 (daño térmico moderado) y L-09 (teñido frecuente con porosidad alta) comparten plan REP-1; el detalle de cada caso vive en sus notas (nota.f2.l03 / nota.f2.l09).',
  },
  {
    clave: 'tratamiento.f2.o05_detox',
    segmento: 'tratamiento_principal',
    prioridad: 8,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'buildUp', op: 'verdadero' },
      ],
    },
    salida: { texto: 'Detox y reinicio de definición (DEF-1)' },
    notasInternas:
      'Entrega 1 · O-05: ondas apagadas por acumulación — un (1) lavado clarificante + hidratación profunda inmediata, y de ahí en adelante DEF-1. El tratamiento adicional de detox del motor (adicional.detox) también se activa: fusión, no duplicado.',
  },
  {
    clave: 'tratamiento.f2.l07_l01_l02_eq1',
    segmento: 'tratamiento_principal',
    prioridad: 11,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        {
          alguna: [
            { hecho: 'oleosidadAlta', op: 'verdadero' },
            { hecho: 'ext.objetivoPrincipal', op: 'eq', valor: 'volumen' },
          ],
        },
      ],
    },
    salida: { texto: 'Equilibrio de raíz ligera (EQ-1)' },
    notasInternas:
      'Entrega 1 · L-01 (raíz grasa, hebra sana), L-02 (raíz grasa + puntas resecas: EQ-1 + sellado de puntas) y L-07 (busca volumen) comparten plan EQ-1; el matiz de cada perfil vive en sus notas y productos.',
  },
  {
    clave: 'tratamiento.f2.l05_nut1',
    segmento: 'tratamiento_principal',
    prioridad: 12,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '1C' },
        { hecho: 'frizzMedioAlto', op: 'verdadero' },
      ],
    },
    salida: { texto: 'Nutrición antifrizz (NUT-1)' },
    notasInternas:
      'Entrega 1 · L-05: 1C con frizz y estática — sellar cutícula y aportar emoliencia sin engrasar.',
  },
  {
    clave: 'tratamiento.f2.l08_l10_mant1',
    segmento: 'tratamiento_principal',
    prioridad: 13,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'hayDano', op: 'falso' },
      ],
    },
    salida: { texto: 'Mantenimiento (MANT-1)' },
    notasInternas:
      'Entrega 1 · L-08 (cuero seco / descamación leve: MANT-1 + cuidado de cuero cabelludo) y L-10 (liso sano: rutina mínima viable — cuando el cabello está bien, Velli lo dice). El liso CON daño sigue a las reglas del motor (reparación).',
  },
  {
    clave: 'tratamiento.f2.o03_def2',
    segmento: 'tratamiento_principal',
    prioridad: 14,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
        {
          alguna: [
            { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '2C' },
            { hecho: 'ext.objetivoPrincipal', op: 'eq', valor: 'mas_rizo' },
          ],
        },
      ],
    },
    salida: { texto: 'Hidratación profunda + definición intensa (DEF-2)' },
    notasInternas:
      'Entrega 1 · O-03 (2C poroso con frizz alto en clima húmedo — caso Villavicencio) y O-10 con porosidad alta. Primero saciar la hebra, luego sellarla.',
  },
  {
    clave: 'tratamiento.f2.o07_eq1',
    segmento: 'tratamiento_principal',
    prioridad: 15,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'oleosidadAlta', op: 'verdadero' },
      ],
    },
    salida: { texto: 'Equilibrio de raíz ligera (EQ-1)' },
    notasInternas:
      'Entrega 1 · O-07: onda con raíz grasa — EQ-1 adaptado a onda: limpieza frecuente y suave de la raíz, definición solo de medios a puntas.',
  },
  {
    clave: 'tratamiento.f2.o08_nut1',
    segmento: 'tratamiento_principal',
    prioridad: 16,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'grosor', op: 'eq', valor: 'grueso' },
        { hecho: 'porosidad', op: 'neq', valor: 'baja' },
      ],
    },
    salida: { texto: 'Nutrición antifrizz (NUT-1)' },
    notasInternas:
      'Entrega 1 · O-08: onda gruesa y seca sin daño químico — NUT-1 adaptado a onda con sellado en cada lavado.',
  },
  {
    clave: 'tratamiento.f2.o09_mant1',
    segmento: 'tratamiento_principal',
    prioridad: 17,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'ext.objetivoPrincipal', op: 'eq', valor: 'mantenimiento' },
        { hecho: 'hayDano', op: 'falso' },
      ],
    },
    salida: { texto: 'Mantenimiento (MANT-1)' },
    notasInternas:
      'Entrega 1 · O-09: onda sana en equilibrio — sostener, no intervenir. MANT-1 + refresco entre lavados.',
  },
  {
    clave: 'tratamiento.f2.o01_o02_def1',
    segmento: 'tratamiento_principal',
    prioridad: 18,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'hayDano', op: 'falso' },
      ],
    },
    salida: { texto: 'Definición de onda (DEF-1)' },
    notasInternas:
      'Entrega 1 · O-01 (2A que se aplasta: styling ultraligero), O-02 (2B definición clásica) y O-10 sin porosidad alta. El matiz por subtipo vive en las notas. El ondulado CON daño sigue a las reglas del motor.',
  },

  // ═══ CRONOGRAMAS PLANTILLA (primera que matchea) ══════════════════════
  // Entrega 1 §4, Entrega 2 §4, Entrega 4 §5. Base: 2 sesiones de cuidado
  // por semana (1 en MANT-1). Las plantillas matchean por regex sobre el
  // código del plan; CAN-1 y CAN-2 (módulo canas) matchean por condición y
  // componen sobre el tipo base — van después de REP/PROT (el daño manda) y
  // antes del resto. Todas con prioridad < 60 (el default del motor).
  {
    clave: 'cronograma.f2.rep2',
    segmento: 'cronograma',
    prioridad: 1,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'REP-2' },
    salida: {
      semana1: 'Sesión 1: Reconstrucción (proteína) · Sesión 2: Hidratación',
      semana2: 'Sesión 1: Hidratación · Sesión 2: Nutrición',
      semana3: 'Sesión 1: Reconstrucción (proteína) · Sesión 2: Hidratación',
      semana4:
        'Sesión 1: Hidratación · Sesión 2: Prueba de elasticidad — decide si se repite el ciclo, se pasa a REP-1 o se propone corte',
    },
    notasInternas:
      'Entrega 1 · REP-2 (Reconstrucción intensiva): elasticidad baja con riesgo de quiebre (L-04, O-04; también A-03 rotura).',
  },
  {
    clave: 'cronograma.f2.rep1',
    segmento: 'cronograma',
    prioridad: 2,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'REP-1' },
    salida: {
      semana1: 'Sesión 1: Hidratación · Sesión 2: Hidratación',
      semana2: 'Sesión 1: Hidratación · Sesión 2: Reconstrucción suave (proteína)',
      semana3: 'Sesión 1: Nutrición · Sesión 2: Hidratación',
      semana4:
        'Sesión 1: Reconstrucción suave (proteína) · Sesión 2: Hidratación + prueba de elasticidad de control',
    },
    notasInternas:
      'Entrega 1 · REP-1 (Reparación progresiva): daño térmico o químico moderado con elasticidad media (L-03, L-09, O-06).',
  },
  {
    clave: 'cronograma.f2.prot1',
    segmento: 'cronograma',
    prioridad: 3,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'PROT-1' },
    salida: {
      semana1:
        'Sesión 1: Limpieza del cuero cabelludo con champú diluido (aplicador) + secado COMPLETO · Sesión 2: Hidratación ligera de raíces visibles (spray acuoso + aceite ligero)',
      semana2:
        'Sesión 1: Hidratación ligera de raíces y largos accesibles · Sesión 2: Revisión de tensión: ¿hay dolor, bultitos o tirantez en bordes? → aflojar o retirar',
      semana3: 'Sesión 1: Limpieza del cuero cabelludo + secado completo · Sesión 2: Hidratación ligera',
      semana4:
        'Sesión 1: Hidratación ligera · Sesión 2: Evaluación de la instalación: semanas acumuladas, estado de bordes, decisión de retiro o continuidad (máximo orientativo 4–8 semanas)',
    },
    notasInternas:
      'Entrega 4 · PROT-1 (Cuidado bajo peinado protector): ciclo de 4 semanas repetible mientras dure la instalación (T4-05, T4-06).',
  },
  {
    clave: 'cronograma.f2.can2',
    segmento: 'cronograma',
    prioridad: 4,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tieneCanas', op: 'verdadero' },
        { hecho: 'ext.situacionColor', op: 'eq', valor: 'en_transicion' },
      ],
    },
    salida: {
      semana1: 'Sesión 1: Hidratación + matización de la zona natural · Sesión 2: Refresco o lavado normal',
      semana2: 'Sesión 1: Reparación suave (proteína ligera) en los largos teñidos · Sesión 2: Hidratación',
      semana3: 'Sesión 1: Hidratación + nutrición en puntas · Sesión 2: Lavado normal',
      semana4:
        'Sesión 1: Foto de progreso para el Pasaporte Capilar · Sesión 2: Revisión de estrategia visual con la clienta',
    },
    notasInternas:
      'Entrega 2 · CAN-2 (Transición acompañada, C-05): ciclo repetible mes a mes durante la transición. Módulo transversal: compone sobre cualquier tipo base; el daño estructural (REP) y el protector (PROT-1) tienen prioridad.',
  },
  {
    clave: 'cronograma.f2.can1',
    segmento: 'cronograma',
    prioridad: 5,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'canas25Mas', op: 'verdadero' },
        { hecho: 'ext.amarillamientoCanas', op: 'verdadero' },
        { hecho: 'ext.situacionColor', op: 'neq', valor: 'tenida_cobertura' },
      ],
    },
    salida: {
      semana1:
        'Sesión 1: Hidratación + matización corta (pausa breve, 3–5 min) · Sesión 2: Lavado normal de rutina',
      semana2: 'Sesión 1: Hidratación profunda (semana de descanso del violeta) · Sesión 2: Lavado normal',
      semana3: 'Sesión 1: Hidratación + matización corta · Sesión 2: Lavado normal',
      semana4:
        'Sesión 1: Hidratación + evaluación de tono y de resequedad · Sesión 2: Ajuste del protocolo según resultado',
    },
    notasInternas:
      'Entrega 2 · CAN-1 (Matización y brillo, C-02): amarillamiento de canas >=25% sin tinte de cobertura. Módulo transversal sobre el tipo base.',
  },
  {
    clave: 'cronograma.f2.eq1',
    segmento: 'cronograma',
    prioridad: 6,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'EQ-1' },
    salida: {
      semana1:
        'Sesión 1: Limpieza equilibrante + hidratación ligera solo en medios y puntas · Sesión 2: Limpieza equilibrante (lavado normal de rutina)',
      semana2:
        'Sesión 1: Limpieza + exfoliación suave del cuero cabelludo · Sesión 2: Hidratación ligera de medios a puntas',
      semana3: 'Sesión 1: Limpieza equilibrante · Sesión 2: Hidratación + nutrición solo en puntas',
      semana4:
        'Sesión 1: Limpieza + hidratación ligera · Sesión 2: Evaluación: ¿bajó la sensación de grasa? Ajustar frecuencia de lavado',
    },
    notasInternas:
      'Entrega 1 · EQ-1 (Equilibrio de raíz ligera): cuero cabelludo oleoso con hebra sana o porosidad mixta (L-01, L-02, L-07, O-07).',
  },
  {
    clave: 'cronograma.f2.nut1',
    segmento: 'cronograma',
    prioridad: 7,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'NUT-1' },
    salida: {
      semana1: 'Sesión 1: Hidratación · Sesión 2: Nutrición',
      semana2: 'Sesión 1: Nutrición · Sesión 2: Hidratación',
      semana3: 'Sesión 1: Hidratación · Sesión 2: Nutrición',
      semana4:
        'Sesión 1: Nutrición + sellado con aceite ligero · Sesión 2: Hidratación + evaluación del frizz',
    },
    notasInternas:
      'Entrega 1 · NUT-1 (Nutrición antifrizz): hebra gruesa o seca con frizz por cutícula abierta (L-05, O-08; también C-03 cana rebelde).',
  },
  {
    clave: 'cronograma.f2.def2',
    segmento: 'cronograma',
    prioridad: 8,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'DEF-2' },
    salida: {
      semana1:
        'Sesión 1: Hidratación profunda (mascarilla con tiempo de pausa) + styling con gel de fijación media-alta · Sesión 2: Refresco',
      semana2: 'Sesión 1: Hidratación + styling · Sesión 2: Hidratación ligera o co-wash + refresco',
      semana3: 'Sesión 1: Hidratación profunda + nutrición en puntas + styling · Sesión 2: Refresco',
      semana4: 'Sesión 1: Hidratación + styling · Sesión 2: Evaluación del frizz en día húmedo real',
    },
    notasInternas:
      'Entrega 1 · DEF-2 (Hidratación profunda + definición intensa): 2C porosos con frizz alto en clima húmedo (O-03, O-10 con porosidad alta).',
  },
  {
    clave: 'cronograma.f2.def1',
    segmento: 'cronograma',
    prioridad: 9,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'DEF-1' },
    salida: {
      semana1:
        'Sesión 1: Hidratación + styling completo (técnica crema + gel) · Sesión 2: Refresco a mitad de semana (agua + leave-in + scrunch)',
      semana2:
        'Sesión 1: Hidratación + styling, ajustando cantidades según resultado de la semana 1 · Sesión 2: Refresco',
      semana3: 'Sesión 1: Hidratación + nutrición en puntas + styling · Sesión 2: Refresco',
      semana4:
        'Sesión 1: Hidratación + styling · Sesión 2: Evaluación: fotos comparativas del patrón para el historial',
    },
    notasInternas:
      'Entrega 1 · DEF-1 (Definición de onda): rutina base de definición para tipo 2 sin daño relevante (O-01, O-02, O-09, O-10).',
  },
  {
    clave: 'cronograma.f2.mant1',
    segmento: 'cronograma',
    prioridad: 11,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'MANT-1' },
    salida: {
      semana1: 'Hidratación (una sesión de cuidado por semana basta)',
      semana2: 'Nutrición ligera',
      semana3: 'Hidratación',
      semana4: 'Hidratación o nutrición según sensación de la hebra',
    },
    notasInternas:
      'Entrega 1 · MANT-1 (Mantenimiento): cabello en equilibrio, de cualquier tipo (L-06, L-08, L-10, O-09). El objetivo es sostener el equilibrio, no intervenirlo.',
  },

  // ═══ TRATAMIENTOS ADICIONALES (todas) — módulos transversales ═════════
  {
    clave: 'adicional.f2.can1',
    segmento: 'tratamiento_adicional',
    prioridad: 40,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'canas25Mas', op: 'verdadero' },
        { hecho: 'ext.amarillamientoCanas', op: 'verdadero' },
      ],
    },
    salida: { texto: 'Módulo canas: matización y brillo (CAN-1)' },
    notasInternas:
      'Entrega 2 · C-02: el módulo de canas se SUMA al diagnóstico base sin reemplazarlo (arquitectura transversal de la validación técnica).',
  },
  {
    clave: 'adicional.f2.can2',
    segmento: 'tratamiento_adicional',
    prioridad: 41,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tieneCanas', op: 'verdadero' },
        { hecho: 'ext.situacionColor', op: 'eq', valor: 'en_transicion' },
      ],
    },
    salida: { texto: 'Módulo canas: transición acompañada (CAN-2)' },
    notasInternas: 'Entrega 2 · C-05: transición a canas desde el tinte (proyecto de 12–24 meses).',
  },
  {
    clave: 'adicional.f2.a01',
    segmento: 'tratamiento_adicional',
    prioridad: 42,
    estado: B,
    condiciones: {
      hecho: 'ext.situacionCaida',
      op: 'en',
      valor: ['en_evaluacion_medica', 'diagnostico_confirmado_manejo'],
    },
    salida: { texto: 'Acompañamiento bajo manejo médico (A-01): cuidado de mínima agresión' },
    notasInternas:
      'Entrega 2 · A-01: clienta ya derivada y/o en tratamiento dermatológico. El protagonista es el médico; el salón cuida sin interferir.',
  },

  // ═══ INTERVALO DE CITA (primera) ══════════════════════════════════════
  {
    clave: 'intervalo.f2.protector',
    segmento: 'intervalo',
    prioridad: 5,
    estado: B,
    condiciones: { hecho: 'protectorInstalado', op: 'verdadero' },
    salida: {
      texto:
        'Revisión de tensión en 1–2 semanas; retiro de la instalación como cita agendada (máximo orientativo 4–8 semanas)',
    },
    notasInternas:
      'Entrega 4 · T4-05: el sistema agenda el retiro como cita al momento de instalar.',
  },
  {
    clave: 'intervalo.f2.can2',
    segmento: 'intervalo',
    prioridad: 6,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tieneCanas', op: 'verdadero' },
        { hecho: 'ext.situacionColor', op: 'eq', valor: 'en_transicion' },
      ],
    },
    salida: { texto: 'Visita mensual con foto de progreso para el Pasaporte Capilar' },
    notasInternas:
      'Entrega 2 · CAN-2: la foto mensual es parte del plan — sostiene la motivación en los meses difíciles de la línea de demarcación.',
  },

  // ═══ NOTAS — Entrega 1: cabello liso (prios 200–219) ══════════════════
  // Una nota por regla documental: diagnóstico + técnica clave, fieles al
  // texto fuente. Las prios altas las colocan después de las notas del
  // motor (10–130), preservando el orden legacy.
  {
    clave: 'nota.f2.l01',
    segmento: 'nota',
    prioridad: 200,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'oleosidadAlta', op: 'verdadero' },
        { hecho: 'porosidad', op: 'neq', valor: 'alta' },
      ],
    },
    salida: {
      textos: [
        'Raíz grasa con hebra sana: en el cabello liso el sebo viaja sin obstáculos por la hebra recta — aplana el peinado y da sensación de sucio rápido aunque la fibra esté en buen estado. Objetivo del mes: regular la sensación de grasa sin resecar largos.',
        'Técnica clave: lavar con yemas de los dedos (nunca uñas), enjuague final con agua tibia-fría, acondicionador jamás en la raíz, secado con aire frío para cerrar cutícula.',
      ],
    },
    notasInternas:
      'Entrega 1 · REGLA L-01 (raíz grasa, hebra sana). Pregunta abierta: ¿lavado diario suave o interdiario para este perfil?',
  },
  {
    clave: 'nota.f2.l02',
    segmento: 'nota',
    prioridad: 201,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'oleosidadAlta', op: 'verdadero' },
        {
          alguna: [
            { hecho: 'estadoPuntas', op: 'regex', valor: 'abiertas' },
            { hecho: 'porosidad', op: 'eq', valor: 'alta' },
          ],
        },
      ],
    },
    salida: {
      textos: [
        'Desequilibrio raíz-puntas (porosidad mixta), el cuadro más común del liso largo: la raíz se engrasa en horas mientras las puntas, lejos del sebo y castigadas por calor o fricción, se resecan y abren. Tratar como dos cabellos distintos: raíz que se limpia, puntas que se protegen (EQ-1 + sellado de puntas en cada lavado).',
        'Técnica clave: sérum únicamente del medio hacia abajo, sobre cabello húmedo; recoger el cabello sin tensión en la raíz; despuntar cada 8–12 semanas.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA L-02 (raíz grasa, puntas resecas — porosidad mixta).',
  },
  {
    clave: 'nota.f2.l03',
    segmento: 'nota',
    prioridad: 202,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'calorFrecuente', op: 'verdadero' },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: {
      textos: [
        'Daño térmico moderado: cutícula erosionada por calor repetido — pérdida de brillo, puntas abiertas, frizz de hebras rotas. La estructura interna aún responde, por lo que es recuperable. Compromiso del mes: protector térmico obligatorio y plancha máximo 1 vez por semana.',
        'Técnica clave: plancha solo sobre cabello 100 % seco y con protector aplicado; temperatura máxima orientativa de 180 °C en hebra fina; una sola pasada lenta en lugar de varias rápidas.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA L-03 (daño térmico moderado).',
  },
  {
    clave: 'nota.f2.l04',
    segmento: 'nota',
    prioridad: 203,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'elasticidad', op: 'eq', valor: 'baja' },
      ],
    },
    salida: {
      textos: [
        'Elasticidad baja — riesgo de quiebre: pérdida estructural de proteína, la fibra perdió su capacidad de estirar y volver. Es el escalón previo al quiebre masivo y exige frenar toda agresión: suspender calor y procesos químicos durante las 4 semanas y reevaluar elasticidad al cierre.',
        'Técnica clave: desenredar solo en húmedo, con acondicionador y peine de dientes anchos, de puntas a raíz; secar sin fricción con toalla de microfibra; nada de coletas tensas.',
        'Si tras 4 semanas la elasticidad no mejora, la fibra dañada es irreversible: proponer corte progresivo de lo comprometido.',
      ],
    },
    notasInternas:
      'Entrega 1 · REGLA L-04 (elasticidad baja). Nota pendiente: cómo comunicar el corte progresivo a la clienta.',
  },
  {
    clave: 'nota.f2.l05',
    segmento: 'nota',
    prioridad: 204,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '1C' },
        { hecho: 'frizzMedioAlto', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        '1C con frizz y estática: hebra gruesa con leve memoria de onda cuya cutícula se abre con la humedad ambiental; falta sellado y peso ligero que ordene la fibra. Objetivo: sellar cutícula y aportar emoliencia sin engrasar.',
        'Técnica clave: secar con aire medio dirigido de raíz a puntas (a favor de la cutícula) y golpe de aire frío final; evitar cepillar en seco; funda de satén opcional para dormir.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA L-05 (1C con frizz y estática).',
  },
  {
    clave: 'nota.f2.l06',
    segmento: 'nota',
    prioridad: 205,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'alisadoVigente', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        'Alisado permanente o keratina vigente: la prioridad es preservar el proceso y no sobrecargar. El proceso ya aportó carga proteica — el exceso de proteína adicional puede rigidizar y quebrar. Hidratación semanal; proteína SOLO si la prueba de elasticidad da baja, y en dosis suave.',
        'Técnica clave: espaciar lavados según protocolo del fabricante; no recoger ni marcar el cabello los primeros días post-proceso si el protocolo lo indica.',
        'Bandera amarilla: NO aplicar nuevos procesos químicos (tinte con amoniaco, decoloración) sin evaluar la hebra.',
      ],
    },
    notasInternas:
      'Entrega 1 · REGLA L-06. Pregunta de fondo: postura oficial de Velli/KEYSHOP frente a keratinas y alisados.',
  },
  {
    clave: 'nota.f2.l07',
    segmento: 'nota',
    prioridad: 206,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '1A' },
        { hecho: 'grosor', op: 'eq', valor: 'fino' },
        { hecho: 'ext.objetivoPrincipal', op: 'eq', valor: 'volumen' },
      ],
    },
    salida: {
      textos: [
        'Busca volumen (hebra fina): hebra fina y sana que se aplana por su propio peso y por productos que la recargan. No le falta salud: le sobra peso en la rutina. La regla mental: todo lo cremoso, lejos de la raíz; todo lo ligero, hacia la raíz.',
        'Técnica clave: secado cabeza abajo o con cepillo redondo levantando la raíz; aplicar el producto de raíz con el cabello húmedo, antes del secado.',
      ],
    },
    notasInternas:
      'Entrega 1 · REGLA L-07. Si la clienta reporta pérdida progresiva de densidad, deja de ser regla cosmética: banderas rojas (senalesCaida).',
  },
  {
    clave: 'nota.f2.l08',
    segmento: 'nota',
    prioridad: 207,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        {
          alguna: [
            { hecho: 'ext.descamacion', op: 'eq', valor: 'fina_blanca' },
            { hecho: 'ext.tipoCueroCabelludo', op: 'eq', valor: 'seco' },
          ],
        },
      ],
    },
    salida: {
      textos: [
        'Cuero cabelludo seco o con descamación leve: resequedad simple (no confundir con caspa grasa ni con dermatitis). Suele asociarse a agua muy caliente, lavado excesivo o clima seco. Plan: espaciar lavados, bajar la temperatura del agua, hidratar la piel.',
        'Técnica clave: masaje suave con yemas al aplicar el tónico; agua tibia, nunca caliente.',
        'LÍMITE de esta regla: si hay placas, enrojecimiento, exudado, dolor o picor intenso, no es resequedad simple — derivación obligatoria.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA L-08 (cuero cabelludo seco o descamación leve).',
  },
  {
    clave: 'nota.f2.l09',
    segmento: 'nota',
    prioridad: 208,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'tinteFrecuente', op: 'verdadero' },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: {
      textos: [
        'Teñido frecuente con porosidad alta: daño químico acumulativo por colorante — cutícula abierta, color que se lava rápido, sequedad creciente. Recuperable con rutina de reparación y hábitos de protección del color (conecta a futuro con el módulo de colorimetría de Fase 3).',
        'Técnica clave: retocar solo raíz cuando sea posible, en lugar de re-teñir todo el largo; espaciar aplicaciones al máximo que el objetivo de color permita.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA L-09 (teñido frecuente con porosidad alta).',
  },
  {
    clave: 'nota.f2.l10',
    segmento: 'nota',
    prioridad: 209,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'hayDano', op: 'falso' },
        { hecho: 'oleosidadAlta', op: 'falso' },
        { hecho: 'ext.descamacion', op: 'neq', valor: 'fina_blanca' },
        { hecho: 'ext.tipoCueroCabelludo', op: 'neq', valor: 'seco' },
      ],
    },
    salida: {
      textos: [
        'Liso sano — cabello en equilibrio. El riesgo aquí es el contrario al habitual: sobre-tratarlo y romper el balance con exceso de productos o tratamientos innecesarios. Rutina mínima viable + educación de hábitos.',
        'Hábitos: no dormir con el cabello mojado, fricción mínima, despunte de mantenimiento cada 10–12 semanas.',
      ],
    },
    notasInternas:
      'Entrega 1 · REGLA L-10. Esta regla protege la credibilidad del diagnóstico: cuando el cabello está bien, Velli lo dice. Vender de más erosiona la confianza.',
  },

  // ═══ NOTAS — Entrega 1: cabello ondulado (prios 220–239) ══════════════
  {
    clave: 'nota.f2.o01',
    segmento: 'nota',
    prioridad: 220,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '2A' },
        { hecho: 'grosor', op: 'eq', valor: 'fino' },
      ],
    },
    salida: {
      textos: [
        '2A que se aplasta: patrón de onda débil y sensible al peso — cualquier crema densa o aceite en raíz lo estira. El problema no es falta de tratamiento sino exceso de carga: styling ultraligero. Prohibido por defecto: cremas densas, mantecas y aceites en raíz.',
        'Técnica clave: aplicar el styling con el cabello muy húmedo, scrunch (apretar hacia arriba), secar al aire o con difusor a temperatura baja; no tocar mientras seca.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA O-01 (2A que se aplasta).',
  },
  {
    clave: 'nota.f2.o02',
    segmento: 'nota',
    prioridad: 221,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '2B' },
        { hecho: 'hayDano', op: 'falso' },
      ],
    },
    salida: {
      textos: [
        '2B — definición clásica: el perfil ondulado de manual, ondas en S desde los medios que solo necesitan método y constancia para verse definidas. Es el perfil ideal para enseñar la rutina completa de definición y fidelizar.',
        'Técnica clave — secuencia completa: desenredar con acondicionador → aplicar crema y gel por secciones con scrunch → plopping 10–15 minutos con microfibra → difusor → romper el cast (la película rígida del gel) con manos secas al final.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA O-02 (2B — definición clásica).',
  },
  {
    clave: 'nota.f2.o03',
    segmento: 'nota',
    prioridad: 222,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '2C' },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: {
      textos: [
        '2C con frizz alto en clima húmedo: hebra ávida de agua — al estar deshidratada y porosa, absorbe la humedad del ambiente y se encrespa. El frizz aquí es síntoma de sed, no de suciedad. Primero saciar la hebra, luego sellarla. La hidratación profunda es semanal e innegociable este mes.',
        'Técnica clave: sellar con gel suficiente para formar cast y romperlo al secar por completo; refresco entre lavados con agua + leave-in; en humedad extrema, capa final de antihumectante (reservado para ocasiones, no como base diaria).',
      ],
    },
    notasInternas:
      'Entrega 1 · REGLA O-03 (2C con frizz alto en clima húmedo — caso Villavicencio). Frontera 2C↔3A: criterio de enrutamiento de la validación técnica — patrón en mojado sin producto (S sin resorte → tipo 2; resorte → motor de rizos) y objetivo como desempate.',
  },
  {
    clave: 'nota.f2.o04',
    segmento: 'nota',
    prioridad: 223,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'elasticidad', op: 'eq', valor: 'baja' },
      ],
    },
    salida: {
      textos: [
        'Onda con elasticidad baja: déficit proteico en patrón ondulado — la fibra perdió memoria. Sin estructura, ninguna técnica de definición funcionará. REP-2 adaptado a onda: reconstructor quincenal alternado con hidratación; styling mínimo durante el mes.',
        'Técnica clave: reevaluar con la prueba de elasticidad al cierre de la semana 4 antes de retomar la rutina de definición.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA O-04 (onda con elasticidad baja).',
  },
  {
    clave: 'nota.f2.o05',
    segmento: 'nota',
    prioridad: 224,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'buildUp', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        'Ondas apagadas por acumulación (build-up): la acumulación de producto impermeabiliza la hebra — la hidratación no entra y el patrón se apaga. Antes de tratar hay que limpiar el lienzo: un (1) lavado clarificante, hidratación profunda inmediata, y de ahí en adelante definición con productos aptos (sin siliconas insolubles).',
        'Técnica clave: el clarificante reseca — la mascarilla de hidratación profunda posterior no es opcional, es parte del procedimiento. Clarificante máximo 1 vez al mes.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA O-05 (ondas apagadas por build-up).',
  },
  {
    clave: 'nota.f2.o06',
    segmento: 'nota',
    prioridad: 225,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'transicion', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        'Transición post-química: la zona tratada químicamente no recuperará su patrón; la nueva crece sana desde la raíz. El plan gestiona la convivencia de ambas y las expectativas de tiempo: REP-1 completo + cortes programados de las puntas tratadas + cero calor.',
        'Técnica clave: peinados de baja tensión que unifiquen visualmente (ondas con técnica, trenzas suaves); calendario de cortes acordado con la clienta.',
      ],
    },
    notasInternas:
      'Entrega 1 · REGLA O-06 (transición post-química). Este perfil es la puerta de entrada clásica al mundo KEYSHOP. Las notas de transición del motor se conservan y se suman (fusión).',
  },
  {
    clave: 'nota.f2.o07',
    segmento: 'nota',
    prioridad: 226,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'oleosidadAlta', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        'Onda con raíz grasa — el clásico conflicto del ondulado: raíz que pide lavado frecuente y largos que piden respeto. Se resuelve tratando cada zona por separado: limpieza frecuente y suave de la raíz, definición solo de medios a puntas.',
        'Técnica clave: lavar la raíz con yemas y dejar que la espuma limpie los largos solo al enjuagar; nada de acondicionador ni styling en la raíz.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA O-07 (onda con raíz grasa).',
  },
  {
    clave: 'nota.f2.o08',
    segmento: 'nota',
    prioridad: 227,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'grosor', op: 'eq', valor: 'grueso' },
        { hecho: 'porosidad', op: 'neq', valor: 'baja' },
      ],
    },
    salida: {
      textos: [
        'Onda gruesa y seca: hebra gruesa que necesita más emoliencia de la que recibe — la sequedad opaca el patrón y dispara el frizz. NUT-1 adaptado a onda: nutrición e hidratación alternadas con sellado en cada lavado.',
        'Técnica clave: aplicar por secciones con el cabello empapado; "squish to condish" en la ducha (escurrir el acondicionador hacia arriba con agua) para cargar hidratación.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA O-08 (onda gruesa y seca).',
  },
  {
    clave: 'nota.f2.o09',
    segmento: 'nota',
    prioridad: 228,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'ext.objetivoPrincipal', op: 'eq', valor: 'mantenimiento' },
        { hecho: 'hayDano', op: 'falso' },
      ],
    },
    salida: {
      textos: [
        'Onda sana — cabello ondulado en equilibrio: el objetivo es sostener, no intervenir. MANT-1 + refresco entre lavados con rutina mínima de su tipo.',
        'Técnica clave — refresco: humedecer, aplicar leave-in ligero y scrunch; dormir con piña alta suelta o funda de satén para conservar el patrón.',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA O-09 (onda sana — mantenimiento).',
  },
  {
    clave: 'nota.f2.o10',
    segmento: 'nota',
    prioridad: 229,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'ext.objetivoPrincipal', op: 'eq', valor: 'mas_rizo' },
      ],
    },
    salida: {
      textos: [
        'Quiere "más rizo": el patrón genético se potencia, no se transforma — una 2B puede lograr su mejor versión de onda marcada, pero no convertirse en 3A. La regla gestiona técnica y expectativa a la vez. Tu onda no se convierte en otro patrón: se convierte en su mejor versión.',
        'Técnica clave: finger coiling en los mechones del marco del rostro; difusor en modo "pixie diffusing" (acercar el cabello al difusor apagado, encender, apagar, soltar); romper el cast al final con gel de fijación media-alta.',
      ],
    },
    notasInternas:
      'Entrega 1 · REGLA O-10 (quiere más rizo). El mensaje "su mejor versión" quedó sugerido en el borrador, pendiente de validar su redacción.',
  },

  // ═══ NOTAS — Entrega 2: módulo canas (prios 240–249) ══════════════════
  // Módulo TRANSVERSAL: se suma al diagnóstico del tipo base sin
  // reemplazarlo, en cualquier tipo 1–4 (arquitectura de la validación técnica).
  {
    clave: 'nota.f2.c01',
    segmento: 'nota',
    prioridad: 240,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'ext.estadoCanas', op: 'eq', valor: 'menos_25' },
        { hecho: 'ext.situacionColor', op: 'neq', valor: 'tenida_cobertura' },
      ],
    },
    salida: {
      textos: [
        'Primeras canas (<25 %): melanina en descenso en hebras puntuales. El cabello circundante sigue mandando — el diagnóstico base de su tipo continúa siendo el principal y este módulo solo lo complementa. Matización solo si aparece amarillamiento.',
        'Educación clave: no arrancar las canas. No "salen siete más" (mito), pero arrancarlas repetidamente maltrata el folículo y puede dañarlo.',
      ],
    },
    notasInternas:
      'Entrega 2 · REGLA C-01. Validación técnica: mito de arrancar la cana validado para el módulo educativo de la app.',
  },
  {
    clave: 'nota.f2.c02',
    segmento: 'nota',
    prioridad: 241,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'canas25Mas', op: 'verdadero' },
        { hecho: 'ext.amarillamientoCanas', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        'Amarillamiento de canas: la hebra blanca, sin melanina que la enmascare, absorbe y muestra todo — rayos UV, calor de herramientas, residuos de producto, minerales del agua dura, contaminación o nicotina. El amarillo es casi siempre extrínseco: tiene causa identificable.',
        'Técnica clave — detective primero: ¿plancha muy caliente? ¿agua dura (considerar enjuague clarificante o quelante suave puntual)? ¿residuo de styling (clarificante 1 vez)? Tratar la causa evita matizar de por vida.',
        'Protocolo de matización: máximo 1 vez por semana, tiempos de pausa cortos al inicio (la cana porosa toma el pigmento violeta rápido — pausas cortas evitan reflejos lila). Siempre intercalar hidratación: los matizadores resecan.',
      ],
    },
    notasInternas:
      'Entrega 2 · REGLA C-02 + reglas del cronograma CAN-1. Pregunta abierta: ¿hay matizador violeta en el catálogo KEYSHOP?',
  },
  {
    clave: 'nota.f2.c03',
    segmento: 'nota',
    prioridad: 242,
    estado: B,
    condiciones: {
      hecho: 'ext.texturaCana',
      op: 'en',
      valor: ['mas_gruesa_aspera', 'patron_distinto'],
    },
    salida: {
      textos: [
        'Cana rebelde — textura cambiada: la cana no es "más fuerte", es más seca e indisciplinada. Con la edad cambia la fibra y baja la producción de sebo, y la hebra blanca lo refleja primero. Plan: NUT-1 adaptado + disciplina sin agresión.',
        'Técnica clave: disciplinar con secado dirigido y tensión suave de cepillo, nunca con plancha al máximo "para domarla". En patrones ondulados o rizados, producto extra y técnica localizada en esas hebras.',
      ],
    },
    notasInternas:
      'Entrega 2 · REGLA C-03. Validación técnica: la cana se identifica como hebra con alteración estructural; refuerzo localizado transversal según el servicio.',
  },
  {
    clave: 'nota.f2.c04',
    segmento: 'nota',
    prioridad: 243,
    estado: B,
    condiciones: { hecho: 'ext.estadoCanas', op: 'eq', valor: 'mas_50' },
    salida: {
      textos: [
        'Cabello maduro (canas ≥50 %): la producción de sebo desciende con la edad — el cabello mayormente cano tiende a una sed estructural que no es daño, es fisiología. La rutina debe compensar lo que el cuero cabelludo ya no aporta: hidratación profunda semanal fija + nutrición ligera alternada.',
        'Técnica clave: espaciar lavados, agua tibia (nunca caliente), funda de satén recomendada.',
      ],
    },
    notasInternas: 'Entrega 2 · REGLA C-04 (cabello maduro reseco — MANT-1 reforzado).',
  },
  {
    clave: 'nota.f2.c05',
    segmento: 'nota',
    prioridad: 244,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tieneCanas', op: 'verdadero' },
        { hecho: 'ext.situacionColor', op: 'eq', valor: 'en_transicion' },
      ],
    },
    salida: {
      textos: [
        'Transición a canas desde el tinte: un proyecto de 12 a 24 meses según el largo — dos cabellos conviviendo en una cabeza. El éxito depende menos de los productos y más de la estrategia visual y el acompañamiento emocional del proceso.',
        'Estrategias posibles: (a) corte progresivo o radical; (b) transición difuminada con técnicas de color (la ejecución pertenece al módulo de colorimetría de Fase 3 o a colorista aliado); (c) transición libre con matización del segmento natural. La línea de demarcación se gestiona con estrategia visual — nunca con química improvisada.',
        'Técnica clave: foto de progreso en cada visita para el Pasaporte Capilar — ver el avance sostiene la decisión en los meses difíciles de la línea de demarcación.',
      ],
    },
    notasInternas:
      'Entrega 2 · REGLA C-05 + CAN-2. Pregunta abierta: ¿KEYSHOP ejecuta las técnicas de color de transición o se alía con colorista hasta Fase 3?',
  },
  {
    clave: 'nota.f2.c06',
    segmento: 'nota',
    prioridad: 245,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'canas25Mas', op: 'verdadero' },
        { hecho: 'ext.situacionColor', op: 'eq', valor: 'tenida_cobertura' },
        { hecho: 'tinteFrecuente', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        'Cobertura de canas con tinte frecuente: doble carga sobre la fibra — hebra madura, naturalmente más seca, sometida además a química frecuente. Es el perfil cano con más riesgo de daño acumulativo. Plan: reparación continua y suave + hábitos de protección del color (proteína suave quincenal o mensual según la prueba de elasticidad).',
        'Técnica clave: retocar solo la raíz siempre que el objetivo lo permita. La cobertura de canas resistentes tiene técnica propia (pre-pigmentación, elección de base) que documentará el módulo de colorimetría de Fase 3.',
      ],
    },
    notasInternas: 'Entrega 2 · REGLA C-06 (cobertura de canas con tinte frecuente).',
  },
  {
    clave: 'nota.f2.c07',
    segmento: 'nota',
    prioridad: 246,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tieneCanas', op: 'verdadero' },
        { hecho: 'esLiso', op: 'falso' },
      ],
    },
    salida: {
      textos: [
        'Cana en patrón ondulado o rizado: las hebras blancas pierden definición frente al resto del patrón. La cana, más seca y a veces con patrón levemente distinto, se "sale del peinado". No es un problema del rizo: es la sed puntual de esas hebras. El plan de definición de su tipo continúa + refuerzo localizado en las hebras canas.',
        'Técnica clave: producto adicional y técnica localizada (finger coiling o twist suave) en los mechones canos del marco del rostro; hidratación profunda regular.',
      ],
    },
    notasInternas:
      'Entrega 2 · REGLA C-07. El ejemplo perfecto de condición transversal: se suma al diagnóstico base sin reemplazarlo. Sobre tipos 3–4 aplica igual (Entrega 4 §2.2).',
  },
  {
    clave: 'nota.f2.c08',
    segmento: 'nota',
    prioridad: 247,
    estado: B,
    condiciones: { hecho: 'ext.aparicionCanas', op: 'eq', valor: 'subita_temprana' },
    salida: {
      textos: [
        'Tus primeras canas son el reflejo de tu genética única. Si consideras que su aparición ha sido extraordinariamente súbita, coméntalo de manera casual con tu médico en tu consulta de rutina, ¡pero sonríe!, la gran mayoría de las veces es herencia pura.',
        'Para la estilista: el tono lo es todo — normalizar y dar opciones (lucirla, matizarla o cubrirla) sin empujar ninguna. La canicie no se "trata" cosméticamente: se cuida y, si la clienta quiere, se colorea. NO es bandera roja.',
      ],
    },
    notasInternas:
      'Entrega 2 · REGLA C-08 (canicie prematura). CORRECCIÓN DE LA VALIDACIÓN TÉCNICA APLICADA: el primer texto es VERBATIM del documento de validación (reemplaza la redacción del borrador; se elimina del PDF cualquier palabra que induzca a la hipocondría).',
  },

  // ═══ NOTAS — Entrega 2: acompañamiento de alopecia (prios 250–259) ════
  // Territorio fronterizo: aquí Velli reconoce, registra, deriva y
  // acompaña. Nunca diagnostica ni trata. Las señales MÉDICAS derivan
  // (sección derivación); estas reglas cubren lo que el salón SÍ hace.
  {
    clave: 'nota.f2.a01',
    segmento: 'nota',
    prioridad: 250,
    estado: B,
    condiciones: {
      hecho: 'ext.situacionCaida',
      op: 'en',
      valor: ['en_evaluacion_medica', 'diagnostico_confirmado_manejo'],
    },
    salida: {
      textos: [
        'Acompañamiento bajo manejo médico (A-01): el protagonista del tratamiento es el médico. El rol del salón es ser el mejor aliado posible — cuidar sin interferir, registrar la evolución y sostener el ánimo. Cuidado de mínima agresión durante todo el proceso: champú suave, sin procesos químicos nuevos, sin calor alto, sin tensión mecánica.',
        'Antes de aplicar cualquier producto en el cuero cabelludo en cabina, confirmar con la clienta que no interfiere con lo indicado por su médico. El salón nunca sugiere modificar, complementar ni suspender un tratamiento médico.',
        'Registrar evolución con fotos comparables (misma luz, mismo ángulo) SOLO con autorización expresa; celebrar los avances pequeños.',
      ],
    },
    notasInternas:
      'Entrega 2 · REGLA A-01. Línea jurídica de la validación técnica (guion de derivación aprobado palabra por palabra).',
  },
  {
    clave: 'nota.f2.a02',
    segmento: 'nota',
    prioridad: 251,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'ext.senalesCaida', op: 'incluye', valor: 'traccion_sienes' },
        { hecho: 'ext.senalesCaida', op: 'noIncluye', valor: 'zonas_lisas_brillantes' },
      ],
    },
    salida: {
      textos: [
        'Amar tu cabello también es soltarlo. La tensión constante en el mismo punto debilita la raíz hasta apagarla. Dale un respiro a tu línea frontal.',
        'Tracción temprana (A-02) — donde el salón es protagonista: es la única forma de pérdida donde la estilista tiene poder causal directo. Intervención inmediata de hábitos: cero tensión por 8–12 semanas, rotación de peinados sueltos, límites de peso y tiempo de uso de extensiones, satén nocturno.',
        'Revisión con fotos a las 8–12 semanas: si no aparece repoblación con vello fino o surgen zonas lisas y brillantes → derivar. La conversación es la técnica: explicar la relación causa-efecto sin culpabilizar y proponer alternativas de peinado que la clienta de verdad use.',
      ],
    },
    notasInternas:
      'Entrega 2 · REGLA A-02. CORRECCIÓN DE LA VALIDACIÓN TÉCNICA APLICADA: el primer texto es el copy oficial VERBATIM del documento de validación. Aprobada con máxima prioridad para la prevención en salones. Si hay zonas lisas y brillantes, gana la derivación (fibrosis).',
  },
  {
    clave: 'nota.f2.a03',
    segmento: 'nota',
    prioridad: 252,
    estado: B,
    condiciones: { hecho: 'ext.senalesCaida', op: 'incluye', valor: 'rotura_sin_bulbo' },
    salida: {
      textos: [
        'Rotura masiva — no es caída (A-03): territorio 100 % cosmético. La fibra se quiebra pero el folículo está sano: hebras partidas sin bulbo, puntas cortas "paradas" a media cabellera. Es grave para la estética pero no es pérdida de cabello — y se comunica así, con alivio incluido.',
        'Plan: REP-2 + suspensión total de la causa (calor, química, fricción) + corte sanitario de lo irreversible.',
        'Técnica clave: mostrarle a la clienta la diferencia bulbo/no-bulbo con una de sus propias hebras — entender que "no se le está cayendo" cambia su ansiedad por completo.',
      ],
    },
    notasInternas: 'Entrega 2 · REGLA A-03 (rotura masiva, no caída).',
  },
  {
    clave: 'nota.f2.a04',
    segmento: 'nota',
    prioridad: 253,
    estado: B,
    condiciones: { hecho: 'ext.situacionCaida', op: 'eq', valor: 'posparto_ventana' },
    salida: {
      textos: [
        'Efluvio en resolución (A-04, p. ej. posparto): proceso generalmente autolimitado — el cabello que "se guardó" durante el embarazo se suelta de golpe (suele iniciar 2–4 meses después del parto). La fibra nueva ya viene en camino: los "baby hairs" del marco son señal de recuperación, no un problema.',
        'Plan: paciencia informada + manejo cosmético del volumen mientras se resuelve — corte estratégico que redistribuya, productos voluminizadores, peinados que disimulen densidad. Nada vendido como "freno de la caída": la cosmética no detiene un efluvio y prometerlo erosiona la confianza.',
        'Acordar revisión: si la caída intensa supera los ~6 meses o empeora, derivar (o re-derivar) para nueva evaluación.',
      ],
    },
    notasInternas: 'Entrega 2 · REGLA A-04 (efluvio en resolución con causa identificada por su médico).',
  },
  {
    clave: 'nota.f2.a05',
    segmento: 'nota',
    prioridad: 254,
    estado: B,
    condiciones: { hecho: 'ext.situacionCaida', op: 'eq', valor: 'perdida_estable_camuflaje' },
    salida: {
      textos: [
        'Camuflaje cosmético digno (A-05): verse bien durante el proceso no es vanidad — es salud emocional. El salón puede ofrecer soluciones honestas de apariencia inmediata sin prometer lo que no puede cumplir.',
        'Menú de opciones según el caso: fibras capilares, polvos densificadores del cuero cabelludo, cortes y peinados que redistribuyen volumen, cambio de línea de raya.',
        'Técnica clave: presentarlo como lo que es — apariencia hoy, sin efecto sobre el crecimiento. La honestidad es parte del servicio.',
      ],
    },
    notasInternas:
      'Entrega 2 · REGLA A-05. Pregunta abierta: ¿incorporamos fibras/densificadores al catálogo KEYSHOP?',
  },

  // ═══ NOTAS — Entrega 4: complementos tipos 3–4 (prios 260–279) ════════
  // Complemento y armonización del motor de rizos en producción — NO lo
  // reemplaza. Las reglas marcadas FUSIONAR aportan solo lo nuevo; las
  // frecuencias y técnicas del motor mandan en caso de conflicto.
  {
    clave: 'nota.f2.r301',
    segmento: 'nota',
    prioridad: 260,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'tipoRizoPrincipal', op: 'eq', valor: '3C' },
        { hecho: 'densidad', op: 'eq', valor: 'alta' },
        { hecho: 'grosor', op: 'eq', valor: 'fino' },
      ],
    },
    salida: {
      textos: [
        'La paradoja del 3C fino (R3-01): necesita mucha agua pero poco peso — se apelmaza con cremas pesadas pero se reseca sin ellas. La solución no es más producto sino capas finas y frecuentes: "menos cantidad, más veces". Leave-in acuoso + gel, evitando mantecas en este perfil.',
        'Técnica clave: aplicar por secciones pequeñas sobre cabello empapado, con squish; refrescos de agua + leave-in entre lavados en lugar de re-aplicar crema.',
      ],
    },
    notasInternas:
      'Entrega 4 · REGLA R3-01 · FUSIONAR: se conservan del motor las frecuencias (cronograma de rizos intacto) y de aquí solo el principio de capas ligeras. Validación técnica: "prohibiendo mantecas densas para evitar el colapso del volumen".',
  },
  {
    clave: 'nota.f2.r302',
    segmento: 'nota',
    prioridad: 261,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esRizado', op: 'verdadero' },
        { hecho: 'ext.procesosQuimicos', op: 'incluye', valor: 'decoloracion' },
      ],
    },
    salida: {
      textos: [
        'Rizo 3 decolorado (R3-02): la fibra decolorada pierde memoria — el rizo se abre o se vuelve lacio-paja en las zonas tratadas. Se maneja con balance proteína-hidratación POR ZONAS y expectativa honesta: parte del patrón puede no volver.',
        'Técnica clave: prueba de elasticidad POR ZONAS (no global); finger coiling en mechones decolorados para reeducar la forma mientras la fibra lo permita; styling que unifique texturas.',
        'Cualquier retoque de color pasa por los guardarraíles del módulo de colorimetría (elasticidad como puerta).',
      ],
    },
    notasInternas:
      'Entrega 4 · REGLA R3-02 · NUEVA: el motor nació antes del módulo de color. Es el puente oficial rizos ↔ colorimetría.',
  },
  {
    clave: 'nota.f2.t401',
    segmento: 'nota',
    prioridad: 262,
    estado: B,
    condiciones: { hecho: 'esAfro', op: 'verdadero' },
    salida: {
      textos: [
        'El encogimiento es dato, no defecto (T4-01): el encogimiento natural del tipo 4 puede superar el 75 % — es señal de elasticidad y salud, no de falta de crecimiento. Registrar SIEMPRE dos largos en el historial: natural y estirado suave. El Pasaporte Capilar muestra la curva de crecimiento real.',
        'Técnica clave: medición del largo estirado sobre mechón húmedo, estirando suave sin tensión; siempre el mismo mechón de referencia (nuca o coronilla) para comparabilidad.',
      ],
    },
    notasInternas:
      'Entrega 4 · REGLA T4-01 · NUEVA (el motor no registra encogimiento). Validación técnica: "El software exigirá al estilista registrar dos medidas de longitud en el Pasaporte Capilar... la única vía científica para demostrar la tasa de crecimiento real". Dimensiones: largoNaturalCm / largoEstiradoCm.',
  },
  {
    clave: 'nota.f2.t402',
    segmento: 'nota',
    prioridad: 263,
    estado: B,
    condiciones: { hecho: 'esAfro', op: 'verdadero' },
    salida: {
      textos: [
        'Desenredado seguro — protocolo anti-rotura OBLIGATORIO en todo plan tipo 4 (T4-02): el tipo 4 se rompe por MANIPULACIÓN más que por química — cada curva de la hebra es un punto estructuralmente débil. Nunca en seco; siempre con acondicionador de deslizamiento; por secciones; de puntas a raíz; dedos primero, peine de dientes anchos después. Frecuencia: la mínima necesaria según el estilo.',
        'Si un nudo no cede con los dedos y acondicionador, se corta el nudo — no se arranca la sección. Un nudo perdido cuesta menos que diez hebras rotas.',
      ],
    },
    notasInternas:
      'Entrega 4 · REGLA T4-02 · FUSIONAR: eleva de consejo a PROTOCOLO obligatorio. El detangle del cuidado en casa del motor se conserva; esta nota agrega el protocolo y la regla del nudo.',
  },
  {
    clave: 'nota.f2.t403_porosidad_alta',
    segmento: 'nota',
    prioridad: 264,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esAfro', op: 'verdadero' },
        { hecho: 'porosidad', op: 'eq', valor: 'alta' },
      ],
    },
    salida: {
      textos: [
        'Sellado en capas (T4-03): por geometría, el sebo no logra recorrer la espiral — el tipo 4 es el cabello más seco que existe. El agua que entra debe sellarse en capas o se evapora en horas. Con porosidad ALTA: orden LOC (líquido → aceite → crema) con sellado pesado (mantecas como karité). Aplicar sobre cabello EMPAPADO por secciones — sellar cabello húmedo-casi-seco es sellar la mitad del agua.',
      ],
    },
    notasInternas:
      'Entrega 4 · REGLA T4-03 · FUSIONAR: el motor ya usa vocabulario LOC/LCO (casa.dia_lavado.porosidad_alta) — esta nota aporta la elección del orden según porosidad y la aplicación sobre cabello empapado.',
  },
  {
    clave: 'nota.f2.t403_porosidad_baja',
    segmento: 'nota',
    prioridad: 265,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esAfro', op: 'verdadero' },
        { hecho: 'porosidad', op: 'eq', valor: 'baja' },
      ],
    },
    salida: {
      textos: [
        'Sellado en capas (T4-03): con porosidad BAJA el orden es LCO ligero (líquido → crema → aceite), productos acuosos, y clarificante mensual para evitar acumulación. Aplicar sobre cabello EMPAPADO por secciones.',
      ],
    },
    notasInternas: 'Entrega 4 · REGLA T4-03 (variante porosidad baja).',
  },
  {
    clave: 'nota.f2.t404',
    segmento: 'nota',
    prioridad: 266,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esAfro', op: 'verdadero' },
        { hecho: 'ext.objetivoEstilo', op: 'eq', valor: 'estirado_sin_calor' },
      ],
    },
    salida: {
      textos: [
        'Estiramiento sin calor (T4-04): el calor frecuente en tipo 4 es la vía rápida a la pérdida permanente de patrón. El estiramiento mecánico suave logra el mismo efecto visual sin hipotecar el rizo. Técnicas según el resultado: twist-out y braid-out (definición estirada), banding y threading africano (máximo estiramiento). Siempre sobre cabello con producto y secado COMPLETO antes de soltar.',
        'Técnica clave: soltar solo con el cabello 100 % seco y con las manos apenas aceitadas (el frizz nace de soltar húmedo o con manos secas). Deshacer en la dirección del twist, nunca en contra.',
      ],
    },
    notasInternas:
      'Entrega 4 · REGLA T4-04 · NUEVA: el motor está optimizado para definición; el estiramiento sin calor es la otra mitad del menú tipo 4.',
  },
  {
    clave: 'nota.f2.t405',
    segmento: 'nota',
    prioridad: 267,
    estado: B,
    condiciones: { hecho: 'protectorInstalado', op: 'verdadero' },
    salida: {
      textos: [
        'El peinado protector bien hecho (T4-05): el protector protege SOLO si no tensa — mal instalado es la causa número uno de alopecia por tracción. El dolor durante la instalación no es normal: es la bandera. Instalación sin dolor; bordes y línea frontal SIEMPRE con holgura; peso de extensiones moderado; duración máxima orientativa de 4–8 semanas; descanso de 1–2 semanas entre instalaciones.',
        'La conversación previa es la técnica: acordar con la clienta el tamaño de secciones, la tensión y el calendario de retiro ANTES de trenzar. Agendar el retiro como cita al momento de instalar.',
        'Tras retirar: descanso de 1–2 semanas y día de lavado completo antes de la siguiente instalación.',
      ],
    },
    notasInternas:
      'Entrega 4 · REGLA T4-05 · NUEVA: regla de servicio y educación; su impacto preventivo (tracción, A-02) la hace prioritaria.',
  },
  {
    clave: 'nota.f2.t406',
    segmento: 'nota',
    prioridad: 268,
    estado: B,
    condiciones: { hecho: 'protectorInstalado', op: 'verdadero' },
    salida: {
      textos: [
        'El cuero cabelludo bajo el protector (T4-06): bajo trenzas, el cuero cabelludo sigue vivo — acumula sebo, sudor y producto. La humedad atrapada tras un lavado mal secado produce olor, picor e irritación: el enemigo silencioso de las instalaciones largas. Limpieza del cuero cabelludo cada 1–2 semanas con champú diluido y aplicador, hidratación ligera de raíces, y secado COMPLETO tras cada mojada, sin excepción.',
        'Bandera dentro de la regla: picor intenso, dolor, pústulas o mal olor persistente → retirar la instalación; si la piel está comprometida, protocolo de derivación.',
      ],
    },
    notasInternas: 'Entrega 4 · REGLA T4-06 · NUEVA: pareja inseparable de T4-05.',
  },
  {
    clave: 'nota.f2.t407',
    segmento: 'nota',
    prioridad: 269,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esAfro', op: 'verdadero' },
        { hecho: 'transicion', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        'Transición tipo 4 — la línea que se rompe (T4-07): la unión entre lo natural y lo procesado es el punto más frágil de cualquier transición, y en tipo 4 doblemente — la curva natural más cerrada multiplica el estrés mecánico justo en la línea de demarcación. Manipulación mínima absoluta, protectores de BAJA tensión como aliados, fortalecimiento suave alternado con hidratación, y cortes programados más frecuentes que en una transición tipo 2–3.',
        'Técnica clave: peinados que no carguen peso sobre la línea de demarcación; desenredado extra-paciente en esa franja. Si la rotura se concentra en la línea: bajar manipulación a mínimos, fortalecer la franja y adelantar el corte programado.',
      ],
    },
    notasInternas:
      'Entrega 4 · REGLA T4-07 · FUSIONAR con las reglas de transición del motor (las notas del motor se conservan y esta agrega el énfasis tipo 4). Incluye la bandera de rotura en línea de demarcación (Entrega 4 §8).',
  },
  {
    clave: 'nota.f2.t408_definido',
    segmento: 'nota',
    prioridad: 270,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esAfro', op: 'verdadero' },
        { hecho: 'ext.objetivoEstilo', op: 'eq', valor: 'definido_natural' },
      ],
    },
    salida: {
      textos: [
        'Tipo 4 en clima húmedo — aliada (T4-08): en estilos definidos al natural la humedad ayuda — hidrata el ambiente y el patrón la celebra. Aprovecharla: refrescos de agua + leave-in, sin miedo.',
      ],
    },
    notasInternas:
      'Entrega 4 · REGLA T4-08 (mitad "definido"). VERIFICAR contra reglas de clima del motor; la gestión de expectativas de estilos estirados es la parte probablemente nueva.',
  },
  {
    clave: 'nota.f2.t408_estirado',
    segmento: 'nota',
    prioridad: 271,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esAfro', op: 'verdadero' },
        { hecho: 'ext.objetivoEstilo', op: 'eq', valor: 'estirado_sin_calor' },
      ],
    },
    salida: {
      textos: [
        'Tipo 4 en clima húmedo — enemiga de los estilos estirados (T4-08): la humedad revierte horas de trabajo en una caminata. Sellado antihumectante + expectativa honesta de duración — el sistema lo dice antes de que la clienta lo descubra mojada. La gestión de expectativas ES la técnica: indicar cuánto durará cada estilo en el clima local, para que la clienta elija informada.',
      ],
    },
    notasInternas: 'Entrega 4 · REGLA T4-08 (mitad "estirado" — probablemente NUEVA).',
  },
  {
    clave: 'nota.f2.protector_dolor',
    segmento: 'nota',
    prioridad: 272,
    estado: B,
    condiciones: { hecho: 'ext.senalesProtector', op: 'incluye', valor: 'dolor_tension_bultitos' },
    salida: {
      textos: [
        'BANDERA DE TENSIÓN: dolor, tirantez o "bultitos" durante o después de una instalación = tracción en curso. Detener o aflojar la instalación de inmediato. El dolor nunca es el precio de un peinado. Dolor o tensión en cualquier momento = señal de retiro, no de aguante.',
      ],
    },
    notasInternas:
      'Entrega 4 · banderas específicas de tipos 3–4: acción operativa inmediata (no es derivación médica por sí sola; la derivación aplica si hay piel comprometida).',
  },
  {
    clave: 'nota.f2.protector_picor',
    segmento: 'nota',
    prioridad: 273,
    estado: B,
    condiciones: { hecho: 'ext.senalesProtector', op: 'incluye', valor: 'picor_mal_olor' },
    salida: {
      textos: [
        'BANDERA BAJO EL PROTECTOR: picor intenso o mal olor persistente = cuero cabelludo comprometido por humedad atrapada o higiene insuficiente. Retirar la instalación. Si la piel muestra lesiones o pústulas, aplica el protocolo de derivación.',
      ],
    },
    notasInternas:
      'Entrega 4 · banderas específicas de tipos 3–4 + T4-06. Con pústulas/lesiones marcadas, la derivación médica gana (derivacion.f2.protector_lesiones).',
  },

  // ═══ PRODUCTOS (categorías, no marcas — todas las que matchean) ═══════
  // Los productos se nombran por categoría; el mapeo al catálogo KEYSHOP
  // es parte de la validación técnica (pregunta abierta n.º 1, Entrega 1).
  {
    clave: 'producto.f2.eq1',
    segmento: 'producto_resumen',
    prioridad: 100,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'EQ-1' },
    salida: {
      textos: [
        'Champú equilibrante suave apto para uso frecuente',
        'Acondicionador ligero solo de medios a puntas',
        'Exfoliante capilar suave (1 vez por semana o quincena)',
      ],
    },
    notasInternas: 'Entrega 1 · productos EQ-1 (L-01, L-02, L-07, O-07).',
  },
  {
    clave: 'producto.f2.eq1_sellado_puntas',
    segmento: 'producto_resumen',
    prioridad: 101,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'oleosidadAlta', op: 'verdadero' },
        {
          alguna: [
            { hecho: 'estadoPuntas', op: 'regex', valor: 'abiertas' },
            { hecho: 'porosidad', op: 'eq', valor: 'alta' },
          ],
        },
      ],
    },
    salida: {
      textos: [
        'Sérum de puntas sin enjuague (siliconas solubles o aceites secos ligeros tipo jojoba)',
        'Mascarilla hidratante quincenal aplicada solo de medios a puntas',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA L-02: EQ-1 + sellado de puntas.',
  },
  {
    clave: 'producto.f2.volumen',
    segmento: 'producto_resumen',
    prioridad: 102,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'ext.objetivoPrincipal', op: 'eq', valor: 'volumen' },
      ],
    },
    salida: {
      textos: [
        'Champú de volumen',
        'Acondicionador solo en puntas',
        'Mousse ligera de raíz (aplicar en húmedo, antes del secado)',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA L-07 (busca volumen).',
  },
  {
    clave: 'producto.f2.rep1',
    segmento: 'producto_resumen',
    prioridad: 103,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'REP-1' },
    salida: {
      textos: [
        'Champú sin sulfatos fuertes',
        'Mascarilla hidratante semanal',
        'Reconstructor con proteína hidrolizada quincenal',
        'Protector térmico en cada exposición a calor',
      ],
    },
    notasInternas: 'Entrega 1 · productos REP-1 (L-03, L-09, O-06).',
  },
  {
    clave: 'producto.f2.rep2',
    segmento: 'producto_resumen',
    prioridad: 104,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'REP-2' },
    salida: {
      textos: [
        'Reconstructor proteico (queratina o colágeno hidrolizado)',
        'Mascarilla hidratante para alternar y evitar sobrecarga proteica',
        'Leave-in con ceramidas',
      ],
    },
    notasInternas: 'Entrega 1 · productos REP-2 (L-04, O-04, A-03).',
  },
  {
    clave: 'producto.f2.nut1',
    segmento: 'producto_resumen',
    prioridad: 105,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'NUT-1' },
    salida: {
      textos: [
        'Acondicionador nutritivo',
        'Crema de peinar ligera',
        'Aceite seco para sellar (2–3 gotas de argán o jojoba en medios y puntas)',
        'Spray antifrizz o antihumectante para días críticos',
      ],
    },
    notasInternas: 'Entrega 1 · productos NUT-1 (L-05, O-08).',
  },
  {
    clave: 'producto.f2.def1',
    segmento: 'producto_resumen',
    prioridad: 106,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'DEF-1' },
    salida: {
      textos: [
        'Crema de peinar ligera + gel de fijación ligera-media (técnica crema + gel)',
        'Toalla de microfibra',
      ],
    },
    notasInternas:
      'Entrega 1 · productos DEF-1 (O-01: mousse/espuma en vez de cremas densas; O-02 secuencia completa).',
  },
  {
    clave: 'producto.f2.def2',
    segmento: 'producto_resumen',
    prioridad: 107,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'DEF-2' },
    salida: {
      textos: [
        'Mascarilla de hidratación profunda semanal',
        'Leave-in',
        'Gel de fijación media-alta',
        'Antihumectante reservado para días u ocasiones críticas',
      ],
    },
    notasInternas: 'Entrega 1 · productos DEF-2 (O-03, O-10 con porosidad alta).',
  },
  {
    clave: 'producto.f2.post_alisado',
    segmento: 'producto_resumen',
    prioridad: 108,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        { hecho: 'alisadoVigente', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        'Champú sin sulfatos ni sal',
        'Mascarilla hidratante',
        'Sérum térmico si usa plancha de retoque',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA L-06 (protocolo post-alisado).',
  },
  {
    clave: 'producto.f2.cuero_seco',
    segmento: 'producto_resumen',
    prioridad: 109,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esLiso', op: 'verdadero' },
        {
          alguna: [
            { hecho: 'ext.descamacion', op: 'eq', valor: 'fina_blanca' },
            { hecho: 'ext.tipoCueroCabelludo', op: 'eq', valor: 'seco' },
          ],
        },
      ],
    },
    salida: {
      textos: ['Champú suave hidratante', 'Tónico o sérum de cuero cabelludo con pantenol o aloe'],
    },
    notasInternas: 'Entrega 1 · REGLA L-08 (cuero cabelludo seco).',
  },
  {
    clave: 'producto.f2.detox',
    segmento: 'producto_resumen',
    prioridad: 110,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'esOndulado', op: 'verdadero' },
        { hecho: 'buildUp', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        'Champú clarificante (máximo 1 vez al mes)',
        'Después del detox: línea de definición sin siliconas insolubles',
      ],
    },
    notasInternas: 'Entrega 1 · REGLA O-05 (detox + reinicio).',
  },
  {
    clave: 'producto.f2.can1',
    segmento: 'producto_resumen',
    prioridad: 111,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'canas25Mas', op: 'verdadero' },
        { hecho: 'ext.amarillamientoCanas', op: 'verdadero' },
      ],
    },
    salida: {
      textos: [
        'Champú o mascarilla matizadora violeta (máximo 1 vez por semana, pausas cortas al inicio)',
        'Hidratación intercalada (los matizadores resecan)',
        'Protector térmico y UV',
      ],
    },
    notasInternas: 'Entrega 2 · REGLA C-02 / cronograma CAN-1.',
  },
  {
    clave: 'producto.f2.color_canas',
    segmento: 'producto_resumen',
    prioridad: 112,
    estado: B,
    condiciones: {
      todas: [
        { hecho: 'canas25Mas', op: 'verdadero' },
        { hecho: 'ext.situacionColor', op: 'eq', valor: 'tenida_cobertura' },
      ],
    },
    salida: {
      textos: [
        'Línea de protección de color sin sulfatos',
        'Hidratación semanal + proteína suave según prueba de elasticidad',
      ],
    },
    notasInternas: 'Entrega 2 · REGLA C-06 (cobertura con tinte frecuente).',
  },
  {
    clave: 'producto.f2.prot1',
    segmento: 'producto_resumen',
    prioridad: 113,
    estado: B,
    condiciones: { hecho: 'protectorInstalado', op: 'verdadero' },
    salida: {
      textos: [
        'Champú suave diluible con botella aplicadora',
        'Spray hidratante acuoso',
        'Aceite ligero para raíces',
        'Accesorios de satén para dormir con la instalación',
      ],
    },
    notasInternas: 'Entrega 4 · productos PROT-1 (T4-05, T4-06).',
  },
  {
    clave: 'producto.f2.camuflaje',
    segmento: 'producto_resumen',
    prioridad: 114,
    estado: B,
    condiciones: { hecho: 'ext.situacionCaida', op: 'eq', valor: 'perdida_estable_camuflaje' },
    salida: {
      textos: [
        'Fibras y polvos densificadores (resistentes al roce, se retiran con el lavado)',
        'Spray fijador suave',
      ],
    },
    notasInternas: 'Entrega 2 · REGLA A-05 (camuflaje cosmético digno).',
  },

  // ═══ CUIDADO EN CASA (append por campo) ═══════════════════════════════
  {
    clave: 'casa.f2.lavado_tipo4',
    segmento: 'cuidado_casa',
    prioridad: 100,
    estado: B,
    condiciones: { hecho: 'esAfro', op: 'verdadero' },
    salida: {
      campo: 'diaLavado',
      textos: [
        'PROTOCOLO DÍA DE LAVADO TIPO 4 (2–4 horas): pre-acondicionado (pre-poo) con aceite o acondicionador sobre cabello seco, por secciones, 20–30 minutos',
        'Seccionar en 4–8 partes y MANTENER las secciones durante todo el proceso (pinzas o twists)',
        'Limpieza por secciones, masajeando solo el cuero cabelludo con yemas; la espuma limpia los largos al enjuagar',
        'Acondicionado profundo: mascarilla con 15–30 minutos de pausa; calor suave opcional (gorro térmico)',
        'Desenredado DENTRO del acondicionador: dedos primero, peine de dientes anchos después, de puntas a raíz',
        'Enjuague con agua tibia terminando en fría; sellado en capas sobre cabello empapado según porosidad',
        'Secado completo sin manipular: aire libre o difusor en frío/medio — cabello tipo 4 húmedo y manipulado = rotura',
      ],
    },
    notasInternas:
      'Entrega 4 §4 · protocolo de referencia, validación técnica: "Introducción obligatoria en la app del Protocolo de Día de Lavado Tipo 4". Nota de producto pendiente: duración extendida automática en agenda para servicios tipo 4 (2–4 h).',
  },
  {
    clave: 'casa.f2.eq1_evitar',
    segmento: 'cuidado_casa',
    prioridad: 101,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'EQ-1' },
    salida: {
      campo: 'evitar',
      textos: [
        'Nada cremoso ni oleoso en la raíz, en ninguna sesión',
        'Agua caliente (usar tibia, con enjuague final frío)',
        'Exfoliar el cuero cabelludo más de 1 vez por semana',
      ],
    },
    notasInternas: 'Entrega 1 · reglas del cronograma EQ-1.',
  },
  {
    clave: 'casa.f2.rep2_evitar',
    segmento: 'cuidado_casa',
    prioridad: 102,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'REP-2' },
    salida: {
      campo: 'evitar',
      textos: [
        'Cero calor y cero químicos durante las 4 semanas, sin excepciones',
        'Proteína sin hidratación (siempre alternar: la proteína sin hidratación rigidiza)',
      ],
    },
    notasInternas: 'Entrega 1 · reglas del cronograma REP-2.',
  },
  {
    clave: 'casa.f2.rep1_evitar',
    segmento: 'cuidado_casa',
    prioridad: 103,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'REP-1' },
    salida: {
      campo: 'evitar',
      textos: [
        'Calor sin protector térmico (protector obligatorio si hay calor)',
        'Plancha más de 1 vez por semana durante el mes',
      ],
    },
    notasInternas: 'Entrega 1 · reglas del cronograma REP-1 (base de hidratación con proteína quincenal).',
  },
  {
    clave: 'casa.f2.nut1_evitar',
    segmento: 'cuidado_casa',
    prioridad: 104,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'NUT-1' },
    salida: {
      campo: 'evitar',
      textos: ['Aceites y mantecas en la raíz (solo de medios a puntas)'],
    },
    notasInternas:
      'Entrega 1 · reglas del cronograma NUT-1. En días de humedad extrema: antihumectante como capa final.',
  },
  {
    clave: 'casa.f2.def_dia_lavado',
    segmento: 'cuidado_casa',
    prioridad: 105,
    estado: B,
    condiciones: { hecho: 'tratamientoPrincipal', op: 'regex', valor: 'DEF-1|DEF-2' },
    salida: {
      campo: 'diaLavado',
      textos: [
        'El styling se aplica siempre sobre cabello muy húmedo',
        'No tocar mientras seca; romper el cast solo cuando esté 100 % seco',
      ],
    },
    notasInternas: 'Entrega 1 · reglas de los cronogramas DEF-1 y DEF-2.',
  },
  {
    clave: 'casa.f2.prot1_dia_lavado',
    segmento: 'cuidado_casa',
    prioridad: 106,
    estado: B,
    condiciones: { hecho: 'protectorInstalado', op: 'verdadero' },
    salida: {
      campo: 'diaLavado',
      textos: [
        'Limpieza del cuero cabelludo con champú diluido y botella aplicadora',
        'Secado COMPLETO tras cada mojada, sin excepción (humedad atrapada = olor, picor e irritación)',
      ],
    },
    notasInternas: 'Entrega 4 · PROT-1 / T4-06.',
  },
  {
    clave: 'casa.f2.prot1_nocturno',
    segmento: 'cuidado_casa',
    prioridad: 107,
    estado: B,
    condiciones: { hecho: 'protectorInstalado', op: 'verdadero' },
    salida: {
      campo: 'nocturno',
      textos: ['Dormir con accesorios de satén mientras dure la instalación'],
    },
    notasInternas: 'Entrega 4 · T4-05.',
  },
  {
    clave: 'casa.f2.prot1_evitar',
    segmento: 'cuidado_casa',
    prioridad: 108,
    estado: B,
    condiciones: { hecho: 'protectorInstalado', op: 'verdadero' },
    salida: {
      campo: 'evitar',
      textos: [
        'Aguantar dolor o tensión: es señal de retiro, no de aguante',
        'Dejar la instalación más de 4–8 semanas sin evaluación',
      ],
    },
    notasInternas: 'Entrega 4 · PROT-1 / T4-05.',
  },
];
