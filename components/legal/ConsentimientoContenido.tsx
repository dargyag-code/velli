// ══════════════════════════════════════════════════════════════════════════
// Cuerpos de los consentimientos informados por clienta.
//
// CONTENIDO PLACEHOLDER: borradores de trabajo basados en el Paquete Legal.
// Al publicar los textos definitivos, subir la
// versión en lib/legal.ts + public.legal_versiones y retirar el banner de
// cada página (app/legal/consentimiento-*).
//
// Se comparten entre las páginas /legal/consentimiento-* y el modal de firma
// en la ficha de la clienta, para que la clienta firme exactamente el texto
// publicado.
// ══════════════════════════════════════════════════════════════════════════

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function ContenidoConsentimientoQuimico() {
  return (
    <div className="flex flex-col gap-5 text-sm text-[#2D2D2D] leading-relaxed">
      <Seccion titulo="1. Naturaleza del servicio">
        <p>
          Autorizo la realización de servicios químicos capilares (decoloración,
          aclaración, tintura u otros procesos oxidativos) por parte del salón,
          entendiendo que involucran productos químicos profesionales cuyo
          resultado depende del historial y estado de mi cabello.
        </p>
      </Seccion>
      <Seccion titulo="2. Riesgos informados">
        <p>
          Declaro que se me informó sobre los riesgos asociados: sensibilización
          o irritación del cuero cabelludo, reacciones alérgicas, alteración de
          la fibra capilar, desviaciones de color y la posible necesidad de un
          plan multi-sesión. Entiendo que ocultar historial químico (henna,
          sales metálicas, alisados) puede producir reacciones adversas.
        </p>
      </Seccion>
      <Seccion titulo="3. Prueba de sensibilidad">
        <p>
          Se me explicó la prueba de sensibilidad cutánea (parche) exigida por
          los fabricantes, que debe aplicarse al menos 48 horas antes del
          servicio. Me comprometo a informar cualquier reacción durante la
          ventana de observación.
        </p>
      </Seccion>
      <Seccion titulo="4. Responsabilidad profesional">
        <p>
          Entiendo que la aplicación la decide y ejecuta la estilista
          profesional («Velli orienta la formulación y el diseño; el estilista
          decide y ejecuta») y que puedo retirar este consentimiento antes de
          iniciar el servicio.
        </p>
      </Seccion>
      <p className="text-xs text-[#999999] italic">
        Borrador de trabajo del Paquete Legal — pendiente del texto definitivo
        de la asesora legal.
      </p>
    </div>
  );
}

export function ContenidoConsentimientoImagenes() {
  return (
    <div className="flex flex-col gap-5 text-sm text-[#2D2D2D] leading-relaxed">
      <Seccion titulo="1. Datos sensibles de salud">
        <p>
          Autorizo al salón a capturar y almacenar fotografías de mi cabello y
          cuero cabelludo dentro de Velli Pro, incluyendo el registro visual del
          módulo de alopecia y de servicios químicos. Entiendo que estas
          imágenes se consideran datos sensibles de salud bajo las
          legislaciones de protección de datos vigentes en Latinoamérica (como
          la Ley 1581 en Colombia, la LGPD en Brasil o la LFPDPPP en México).
        </p>
      </Seccion>
      <Seccion titulo="2. Finalidad y uso privado">
        <p>
          Las imágenes se usarán exclusivamente para mi diagnóstico capilar, el
          seguimiento de mi historial (Pasaporte Capilar) y, si aplica, el
          informe técnico para mi dermatólogo. No se publicarán ni compartirán
          con terceros fuera de ese fin clínico/cosmético privado sin una
          autorización adicional expresa.
        </p>
      </Seccion>
      <Seccion titulo="3. Derechos de la titular">
        <p>
          Puedo solicitar en cualquier momento el acceso, la corrección o la
          eliminación de mis fotografías, y revocar esta autorización para
          capturas futuras, sin que ello afecte los servicios no fotográficos.
        </p>
      </Seccion>
      <Seccion titulo="4. Vigencia">
        <p>
          Esta autorización aplica a la versión del documento indicada al
          firmar. Si el texto cambia, el salón me pedirá una nueva firma antes
          de volver a activar la cámara en los módulos protegidos.
        </p>
      </Seccion>
      <p className="text-xs text-[#999999] italic">
        Borrador de trabajo del Paquete Legal — pendiente del texto definitivo
        de la asesora legal.
      </p>
    </div>
  );
}
