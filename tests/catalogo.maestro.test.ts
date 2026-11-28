import { describe, expect, it } from 'vitest';
import { VERTICALES, type VerticalSalon } from '@/lib/flags/verticales';
import {
  CATALOGO_MAESTRO_COLOMBIA,
  buscarEnCatalogoMaestro,
  listarCatalogoPorVertical,
  normalizarTextoBusqueda,
  obtenerPackPopularPorVertical,
} from '@/lib/catalogos/catalogoMaestroColombia';

describe('Catálogo Maestro de Procedimientos Colombia (Recalibrado P0)', () => {
  it('mantiene cobertura curada entre 110 y 140 procedimientos sin ids duplicados', () => {
    expect(CATALOGO_MAESTRO_COLOMBIA.length).toBeGreaterThanOrEqual(110);
    expect(CATALOGO_MAESTRO_COLOMBIA.length).toBeLessThanOrEqual(140);

    const ids = CATALOGO_MAESTRO_COLOMBIA.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)+$/);
    }
  });

  it('cubre las 5 verticales y nunca preselecciona en popular un ítem sujeto a habilitación REPS', () => {
    for (const vertical of VERTICALES) {
      const items = listarCatalogoPorVertical(vertical);
      expect(items.length).toBeGreaterThanOrEqual(15);

      const populares = obtenerPackPopularPorVertical(vertical);
      expect(populares.length).toBeGreaterThanOrEqual(8);
      expect(populares.length).toBeLessThanOrEqual(10);
      expect(
        populares.every(
          (p) => p.veli_guardrail_action !== 'restrict_require_reps_health_license'
        )
      ).toBe(true);
    }
  });

  it('garantiza integridad numérica de precios COP, duraciones y ciclos de retorno', () => {
    for (const item of CATALOGO_MAESTRO_COLOMBIA) {
      expect(item.precio_min_cop, `${item.id}: min > 0`).toBeGreaterThan(0);
      expect(item.precio_min_cop % 1000, `${item.id}: min mult 1000`).toBe(0);
      expect(item.precio_sugerido_cop % 1000, `${item.id}: sugerido mult 1000`).toBe(0);
      expect(item.precio_max_cop % 1000, `${item.id}: max mult 1000`).toBe(0);

      expect(item.precio_min_cop, `${item.id}: min <= sugerido`).toBeLessThanOrEqual(
        item.precio_sugerido_cop
      );
      expect(item.precio_sugerido_cop, `${item.id}: sugerido <= max`).toBeLessThanOrEqual(
        item.precio_max_cop
      );

      expect(item.duracion_min, `${item.id}: duracion >= 15`).toBeGreaterThanOrEqual(15);
      expect(item.duracion_min % 15, `${item.id}: duracion mult 15`).toBe(0);
      expect(item.ciclo_retorno_dias, `${item.id}: retorno >= 7`).toBeGreaterThanOrEqual(7);
      expect(item.descripcion_corta.length, `${item.id}: desc <= 95`).toBeLessThanOrEqual(95);
    }
  });

  it('recalibra gramajes base a escala 1.0x cabello corto y homologa alisados en ml (P0)', () => {
    const porId = new Map(CATALOGO_MAESTRO_COLOMBIA.map((i) => [i.id, i]));

    expect(porId.get('hair-balayage-completo')?.gramos_base_sugeridos).toBe(60);
    expect(porId.get('hair-balayage-completo')?.unidad_base).toBe('g');
    expect(porId.get('hair-balayage-completo')?.nota_formula_secundaria).toMatch(/matizante/i);

    expect(porId.get('hair-babylights')?.gramos_base_sugeridos).toBe(60);
    expect(porId.get('hair-decoloracion-global')?.gramos_base_sugeridos).toBe(75);
    expect(porId.get('hair-correccion-color')?.gramos_base_sugeridos).toBe(80);

    for (const idAlisado of [
      'hair-keratina-alisado',
      'hair-aminoacidos-capilares',
      'hair-cirugia-capilar',
    ]) {
      const item = porId.get(idAlisado);
      expect(item?.gramos_base_sugeridos).toBe(60);
      expect(item?.unidad_base).toBe('ml');
    }

    for (const item of CATALOGO_MAESTRO_COLOMBIA) {
      if (item.usa_sin_bascula) {
        expect(item.gramos_base_sugeridos ?? 0).toBeGreaterThan(0);
        expect(['g', 'ml']).toContain(item.unidad_base);
      } else {
        expect(item.gramos_base_sugeridos).toBeNull();
        expect(item.unidad_base).toBeNull();
      }
    }
  });

  it('incorpora los desdobles regulatorios P0, copy seguro y sesiones nupciales', () => {
    const porId = new Map(CATALOGO_MAESTRO_COLOMBIA.map((i) => [i.id, i]));

    // Desdobles nuevos P0 presentes
    expect(porId.has('spa-nanoneedling-epidermico')).toBe(true);
    expect(porId.has('spa-drenaje-postoperatorio-especializado')).toBe(true);
    expect(porId.has('spa-hidrodermoabrasion-estetica')).toBe(true);
    expect(porId.has('lounge-prueba-maquillaje-peinado-novia')).toBe(true);
    expect(porId.get('lounge-prueba-maquillaje-peinado-novia')?.duracion_min).toBe(150);

    // Paquete novia completo documenta 330 min en 2 sesiones
    expect(porId.get('lounge-paquete-novia-completo')?.duracion_min).toBe(330);
    expect(porId.get('lounge-paquete-novia-completo')?.nota_formula_secundaria).toMatch(/330 min/);

    // Copy seguro
    expect(porId.get('spa-drenaje-linfatico-manual')?.nombre).not.toMatch(/postoperatorio/i);
    expect(porId.get('spa-peeling-quimico-suave')?.nombre).toBe(
      'Renovación facial con ácidos cosméticos suaves (AHA)'
    );
    expect(porId.get('nail-pedicura-clinica-sin-esmalte')?.nombre).toBe(
      'Pedicura de cuidado profundo sin esmalte'
    );

    // Guardarraíles REPS
    for (const idReps of [
      'spa-dermapen-microneedling',
      'spa-laser-zona-pequena',
      'spa-laser-zona-mediana',
      'spa-laser-zona-grande',
      'spa-drenaje-postoperatorio-especializado',
    ]) {
      expect(porId.get(idReps)?.veli_guardrail_action).toBe(
        'restrict_require_reps_health_license'
      );
    }
  });

  it('soporta búsqueda insensible a tildes, mayúsculas y sinónimos locales de Colombia', () => {
    expect(normalizarTextoBusqueda('  Queratína / Bótox  ')).toBe('queratina / botox');
    expect(buscarEnCatalogoMaestro('BLOWER').some((i) => i.id === 'hair-cepillado-blower')).toBe(
      true
    );
    expect(
      buscarEnCatalogoMaestro('acrilicas', 'nail_bar').some(
        (i) => i.id === 'nail-acrilicas-set-nuevo'
      )
    ).toBe(true);
    expect(
      buscarEnCatalogoMaestro('capul', 'hair_studio').some(
        (i) => i.id === 'hair-corte-flequillo'
      )
    ).toBe(true);

    const verticales: readonly VerticalSalon[] = VERTICALES;
    for (const vertical of verticales) {
      const pack = obtenerPackPopularPorVertical(vertical);
      expect(pack.every((i) => i.vertical === vertical && i.popular)).toBe(true);
    }
  });
});
