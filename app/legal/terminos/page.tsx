import BannerPlaceholder from '@/components/legal/BannerPlaceholder';
import CorreoSoporte from '@/components/legal/CorreoSoporte';

const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

export const metadata = {
  title: 'Términos de uso — Velli Pro',
};

export default function TerminosPage() {
  return (
    <article className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
      <h1 className="text-2xl text-[#2D5A27] mb-1" style={serif}>
        Términos de uso
      </h1>
      <p className="text-xs text-[#999999] mb-6">Última actualización: octubre 2026</p>

      <BannerPlaceholder />

      <div className="flex flex-col gap-5 text-sm text-[#2D2D2D] leading-relaxed">
        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            1. Propósito del servicio
          </h2>
          <p>
            Velli Pro es una <strong>herramienta de estimación administrativa y financiera</strong>{' '}
            para salones de belleza. Ayuda a organizar las clientas y los servicios del salón y a
            estimar fórmulas, cantidades de producto, precios y costos. Para alimentar esas
            estimaciones incluye un diagnóstico capilar orientativo, con apoyo opcional de
            inteligencia artificial. El uso está limitado a fines profesionales legítimos del sector
            de belleza capilar.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            2. Estimaciones, cotizaciones y responsabilidad del profesional
          </h2>
          <p>
            Todo lo que Velli Pro calcula o sugiere (el diagnóstico orientativo, el análisis con
            IA, los planes sugeridos, las fórmulas de color, las cantidades de producto, los precios
            y los costos) es una estimación de apoyo, hecha con la información que registra el
            salón. No es un concepto técnico, médico ni dermatológico, y no garantiza un resultado.
          </p>
          <p className="mt-2">
            Los valores cotizados y compartidos mediante los enlaces de cotización son{' '}
            <strong>estimaciones vigentes hasta la fecha indicada</strong> y pueden variar si al
            momento de la atención presencial el cabello presenta condiciones distintas o requiere
            procesos o productos adicionales.
          </p>
          <p className="mt-2">
            <strong>
              El diagnóstico presencial del cabello y del cuero cabelludo, la prueba de alergia
              (sensibilidad), la prueba de mechón y la aplicación de cualquier servicio químico son
              responsabilidad exclusiva del profesional del salón
            </strong>{' '}
            que atiende a la clienta, igual que la elección de los productos. Ante señales de una
            condición del cuero cabelludo o de salud, el profesional debe remitir a la clienta a un
            médico.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            3. Cuentas y responsabilidad
          </h2>
          <p>
            Al crear una cuenta declaras que la información suministrada es veraz y que eres la
            persona responsable del salón o práctica profesional. Eres responsable de mantener la
            confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            4. Información de las clientas
          </h2>
          <p>
            Al registrar a una clienta te comprometes a contar con su consentimiento para procesar
            sus datos personales, fotografías y datos de salud capilar dentro de Velli Pro. Velli
            Pro actúa como encargado del tratamiento: los datos son tuyos y de tus clientas; no los
            vendemos ni compartimos con terceros fuera del alcance descrito en la Política de
            Privacidad.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            5. Uso de inteligencia artificial
          </h2>
          <p>
            El análisis del cabello con fotos (de la cámara o de la galería) usa modelos de
            inteligencia artificial de Anthropic (Claude). Las fotografías se envían a Anthropic
            solo para comprobar que muestran cabello y para generar el análisis; según sus
            condiciones comerciales vigentes, Anthropic no las usa para entrenar sus modelos. Si la
            IA no está disponible, el diagnóstico se hace de forma manual. Los resultados son una
            ayuda: <strong>no reemplazan el criterio del profesional</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            6. Uso aceptable
          </h2>
          <p>No está permitido usar Velli Pro para:</p>
          <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
            <li>Almacenar información de personas sin su consentimiento.</li>
            <li>Sustituir diagnóstico médico o dermatológico profesional.</li>
            <li>Ingeniería inversa, scraping o intento de acceso a datos de otras cuentas.</li>
            <li>Cualquier uso contrario a la ley colombiana o del país donde operes.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            7. Disponibilidad y limitación de responsabilidad
          </h2>
          <p>
            Velli Pro se ofrece “tal cual”. Hacemos nuestro mejor esfuerzo por mantener el servicio
            disponible, pero no garantizamos ausencia total de errores o interrupciones. En la
            máxima medida permitida por la ley, no seremos responsables por daños indirectos,
            lucro cesante o pérdida de datos derivados del uso o imposibilidad de uso del servicio,
            ni por el resultado de los servicios prestados en el salón o de las decisiones técnicas
            o comerciales tomadas con base en las estimaciones.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            8. Cambios
          </h2>
          <p>
            Podemos actualizar estos términos para reflejar mejoras o cambios legales. Si el cambio
            es relevante te avisaremos por email o dentro de la app antes de que entre en vigor.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            9. Contacto
          </h2>
          <p>
            Para cualquier asunto relacionado con estos términos escríbenos a <CorreoSoporte />.
          </p>
        </section>

        <p className="text-xs text-[#999999] italic border-t border-[#F0F0F0] pt-4 mt-2">
          Borrador de trabajo: puede cambiar antes de la versión definitiva.
        </p>
      </div>
    </article>
  );
}
