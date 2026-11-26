'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  MessageCircle,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import VelvetTopHeader from '@/components/v2/VelvetTopHeader';
import VelvetImageUploader from '@/components/v2/VelvetImageUploader';
import { formatearPrecioCop } from '@/lib/cotizador/whatsapp';
import { APP_URL } from '@/lib/sitio';
import { showToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';
import { enlaceWhatsApp } from '@/lib/whatsapp';
import {
  actualizarCatalogProduct,
  actualizarEstadoPublicOrder,
  crearCatalogProduct,
  eliminarCatalogProduct,
  listarCatalogProductsOrg,
  listarPublicOrdersOrg,
  obtenerOrganizacionActivaPanel,
  puedeTransicionarEstadoPedido,
  type CatalogProduct,
  type CatalogProductVariant,
  type OrganizacionPanelResumen,
  type PublicOrder,
  type PublicOrderStatus,
  type VariantGroupKind,
} from '@/lib/vitrina';

const STATUS_META: Record<
  PublicOrderStatus,
  { label: string; classes: string }
> = {
  sent_to_whatsapp: {
    label: 'Enviado a WhatsApp',
    classes: 'bg-[#F5EBE8] text-[#3B0D1E] border-[#E8CFC8]',
  },
  confirmed: {
    label: 'Confirmado',
    classes: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
  },
  completed: {
    label: 'Completado',
    classes: 'bg-[#F0FDFA] text-[#0D9488] border-[#0D9488]/30',
  },
  cancelled: {
    label: 'Cancelado',
    classes: 'bg-[#FFF7F5] text-[#D97757] border-[#D97757]/30',
  },
};

export default function VitrinaPanelPage() {
  const [cargando, setCargando] = useState(true);
  const [org, setOrg] = useState<OrganizacionPanelResumen | null>(null);
  const [tab, setTab] = useState<'pedidos' | 'productos'>('pedidos');

  const [orders, setOrders] = useState<PublicOrder[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | PublicOrderStatus>('todos');
  const [actualizandoOrderId, setActualizandoOrderId] = useState<string | null>(null);

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [mostrarFormProducto, setMostrarFormProducto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardandoProducto, setGuardandoProducto] = useState(false);

  // Campos del formulario CRUD de `catalog_products`
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('Cuidado Capilar');
  const [prodPriceCop, setProdPriceCop] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodInStock, setProdInStock] = useState(true);
  const [prodActive, setProdActive] = useState(true);
  const [prodVariants, setProdVariants] = useState<CatalogProductVariant[]>([]);

  // Campos para agregar una variante rápida
  const [varLabel, setVarLabel] = useState('');
  const [varGroup, setVarGroup] = useState<VariantGroupKind>('ml');
  const [varPriceOverride, setVarPriceOverride] = useState('');

  const cargarTodo = useCallback(async () => {
    setCargando(true);
    try {
      const orgActiva = await obtenerOrganizacionActivaPanel();
      setOrg(orgActiva);
      if (orgActiva) {
        const [listaPedidos, listaProductos] = await Promise.all([
          listarPublicOrdersOrg(orgActiva.id),
          listarCatalogProductsOrg(orgActiva.id),
        ]);
        setOrders(listaPedidos);
        setProducts(listaProductos);
      }
    } catch (err) {
      console.error('[vitrina.panel]', err);
      showToast('No se pudo cargar la vitrina', 'error');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const esAdmin = org?.role === 'owner' || org?.role === 'manager';
  const urlPublicaVitrina = org ? `${APP_URL}/s/${org.slug}` : null;

  const copiarEnlaceVitrina = async () => {
    if (!urlPublicaVitrina) return;
    try {
      await navigator.clipboard.writeText(urlPublicaVitrina);
      showToast('Enlace de tu vitrina copiado', 'success');
    } catch {
      showToast('No se pudo copiar el enlace', 'error');
    }
  };

  const pedidosFiltrados = useMemo(
    () =>
      filtroEstado === 'todos'
        ? orders
        : orders.filter((o) => o.status === filtroEstado),
    [orders, filtroEstado]
  );

  const cambiarEstadoPedido = async (order: PublicOrder, next: PublicOrderStatus) => {
    if (!esAdmin || !puedeTransicionarEstadoPedido(order.status, next)) return;
    setActualizandoOrderId(order.id);
    try {
      const actualizado = await actualizarEstadoPublicOrder(order.id, next);
      setOrders((prev) => prev.map((o) => (o.id === actualizado.id ? actualizado : o)));
      showToast(`Pedido ${order.orderCode} actualizado`, 'success');
    } catch (err) {
      console.error('[vitrina.order.status]', err);
      showToast('No se pudo actualizar el estado del pedido', 'error');
    } finally {
      setActualizandoOrderId(null);
    }
  };

  const limpiarFormularioProducto = () => {
    setEditandoId(null);
    setProdName('');
    setProdCategory('Cuidado Capilar');
    setProdPriceCop('');
    setProdDescription('');
    setProdImageUrl('');
    setProdInStock(true);
    setProdActive(true);
    setProdVariants([]);
    setVarLabel('');
    setVarPriceOverride('');
  };

  const iniciarEdicionProducto = (prod: CatalogProduct) => {
    setEditandoId(prod.id);
    setProdName(prod.name);
    setProdCategory(prod.category);
    setProdPriceCop(String(prod.priceCop));
    setProdDescription(prod.description ?? '');
    setProdImageUrl(prod.imageUrl ?? '');
    setProdInStock(prod.inStock);
    setProdActive(prod.active);
    setProdVariants(prod.variants);
    setMostrarFormProducto(true);
  };

  const agregarVarianteForm = () => {
    const etiqueta = varLabel.trim();
    if (!etiqueta) return;
    const precioNum = Number(varPriceOverride.replace(/\D/g, ''));
    const nueva: CatalogProductVariant = {
      id: `var-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      label: etiqueta,
      group: varGroup,
      ...(varPriceOverride.trim() && Number.isFinite(precioNum) && precioNum >= 0
        ? { priceOverrideCop: precioNum }
        : {}),
      inStock: true,
    };
    setProdVariants((prev) => [...prev, nueva]);
    setVarLabel('');
    setVarPriceOverride('');
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org || !esAdmin || guardandoProducto) return;

    const nombreLimpio = prodName.trim();
    const precioLimpio = Number(prodPriceCop.replace(/\D/g, ''));
    if (!nombreLimpio) {
      showToast('Escribe el nombre del producto', 'error');
      return;
    }
    if (!Number.isFinite(precioLimpio) || precioLimpio < 0) {
      showToast('Ingresa un precio válido en COP', 'error');
      return;
    }

    setGuardandoProducto(true);
    try {
      if (editandoId) {
        const actualizado = await actualizarCatalogProduct(editandoId, {
          name: nombreLimpio,
          category: prodCategory,
          priceCop: precioLimpio,
          description: prodDescription,
          imageUrl: prodImageUrl,
          inStock: prodInStock,
          active: prodActive,
          variants: prodVariants,
        });
        setProducts((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)));
        showToast('Producto actualizado', 'success');
      } else {
        const creado = await crearCatalogProduct({
          organizationId: org.id,
          name: nombreLimpio,
          category: prodCategory,
          priceCop: precioLimpio,
          description: prodDescription,
          imageUrl: prodImageUrl,
          inStock: prodInStock,
          active: prodActive,
          variants: prodVariants,
          sortOrder: products.length,
        });
        setProducts((prev) => [creado, ...prev]);
        showToast('Producto publicado en tu vitrina', 'success');
      }
      limpiarFormularioProducto();
      setMostrarFormProducto(false);
    } catch (err) {
      console.error('[vitrina.product.save]', err);
      showToast('No se pudo guardar el producto', 'error');
    } finally {
      setGuardandoProducto(false);
    }
  };

  const toggleStockRapido = async (prod: CatalogProduct) => {
    if (!esAdmin) return;
    try {
      const actualizado = await actualizarCatalogProduct(prod.id, {
        inStock: !prod.inStock,
      });
      setProducts((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)));
      showToast(actualizado.inStock ? 'Marcado en stock' : 'Marcado agotado', 'success');
    } catch {
      showToast('No se pudo cambiar el stock', 'error');
    }
  };

  const borrarProducto = async (prod: CatalogProduct) => {
    if (!esAdmin) return;
    try {
      await eliminarCatalogProduct(prod.id);
      setProducts((prev) => prev.filter((p) => p.id !== prod.id));
      showToast('Producto eliminado del catálogo', 'success');
    } catch {
      showToast('No se pudo eliminar el producto', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F5] text-[#3B0D1E] font-sans pb-16">
      <VelvetTopHeader
        nombreSalon={org?.name}
        ciudadSalon={org?.city ?? undefined}
        rolOrganizacion={org?.role ?? null}
      />

      {/* Sub-header Vitrina & Pedidos Web */}
      <div className="border-b border-[#EFE8E4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
              Canal Digital · Conversión por WhatsApp
            </span>
            <h1 className="m-0 mt-0.5 font-display text-2xl md:text-3xl font-semibold tracking-tight text-[#3B0D1E]">
              Vitrina & Pedidos Web
            </h1>
          </div>

          {org && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copiarEnlaceVitrina}
                className="min-h-[42px] px-3.5 py-2 rounded-2xl bg-white hover:bg-[#F5EBE8] border border-[#EFE8E4] text-xs font-bold text-[#3B0D1E] inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy size={14} />
                <span className="font-mono text-[11px]">/s/{org.slug}</span>
              </button>

              <Link
                href={`/s/${org.slug}`}
                target="_blank"
                className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] text-xs font-bold inline-flex items-center gap-1.5 no-underline transition-colors"
              >
                <span>Ver vitrina pública</span>
                <ExternalLink size={13} />
              </Link>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Selector de sección */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#F5EBE8] border border-[#EFE8E4]">
            <button
              type="button"
              onClick={() => setTab('pedidos')}
              className={`min-h-[42px] px-4 py-2 rounded-xl font-sans text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer border-none ${
                tab === 'pedidos'
                  ? 'bg-[#3B0D1E] text-[#FAF7F5]'
                  : 'bg-transparent text-[#6B535C] hover:text-[#3B0D1E]'
              }`}
            >
              <MessageCircle size={14} />
              <span>Pedidos Web ({orders.length})</span>
            </button>

            {esAdmin && (
              <button
                type="button"
                onClick={() => setTab('productos')}
                className={`min-h-[42px] px-4 py-2 rounded-xl font-sans text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer border-none ${
                  tab === 'productos'
                    ? 'bg-[#3B0D1E] text-[#FAF7F5]'
                    : 'bg-transparent text-[#6B535C] hover:text-[#3B0D1E]'
                }`}
              >
                <ShoppingBag size={14} />
                <span>Catálogo Tienda ({products.length})</span>
              </button>
            )}
          </div>

          {tab === 'productos' && esAdmin && !mostrarFormProducto && (
            <button
              type="button"
              onClick={() => {
                limpiarFormularioProducto();
                setMostrarFormProducto(true);
              }}
              className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] font-sans text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border-none"
            >
              <Plus size={14} />
              <span>Nuevo producto</span>
            </button>
          )}
        </div>

        {cargando ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer h-28 rounded-3xl" />
            ))}
          </div>
        ) : !org ? (
          <section className="bg-white rounded-3xl border border-[#EFE8E4] p-8 text-center shadow-velvet">
            <h2 className="m-0 font-display text-2xl font-semibold text-[#3B0D1E]">
              Aún no hay organización activa
            </h2>
            <p className="mt-2 mb-0 text-sm text-[#6B535C] max-w-md mx-auto">
              Aplica las migraciones `migration-multitenant-rbac.sql` y `migration-vitrina-editorial.sql` en Supabase para habilitar la vitrina pública de tu salón.
            </p>
          </section>
        ) : tab === 'pedidos' ? (
          <div className="space-y-4">
            {/* Filtros por estado */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'todos', label: 'Todos' },
                  { key: 'sent_to_whatsapp', label: 'Por confirmar' },
                  { key: 'confirmed', label: 'Confirmados' },
                  { key: 'completed', label: 'Completados' },
                  { key: 'cancelled', label: 'Cancelados' },
                ] as const
              ).map((f) => {
                const activo = filtroEstado === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFiltroEstado(f.key)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      activo
                        ? 'bg-[#3B0D1E] text-[#FAF7F5] border-[#3B0D1E]'
                        : 'bg-white text-[#6B535C] border-[#EFE8E4] hover:bg-[#F5EBE8]'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {pedidosFiltrados.length === 0 ? (
              <section className="bg-white rounded-3xl border border-[#EFE8E4] p-10 text-center shadow-velvet">
                <MessageCircle size={26} className="text-[#947C85] mx-auto mb-3" />
                <h2 className="m-0 font-display text-xl font-semibold text-[#3B0D1E]">
                  Sin pedidos web en este filtro
                </h2>
                <p className="mt-1.5 mb-0 text-xs text-[#6B535C] max-w-sm mx-auto leading-relaxed">
                  Comparte el enlace público de tu vitrina en Instagram o WhatsApp para recibir pedidos con código único y desglose automático.
                </p>
              </section>
            ) : (
              <div className="space-y-3.5">
                {pedidosFiltrados.map((order) => {
                  const meta = STATUS_META[order.status];
                  const chatClienteUrl = enlaceWhatsApp(
                    order.customerPhone,
                    `Hola ${order.customerName}, te escribimos de ${org.name} sobre tu pedido ${order.orderCode}.`
                  );
                  const ocupado = actualizandoOrderId === order.id;

                  return (
                    <article
                      key={order.id}
                      className="bg-white rounded-3xl border border-[#EFE8E4] p-5 sm:p-6 shadow-velvet space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#FAF7F5] border border-[#EFE8E4] text-[#3B0D1E] tabular-nums">
                              {order.orderCode}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.classes}`}
                            >
                              {meta.label}
                            </span>
                            <span className="text-[11px] font-semibold text-[#947C85]">
                              ·{' '}
                              {order.orderType === 'service_inquiry'
                                ? 'Solicitud de servicio'
                                : 'Carrito de tienda'}
                            </span>
                          </div>

                          <h3 className="m-0 mt-2 font-sans text-base font-bold text-[#3B0D1E]">
                            {order.customerName}{' '}
                            <span className="font-mono text-xs font-normal text-[#6B535C] tabular-nums">
                              · {order.customerPhone}
                            </span>
                          </h3>
                          <span className="font-mono text-[11px] text-[#947C85] tabular-nums">
                            {formatDate(order.createdAt)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B535C] block">
                            Total
                          </span>
                          <div className="font-display text-2xl font-bold text-[#3B0D1E] tabular-nums">
                            {formatearPrecioCop(order.totalCop)}
                          </div>
                        </div>
                      </div>

                      {/* Ítems del pedido */}
                      <div className="rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] p-3.5 space-y-1.5">
                        {order.items.map((it, idx) => (
                          <div
                            key={`${order.id}-${idx}`}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="text-[#3B0D1E] font-medium">
                              <strong className="font-mono tabular-nums">{it.quantity}×</strong>{' '}
                              {it.name}
                              {it.variantLabel && (
                                <span className="text-[#6B535C]"> ({it.variantLabel})</span>
                              )}
                            </span>
                            <span className="font-mono font-semibold text-[#3B0D1E] tabular-nums shrink-0">
                              {formatearPrecioCop(it.lineTotalCop)}
                            </span>
                          </div>
                        ))}
                        {order.notes && (
                          <p className="m-0 pt-2 border-t border-[#EFE8E4] text-xs text-[#6B535C]">
                            <strong className="text-[#3B0D1E]">Nota:</strong> {order.notes}
                          </p>
                        )}
                      </div>

                      {/* Acciones operativas */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {chatClienteUrl ? (
                          <a
                            href={chatClienteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FAF7F5] hover:bg-[#F5EBE8] border border-[#EFE8E4] text-xs font-bold text-[#3B0D1E] inline-flex items-center gap-1.5 no-underline transition-colors"
                          >
                            <MessageCircle size={14} />
                            <span>Responder en WhatsApp</span>
                          </a>
                        ) : (
                          <span />
                        )}

                        {esAdmin && (
                          <div className="flex flex-wrap items-center gap-2">
                            {puedeTransicionarEstadoPedido(order.status, 'confirmed') && (
                              <button
                                type="button"
                                disabled={ocupado}
                                onClick={() => cambiarEstadoPedido(order, 'confirmed')}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border-none"
                              >
                                <Check size={14} />
                                <span>Confirmar</span>
                              </button>
                            )}
                            {puedeTransicionarEstadoPedido(order.status, 'completed') && (
                              <button
                                type="button"
                                disabled={ocupado}
                                onClick={() => cambiarEstadoPedido(order, 'completed')}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0D9488] hover:opacity-95 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border-none"
                              >
                                <CheckCircle2 size={14} />
                                <span>Completado</span>
                              </button>
                            )}
                            {puedeTransicionarEstadoPedido(order.status, 'cancelled') && (
                              <button
                                type="button"
                                disabled={ocupado}
                                onClick={() => cambiarEstadoPedido(order, 'cancelled')}
                                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FFF7F5] hover:bg-[#F5EBE8] border border-[#D97757]/30 text-[#D97757] text-xs font-bold cursor-pointer disabled:opacity-50"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {mostrarFormProducto && esAdmin && (
              <form
                onSubmit={guardarProducto}
                className="bg-white rounded-3xl border border-[#EFE8E4] p-6 shadow-velvet space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="m-0 font-display text-xl font-semibold text-[#3B0D1E]">
                    {editandoId ? 'Editar producto' : 'Nuevo producto de tienda'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      limpiarFormularioProducto();
                      setMostrarFormProducto(false);
                    }}
                    className="w-8 h-8 rounded-full bg-[#FAF7F5] border border-[#EFE8E4] text-[#6B535C] flex items-center justify-center cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <label className="block sm:col-span-2">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                      Nombre comercial *
                    </span>
                    <input
                      type="text"
                      required
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="Ej. Shampoo Nutritivo Sin Sulfatos"
                      className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E]"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                      Precio público COP *
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      required
                      value={prodPriceCop}
                      onChange={(e) => setProdPriceCop(e.target.value)}
                      placeholder="65000"
                      className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#3B0D1E]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                  <label className="block">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                      Categoría
                    </span>
                    <input
                      type="text"
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                      placeholder="Cuidado Capilar, Styling, Kits…"
                      className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E]"
                    />
                  </label>

                  <VelvetImageUploader
                    organizationId={org.id}
                    folder="products"
                    label="Fotografía del producto"
                    helperText="JPG, PNG o WebP · máx. 3 MB"
                    shape="landscape"
                    value={prodImageUrl || null}
                    onChange={(nextUrl) => setProdImageUrl(nextUrl ?? '')}
                    disabled={guardandoProducto}
                  />
                </div>

                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C] mb-1">
                    Descripción breve
                  </span>
                  <textarea
                    rows={2}
                    maxLength={600}
                    value={prodDescription}
                    onChange={(e) => setProdDescription(e.target.value)}
                    placeholder="Beneficios principales y modo de uso en casa…"
                    className="w-full bg-[#FAF7F5] border border-[#EFE8E4] rounded-2xl px-3.5 py-2.5 text-sm text-[#3B0D1E] resize-none"
                  />
                </label>

                {/* Variantes opcionales */}
                <div className="p-4 rounded-2xl bg-[#FAF7F5] border border-[#EFE8E4] space-y-3">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B535C]">
                    Variantes opcionales (ml / talla / aroma / presentación)
                  </span>

                  {prodVariants.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {prodVariants.map((v) => (
                        <span
                          key={v.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-[#EFE8E4] font-mono text-xs text-[#3B0D1E] tabular-nums"
                        >
                          {v.label}
                          {v.priceOverrideCop !== undefined &&
                            ` · ${formatearPrecioCop(v.priceOverrideCop)}`}
                          <button
                            type="button"
                            onClick={() =>
                              setProdVariants((prev) => prev.filter((x) => x.id !== v.id))
                            }
                            aria-label={`Quitar variante ${v.label}`}
                            className="p-0.5 bg-transparent border-none text-[#947C85] hover:text-[#D97757] cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select
                      value={varGroup}
                      onChange={(e) => setVarGroup(e.target.value as VariantGroupKind)}
                      className="bg-white border border-[#EFE8E4] rounded-xl px-3 py-2 text-xs text-[#3B0D1E]"
                    >
                      <option value="ml">Mililitros (ml)</option>
                      <option value="presentacion">Presentación</option>
                      <option value="aroma">Aroma</option>
                      <option value="talla">Talla</option>
                    </select>
                    <input
                      type="text"
                      value={varLabel}
                      onChange={(e) => setVarLabel(e.target.value)}
                      placeholder="Ej. 250 ml"
                      className="bg-white border border-[#EFE8E4] rounded-xl px-3 py-2 text-xs text-[#3B0D1E]"
                    />
                    <input
                      type="number"
                      min={0}
                      value={varPriceOverride}
                      onChange={(e) => setVarPriceOverride(e.target.value)}
                      placeholder="Precio COP variante (opc.)"
                      className="bg-white border border-[#EFE8E4] rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-[#3B0D1E]"
                    />
                    <button
                      type="button"
                      onClick={agregarVarianteForm}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-[#F5EBE8] border border-[#E8CFC8] text-xs font-bold text-[#3B0D1E] cursor-pointer"
                    >
                      + Añadir variante
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-4 text-xs font-semibold text-[#3B0D1E]">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prodInStock}
                        onChange={(e) => setProdInStock(e.target.checked)}
                      />
                      <span>Disponible en stock</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prodActive}
                        onChange={(e) => setProdActive(e.target.checked)}
                      />
                      <span>Visible en vitrina</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        limpiarFormularioProducto();
                        setMostrarFormProducto(false);
                      }}
                      className="min-h-[42px] px-4 py-2 rounded-2xl bg-white border border-[#EFE8E4] text-xs font-bold text-[#6B535C] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoProducto}
                      className="min-h-[42px] px-5 py-2 rounded-2xl bg-[#3B0D1E] hover:bg-[#52142B] text-[#FAF7F5] text-xs font-bold cursor-pointer disabled:opacity-60 border-none"
                    >
                      {guardandoProducto ? 'Guardando…' : 'Guardar producto'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {products.length === 0 ? (
              <section className="bg-white rounded-3xl border border-[#EFE8E4] p-10 text-center shadow-velvet">
                <Package size={26} className="text-[#947C85] mx-auto mb-3" />
                <h2 className="m-0 font-display text-xl font-semibold text-[#3B0D1E]">
                  Tu catálogo de tienda está vacío
                </h2>
                <p className="mt-1.5 mb-0 text-xs text-[#6B535C] max-w-sm mx-auto leading-relaxed">
                  Agrega shampoos, mascarillas o kits de mantenimiento en casa para vender por WhatsApp desde tu vitrina pública.
                </p>
              </section>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((prod) => (
                  <article
                    key={prod.id}
                    className="bg-white rounded-3xl border border-[#EFE8E4] p-5 shadow-velvet flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-[#6B535C]">
                          {prod.category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              prod.inStock
                                ? 'bg-[#F0FDFA] text-[#0D9488] border-[#0D9488]/25'
                                : 'bg-[#FFF7F5] text-[#D97757] border-[#D97757]/30'
                            }`}
                          >
                            {prod.inStock ? 'En stock' : 'Agotado'}
                          </span>
                          {!prod.active && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF7F5] text-[#947C85] border border-[#EFE8E4]">
                              Oculto
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5">
                        {prod.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-16 h-16 rounded-2xl object-cover border border-[#EFE8E4] shrink-0 bg-[#FAF7F5]"
                          />
                        )}
                        <div className="min-w-0">
                          <h3 className="m-0 font-sans text-base font-bold text-[#3B0D1E]">
                            {prod.name}
                          </h3>
                          <div className="mt-1 font-display text-xl font-bold text-[#3B0D1E] tabular-nums">
                            {formatearPrecioCop(prod.priceCop)}
                          </div>
                        </div>
                      </div>

                      {prod.variants.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {prod.variants.map((v) => (
                            <span
                              key={v.id}
                              className="px-2 py-0.5 rounded-lg bg-[#FAF7F5] border border-[#EFE8E4] font-mono text-[11px] text-[#6B535C] tabular-nums"
                            >
                              {v.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {esAdmin && (
                      <div className="pt-3 border-t border-[#EFE8E4] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStockRapido(prod)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#FAF7F5] hover:bg-[#F5EBE8] border border-[#EFE8E4] text-xs font-bold text-[#3B0D1E] cursor-pointer"
                        >
                          {prod.inStock ? 'Marcar agotado' : 'Activar stock'}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => iniciarEdicionProducto(prod)}
                            aria-label={`Editar ${prod.name}`}
                            className="w-9 h-9 rounded-xl bg-[#FAF7F5] hover:bg-[#F5EBE8] border border-[#EFE8E4] text-[#3B0D1E] flex items-center justify-center cursor-pointer"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => borrarProducto(prod)}
                            aria-label={`Eliminar ${prod.name}`}
                            className="w-9 h-9 rounded-xl bg-[#FFF7F5] hover:bg-[#F5EBE8] border border-[#D97757]/30 text-[#D97757] flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
