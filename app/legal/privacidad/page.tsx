import BannerPlaceholder from '@/components/legal/BannerPlaceholder';
import CorreoSoporte from '@/components/legal/CorreoSoporte';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

export const metadata = {
  title: 'Política de privacidad — Velli Pro',
};

export default function PrivacidadPage() {
  return (
    <article className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
      <h1 className="text-2xl text-[#2D5A27] mb-1" style={serif}>
        Política de privacidad
      </h1>
      <p className="text-xs text-[#999999] mb-6">Última actualización: octubre 2026</p>

      <BannerPlaceholder />

      <div className="flex flex-col gap-5 text-sm text-[#2D2D2D] leading-relaxed">
        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            1. Quiénes somos
          </h2>
          <p>
            Velli Pro es una herramienta de estimación administrativa y financiera para salones de
            belleza. Esta política explica qué datos recopilamos, cómo los usamos y qué derechos
            tienes sobre ellos según la Ley Estatutaria 1581 de 2012 de Colombia (Habeas Data) y
            normas equivalentes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            2. Datos que recopilamos
          </h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><strong>De tu cuenta:</strong> nombre, email, nombre del salón, teléfono, ciudad.</li>
            <li>
              <strong>De tus clientas:</strong> nombre, edad, contacto, datos de salud capilar
              (alergias, condiciones, medicamentos, embarazo, nivel de estrés) y fotografías del
              cabello que captures dentro de la app.
            </li>
            <li>
              <strong>De diagnósticos:</strong> tipo de rizo, porosidad, densidad, historial de
              tratamientos, notas profesionales, fechas de citas y resultado del análisis IA.
            </li>
            <li>
              <strong>De cotizaciones y operación del salón:</strong> servicios, plantillas de
              precios, estilistas, productos con sus precios de compra, comisiones, valores
              cotizados y valores cobrados.
            </li>
            <li>
              <strong>Técnicos:</strong> sesión autenticada y registros mínimos para mantener la
              app funcionando de forma segura.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            3. Cómo usamos los datos y enlaces públicos de cotización
          </h2>
          <p>
            Usamos los datos exclusivamente para prestarte el servicio: mostrar tu información,
            generar el diagnóstico orientativo y las estimaciones del salón, guardar el historial de
            tus clientas y permitirte exportar backups. Los datos se almacenan cifrados en
            servidores gestionados por Supabase. <strong>No los vendemos ni los compartimos con
            anunciantes.</strong>
          </p>
          <p className="mt-2">
            <strong>Enlaces públicos de cotización (<code>/c/&lt;token&gt;</code>):</strong> al
            generar y enviar una cotización se crea un enlace único con un identificador aleatorio
            que puedes compartir con tu clienta (por ejemplo, por WhatsApp). Esa página pública
            muestra <strong>exclusivamente</strong> el nombre del salón, el servicio cotizado, el
            valor en COP y la fecha de vigencia, <strong>sin exponer en ningún caso el nombre de la
            clienta, fotografías ni datos del diagnóstico o de salud capilar</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            4. Inteligencia artificial (Anthropic)
          </h2>
          <p>
            El análisis con IA envía las fotografías del cabello a la API de Anthropic (modelos
            Claude), que actúa como proveedor de ese procesamiento, para comprobar que muestran
            cabello y producir el análisis. Según sus condiciones comerciales vigentes para la API,
            Anthropic no utiliza estos datos para entrenar sus modelos. La fotografía se guarda en tu
            almacenamiento privado dentro de Velli Pro; tú decides si conservarla o eliminarla.
          </p>
          <p className="mt-2">
            Supabase (almacenamiento) y Anthropic (IA) pueden procesar los datos en servidores
            ubicados fuera de Colombia.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            5. Aislamiento multi-tenant
          </h2>
          <p>
            Cada estilista solo ve sus propias clientas y consultas gracias a políticas de
            seguridad a nivel de fila (Row Level Security). Ninguna otra cuenta puede acceder a
            tus datos desde la app.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            6. Tus derechos (Habeas Data)
          </h2>
          <p>Como titular o encargada de tratamiento puedes en cualquier momento:</p>
          <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
            <li>Conocer, actualizar y rectificar tus datos.</li>
            <li>Solicitar prueba de la autorización de tratamiento.</li>
            <li>Revocar la autorización o solicitar la supresión de los datos.</li>
            <li>Acceder gratuitamente a los datos que hayan sido objeto de tratamiento.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            7. Cómo eliminar tus datos
          </h2>
          <p>Puedes eliminar la información desde la propia app:</p>
          <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
            <li>
              <strong>Una clienta:</strong> entra al perfil de la clienta y usa el icono de
              eliminar. Borra la clienta y todo su historial.
            </li>
            <li>
              <strong>Todos tus datos:</strong> ve a <em>Configuración → Zona de peligro → Borrar
              todos los datos</em>. La acción es irreversible.
            </li>
            <li>
              <strong>Tu cuenta completa:</strong> escríbenos a <CorreoSoporte /> desde el email
              registrado y la eliminamos en un plazo máximo de 15 días hábiles.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            8. Conservación y seguridad
          </h2>
          <p>
            Conservamos los datos mientras tu cuenta esté activa. Usamos cifrado en tránsito
            (HTTPS) y en reposo. Aún así, ningún sistema es 100% infalible: te recomendamos
            exportar backups periódicos desde <em>Configuración → Datos</em>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            9. Contacto
          </h2>
          <p>
            Para ejercer tus derechos o resolver dudas escríbenos a <CorreoSoporte />.
          </p>
        </section>

        <p className="text-xs text-[#999999] italic border-t border-[#F0F0F0] pt-4 mt-2">
          Borrador de trabajo: puede cambiar antes de la versión definitiva.
        </p>
      </div>
    </article>
  );
}
