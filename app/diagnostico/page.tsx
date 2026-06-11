'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { StepBarV2, Btn } from '@/components/v2';
import PasoClienta from '@/components/wizard/PasoClienta';
import PasoCabello from '@/components/wizard/PasoCabello';
import PasoPlan from '@/components/wizard/PasoPlan';
import { WizardData, WIZARD_INITIAL_DATA, Consulta, Clienta } from '@/lib/types';
import { generateDiagnosis, SaludClienta } from '@/lib/diagnosticEngine';
import { createConsulta, createClienta, getClientaById, getConsultasByClienta, getConsultaById, updateConsulta } from '@/lib/db';
import { generateId, todayISO } from '@/lib/utils';
import { generateConsultaPDF } from '@/lib/pdfGenerator';
import { uploadFoto, uploadFotos, resolveFotoUrl, resolveFotoUrls } from '@/lib/storage';
import { showToast } from '@/lib/toast';

const TOTAL_PASOS = 3;
const STORAGE_KEY = 'velli_wizard_v2_draft';

const STEP_LABELS = ['La clienta', 'El cabello', 'El plan'];

function WizardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientaIdParam = searchParams.get('clientaId');
  const repeatFromParam = searchParams.get('repeatFrom');
  const editParam = searchParams.get('edit');
  const modeParam = searchParams.get('mode');

  const [paso, setPaso] = useState(0);
  // Iniciar siempre con WIZARD_INITIAL_DATA (igual en server y client).
  // El borrador de localStorage se carga en useEffect para evitar hydration mismatch.
  const [data, setData] = useState<WizardData>({ ...WIZARD_INITIAL_DATA });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [clienta, setClienta] = useState<Clienta | null>(null);

  // Cargar borrador guardado (solo si no hay repeatFrom ni edit)
  useEffect(() => {
    if (repeatFromParam || editParam) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setData(JSON.parse(saved));
    } catch {}
  }, [repeatFromParam, editParam]);

  // Modo edición: precargar TODOS los datos de la consulta existente
  // (incluido fotos, notas, satisfacción, próxima cita) y saltar al paso del plan.
  useEffect(() => {
    if (!editParam) return;
    (async () => {
      const existing = await getConsultaById(editParam);
      if (!existing) return;

      const cl = existing.clientaId
        ? await getClientaById(existing.clientaId)
        : null;
      if (cl) setClienta(cl);

      // Resolver paths/URLs antiguas a signed URLs para que las imágenes se
      // vean en el wizard. uploadFoto luego las pasa tal cual si siguen
      // siendo http(s) — sólo re-sube si la estilista las reemplaza.
      const [fotoAntesUrl, fotoDespuesUrl, fotoAnalisisUrls] = await Promise.all([
        resolveFotoUrl(existing.fotoAntes),
        resolveFotoUrl(existing.fotoDespues),
        resolveFotoUrls(existing.fotoAnalisis),
      ]);

      setData((prev) => ({
        ...prev,
        clientaId: existing.clientaId,
        nombre: cl?.nombre || '',
        edad: String(cl?.edad ?? ''),
        telefono: cl?.telefono || '',
        email: cl?.email || '',
        quimicos: existing.quimicos,
        ultimoQuimico: existing.ultimoQuimico || '',
        usoCalor: existing.usoCalor,
        frecuenciaCalor: existing.frecuenciaCalor,
        usaProtectorTermico: existing.usaProtectorTermico,
        frecuenciaLavado: existing.frecuenciaLavado,
        metodoLavado: existing.metodoLavado,
        productosActuales: existing.productosActuales,
        problemas: existing.problemas,
        otroProblema: existing.otroProblema || '',
        tipoRizoPrincipal: existing.tipoRizoPrincipal,
        tiposSecundarios: existing.tiposSecundarios || [],
        zonasCambio: existing.zonasCambio || '',
        iaTipoSugerido: existing.iaTipoSugerido,
        iaCorreccion: existing.iaCorreccion,
        porosidad: existing.porosidad || '',
        densidad: existing.densidad || '',
        grosor: existing.grosor || '',
        elasticidad: existing.elasticidad || '',
        balanceHP: existing.balanceHP || '',
        estadoCueroCabelludo: existing.estadoCueroCabelludo,
        estadoPuntas: existing.estadoPuntas || '',
        tipoDano: existing.tipoDano,
        lineaDemarcacion: existing.lineaDemarcacion || '',
        captureMetadata: existing.captureMetadata,
        fotoAnalisis: fotoAnalisisUrls.length ? fotoAnalisisUrls : undefined,
        fotoAntes: fotoAntesUrl,
        fotoDespues: fotoDespuesUrl,
      }));

      // El estado de consulta arranca con el resultado existente para que
      // PasoPlan lo muestre sin re-generar. Si la estilista vuelve al paso 1
      // y avanza, buildConsulta regenera el resultado con los datos editados.
      setConsulta({
        ...existing,
        fotoAntes: fotoAntesUrl,
        fotoDespues: fotoDespuesUrl,
        fotoAnalisis: fotoAnalisisUrls.length ? fotoAnalisisUrls : undefined,
      });

      setPaso(2);
      window.scrollTo({ top: 0 });
    })();
  }, [editParam]);

  // Repetir último diagnóstico: pre-llenar con datos de consulta anterior
  useEffect(() => {
    if (!repeatFromParam) return;
    getConsultaById(repeatFromParam).then((consulta) => {
      if (!consulta) return;
      setData((prev) => ({
        ...prev,
        quimicos: consulta.quimicos,
        ultimoQuimico: consulta.ultimoQuimico || '',
        usoCalor: consulta.usoCalor,
        frecuenciaCalor: consulta.frecuenciaCalor,
        usaProtectorTermico: consulta.usaProtectorTermico,
        frecuenciaLavado: consulta.frecuenciaLavado,
        metodoLavado: consulta.metodoLavado,
        productosActuales: consulta.productosActuales,
        problemas: consulta.problemas,
        otroProblema: consulta.otroProblema || '',
        tipoRizoPrincipal: consulta.tipoRizoPrincipal,
        tiposSecundarios: consulta.tiposSecundarios || [],
        zonasCambio: consulta.zonasCambio || '',
        porosidad: consulta.porosidad || '',
        densidad: consulta.densidad || '',
        grosor: consulta.grosor || '',
        elasticidad: consulta.elasticidad || '',
        balanceHP: consulta.balanceHP || '',
        estadoCueroCabelludo: consulta.estadoCueroCabelludo,
        estadoPuntas: consulta.estadoPuntas || '',
        tipoDano: consulta.tipoDano,
        lineaDemarcacion: consulta.lineaDemarcacion || '',
      }));
      setPaso(1);
    });
  }, [repeatFromParam]);

  // Pre-cargar clienta si viene por param
  useEffect(() => {
    if (clientaIdParam) {
      getClientaById(clientaIdParam).then((c) => {
        if (c) {
          setData((prev) => ({
            ...prev,
            clientaId: c.id,
            nombre: c.nombre,
            edad: String(c.edad || ''),
            telefono: c.telefono || '',
            email: c.email || '',
          }));
          setClienta(c);
        }
      });
    }
  }, [clientaIdParam]);

  // Autoguardado del borrador (no aplica en modo edición — no debe
  // contaminar el borrador del próximo diagnóstico nuevo).
  useEffect(() => {
    if (editParam) return;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {}
    }
  }, [data, editParam]);

  const update = useCallback((patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setErrors({});
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (paso === 0) {
      if (!data.nombre.trim()) errs.nombre = 'El nombre es requerido';
    }
    if (paso === 1) {
      if (!data.tipoRizoPrincipal) errs.tipoRizoPrincipal = 'Selecciona el tipo de cabello';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Construye y almacena la consulta pre-guardado
  const buildConsulta = useCallback(
    async (wizardData: WizardData): Promise<Consulta> => {
      // Leer datos de salud desde el perfil de la clienta (no del wizard)
      const saludClienta: SaludClienta | undefined = clienta ? {
        embarazo: clienta.embarazo,
        nivelEstres: clienta.nivelEstres,
        alergias: clienta.alergias,
        condicionesMedicas: clienta.condicionesMedicas,
        medicamentos: clienta.medicamentos,
      } : undefined;
      const res = generateDiagnosis(wizardData, saludClienta);

      let clientaObj = clienta;
      if (!wizardData.clientaId && !clienta) {
        // La clienta se crea definitivamente al guardar; aquí solo construimos el objeto
      } else if (wizardData.clientaId && !clienta) {
        clientaObj = (await getClientaById(wizardData.clientaId)) || null;
        setClienta(clientaObj);
      }

      const c: Consulta = {
        id: generateId(),
        clientaId: wizardData.clientaId || '',
        fecha: todayISO(),
        numeroConsulta: 1,
        quimicos: wizardData.quimicos,
        ultimoQuimico: wizardData.ultimoQuimico,
        usoCalor: wizardData.usoCalor,
        frecuenciaCalor: wizardData.frecuenciaCalor,
        usaProtectorTermico: wizardData.usaProtectorTermico,
        frecuenciaLavado: wizardData.frecuenciaLavado,
        metodoLavado: wizardData.metodoLavado,
        productosActuales: wizardData.productosActuales,
        problemas: [...wizardData.problemas, ...(wizardData.otroProblema ? [wizardData.otroProblema] : [])],
        otroProblema: wizardData.otroProblema,
        tipoRizoPrincipal: wizardData.tipoRizoPrincipal,
        tiposSecundarios: wizardData.tiposSecundarios,
        zonasCambio: wizardData.zonasCambio,
        iaTipoSugerido: wizardData.iaTipoSugerido,
        iaCorreccion: wizardData.iaCorreccion,
        porosidad: wizardData.porosidad as 'baja' | 'media' | 'alta' | undefined,
        densidad: wizardData.densidad as 'baja' | 'media' | 'alta' | undefined,
        grosor: wizardData.grosor as 'fino' | 'medio' | 'grueso' | undefined,
        elasticidad: wizardData.elasticidad as 'baja' | 'media' | 'alta' | undefined,
        balanceHP: wizardData.balanceHP as 'hidratacion' | 'nutricion' | 'proteina' | 'equilibrado' | undefined,
        estadoCueroCabelludo: wizardData.estadoCueroCabelludo,
        estadoPuntas: wizardData.estadoPuntas,
        tipoDano: wizardData.tipoDano,
        lineaDemarcacion: wizardData.lineaDemarcacion,
        // Salud: snapshot desde el perfil de la clienta al momento del diagnóstico
        alergias: clienta?.alergias,
        condicionesMedicas: clienta?.condicionesMedicas,
        medicamentos: clienta?.medicamentos,
        embarazo: clienta?.embarazo ?? false,
        nivelEstres: clienta?.nivelEstres ?? '',
        resultado: res,
        captureMetadata: wizardData.captureMetadata,
        fotoAnalisis: wizardData.fotoAnalisis,
      };

      setConsulta(c);
      return c;
    },
    [clienta]
  );

  const next = async () => {
    if (!validate()) return;

    if (paso === 1) {
      // Generar diagnóstico antes de mostrar el plan
      await buildConsulta(data);
    }

    setPaso((p) => p + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prev = () => {
    setPaso((p) => Math.max(0, p - 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Modo express: salta directo al paso 2 (plan)
  const handleExpressReady = async () => {
    if (!validate()) return;
    await buildConsulta(data);
    setPaso(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (proximaCita: string, notas: string, esBorrador: boolean, fotoAntes?: string, fotoDespues?: string, estrellas?: number): Promise<string> => {
    if (!consulta) return '';
    setSaving(true);
    try {
      let clientaObj = clienta;

      if (!editParam && !data.clientaId) {
        const newClienta: Clienta = {
          id: generateId(),
          nombre: data.nombre.trim(),
          edad: parseInt(data.edad) || 0,
          telefono: data.telefono,
          email: data.email || undefined,
          fechaRegistro: todayISO(),
          tipoRizoPrincipal: data.tipoRizoPrincipal,
          totalVisitas: 0,
        };
        await createClienta(newClienta);
        clientaObj = newClienta;
        setClienta(newClienta);
      } else if (!clienta) {
        clientaObj = (await getClientaById(data.clientaId || consulta.clientaId)) || null;
      }

      // En edición: conserva el numeroConsulta original (no se incrementa).
      const numeroConsulta = editParam
        ? consulta.numeroConsulta
        : (await getConsultasByClienta(clientaObj?.id || data.clientaId || '')).length + 1;

      // Subir fotos a Supabase Storage. uploadFoto pasa http(s) tal cual,
      // así que las fotos preexistentes (cargadas como signed URLs en el
      // useEffect de edit) NO se vuelven a subir; sólo las nuevas en data URL.
      const basePath = `diagnosticos/${consulta.id}`;
      const [uploadedAnalisis, uploadedAntes, uploadedDespues] = await Promise.all([
        consulta.fotoAnalisis && consulta.fotoAnalisis.length > 0
          ? uploadFotos(consulta.fotoAnalisis, `${basePath}/analisis`)
          : Promise.resolve(undefined),
        fotoAntes ? uploadFoto(fotoAntes, `${basePath}/antes`).catch(() => undefined) : Promise.resolve(undefined),
        fotoDespues ? uploadFoto(fotoDespues, `${basePath}/despues`).catch(() => undefined) : Promise.resolve(undefined),
      ]);

      const finalConsulta: Consulta = {
        ...consulta,
        clientaId: clientaObj?.id || data.clientaId || consulta.clientaId,
        numeroConsulta,
        proximaCita,
        notasEstilista: notas,
        esBorrador,
        fotoAnalisis: uploadedAnalisis,
        fotoAntes: uploadedAntes,
        fotoDespues: uploadedDespues,
        // Escala única 1–5; conserva la calificación previa al editar si no
        // se tocó en esta pasada.
        satisfaccion: (estrellas as (1 | 2 | 3 | 4 | 5) | undefined) ?? consulta.satisfaccion,
      };

      if (editParam) {
        await updateConsulta(finalConsulta);
      } else {
        await createConsulta(finalConsulta);
      }
      setConsulta(finalConsulta);

      if (typeof window !== 'undefined' && !editParam) {
        localStorage.removeItem(STORAGE_KEY);
      }
      showToast(
        editParam
          ? 'Consulta actualizada'
          : esBorrador
            ? 'Borrador guardado'
            : 'Diagnóstico guardado',
        'success'
      );
      return clientaObj?.id || data.clientaId || consulta.clientaId || '';
    } catch (e) {
      showToast(
        editParam
          ? 'No se pudo actualizar la consulta. Intenta de nuevo.'
          : 'No se pudo guardar el diagnóstico. Intenta de nuevo.',
        'error'
      );
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!consulta || consulta.esBorrador) return;
    const c = clienta || {
      id: '',
      nombre: data.nombre,
      edad: parseInt(data.edad) || 0,
      telefono: data.telefono,
      fechaRegistro: todayISO(),
      totalVisitas: 0,
    };
    await generateConsultaPDF(c, consulta);
  };

  const esPasoResultado = paso === 2;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Progress */}
      <StepBarV2
        currentStep={paso}
        totalSteps={TOTAL_PASOS - 1}
        stepLabels={STEP_LABELS}
      />

      {/* Content */}
      <main style={{ flex: 1, width: '100%', maxWidth: 768, margin: '0 auto', padding: '20px 16px' }}>
        {paso === 0 && (
          <PasoClienta data={data} onChange={update} errors={errors} />
        )}
        {paso === 1 && (
          <PasoCabello
            data={data}
            onChange={update}
            errors={errors}
            onExpressReady={handleExpressReady}
            autoCamera={modeParam === 'camera'}
          />
        )}
        {paso === 2 && consulta && (
          <PasoPlan
            consulta={consulta}
            clienta={clienta}
            wizardData={data}
            onSave={handleSave}
            saving={saving}
            editMode={!!editParam}
          />
        )}
      </main>

      {/* Navegación — solo pasos 0 y 1 */}
      {paso < 2 && (
        <div
          className="pb-safe"
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'rgba(255, 254, 251, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border-soft)',
            padding: '12px 16px',
          }}
        >
          <div style={{ maxWidth: 768, margin: '0 auto', display: 'flex', gap: 8 }}>
            {paso > 0 ? (
              <Btn
                variant="ghost"
                size="lg"
                onClick={prev}
                icon={<ArrowLeft size={14} />}
                style={{ flex: 0.4 }}
              >
                Atrás
              </Btn>
            ) : (
              <Btn
                variant="ghost"
                size="lg"
                onClick={() => router.back()}
                icon={<ArrowLeft size={14} />}
                style={{ flex: 0.4 }}
              >
                Cancelar
              </Btn>
            )}
            <Btn
              variant="primary"
              size="lg"
              fullWidth
              onClick={next}
              iconRight={<ArrowRight size={14} />}
              style={{ flex: 1 }}
            >
              {paso === 1 ? 'Generar plan' : 'Continuar'}
            </Btn>
          </div>
        </div>
      )}

      {/* Después de guardar — volver al inicio */}
      {paso === 2 && (
        <div
          className="pb-safe"
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'rgba(255, 254, 251, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border-soft)',
            padding: '12px 16px',
          }}
        >
          <div style={{ maxWidth: 768, margin: '0 auto' }}>
            <Btn variant="ghost" size="md" fullWidth onClick={() => router.push('/')}>
              Volver al inicio
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DiagnosticoPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              border: '3px solid var(--primary)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              margin: '0 auto 12px',
              animation: 'pulse-soft 1.4s linear infinite',
            }}
            className="loading-pulse"
          />
          <p className="v-caps">Cargando…</p>
        </div>
      </div>
    }>
      <WizardContent />
    </Suspense>
  );
}
