function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function ContenidoConsentimientoQuimico() {
  return (
    <div className="flex flex-col gap-5 text-sm text-[#52525B] leading-relaxed">
      <Seccion titulo="1. Naturaleza del servicio">
        <p>
          Autorizo la realización de servicios químicos capilares (decoloración,
          aclaración, tintura u otros procesos oxidativos) por parte del estudio,
          entendiendo que involucran productos químicos profesionales cuyo
          resultado depende del historial y estado de mi fibra capilar.
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
          Entiendo que la aplicación la decide y ejecuta el especialista
          profesional («Veli orienta la formulación y el diseño; el especialista
          decide y ejecuta») y que puedo retirar este consentimiento antes de
          iniciar el servicio.
        </p>
      </Seccion>
      <p className="text-xs text-[#71717A] border-t border-[#E4E4E7] pt-4 mt-2">
        Borrador de trabajo del Paquete Legal — pendiente del texto definitivo
        de asesoría legal.
      </p>
    </div>
  );
}

export function ContenidoConsentimientoImagenes() {
  return (
    <div className="flex flex-col gap-5 text-sm text-[#52525B] leading-relaxed">
      <Seccion titulo="1. Datos sensibles de salud">
        <p>
          Autorizo al estudio a capturar y almacenar fotografías de mi cabello y
          cuero cabelludo dentro de Veli, incluyendo el registro visual de
          diagnóstico y de servicios químicos. Entiendo que estas imágenes se
          consideran datos sensibles de salud bajo las legislaciones de
          protección de datos vigentes en Latinoamérica (Ley 1581 en Colombia,
          LGPD en Brasil o LFPDPPP en México).
        </p>
      </Seccion>
      <Seccion titulo="2. Finalidad y uso privado">
        <p>
          Las imágenes se usarán exclusivamente para mi diagnóstico, el
          seguimiento de mi historial técnico y, si aplica, el informe para
          evaluación dermatológica. No se publicarán ni compartirán con terceros
          fuera de ese fin privado sin una autorización adicional expresa.
        </p>
      </Seccion>
      <Seccion titulo="3. Derechos del titular">
        <p>
          Puedo solicitar en cualquier momento el acceso, la corrección o la
          eliminación de mis fotografías, y revocar esta autorización para
          capturas futuras, sin que ello afecte los servicios no fotográficos.
        </p>
      </Seccion>
      <Seccion titulo="4. Vigencia">
        <p>
          Esta autorización aplica a la versión del documento indicada al
          firmar. Si el texto cambia, el estudio solicitará una nueva firma
          antes de volver a activar la cámara en los módulos protegidos.
        </p>
      </Seccion>
      <p className="text-xs text-[#71717A] border-t border-[#E4E4E7] pt-4 mt-2">
        Borrador de trabajo del Paquete Legal — pendiente del texto definitivo
        de asesoría legal.
      </p>
    </div>
  );
}
