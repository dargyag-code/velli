'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import ProgressBar from '@/components/layout/ProgressBar';
import StepClienta from '@/components/wizard/StepClienta';
import StepHistorial from '@/components/wizard/StepHistorial';
import StepTipoRizo from '@/components/wizard/StepTipoRizo';
import StepDiagnostico from '@/components/wizard/StepDiagnostico';
import StepCueroCabelludo from '@/components/wizard/StepCueroCabelludo';
import StepSalud from '@/components/wizard/StepSalud';
import ResultadoDiagnostico from '@/components/resultado/ResultadoDiagnostico';
import Button from '@/components/ui/Button';
import { WizardData, WIZARD_INITIAL_DATA, Consulta, Clienta } from '@/lib/types';
import { generateDiagnosis } from '@/lib/diagnosticEngine';
import { createConsulta, createClienta, getClientaById, getConsultasByClienta } from '@/lib/db';
import { generateId, todayISO } from '@/lib/utils';
import { generateConsultaPDF } from '@/lib/pdfGenerator';

const TOTAL_STEPS = 6; // 0..5 are form steps, 6 is result
const STORAGE_KEY = 'keyshop_wizard_draft';

function WizardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientaIdParam = searchParams.get('clientaId');

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { ...WIZARD_INITIAL_DATA };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [clienta, setClienta] = useState<Clienta | null>(null);
  const [result, setResult] = useState<ReturnType<typeof generateDiagnosis> | null>(null);

  // Pre-load clienta if param given
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
            alergias: c.alergias || '',
            condicionesMedicas: c.condicionesMedicas || '',
            medicamentos: c.medicamentos || '',
            embarazo: c.embarazo,
            nivelEstres: c.nivelEstres || '',
          }));
          setClienta(c);
        }
      });
    }
  }, [clientaIdParam]);

  // Auto-save draft
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

    if (step === 0) {
      if (!data.nombre.trim()) errs.nombre = 'El nombre es requerido';
    }
    if (step === 1) {
      if (data.problemas.length === 0 && !data.otroProblema)
        errs.problemas = 'Selecciona al menos un problema';
    }
    if (step === 2) {
      if (!data.tipoRizoPrincipal) errs.tipoRizoPrincipal = 'Selecciona el tipo de rizo';
    }
    if (step === 3) {
      if (!data.porosidad) errs.porosidad = 'Requerido';
      if (!data.densidad) errs.densidad = 'Requerido';
      if (!data.grosor) errs.grosor = 'Requerido';
      if (!data.elasticidad) errs.elasticidad = 'Requerido';
      if (!data.balanceHP) errs.balanceHP = 'Requerido';
    }
    if (step === 4) {
      if (data.estadoCueroCabelludo.length === 0) errs.estadoCueroCabelludo = 'Selecciona al menos una opción';
      if (!data.estadoPuntas) errs.estadoPuntas = 'Selecciona el estado de las puntas';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validate()) return;

    if (step === TOTAL_STEPS - 1) {
      // Generate result
      const res = generateDiagnosis(data);
      setResult(res);

      // Build consulta object (not saved yet)
      const c: Consulta = {
        id: generateId(),
        clientaId: data.clientaId || '',
        fecha: todayISO(),
        numeroConsulta: 1,
        quimicos: data.quimicos,
        ultimoQuimico: data.ultimoQuimico,
        usoCalor: data.usoCalor,
        frecuenciaCalor: data.frecuenciaCalor,
        usaProtectorTermico: data.usaProtectorTermico,
        frecuenciaLavado: data.frecuenciaLavado,
        metodoLavado: data.metodoLavado,
        productosActuales: data.productosActuales,
        problemas: [...data.problemas, ...(data.otroProblema ? [data.otroProblema] : [])],
        otroProblema: data.otroProblema,
        tipoRizoPrincipal: data.tipoRizoPrincipal,
        tiposSecundarios: data.tiposSecundarios,
        zonasCambio: data.zonasCambio,
        porosidad: data.porosidad as 'baja' | 'media' | 'alta',
        porosidadObs: data.porosidadObs,
        densidad: data.densidad as 'baja' | 'media' | 'alta',
        grosor: data.grosor as 'fino' | 'medio' | 'grueso',
        elasticidad: data.elasticidad as 'baja' | 'media' | 'alta',
        balanceHP: data.balanceHP as 'hidratacion' | 'nutricion' | 'proteina' | 'equilibrado',
        estadoCueroCabelludo: data.estadoCueroCabelludo,
        obsCueroCabelludo: data.obsCueroCabelludo,
        estadoPuntas: data.estadoPuntas,
        tipoDano: data.tipoDano,
        lineaDemarcacion: data.lineaDemarcacion,
        alergias: data.alergias,
        condicionesMedicas: data.condicionesMedicas,
        medicamentos: data.medicamentos,
        embarazo: data.embarazo,
        nivelEstres: data.nivelEstres,
        resultado: res,
      };
      setConsulta(c);
    }

    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prev = () => {
    setStep((s) => Math.max(0, s - 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (proximaCita?: string, notas?: string) => {
    if (!consulta) return;
    setSaving(true);
    try {
      let clientaObj = clienta;

      // Create or get clienta
      if (!data.clientaId) {
        const newClienta: Clienta = {
          id: generateId(),
          nombre: data.nombre.trim(),
          edad: parseInt(data.edad) || 0,
          telefono: data.telefono,
          email: data.email || undefined,
          fechaRegistro: todayISO(),
          alergias: data.alergias || undefined,
          condicionesMedicas: data.condicionesMedicas || undefined,
          medicamentos: data.medicamentos || undefined,
          embarazo: data.embarazo,
          nivelEstres: (data.nivelEstres || 'bajo') as 'bajo' | 'medio' | 'alto',
          tipoRizoPrincipal: data.tipoRizoPrincipal,
          totalVisitas: 0,
        };
        await createClienta(newClienta);
        clientaObj = newClienta;
        setClienta(newClienta);
      } else {
        clientaObj = await getClientaById(data.clientaId) || null;
      }

      // Count existing consultas for this clienta
      const existingConsultas = await getConsultasByClienta(clientaObj?.id || data.clientaId || '');
      const numeroConsulta = existingConsultas.length + 1;

      const finalConsulta: Consulta = {
        ...consulta,
        clientaId: clientaObj?.id || data.clientaId || '',
        numeroConsulta,
        proximaCita,
        notasEstilista: notas,
      };

      await createConsulta(finalConsulta);
      setConsulta(finalConsulta);

      // Clear draft
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!consulta) return;
    const c = clienta || {
      id: '',
      nombre: data.nombre,
      edad: parseInt(data.edad) || 0,
      telefono: data.telefono,
      fechaRegistro: todayISO(),
      embarazo: data.embarazo,
      nivelEstres: 'bajo' as const,
      totalVisitas: 0,
    };
    await generateConsultaPDF(c, consulta);
  };

  const isResultStep = step === TOTAL_STEPS;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      {/* Progress */}
      <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5">
        {step === 0 && <StepClienta data={data} onChange={update} errors={errors} />}
        {step === 1 && <StepHistorial data={data} onChange={update} errors={errors} />}
        {step === 2 && <StepTipoRizo data={data} onChange={update} errors={errors} />}
        {step === 3 && <StepDiagnostico data={data} onChange={update} errors={errors} />}
        {step === 4 && <StepCueroCabelludo data={data} onChange={update} errors={errors} />}
        {step === 5 && <StepSalud data={data} onChange={update} errors={errors} />}
        {isResultStep && consulta && result && (
          <ResultadoDiagnostico
            consulta={consulta}
            clienta={clienta}
            wizardData={data}
            onSave={handleSave}
            onExportPDF={handleExportPDF}
            saving={saving}
          />
        )}
      </main>

      {/* Navigation */}
      {!isResultStep && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-[#E5E5E5] px-4 py-3 pb-safe">
          <div className="max-w-2xl mx-auto flex gap-3">
            {step > 0 ? (
              <Button
                variant="ghost"
                size="lg"
                onClick={prev}
                icon={<ArrowLeft size={18} />}
                className="flex-shrink-0"
              >
                Anterior
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
              {step === TOTAL_STEPS - 1 ? 'Ver diagnóstico' : 'Siguiente'}
            </Button>
          </div>
        </div>
      )}

      {isResultStep && (
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
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#5B2D8E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#666666]">Cargando diagnóstico...</p>
        </div>
      </div>
    }>
      <WizardContent />
    </Suspense>
  );
}
