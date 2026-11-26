'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  formatearFechaBogotaYmd,
  sumarDiasYmd,
  type AvailableSlot,
} from '@/lib/agenda/disponibilidad';
import { formatearPrecioCop } from '@/lib/cotizador/whatsapp';
import { normalizarHexVelvet } from '@/lib/organizations/brand';
import { resolverPrecioVariante } from '@/lib/vitrina/motor';
import type {
  CatalogProductVariant,
  PublicCatalogProduct,
  PublicOrderType,
  PublicServiceItem,
  PublicStorefrontData,
} from '@/lib/vitrina/tipos';

interface CartEntry {
  key: string;
  kind: 'product' | 'service';
  itemId: string;
  name: string;
  variantId?: string;
  variantLabel?: string;
  unitPriceCop: number;
  quantity: number;
}

interface SpecialistDisponibilidad {
  id: string;
  name: string;
  slots: AvailableSlot[];
}

const CATEGORY_LABELS: Record<string, string> = {
  color: 'Coloración',
  decoloracion: 'Diseño de Rubios',
  tratamiento: 'Tratamientos',
  corte: 'Corte & Diseño',
  alisado: 'Alisados & Forma',
  rizos: 'Rizos & Textura',
  peinado: 'Peinado',
  cuero_cabelludo: 'Cuero Cabelludo',
  extensiones: 'Extensiones',
  otro: 'Servicios',
};

function formatearCategoria(cat: string): string {
  return CATEGORY_LABELS[cat.toLowerCase()] ?? cat;
}

