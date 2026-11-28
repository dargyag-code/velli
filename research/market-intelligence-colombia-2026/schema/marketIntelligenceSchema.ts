/**
 * Esquema Lógico Normalizado · Base de Inteligencia de Mercado Veli (Colombia 2026)
 *
 * IMPORTANTE:
 * - Este archivo documenta y tipa estrictamente las 21 entidades lógicas del repositorio
 *   de investigación (`research/market-intelligence-colombia-2026/`).
 * - NO modifica ni reemplaza tablas productivas multi-tenant (`organization_id`) ni migraciones SQL.
 * - Mantiene separación absoluta entre referencias agregadas de mercado y datos privados del salón.
 */

import type { VerticalSalon } from '@/lib/flags/verticales';

export type MarketVertical = VerticalSalon;

export type DataOriginType =
  | 'observed'
  | 'calculated'
  | 'estimated'
  | 'proposed'
  | 'pending';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unverified';

export type EstablishmentSegment = 'economico' | 'estandar' | 'premium';

export type CityTier = 'principal' | 'intermedia_alta' | 'intermedia';

export type MeasurementUnit =
  | 'g'
  | 'ml'
  | 'unidad'
  | 'par'
  | 'kit'
  | 'sesion'
  | 'min'
  | 'dias';

export type CostTrackingMode =
  | 'sin_bascula_mezcla'
  | 'estructural_ml_g'
  | 'monodosis_kit'
  | 'consumibles_fijos';

export type LegalClassification =
  | 'ornamental_cosmetico'
  | 'estetico_cosmetologico_no_invasivo'
  | 'habilitacion_salud_reps_medica'
  | 'prohibido_sanitariamente';

export type VeliGuardrailAction =
  | 'allow_standard'
  | 'allow_with_chemical_or_patch_consent'
  | 'allow_with_cosmetologist_and_invima_warning'
  | 'restrict_require_reps_health_license'
  | 'hard_block_illegal_substance';

// ── 1. market_categories ───────────────────────────────────────────────────
export interface MarketCategory {
  readonly category_id: string;
  readonly vertical: MarketVertical;
  readonly category_name: string;
  readonly subcategory_name: string | null;
  readonly display_order: number;
}

// ── 2. market_procedures ───────────────────────────────────────────────────
export interface MarketProcedure {
  readonly procedure_id: string;
  readonly vertical: MarketVertical;
  readonly category_id: string;
  readonly standardized_name: string;
  readonly colombia_aliases: readonly string[];
  readonly short_description: string;
  readonly catalog_origin: 'v1_existing' | 'v2_proposed_addition';
  readonly is_starting_price: boolean;
  readonly cost_tracking_mode: CostTrackingMode;
  readonly uses_sin_bascula: boolean;
  readonly base_grams_or_ml_short: number | null;
  readonly return_cycle_days: number;
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3';
  readonly data_origin: DataOriginType;
  readonly confidence_level: ConfidenceLevel;
  readonly updated_at: string;
}

// ── 3. market_procedure_variants ───────────────────────────────────────────
export interface MarketProcedureVariant {
  readonly variant_id: string;
  readonly procedure_id: string;
  readonly dimension_type:
    | 'largo'
    | 'largo_densidad'
    | 'largo_una'
    | 'complejidad_diseno'
    | 'tiempo_retorno'
    | 'duracion'
    | 'paquete_sesiones'
    | 'nivel_especialista'
    | 'tecnica';
  readonly variant_code: string;
  readonly variant_label: string;
  readonly duration_delta_min: number;
  readonly consumption_multiplier: number;
  readonly price_surcharge_cop: number;
  readonly price_multiplier: number;
  readonly notes: string;
}

// ── 4. market_sources ──────────────────────────────────────────────────────
export interface MarketSource {
  readonly source_id: string;
  readonly source_type:
    | 'internal_codebase'
    | 'booking_platform'
    | 'official_establishment_site'
    | 'public_social_tariff'
    | 'professional_distributor'
    | 'sector_study'
    | 'saas_global'
    | 'saas_benchmark'
    | 'official_regulatory';
  readonly entity_or_platform: string;
  readonly base_url: string;
  readonly verticals_covered: readonly MarketVertical[] | 'all';
  readonly geographic_scope: string;
  readonly accessed_at: string;
  readonly reliability_tier: ConfidenceLevel;
  readonly notes: string;
}

