import { useEffect, useMemo, useState } from 'react';
import { getProfile } from '@/lib/profile';
import { flagsActivos, type FlagsEvaluados, type OverridesFlags } from './index';

/**
 * Flags para la interfaz. Arranca con los del entorno (los módulos
 * congelados quedan ocultos desde el primer render, sin parpadeo) y suma los
 * overrides del salón cuando llega el perfil. La RLS sigue siendo la
 * barrera real: esto solo decide qué se muestra.
 */
export function useFlags(): FlagsEvaluados {
  const [salon, setSalon] = useState<OverridesFlags | null>(null);

  useEffect(() => {
    let vivo = true;
    getProfile()
      .then((p) => {
        if (vivo) setSalon(p?.featureFlags ?? null);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  return useMemo(() => flagsActivos(salon), [salon]);
}
