import { createClient } from '@/lib/supabase/client';
import { sanitizarFlagsSalon, type OverridesFlags } from '@/lib/flags/evaluar';

// Horario base de atención del salón (paso 3 del onboarding). Alimenta la
// vista de agenda (días laborables en la franja semanal). 0=domingo…6=sábado.
export interface HorarioAtencion {
  dias: number[];
  desde: string; // "09:00"
  hasta: string; // "18:00"
}

export const COLOR_VELLI = '#2D5A27';

export interface Profile {
  id: string;
  nombre: string;
  nombreSalon?: string;
  telefono?: string;
  ciudad?: string;
  // Opt-in para registrar lat/lon aproximada al tomar fotos del wizard.
  // Default false — la columna en DB tiene NOT NULL DEFAULT false.
  permiteUbicacion?: boolean;
  // ── Onboarding ──
  // false solo para registros nuevos (la migración backfillea true a las
  // cuentas existentes). Gatea el wizard /onboarding y la checklist.
  onboardingCompleted: boolean;
  checklistDescartada: boolean;
  primerPdfDescargado: boolean;
  // ── Marca (paso 2) — alimenta los PDF de diagnóstico ──
  logoUrl?: string;
  colorPrimario?: string;
  // ── Operación (paso 3) ──
  servicios?: string[];
  horarioAtencion?: HorarioAtencion;
  // Cuenta fundadora (legado): acceso al funnel agregado. Desde la capa de
  // gobernanza el gating real es `rol` — es_fundadora queda como flag
  // histórico mapeado a rol corporativo por la migración legal-gobernanza.
  esFundadora: boolean;
  // ── Gobernanza (validación Keila 6.P2) ──
  // 'corporativo': administra la librería global (reglas base, cartas de
  // marca, fichas de corte). 'salon' (default): NO edita la librería; solo
  // selecciona qué marcas publicadas están activas en su inventario.
  // La RLS es la barrera real — esto solo gatea la UI.
  rol: 'corporativo' | 'salon';
  // Bloque de agenda para "día de lavado tipo 4" / "instalación de peinado
  // protector", en minutos (120–240, default 180). Configurable por salón.
  bloqueoTipo4Minutos: number;
  // Overrides de feature flags de este salón (profiles.feature_flags). Los
  // asigna el equipo por SQL; un trigger impide que la cuenta los cambie.
  featureFlags: OverridesFlags;
}

type ProfileRow = {
  id: string;
  nombre: string;
  nombre_salon: string | null;
  telefono: string | null;
  ciudad: string | null;
  permite_ubicacion: boolean | null;
  onboarding_completed: boolean | null;
  checklist_descartada: boolean | null;
  primer_pdf_descargado: boolean | null;
  logo_url: string | null;
  color_primario: string | null;
  servicios: string[] | null;
  horario_atencion: HorarioAtencion | null;
  es_fundadora: boolean | null;
  rol?: 'corporativo' | 'salon' | null;
  bloqueo_tipo4_minutos?: number | null;
  feature_flags?: unknown;
};

function rowToProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    nombre: r.nombre,
    nombreSalon: r.nombre_salon ?? undefined,
    telefono: r.telefono ?? undefined,
    ciudad: r.ciudad ?? undefined,
    permiteUbicacion: r.permite_ubicacion ?? false,
    // Si la migración aún no corrió (columna ausente → undefined/null),
    // tratar como "ya onboardeado" para no encerrar cuentas viejas en el
    // wizard ni mostrarles la checklist.
    onboardingCompleted: r.onboarding_completed ?? true,
    checklistDescartada: r.checklist_descartada ?? true,
    primerPdfDescargado: r.primer_pdf_descargado ?? false,
    logoUrl: r.logo_url ?? undefined,
    colorPrimario: r.color_primario ?? undefined,
    servicios: Array.isArray(r.servicios) ? r.servicios : undefined,
    horarioAtencion: r.horario_atencion ?? undefined,
    esFundadora: r.es_fundadora ?? false,
    // Sin migración legal-gobernanza (columna ausente): las fundadoras
    // conservan el acceso corporativo; el resto es salon.
    rol: r.rol ?? (r.es_fundadora ? 'corporativo' : 'salon'),
    bloqueoTipo4Minutos: r.bloqueo_tipo4_minutos ?? 180,
    // Sin migración de flags (columna ausente) → sin overrides: rigen los
    // valores del entorno.
    featureFlags: sanitizarFlagsSalon(r.feature_flags),
  };
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : null;
}

export async function updateProfile(updates: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const patch: Partial<ProfileRow> = {};
  if (updates.nombre !== undefined) patch.nombre = updates.nombre;
  if (updates.nombreSalon !== undefined) patch.nombre_salon = updates.nombreSalon || null;
  if (updates.telefono !== undefined) patch.telefono = updates.telefono || null;
  if (updates.ciudad !== undefined) patch.ciudad = updates.ciudad || null;
  if (updates.permiteUbicacion !== undefined) patch.permite_ubicacion = updates.permiteUbicacion;
  if (updates.onboardingCompleted !== undefined) patch.onboarding_completed = updates.onboardingCompleted;
  if (updates.checklistDescartada !== undefined) patch.checklist_descartada = updates.checklistDescartada;
  if (updates.primerPdfDescargado !== undefined) patch.primer_pdf_descargado = updates.primerPdfDescargado;
  if (updates.logoUrl !== undefined) patch.logo_url = updates.logoUrl || null;
  if (updates.colorPrimario !== undefined) patch.color_primario = updates.colorPrimario || null;
  if (updates.servicios !== undefined) patch.servicios = updates.servicios?.length ? updates.servicios : null;
  if (updates.horarioAtencion !== undefined) patch.horario_atencion = updates.horarioAtencion ?? null;
  // rol y feature_flags NO son editables desde el cliente: se asignan por
  // SQL y los protege el trigger de supabase/migration-proteger-perfil.sql.
  if (updates.bloqueoTipo4Minutos !== undefined) {
    patch.bloqueo_tipo4_minutos = Math.min(240, Math.max(120, updates.bloqueoTipo4Minutos));
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToProfile(data);
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