export default function VitrinaPublicaClient({
  data,
  appHost,
}: {
  data: PublicStorefrontData;
  appHost: string;
}) {
  const tieneServicios = data.services.length > 0;

  const [tab, setTab] = useState<'servicios' | 'tienda'>(
    tieneServicios ? 'servicios' : 'tienda'
  );
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState<string>('todas');
  const [variantePorProducto, setVariantePorProducto] = useState<Record<string, string>>({});

  // Carrito y Checkout Sheet
  const [carrito, setCarrito] = useState<CartEntry[]>([]);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorCheckout, setErrorCheckout] = useState<string | null>(null);
  const [pedidoConfirmado, setPedidoConfirmado] = useState<{
    orderCode: string;
    totalCop: number;
    whatsappUrl: string;
  } | null>(null);

  // Flujo de Reserva de Cita (Servicio → Especialista → Fecha/Hora → Confirmación)
  const [servicioAgendando, setServicioAgendando] = useState<PublicServiceItem | null>(null);
  const [fechaCita, setFechaCita] = useState<string>(() =>
    sumarDiasYmd(formatearFechaBogotaYmd(new Date()), 1)
  );
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [especialistasAgenda, setEspecialistasAgenda] = useState<SpecialistDisponibilidad[]>([]);
  const [specialistIdElegida, setSpecialistIdElegida] = useState<string>('');
  const [horaElegida, setHoraElegida] = useState<string>('');
  const [citaNombre, setCitaNombre] = useState('');
  const [citaTelefono, setCitaTelefono] = useState('');
  const [citaNotas, setCitaNotas] = useState('');
  const [guardandoCita, setGuardandoCita] = useState(false);
  const [errorCita, setErrorCita] = useState<string | null>(null);
  const [citaConfirmada, setCitaConfirmada] = useState<{
    whatsappUrl: string;
    serviceName: string;
    specialistName: string;
    dateLabel: string;
    timeLabel: string;
  } | null>(null);

  const primaryColor = normalizarHexVelvet(data.brand.primaryColor, '#3B0D1E');

  const cambiarTab = (next: 'servicios' | 'tienda') => {
    setTab(next);
    setCategoriaActiva('todas');
    setBusqueda('');
  };

  // Cargar especialistas y slots cuando se abre el modal de cita o cambia la fecha
  useEffect(() => {
    if (!servicioAgendando) return;
    let vivo = true;
    setCargandoSlots(true);
    setErrorCita(null);
    setHoraElegida('');

    const qs = new URLSearchParams({
      slug: data.organization.slug,
      date: fechaCita,
      serviceId: servicioAgendando.id,
    });

    fetch(`/api/public/appointments?${qs.toString()}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          specialists?: SpecialistDisponibilidad[];
          error?: string;
        };
        if (!vivo) return;
        if (!res.ok || !json.ok) {
          setEspecialistasAgenda([]);
          setErrorCita(json.error ?? 'No se pudo consultar la disponibilidad');
          return;
        }
        const lista = json.specialists ?? [];
        setEspecialistasAgenda(lista);
        setSpecialistIdElegida((prev) =>
          lista.some((s) => s.id === prev) ? prev : (lista[0]?.id ?? '')
        );
      })
      .catch(() => {
        if (vivo) {
          setEspecialistasAgenda([]);
          setErrorCita('Sin conexión para consultar horarios.');
        }
      })
      .finally(() => {
        if (vivo) setCargandoSlots(false);
      });

    return () => {
      vivo = false;
    };
  }, [servicioAgendando, fechaCita, data.organization.slug]);

  const especialistaActual = useMemo(
    () => especialistasAgenda.find((s) => s.id === specialistIdElegida) ?? null,
    [especialistasAgenda, specialistIdElegida]
  );

  const abrirModalCita = (srv: PublicServiceItem) => {
    setCitaConfirmada(null);
    setErrorCita(null);
    setHoraElegida('');
    setServicioAgendando(srv);
  };

  const confirmarSolicitudCita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!servicioAgendando || !especialistaActual || !horaElegida || guardandoCita) return;

    setErrorCita(null);
    setGuardandoCita(true);

    try {
      const res = await fetch('/api/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationSlug: data.organization.slug,
          serviceId: servicioAgendando.id,
          specialistId: especialistaActual.id,
          date: fechaCita,
          time: horaElegida,
          customerName: citaNombre,
          customerPhone: citaTelefono,
          notes: citaNotas.trim() || null,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        whatsappUrl?: string;
        error?: string;
      };

      if (!res.ok || !json.ok || !json.whatsappUrl) {
        setErrorCita(json.error ?? 'No se pudo agendar la cita');
        setGuardandoCita(false);
        return;
      }

      const [yyyy, mm, dd] = fechaCita.split('-');
      setCitaConfirmada({
        whatsappUrl: json.whatsappUrl,
        serviceName: servicioAgendando.name,
        specialistName: especialistaActual.name,
        dateLabel: `${dd}/${mm}/${yyyy}`,
        timeLabel: horaElegida,
      });
      setGuardandoCita(false);
      window.open(json.whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setErrorCita('Sin conexión a internet. Intenta de nuevo.');
      setGuardandoCita(false);
    }
  };

  const categoriasDisponibles = useMemo(() => {
    const origen =
      tab === 'servicios'
        ? data.services.map((s) => formatearCategoria(s.category))
        : data.products.map((p) => p.category);
    return Array.from(new Set(origen.filter(Boolean)));
  }, [tab, data.services, data.products]);

  const serviciosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return data.services.filter((s) => {
      const catLabel = formatearCategoria(s.category);
      if (categoriaActiva !== 'todas' && catLabel !== categoriaActiva) return false;
      if (q && !s.name.toLowerCase().includes(q) && !catLabel.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [data.services, busqueda, categoriaActiva]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return data.products.filter((p) => {
      if (categoriaActiva !== 'todas' && p.category !== categoriaActiva) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.description ?? '').toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data.products, busqueda, categoriaActiva]);

  const obtenerVarianteSeleccionada = (
    prod: PublicCatalogProduct
  ): CatalogProductVariant | undefined => {
    if (prod.variants.length === 0) return undefined;
    const elegidaId = variantePorProducto[prod.id];
    return (
      prod.variants.find((v) => v.id === elegidaId) ??
      prod.variants.find((v) => v.inStock !== false) ??
      prod.variants[0]
    );
  };

  const agregarProducto = (prod: PublicCatalogProduct) => {
    if (!prod.inStock) return;
    const variante = obtenerVarianteSeleccionada(prod);
    if (variante && variante.inStock === false) return;

    const unitPriceCop = resolverPrecioVariante(prod.priceCop, variante);
    const key = `product:${prod.id}:${variante?.id ?? 'base'}`;

    setCarrito((prev) => {
      const existente = prev.find((it) => it.key === key);
      if (existente) {
        return prev.map((it) =>
          it.key === key ? { ...it, quantity: Math.min(50, it.quantity + 1) } : it
        );
      }
      return [
        ...prev,
        {
          key,
          kind: 'product',
          itemId: prod.id,
          name: prod.name,
          variantId: variante?.id,
          variantLabel: variante?.label,
          unitPriceCop,
          quantity: 1,
        },
      ];
    });
  };

  const agregarServicio = (srv: PublicServiceItem) => {
    const key = `service:${srv.id}`;
    setCarrito((prev) => {
      const existente = prev.find((it) => it.key === key);
      if (existente) {
        return prev.map((it) =>
          it.key === key ? { ...it, quantity: Math.min(50, it.quantity + 1) } : it
        );
      }
      return [
        ...prev,
        {
          key,
          kind: 'service',
          itemId: srv.id,
          name: srv.name,
          unitPriceCop: srv.priceCop,
          quantity: 1,
        },
      ];
    });
  };

  const cambiarCantidad = (key: string, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((it) => (it.key === key ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0 && it.quantity <= 50)
    );
  };

  const totalUnidades = useMemo(
    () => carrito.reduce((acc, it) => acc + it.quantity, 0),
    [carrito]
  );

  const totalCarritoCop = useMemo(
    () => carrito.reduce((acc, it) => acc + it.unitPriceCop * it.quantity, 0),
    [carrito]
  );

  const tipoPedidoInferido: PublicOrderType = useMemo(() => {
    const hayProductos = carrito.some((it) => it.kind === 'product');
    return hayProductos ? 'product_cart' : 'service_inquiry';
  }, [carrito]);

  const confirmarPedidoWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando || carrito.length === 0) return;

    setErrorCheckout(null);
    setEnviando(true);

    try {
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationSlug: data.organization.slug,
          customerName,
          customerPhone,
          orderType: tipoPedidoInferido,
          notes: notes.trim() || null,
          items: carrito.map((it) => ({
            kind: it.kind,
            itemId: it.itemId,
            variantId: it.variantId ?? null,
            quantity: it.quantity,
          })),
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        orderCode?: string;
        totalCop?: number;
        whatsappUrl?: string;
        error?: string;
      };

      if (!res.ok || !json.ok || !json.orderCode || !json.whatsappUrl) {
        setErrorCheckout(json.error ?? 'No se pudo procesar tu solicitud');
        setEnviando(false);
        return;
      }

      setPedidoConfirmado({
        orderCode: json.orderCode,
        totalCop: json.totalCop ?? totalCarritoCop,
        whatsappUrl: json.whatsappUrl,
      });
      setCarrito([]);
      setNotes('');
      setEnviando(false);

      window.open(json.whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setErrorCheckout('Sin conexión a internet. Verifica tu red e intenta nuevamente.');
      setEnviando(false);
    }
  };

  const hoyBogota = useMemo(() => formatearFechaBogotaYmd(new Date()), []);

  return (
    <div
      className="min-h-screen bg-[#FAF7F5] text-[#3B0D1E] font-sans pb-32"
      style={{ ['--brand-accent' as string]: primaryColor }}
    >
      {/* Cabecera Editorial de Marca */}
      <header className="bg-white border-b border-[#EFE8E4] pt-7 pb-5 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            {data.brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.brand.logoUrl}
                alt={data.brand.displayName}
                className="w-14 h-14 rounded-2xl object-cover border border-[#EFE8E4] shrink-0"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl text-[#FAF7F5] font-display text-2xl font-semibold flex items-center justify-center shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {data.brand.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              {data.organization.city && (
                <span className="inline-flex items-center gap-1 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                  <MapPin size={12} />
                  {data.organization.city}
                </span>
              )}
              <h1 className="m-0 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#3B0D1E] leading-tight truncate">
                {data.brand.displayName}
              </h1>
              {data.brand.publicTagline && (
                <p className="m-0 mt-1 text-xs sm:text-sm text-[#6B535C] leading-relaxed">
                  {data.brand.publicTagline}
                </p>
              )}
            </div>
          </div>

          {/* Selector de Pestañas: Servicios / Tienda */}
          <div className="mt-5 grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4]">
            <button
              type="button"
              onClick={() => cambiarTab('servicios')}
              className={`min-h-[44px] py-2 px-3 rounded-xl font-sans text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-all cursor-pointer border-none ${
                tab === 'servicios'
                  ? 'text-[#FAF7F5] shadow-xs'
                  : 'bg-transparent text-[#6B535C] hover:text-[#3B0D1E]'
              }`}
              style={tab === 'servicios' ? { backgroundColor: primaryColor } : undefined}
            >
              <Sparkles size={15} />
              <span>Servicios ({data.services.length})</span>
            </button>

            <button
              type="button"
              onClick={() => cambiarTab('tienda')}
              className={`min-h-[44px] py-2 px-3 rounded-xl font-sans text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-all cursor-pointer border-none ${
                tab === 'tienda'
                  ? 'text-[#FAF7F5] shadow-xs'
                  : 'bg-transparent text-[#6B535C] hover:text-[#3B0D1E]'
              }`}
              style={tab === 'tienda' ? { backgroundColor: primaryColor } : undefined}
            >
              <ShoppingBag size={15} />
              <span>Tienda ({data.products.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Buscador + Filtros de Categoría */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5">
        <div className="min-h-[46px] flex items-center gap-2.5 px-4 bg-white border border-[#EFE8E4] rounded-2xl shadow-velvet">
          <Search size={16} className="text-[#947C85] shrink-0" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={
              tab === 'servicios'
                ? 'Buscar servicio (ej. Balayage, Hidratación)…'
                : 'Buscar producto, línea o beneficio…'
            }
            className="flex-1 min-w-0 py-2.5 border-none bg-transparent outline-none text-sm font-sans text-[#3B0D1E] placeholder-[#947C85]"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
              className="p-1 rounded-full bg-transparent border-none text-[#947C85] hover:text-[#3B0D1E] cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {categoriasDisponibles.length > 1 && (
          <div className="v-noscroll flex gap-2 mt-3 overflow-x-auto pb-1">
            {['todas', ...categoriasDisponibles].map((cat) => {
              const activa = categoriaActiva === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoriaActiva(cat)}
                  className={`min-h-[38px] shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                    activa
                      ? 'text-[#FAF7F5] border-transparent'
                      : 'bg-white text-[#6B535C] border-[#EFE8E4] hover:bg-[#F5EBE8] hover:text-[#3B0D1E]'
                  }`}
                  style={activa ? { backgroundColor: primaryColor } : undefined}
                >
                  {cat === 'todas' ? 'Todas' : cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Contenido de Pestañas */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 space-y-3.5">
        {tab === 'servicios' ? (
          serviciosFiltrados.length === 0 ? (
            <section className="bg-white rounded-3xl border border-[#EFE8E4] p-8 text-center shadow-velvet">
              <Sparkles size={24} className="text-[#947C85] mx-auto mb-2.5" />
              <h2 className="m-0 font-sans text-base font-bold text-[#3B0D1E]">
                No hay servicios para mostrar
              </h2>
              <p className="m-0 mt-1 text-xs text-[#6B535C]">
                Ajusta el término de búsqueda o consulta directamente por WhatsApp.
              </p>
            </section>
          ) : (
            serviciosFiltrados.map((srv) => {
              const enCarrito = carrito.find((it) => it.key === `service:${srv.id}`);
              return (
                <article
                  key={srv.id}
                  className="bg-white rounded-3xl border border-[#EFE8E4] p-5 shadow-velvet flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-0.5 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] text-[#6B535C]">
                        {formatearCategoria(srv.category)}
                      </span>
                      {srv.durationMinutes && (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#947C85] tabular-nums">
                          <Clock size={12} />
                          {srv.durationMinutes} min
                        </span>
                      )}
                    </div>

                    <h2 className="m-0 font-sans text-base sm:text-lg font-bold tracking-tight text-[#3B0D1E]">
                      {srv.name}
                    </h2>

                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#947C85]">
                        Desde
                      </span>
                      <span className="font-display text-xl font-bold text-[#3B0D1E] tabular-nums">
                        {formatearPrecioCop(srv.priceCop)}
                      </span>
                      <span className="text-[11px] text-[#947C85] font-semibold">COP</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirModalCita(srv)}
                      className="min-h-[44px] px-4 py-2.5 rounded-2xl text-[#FAF7F5] font-sans text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer border-none"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Calendar size={14} />
                      <span>Agendar cita</span>
                    </button>

                    {enCarrito ? (
                      <div className="inline-flex items-center gap-1.5 bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl p-1">
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(enCarrito.key, -1)}
                          aria-label="Disminuir"
                          className="w-8 h-8 rounded-xl bg-white border border-[#EFE8E4] text-[#3B0D1E] flex items-center justify-center cursor-pointer"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-5 text-center font-mono text-xs font-bold tabular-nums text-[#3B0D1E]">
                          {enCarrito.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(enCarrito.key, 1)}
                          aria-label="Aumentar"
                          className="w-8 h-8 rounded-xl bg-white border border-[#EFE8E4] text-[#3B0D1E] flex items-center justify-center cursor-pointer"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => agregarServicio(srv)}
                        className="min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-[#FAF7F5] hover:bg-[#F5EBE8] border border-[#EFE8E4] text-[#3B0D1E] font-sans text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Al resumen</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )
        ) : productosFiltrados.length === 0 ? (
          <section className="bg-white rounded-3xl border border-[#EFE8E4] p-8 text-center shadow-velvet">
            <Package size={24} className="text-[#947C85] mx-auto mb-2.5" />
            <h2 className="m-0 font-sans text-base font-bold text-[#3B0D1E]">
              Aún no hay productos publicados en tienda
            </h2>
            <p className="m-0 mt-1 text-xs text-[#6B535C]">
              Explora nuestros servicios en la pestaña contigua o escríbenos para asesoría personalizada.
            </p>
          </section>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {productosFiltrados.map((prod) => {
              const varianteActual = obtenerVarianteSeleccionada(prod);
              const precioActual = resolverPrecioVariante(prod.priceCop, varianteActual);
              const keyCarrito = `product:${prod.id}:${varianteActual?.id ?? 'base'}`;
              const enCarrito = carrito.find((it) => it.key === keyCarrito);
              const agotado = !prod.inStock || varianteActual?.inStock === false;

              return (
                <article
                  key={prod.id}
                  className="bg-white rounded-3xl border border-[#EFE8E4] p-5 shadow-velvet flex flex-col justify-between gap-4"
                >
                  <div>
                    {prod.imageUrl && (
                      <div className="w-full h-44 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] overflow-hidden mb-3.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                        {prod.category}
                      </span>
                      {agotado && (
                        <span className="px-2 py-0.5 rounded-full bg-[#FFF7F5] border border-[#D97757]/30 text-[#D97757] text-[10px] font-bold">
                          Agotado
                        </span>
                      )}
                    </div>

                    <h2 className="m-0 font-sans text-base font-bold tracking-tight text-[#3B0D1E] leading-snug">
                      {prod.name}
                    </h2>

                    {prod.description && (
                      <p className="m-0 mt-1.5 text-xs text-[#6B535C] leading-relaxed line-clamp-2">
                        {prod.description}
                      </p>
                    )}

                    {prod.variants.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {prod.variants.map((v) => {
                          const activa = varianteActual?.id === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={v.inStock === false}
                              onClick={() =>
                                setVariantePorProducto((prev) => ({
                                  ...prev,
                                  [prod.id]: v.id,
                                }))
                              }
                              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold tabular-nums border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                activa
                                  ? 'bg-[#F5EBE8] text-[#3B0D1E] border-[#3B0D1E]'
                                  : 'bg-[#FAF7F5] text-[#6B535C] border-[#EFE8E4] hover:border-[#E8CFC8]'
                              }`}
                            >
                              {v.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#EFE8E4] flex items-center justify-between gap-3">
                    <div className="font-display text-xl font-bold text-[#3B0D1E] tabular-nums">
                      {formatearPrecioCop(precioActual)}
                    </div>

                    {enCarrito ? (
                      <div className="inline-flex items-center gap-1.5 bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl p-1">
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(keyCarrito, -1)}
                          aria-label="Restar unidad"
                          className="w-8 h-8 rounded-xl bg-white border border-[#EFE8E4] text-[#3B0D1E] flex items-center justify-center cursor-pointer"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center font-mono text-xs font-bold tabular-nums text-[#3B0D1E]">
                          {enCarrito.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(keyCarrito, 1)}
                          aria-label="Sumar unidad"
                          className="w-8 h-8 rounded-xl bg-white border border-[#EFE8E4] text-[#3B0D1E] flex items-center justify-center cursor-pointer"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={agotado}
                        onClick={() => agregarProducto(prod)}
                        className="min-h-[40px] px-4 py-2 rounded-2xl text-[#FAF7F5] font-sans text-xs font-bold inline-flex items-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-none"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <Plus size={14} />
                        <span>Agregar</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <footer className="pt-8 pb-4 text-center space-y-1.5">
          {data.brand.legalFooter && (
            <p className="m-0 text-[11px] text-[#6B535C] leading-relaxed">
              {data.brand.legalFooter}
            </p>
          )}
          {data.organization.conMarcaVelli && (
            <p className="m-0 font-sans text-[11px] text-[#947C85]">
              Vitrina digital con respaldo de Velli · {appHost}
            </p>
          )}
        </footer>
      </main>

      {/* Barra Flotante Minimalista de Carrito */}
      {totalUnidades > 0 && !drawerAbierto && !servicioAgendando && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4">
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => {
                setPedidoConfirmado(null);
                setErrorCheckout(null);
                setDrawerAbierto(true);
              }}
              className="w-full min-h-[56px] px-5 py-3.5 rounded-3xl text-[#FAF7F5] shadow-velvet flex items-center justify-between gap-3 cursor-pointer border-none transition-transform active:scale-[0.99]"
              style={{ backgroundColor: primaryColor }}
            >
              <span className="inline-flex items-center gap-2.5 font-sans text-sm font-bold">
                <span className="w-7 h-7 rounded-xl bg-white/15 font-mono text-xs font-bold tabular-nums flex items-center justify-center">
                  {totalUnidades}
                </span>
                <span>Ver resumen y pedir por WhatsApp</span>
              </span>
              <span className="font-display text-lg font-bold tabular-nums">
                {formatearPrecioCop(totalCarritoCop)}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Solicitud de Cita (Servicio → Especialista → Fecha/Hora → Confirmación) */}
      {servicioAgendando && (
        <div
          onClick={() => !guardandoCita && setServicioAgendando(null)}
          className="fixed inset-0 z-50 bg-[#1F050F]/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl border border-[#EFE8E4] p-6 sm:p-7 shadow-velvet pb-safe"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
                  {citaConfirmada ? 'Solicitud registrada' : 'Reserva de cita en línea'}
                </span>
                <h2 className="m-0 font-display text-2xl font-semibold tracking-tight text-[#3B0D1E]">
                  {servicioAgendando.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setServicioAgendando(null)}
                aria-label="Cerrar reserva"
                className="w-9 h-9 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] text-[#6B535C] hover:text-[#3B0D1E] flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {citaConfirmada ? (
              <div className="space-y-4 text-center py-3">
                <div className="w-14 h-14 rounded-2xl bg-[#F0FDFA] border border-[#0D9488]/25 text-[#0D9488] flex items-center justify-center mx-auto">
                  <Check size={26} />
                </div>
                <div className="space-y-1">
                  <p className="m-0 font-sans text-sm font-bold text-[#3B0D1E]">
                    {citaConfirmada.specialistName} · {citaConfirmada.dateLabel} a las{' '}
                    <span className="font-mono tabular-nums">{citaConfirmada.timeLabel}</span>
                  </p>
                  <p className="m-0 text-xs text-[#6B535C] leading-relaxed">
                    Tu solicitud ya quedó agendada en el salón. Confírmala en un toque por WhatsApp.
                  </p>
                </div>
                <a
                  href={citaConfirmada.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl text-[#FAF7F5] font-sans text-sm font-bold inline-flex items-center justify-center gap-2 no-underline"
                  style={{ backgroundColor: primaryColor }}
                >
                  <MessageCircle size={17} />
                  <span>Confirmar cita por WhatsApp</span>
                </a>
              </div>
            ) : (
              <form onSubmit={confirmarSolicitudCita} className="space-y-4">
                {/* 1. Fecha */}
                <label className="block">
                  <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                    1. Elige la fecha (hora Colombia)
                  </span>
                  <input
                    type="date"
                    min={hoyBogota}
                    value={fechaCita}
                    onChange={(e) => setFechaCita(e.target.value)}
                    className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#3B0D1E]"
                  />
                </label>

                {/* 2. Especialista */}
                <div>
                  <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1.5">
                    2. Especialista
                  </span>
                  {cargandoSlots ? (
                    <div className="skeleton-shimmer h-11 rounded-2xl" />
                  ) : especialistasAgenda.length === 0 ? (
                    <p className="m-0 text-xs text-[#6B535C] p-3 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4]">
                      No hay especialistas activas para agendar en línea en este momento.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {especialistasAgenda.map((sp) => {
                        const activa = specialistIdElegida === sp.id;
                        return (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => {
                              setSpecialistIdElegida(sp.id);
                              setHoraElegida('');
                            }}
                            className={`min-h-[40px] px-3.5 py-2 rounded-2xl text-xs font-bold inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
                              activa
                                ? 'text-[#FAF7F5] border-transparent'
                                : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:bg-[#F5EBE8]'
                            }`}
                            style={activa ? { backgroundColor: primaryColor } : undefined}
                          >
                            <UserCheck size={13} />
                            <span>{sp.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Horas disponibles */}
                {especialistaActual && (
                  <div>
                    <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1.5">
                      3. Hora disponible
                    </span>
                    {especialistaActual.slots.length === 0 ? (
                      <p className="m-0 text-xs text-[#6B535C] p-3 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4]">
                        Sin cupos disponibles en esta fecha. Prueba seleccionando otro día.
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                        {especialistaActual.slots.map((slot) => {
                          const activo = horaElegida === slot.label;
                          return (
                            <button
                              key={slot.label}
                              type="button"
                              onClick={() => setHoraElegida(slot.label)}
                              className={`min-h-[38px] py-1.5 px-2 rounded-xl font-mono text-xs font-semibold tabular-nums border transition-all cursor-pointer ${
                                activo
                                  ? 'text-[#FAF7F5] border-transparent'
                                  : 'bg-[#FAF7F5] text-[#3B0D1E] border-[#EFE8E4] hover:border-[#E8CFC8]'
                              }`}
                              style={activo ? { backgroundColor: primaryColor } : undefined}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Datos de contacto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="block">
                    <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                      Tu nombre *
                    </span>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={citaNombre}
                      onChange={(e) => setCitaNombre(e.target.value)}
                      placeholder="Nombre y apellido"
                      className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E]"
                    />
                  </label>

                  <label className="block">
                    <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                      Tu WhatsApp *
                    </span>
                    <input
                      type="tel"
                      required
                      value={citaTelefono}
                      onChange={(e) => setCitaTelefono(e.target.value)}
                      placeholder="300 123 4567"
                      className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#3B0D1E]"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                    Comentario opcional
                  </span>
                  <input
                    type="text"
                    maxLength={300}
                    value={citaNotas}
                    onChange={(e) => setCitaNotas(e.target.value)}
                    placeholder="Ej. Tengo tinte previo o largo medio"
                    className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E]"
                  />
                </label>

                {errorCita && (
                  <div className="p-3 rounded-2xl bg-[#FFF7F5] border border-[#D97757]/35 text-xs font-semibold text-[#D97757]">
                    {errorCita}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={guardandoCita || !horaElegida || !especialistaActual}
                  className="w-full min-h-[50px] py-3.5 px-5 rounded-2xl text-[#FAF7F5] font-sans text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border-none"
                  style={{ backgroundColor: primaryColor }}
                >
                  <MessageCircle size={17} />
                  <span>
                    {guardandoCita ? 'Reservando cupo…' : 'Confirmar cita y abrir WhatsApp'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Drawer / Modal de Resumen de Carrito y Envío a WhatsApp */}
      {(drawerAbierto || pedidoConfirmado) && (
        <div
          onClick={() => {
            if (!enviando) {
              setDrawerAbierto(false);
              setPedidoConfirmado(null);
            }
          }}
          className="fixed inset-0 z-50 bg-[#1F050F]/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl border border-[#EFE8E4] p-6 sm:p-7 shadow-velvet pb-safe"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
                  {pedidoConfirmado ? 'Pedido registrado' : 'Resumen de solicitud'}
                </span>
                <h2 className="m-0 font-display text-2xl font-semibold tracking-tight text-[#3B0D1E]">
                  {pedidoConfirmado ? '¡Listo para enviar!' : data.brand.displayName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrawerAbierto(false);
                  setPedidoConfirmado(null);
                }}
                aria-label="Cerrar"
                className="w-9 h-9 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] text-[#6B535C] hover:text-[#3B0D1E] flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {pedidoConfirmado ? (
              <div className="space-y-4 text-center py-3">
                <div className="w-14 h-14 rounded-2xl bg-[#F0FDFA] border border-[#0D9488]/25 text-[#0D9488] flex items-center justify-center mx-auto">
                  <Check size={26} />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] text-[#3B0D1E] tabular-nums">
                    {pedidoConfirmado.orderCode}
                  </span>
                  <p className="mt-3 mb-0 text-sm text-[#6B535C] leading-relaxed">
                    Registramos tu solicitud por{' '}
                    <strong className="text-[#3B0D1E] tabular-nums">
                      {formatearPrecioCop(pedidoConfirmado.totalCop)} COP
                    </strong>
                    . Si WhatsApp no se abrió automáticamente, toca el botón para continuar.
                  </p>
                </div>
                <a
                  href={pedidoConfirmado.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl text-[#FAF7F5] font-sans text-sm font-bold inline-flex items-center justify-center gap-2 no-underline"
                  style={{ backgroundColor: primaryColor }}
                >
                  <MessageCircle size={17} />
                  <span>Abrir conversación en WhatsApp</span>
                </a>
              </div>
            ) : (
              <form onSubmit={confirmarPedidoWhatsApp} className="space-y-5">
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {carrito.map((it) => (
                    <div
                      key={it.key}
                      className="p-3.5 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-sans text-xs sm:text-sm font-bold text-[#3B0D1E] truncate">
                          {it.name}
                        </div>
                        <div className="font-mono text-[11px] text-[#6B535C] tabular-nums mt-0.5">
                          {it.variantLabel ? `${it.variantLabel} · ` : ''}
                          {formatearPrecioCop(it.unitPriceCop)} c/u
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(it.key, -1)}
                          aria-label="Restar"
                          className="w-7 h-7 rounded-lg bg-white border border-[#EFE8E4] text-[#3B0D1E] flex items-center justify-center cursor-pointer"
                        >
                          {it.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                        </button>
                        <span className="w-5 text-center font-mono text-xs font-bold tabular-nums">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(it.key, 1)}
                          aria-label="Sumar"
                          className="w-7 h-7 rounded-lg bg-white border border-[#EFE8E4] text-[#3B0D1E] flex items-center justify-center cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] flex items-center justify-between">
                  <span className="font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                    {tipoPedidoInferido === 'service_inquiry'
                      ? 'Total orientativo'
                      : 'Total del pedido'}
                  </span>
                  <span className="font-display text-2xl font-bold text-[#3B0D1E] tabular-nums">
                    {formatearPrecioCop(totalCarritoCop)}
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                      Tu nombre *
                    </span>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ej. Valentina Gómez"
                      className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E] font-sans placeholder-[#947C85]"
                    />
                  </label>

                  <label className="block">
                    <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                      Tu WhatsApp / Celular *
                    </span>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Ej. 300 123 4567"
                      className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E] font-mono tabular-nums placeholder-[#947C85]"
                    />
                  </label>

                  <label className="block">
                    <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                      Notas opcionales (día sugerido, dirección o comentario)
                    </span>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Opcional…"
                      className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E] font-sans placeholder-[#947C85] resize-none"
                    />
                  </label>
                </div>

                {errorCheckout && (
                  <div className="p-3 rounded-2xl bg-[#FFF7F5] border border-[#D97757]/35 text-xs font-semibold text-[#D97757]">
                    {errorCheckout}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={enviando || carrito.length === 0}
                  className="w-full min-h-[50px] py-3.5 px-5 rounded-2xl text-[#FAF7F5] font-sans text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border-none"
                  style={{ backgroundColor: primaryColor }}
                >
                  <MessageCircle size={17} />
                  <span>
                    {enviando ? 'Generando código de pedido…' : 'Confirmar y enviar por WhatsApp'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