// ── 5. market_establishments ───────────────────────────────────────────────
export interface MarketEstablishment {
  readonly establishment_id: string;
  readonly establishment_name: string;
  readonly vertical: MarketVertical;
  readonly city_code: string;
  readonly city: string;
  readonly department: string;
  readonly establishment_segment: EstablishmentSegment;
  readonly segment_signals: string;
  readonly primary_source_id: string;
  readonly source_url: string;
}

// ── 6. market_price_observations ───────────────────────────────────────────
export interface MarketPriceObservation {
  readonly observation_id: string;
  readonly procedure_id: string;
  readonly procedure_name_observed: string;
  readonly establishment_name: string;
  readonly city: string;
  readonly department: string;
  readonly source_url: string;
  readonly source_type: string;
  readonly observed_price_cop: number;
  readonly price_type: 'fixed' | 'starting_at' | 'range_midpoint' | 'package_total';
  readonly observed_at: string;
  readonly service_conditions: string;
  readonly duration_if_published: number | null;
  readonly establishment_segment: EstablishmentSegment;
  readonly promotion_status: 'regular' | 'promotional' | 'first_visit_offer';
  readonly length_or_design_conditions: string;
  readonly evidence_notes: string;
  readonly confidence_level: ConfidenceLevel;
}

// ── 7. market_price_benchmarks ─────────────────────────────────────────────
export interface MarketPriceBenchmark {
  readonly benchmark_id: string;
  readonly procedure_id: string;
  readonly vertical: MarketVertical;
  readonly n_observations: number;
  readonly min_observed_cop: number;
  readonly p25_cop: number;
  readonly median_cop: number;
  readonly p75_cop: number;
  readonly max_observed_cop: number;
  readonly mean_cop: number;
  readonly iqr_dispersion_cop: number;
  readonly recommended_econ_cop: number;
  readonly recommended_std_cop: number;
  readonly recommended_prem_cop: number;
  readonly catalog_v1_suggested_cop: number | null;
  readonly delta_vs_v1_pct: number | null;
  readonly data_origin: DataOriginType;
  readonly confidence_level: ConfidenceLevel;
  readonly justification: string;
}

// ── 8. market_suppliers ────────────────────────────────────────────────────
export interface MarketSupplier {
  readonly supplier_id: string;
  readonly supplier_name: string;
  readonly supplier_type: 'manufacturer' | 'national_importer' | 'professional_distributor' | 'wholesale_retail';
  readonly channel_type: string;
  readonly cities_coverage: string;
  readonly verticals_served: readonly MarketVertical[];
  readonly website_url: string;
  readonly purchase_conditions: string;
  readonly observed_at: string;
  readonly confidence_level: ConfidenceLevel;
}

// ── 9. market_products ─────────────────────────────────────────────────────
export interface MarketProduct {
  readonly product_id: string;
  readonly brand: string;
  readonly commercial_name: string;
  readonly technical_category: string;
  readonly subcategory: string;
  readonly verticals_used: readonly MarketVertical[];
  readonly segment_tier: EstablishmentSegment;
  readonly default_presentation: string;
  readonly content_amount: number;
  readonly unit: MeasurementUnit;
  readonly storage_or_shelf_life: string;
  readonly compatible_procedure_categories: readonly string[];
  readonly data_origin: DataOriginType;
  readonly confidence_level: ConfidenceLevel;
}

// ── 10. market_product_prices ──────────────────────────────────────────────
export interface MarketProductPrice {
  readonly product_price_id: string;
  readonly product_id: string;
  readonly supplier_id: string;
  readonly presentation_label: string;
  readonly content_amount: number;
  readonly unit: MeasurementUnit;
  readonly observed_price_cop: number;
  readonly price_channel:
    | 'professional_distributor'
    | 'wholesale'
    | 'commercial_retail'
    | 'promotional';
  readonly unit_price_cop: number;
  readonly estimated_yield_services: number;
  readonly cost_per_service_ref_cop: number;
  readonly city_or_coverage: string;
  readonly source_url: string;
  readonly observed_at: string;
  readonly data_origin: DataOriginType;
  readonly confidence_level: ConfidenceLevel;
  readonly notes: string;
}

