import BannerPlaceholder from '@/components/legal/BannerPlaceholder';
import CorreoSoporte from '@/components/legal/CorreoSoporte';

export const metadata = {
  title: 'Política de privacidad — Veli',
};

export default function PrivacidadPage() {
  return (
    <article className="bg-white rounded-xl border border-[#E4E4E7] p-6 sm:p-8">
      <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] mb-1.5">
        Política de privacidad
      </h1>
      <p className="text-xs text-[#71717A] mb-6">Última actualización: noviembre 2026</p>

      <BannerPlaceholder />

      <div className="flex flex-col gap-5 text-sm text-[#52525B] leading-relaxed [&_strong]:text-[#111111] [&_code]:font-mono [&_code]:text-xs [&_code]:bg-[#F4F4F5] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[#111111]">
        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            1. Quiénes somos
          </h2>
          <p>
            Veli es una plataforma de gestión operativa y estimación financiera para estudios y
            negocios de belleza. Esta política explica qué datos recopilamos, cómo los usamos y qué
            derechos tienes sobre ellos según la Ley Estatutaria 1581 de 2012 de Colombia (Habeas
            Data) y normas equivalentes.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            2. Datos que recopilamos
          </h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><strong>De tu cuenta:</strong> nombre, correo, nombre del estudio, teléfono y ciudad.</li>
            <li>
              <strong>De tus clientes:</strong> nombre, edad, contacto, datos de diagnóstico
              (alergias, condiciones, medicamentos, historial técnico) y fotografías capturadas con
              consentimiento dentro de la aplicación.
            </li>
            <li>
              <strong>De diagnósticos:</strong> tipo de fibra, porosidad, densidad, historial de
              tratamientos, notas profesionales, fechas de citas y resultado del análisis con IA.
            </li>
            <li>
              <strong>De cotizaciones y operación del estudio:</strong> servicios, plantillas de
              precios, especialistas, productos con precios de compra, comisiones, valores cotizados
              y valores cobrados.
            </li>
            <li>
              <strong>Técnicos:</strong> sesión autenticada y registros mínimos para mantener la
              plataforma funcionando de forma segura.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            3. Cómo usamos los datos y enlaces públicos de cotización
          </h2>
          <p>
            Usamos los datos exclusivamente para prestarte el servicio: mostrar tu información,
            generar el diagnóstico orientativo y las estimaciones del estudio, guardar el historial
            y permitirte exportar respaldos. Los datos se almacenan cifrados en servidores
            gestionados por Supabase. <strong>No los vendemos ni los compartimos con anunciantes.</strong>
          </p>
          <p className="mt-2">
            <strong>Enlaces públicos de cotización (<code>/c/&lt;token&gt;</code>):</strong> al
            generar y enviar una cotización se crea un enlace único con un identificador aleatorio
            que puedes compartir por WhatsApp. Esa página pública muestra{' '}
            <strong>exclusivamente</strong> el nombre del estudio, el servicio cotizado, el valor en
            COP y la fecha de vigencia, <strong>sin exponer en ningún caso el nombre del cliente,
            fotografías ni datos del diagnóstico o de salud capilar</strong>.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            4. Inteligencia artificial (Anthropic)
          </h2>
          <p>
            El análisis con IA envía las fotografías a la API de Anthropic (modelos Claude), que
            actúa como proveedor exclusivo de ese procesamiento, para validar la imagen y producir
            el análisis. Según sus condiciones comerciales vigentes para la API, Anthropic no
            utiliza estos datos para entrenar sus modelos. La fotografía se guarda en tu
            almacenamiento privado dentro de Veli; tú decides si conservarla o eliminarla.
          </p>
          <p className="mt-2">
            Supabase (almacenamiento) y Anthropic (IA) pueden procesar los datos en servidores
            ubicados fuera de Colombia.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            5. Aislamiento multi-tenant
          </h2>
          <p>
            Cada organización solo accede a sus propios registros gracias a políticas estrictas de
            seguridad a nivel de fila (Row Level Security). Ninguna otra cuenta puede consultar tus
            datos desde la aplicación.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            6. Tus derechos (Habeas Data)
          </h2>
          <p>Como titular o responsable del tratamiento puedes en cualquier momento:</p>
          <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
            <li>Conocer, actualizar y rectificar tus datos.</li>
            <li>Solicitar prueba de la autorización de tratamiento.</li>
            <li>Revocar la autorización o solicitar la supresión de los datos.</li>
            <li>Acceder gratuitamente a los datos que hayan sido objeto de tratamiento.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            7. Cómo eliminar tus datos
          </h2>
          <p>Puedes eliminar la información desde la propia aplicación:</p>
          <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
            <li>
              <strong>Un perfil individual:</strong> entra a la ficha correspondiente y usa la
              opción de eliminar para borrar su historial.
            </li>
            <li>
              <strong>Todos tus datos:</strong> ve a <em>Configuración → Respaldo y datos → Borrar
              todos los datos</em>. La acción es irreversible.
            </li>
            <li>
              <strong>Tu cuenta completa:</strong> escríbenos a <CorreoSoporte /> desde el correo
              registrado y la eliminamos en un plazo máximo de 15 días hábiles.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            8. Conservación y seguridad
          </h2>
          <p>
            Conservamos los datos mientras tu cuenta esté activa. Usamos cifrado en tránsito
            (HTTPS) y en reposo. Te recomendamos exportar respaldos periódicos desde{' '}
            <em>Configuración</em>.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            9. Contacto
          </h2>
          <p>
            Para ejercer tus derechos o resolver dudas escríbenos a <CorreoSoporte />.
          </p>
        </section>

        <p className="text-xs text-[#71717A] border-t border-[#E4E4E7] pt-4 mt-2">
          Borrador de trabajo: puede cambiar antes de la versión definitiva.
        </p>
      </div>
    </article>
  );
}
