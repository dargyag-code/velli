'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import ProgressBar from '@/components/layout/ProgressBar';
import PasoClienta from '@/components/wizard/PasoClienta';
import PasoCabello from '@/components/wizard/PasoCabello';
import PasoPlan from '@/components/wizard/PasoPlan';
import Button from '@/components/ui/Button';
import { WizardData, WIZARD_INITIAL_DATA, Consulta, Clienta } from '@/lib/types';
import { generateDiagnosis, SaludClienta } from '@/lib/diagnosticEngine';
import { createConsulta, createClienta, getClientaById, getConsultasByClienta, getConsultaById } from '@/lib/db';
import { generateId, todayISO } from '@/lib/utils';
import { generateConsultaPDF } from '@/lib/pdfGenerator';
import { uploadFoto, uploadFotos } from '@/lib/storage';
import { showToast } from '@/lib/toast';

const TOTAL_PASOS = 3;
const STORAGE_KEY = 'velli_wizard_v2_draft';

const STEP_LABELS = ['La clienta', 'El cabello', 'El plan'];

function WizardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientaIdParam = searchParams.get('clientaId');
  const repeatFromParam = searchParams.get('repeatFrom');
  const modeParam = searchParams.get('mode');

  const [paso, setPaso] = useState(0);
  // Iniciar siempre con WIZARD_INITIAL_DATA (igual en server y client).
  // El borrador de localStorage se carga en useEffect para evitar hydration mismatch.
  const [data, setData] = useState<WizardData>({ ...WIZARD_INITIAL_DATA });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [clienta, setClienta] = useState<Clienta | null>(null);

  // Cargar borrador guardado (solo si no hay repeatFrom)
  useEffect(() => {
    if (repeatFromParam) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setData(JSON.parse(saved));
    } catch {}
  }, [repeatFromParam]);

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

  // Autoguardado del borrador
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {}
    }
  }, [data]);

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

      if (!data.clientaId) {
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
        clientaObj = (await getClientaById(data.clientaId)) || null;
      }

      const existingConsultas = await getConsultasByClienta(clientaObj?.id || data.clientaId || '');
      const numeroConsulta = existingConsultas.length + 1;

      // Subir fotos a Supabase Storage: base64 → URL pública
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
        clientaId: clientaObj?.id || data.clientaId || '',
        numeroConsulta,
        proximaCita,
        notasEstilista: notas,
        esBorrador,
        fotoAnalisis: uploadedAnalisis,
        fotoAntes: uploadedAntes,
        fotoDespues: uploadedDespues,
        satisfaccionEstrellas: estrellas as (1|2|3|4|5) | undefined,
      };

      await createConsulta(finalConsulta);
      setConsulta(finalConsulta);

      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      showToast(esBorrador ? 'Borrador guardado' : 'Diagnóstico guardado', 'success');
      return clientaObj?.id || data.clientaId || '';
    } catch (e) {
      // TEMP DEBUG — mostrar código+mensaje real de Supabase en el toast.
      // Revertir a 'No se pudo guardar el diagnóstico' cuando no haya más mismatches.
      const err = e as { code?: string; message?: string; details?: string; hint?: string };
      console.error('[diagnostico.save] full error', {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        raw: e,
      });
      const rawMsg = err?.message || (typeof e === 'string' ? e : JSON.stringify(e));
      const debugMsg = err?.code
        ? `[${err.code}] ${rawMsg}${err?.details ? ` — ${err.details}` : ''}`
        : rawMsg;
      showToast(debugMsg, 'error');
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
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col">
      {/* Progress */}
      <ProgressBar
        currentStep={paso}
        totalSteps={TOTAL_PASOS - 1}
        stepLabels={STEP_LABELS}
      />

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5">
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
          />
        )}
      </main>

      {/* Navegación — solo pasos 0 y 1 */}
      {paso < 2 && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-[#E5E5E5] px-4 py-3 pb-safe">
          <div className="max-w-2xl mx-auto flex gap-3">
            {paso > 0 ? (
              <Button
                variant="ghost"
                size="lg"
                onClick={prev}
                icon={<ArrowLeft size={18} />}
                className="flex-shrink-0"
              >
                Atrás
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="lg"
                onClick={() => router.back()}
                icon={<ArrowLeft size={18} />}
                className="flex-shrink-0"
              >
                Cancelar
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={next}
              icon={<ArrowRight size={18} />}
            >
              {paso === 1 ? 'Generar plan' : 'Siguiente'}
            </Button>
          </div>
        </div>
      )}

      {/* Después de guardar — volver al inicio */}
      {paso === 2 && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-[#E5E5E5] px-4 py-3 pb-safe">
          <div className="max-w-2xl mx-auto">
            <Button
              variant="ghost"
              size="md"
              fullWidth
              onClick={() => router.push('/')}
            >
              Volver al inicio
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DiagnosticoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2D5A27] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#666666]">Cargando...</p>
        </div>
      </div>
    }>
      <WizardContent />
    </Suspense>
  );
}