// ── 11. market_procedure_formulas ──────────────────────────────────────────
export interface MarketProcedureFormula {
  readonly formula_id: string;
  readonly procedure_id: string;
  readonly config_code: string;
  readonly product_technical_category: string;
  readonly reference_product_id: string | null;
  readonly reference_quantity: number;
  readonly unit: 'g' | 'ml' | 'unidad' | 'kit';
  readonly oxidant_mix_ratio: number | null;
  readonly waste_pct: number;
  readonly data_origin: DataOriginType;
  readonly confidence_level: ConfidenceLevel;
}

// ── 12. market_procedure_consumables ───────────────────────────────────────
export interface MarketProcedureConsumable {
  readonly consumable_map_id: string;
  readonly procedure_id: string;
  readonly product_id: string | null;
  readonly consumable_description: string;
  readonly quantity_per_service: number;
  readonly unit: MeasurementUnit;
  readonly reference_cost_cop: number;
  readonly data_origin: DataOriginType;
  readonly confidence_level: ConfidenceLevel;
}

// ── 13. market_procedure_durations ─────────────────────────────────────────
export interface MarketProcedureDuration {
  readonly duration_id: string;
  readonly procedure_id: string;
  readonly prep_min: number;
  readonly exec_min_minimum: number;
  readonly exec_min_typical: number;
  readonly exec_min_complex_or_xl: number;
  readonly processing_pose_min: number;
  readonly cleanup_min: number;
  readonly total_chair_min_typical: number;
  readonly specialist_active_min_typical: number;
  readonly can_overlap_client_in_pose: boolean;
  readonly data_origin: DataOriginType;
  readonly confidence_level: ConfidenceLevel;
  readonly technical_notes: string;
}

// ── 14. market_commission_models ───────────────────────────────────────────
export interface MarketCommissionModel {
  readonly commission_model_id: string;
  readonly vertical: MarketVertical;
  readonly scheme_type:
    | 'percentage_gross'
    | 'percentage_net_after_product'
    | 'fixed_per_service'
    | 'booth_rent_chair'
    | 'employed_base_plus_commission';
  readonly typical_rate_pct_or_cop: number;
  readonly salon_absorbs_chemical_cost: boolean;
  readonly social_security_load_factor: number;
  readonly market_prevalence_colombia: string;
  readonly pros_and_risks: string;
  readonly confidence_level: ConfidenceLevel;
}

// ── 15. market_cost_models ─────────────────────────────────────────────────
export interface MarketCostModel {
  readonly cost_model_id: string;
  readonly procedure_id: string;
  readonly scenario_segment: EstablishmentSegment;
  readonly commission_model_id: string;
  readonly reference_price_cop: number;
  readonly materials_cost_cop: number;
  readonly consumables_cost_cop: number;
  readonly payment_fee_cost_cop: number;
  readonly total_variable_cost_cop: number;
  readonly specialist_payout_or_labor_cop: number;
  readonly allocated_overhead_cop: number;
  readonly cost_per_chair_min_cop: number;
  readonly gross_margin_cop: number;
  readonly gross_margin_pct: number;
  readonly contribution_margin_cop: number;
  readonly contribution_margin_pct: number;
  readonly operating_profit_cop: number;
  readonly operating_margin_pct: number;
  readonly breakeven_price_cop: number;
  readonly recommended_target_margin_price_cop: number;
  readonly operating_profit_per_active_hour_cop: number;
  readonly data_origin: DataOriginType;
  readonly confidence_level: ConfidenceLevel;
}

// ── 16. market_competitors ─────────────────────────────────────────────────
export interface MarketCompetitor {
  readonly competitor_id: string;
  readonly name: string;
  readonly category_type: 'direct_latam_co' | 'direct_marketplace' | 'indirect_tool' | 'global_benchmark';
  readonly origin_region: string;
  readonly active_in_colombia: boolean;
  readonly target_segments: string;
  readonly business_model: string;
  readonly core_value_proposition: string;
  readonly key_strengths: string;
  readonly key_weaknesses_for_colombia: string;
  readonly veli_opportunity_gap: string;
  readonly source_url: string;
  readonly observed_at: string;
  readonly confidence_level: ConfidenceLevel;
}

// ── 17. market_competitor_features ─────────────────────────────────────────
export type FeatureSupportLevel =
  | 'yes_native'
  | 'partial_or_paid_addon'
  | 'no'
  | 'unverified';

