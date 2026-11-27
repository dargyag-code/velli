import BannerPlaceholder from '@/components/legal/BannerPlaceholder';
import CorreoSoporte from '@/components/legal/CorreoSoporte';

export const metadata = {
  title: 'Términos de uso — Veli',
};

export default function TerminosPage() {
  return (
    <article className="bg-white rounded-xl border border-[#E4E4E7] p-6 sm:p-8">
      <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] mb-1.5">
        Términos de uso
      </h1>
      <p className="text-xs text-[#71717A] mb-6">Última actualización: noviembre 2026</p>

      <BannerPlaceholder />

      <div className="flex flex-col gap-5 text-sm text-[#52525B] leading-relaxed [&_strong]:text-[#111111]">
        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            1. Propósito del servicio
          </h2>
          <p>
            Veli es una <strong>herramienta de gestión operativa y estimación financiera</strong>{' '}
            para estudios y negocios de belleza. Ayuda a organizar agenda, clientes y servicios y a
            estimar fórmulas, cantidades de producto, precios y costos. El uso está limitado a fines
            profesionales legítimos del sector.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            2. Estimaciones, cotizaciones y responsabilidad del profesional
          </h2>
          <p>
            Todo lo que Veli calcula o sugiere (diagnóstico orientativo, análisis con IA, planes
            sugeridos, fórmulas, cantidades de producto, precios y costos) es una estimación de
            apoyo basada en la información registrada por el estudio. No constituye un concepto
            médico ni dermatológico, y no garantiza un resultado.
          </p>
          <p className="mt-2">
            Los valores cotizados y compartidos mediante los enlaces de cotización son{' '}
            <strong>estimaciones vigentes hasta la fecha indicada</strong> y pueden variar si al
            momento de la atención presencial se presentan condiciones distintas o se requieren
            procesos o productos adicionales.
          </p>
          <p className="mt-2">
            <strong>
              El diagnóstico presencial, la prueba de sensibilidad, la prueba de mechón y la
              ejecución de cualquier procedimiento químico o estético son responsabilidad exclusiva
              del especialista del estudio
            </strong>
            , al igual que la elección de los insumos. Ante señales de una condición dermatológica o
            de salud, el profesional debe remitir a evaluación médica.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            3. Cuentas y responsabilidad
          </h2>
          <p>
            Al crear una cuenta declaras que la información suministrada es veraz y que representas
            legítimamente al estudio o práctica profesional. Eres responsable de mantener la
            confidencialidad de tus credenciales y de toda actividad realizada desde tu cuenta.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            4. Información de los clientes
          </h2>
          <p>
            Al registrar un cliente te comprometes a contar con su consentimiento para procesar sus
            datos personales, fotografías y antecedentes técnicos dentro de Veli. Veli actúa como
            encargado del tratamiento: los datos pertenecen a tu estudio y a tus clientes; no los
            vendemos ni compartimos fuera del alcance descrito en la Política de Privacidad.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            5. Uso de inteligencia artificial
          </h2>
          <p>
            El análisis fotográfico utiliza exclusivamente modelos de inteligencia artificial de
            Anthropic (Claude). Según sus condiciones comerciales vigentes para la API, Anthropic no
            emplea estos datos para entrenar sus modelos. Si la IA no está disponible, el
            diagnóstico se realiza de forma manual. Los resultados son de apoyo y{' '}
            <strong>no reemplazan el criterio del especialista</strong>.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            6. Uso aceptable
          </h2>
          <p>No está permitido usar Veli para:</p>
          <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
            <li>Almacenar información de personas sin su consentimiento.</li>
            <li>Sustituir diagnóstico médico o dermatológico profesional.</li>
            <li>Ingeniería inversa, scraping o intento de acceso a datos de otras organizaciones.</li>
            <li>Cualquier uso contrario a la ley aplicable.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            7. Disponibilidad y limitación de responsabilidad
          </h2>
          <p>
            Veli se ofrece “tal cual”. En la máxima medida permitida por la ley, no seremos
            responsables por daños indirectos, lucro cesante o pérdida de datos derivados del uso o
            imposibilidad de uso del servicio, ni por el resultado de los procedimientos prestados
            en el estudio.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            8. Cambios
          </h2>
          <p>
            Podemos actualizar estos términos para reflejar mejoras o cambios regulatorios. Si el
            cambio es relevante te avisaremos por correo o dentro de la aplicación.
          </p>
        </section>

        <section>
          <h2 className="font-sans text-base font-bold tracking-tight text-[#111111] mb-2">
            9. Contacto
          </h2>
          <p>
            Para cualquier asunto relacionado con estos términos escríbenos a <CorreoSoporte />.
          </p>
        </section>

        <p className="text-xs text-[#71717A] border-t border-[#E4E4E7] pt-4 mt-2">
          Borrador de trabajo: puede cambiar antes de la versión definitiva.
        </p>
      </div>
    </article>
  );
}