export interface MarketCompetitorFeatureMatrix {
  readonly competitor_id: string;
  readonly online_booking: FeatureSupportLevel;
  readonly pos_checkout: FeatureSupportLevel;
  readonly crm_clinical_records: FeatureSupportLevel;
  readonly inventory_basic: FeatureSupportLevel;
  readonly variable_service_quoter: FeatureSupportLevel;
  readonly chemical_gram_cost_tracking: FeatureSupportLevel;
  readonly commission_on_net_after_product: FeatureSupportLevel;
  readonly real_margin_per_hour_bi: FeatureSupportLevel;
  readonly marketing_automations: FeatureSupportLevel;
  readonly native_whatsapp_colombia: FeatureSupportLevel;
  readonly ai_features: FeatureSupportLevel;
  readonly consumer_marketplace_directory: FeatureSupportLevel;
  readonly local_co_payments_pse_nequi: FeatureSupportLevel;
  readonly feature_verification_notes: string;
  readonly confidence_level: ConfidenceLevel;
}

// ── 18. market_demand_observations ─────────────────────────────────────────
export interface MarketDemandObservation {
  readonly demand_obs_id: string;
  readonly vertical: MarketVertical | 'cross_vertical';
  readonly geographic_scope: string;
  readonly topic_category: string;
  readonly finding_summary: string;
  readonly quantitative_metric_if_available: string | null;
  readonly source_name: string;
  readonly source_url: string;
  readonly observed_at: string;
  readonly evidence_classification:
    | 'published_sector_study'
    | 'observed_market_pattern'
    | 'commercial_hypothesis';
  readonly confidence_level: ConfidenceLevel;
  readonly actionable_for_veli: string;
}

// ── 19. market_trends ──────────────────────────────────────────────────────
export interface MarketTrendEvaluation {
  readonly trend_id: string;
  readonly vertical: MarketVertical;
  readonly trend_or_procedure_name: string;
  readonly demand_evidence_score_1_5: number;
  readonly potential_price_cop: number;
  readonly required_investment_cop: number;
  readonly technical_complexity: 'baja' | 'media' | 'alta' | 'especializada';
  readonly professional_requirements: string;
  readonly margin_potential_pct: number;
  readonly recurrence_days: number;
  readonly competition_intensity: 'baja' | 'media' | 'alta';
  readonly regulatory_or_operational_risk: 'bajo' | 'medio' | 'alto';
  readonly implementation_ease: 'alta' | 'media' | 'baja';
  readonly catalog_verdict: 'include_now' | 'include_with_guardrail' | 'monitor_only' | 'exclude_medical_or_fad';
  readonly confidence_level: ConfidenceLevel;
}

// ── 20. market_regulatory_requirements ─────────────────────────────────────
export interface MarketRegulatoryRequirement {
  readonly reg_req_id: string;
  readonly vertical: MarketVertical;
  readonly procedure_group_or_id: string;
  readonly sample_procedure_ids: readonly string[];
  readonly legal_classification: LegalClassification;
  readonly applicable_colombian_norms: readonly string[];
  readonly required_personnel_credential: string;
  readonly infrastructure_and_biosecurity_reqs: string;
  readonly waste_management_reqs: string;
  readonly invima_product_or_device_reqs: string;
  readonly mandatory_informed_consent: boolean;
  readonly veli_guardrail_action: VeliGuardrailAction;
  readonly operational_risk_level: 'bajo' | 'medio' | 'alto' | 'critico';
  readonly confidence_level: ConfidenceLevel;
  readonly regulatory_notes: string;
}

// ── 21. market_validation_issues ───────────────────────────────────────────
export interface MarketValidationIssue {
  readonly issue_id: string;
  readonly detected_by: 'AGENTE_0' | 'AGENTE_7';
  readonly target_entity: string;
  readonly target_id: string;
  readonly severity: 'critical' | 'warning' | 'info';
  readonly issue_type:
    | 'grammage_multiplier_mismatch'
    | 'protocol_hybrid_split_needed'
    | 'regulatory_boundary_alert'
    | 'sample_size_limitation'
    | 'price_dispersion_outlier'
    | 'missing_consumable_tracking';
  readonly description: string;
  readonly resolution_status: 'resolved_in_benchmark' | 'documented_for_p0' | 'documented_limitation';
  readonly resolution_notes: string;
}
