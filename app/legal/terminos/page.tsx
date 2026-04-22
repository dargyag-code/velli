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
      <p className="text-xs text-[#999999] mb-6">Última actualización: abril 2026</p>

      <div className="flex flex-col gap-5 text-sm text-[#2D2D2D] leading-relaxed">
        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            1. Propósito del servicio
          </h2>
          <p>
            Velli Pro es una aplicación profesional dirigida a estilistas que ofrece herramientas
            para registrar clientas, realizar diagnósticos capilares con apoyo de inteligencia
            artificial, agendar citas y generar planes de tratamiento. El uso está limitado a
            fines profesionales legítimos del sector de belleza capilar.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            2. Cuentas y responsabilidad
          </h2>
          <p>
            Al crear una cuenta declaras que la información suministrada es veraz y que eres la
            persona responsable del salón o práctica profesional. Eres responsable de mantener la
            confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            3. Información de las clientas
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
            4. Uso de Inteligencia Artificial
          </h2>
          <p>
            El análisis de cabello mediante cámara utiliza modelos de lenguaje visual provistos
            por OpenAI (GPT-4o). Las fotografías enviadas se procesan únicamente para generar el
            diagnóstico y no se utilizan para entrenar modelos públicos. Los resultados son una
            ayuda profesional: <strong>no reemplazan el criterio clínico ni tricológico</strong> de
            la estilista.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            5. Uso aceptable
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
            6. Disponibilidad y limitación de responsabilidad
          </h2>
          <p>
            Velli Pro se ofrece “tal cual”. Hacemos nuestro mejor esfuerzo por mantener el servicio
            disponible, pero no garantizamos ausencia total de errores o interrupciones. En la
            máxima medida permitida por la ley, no seremos responsables por daños indirectos,
            lucro cesante o pérdida de datos derivados del uso o imposibilidad de uso del servicio.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            7. Cambios
          </h2>
          <p>
            Podemos actualizar estos términos para reflejar mejoras o cambios legales. Si el cambio
            es relevante te avisaremos por email o dentro de la app antes de que entre en vigor.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#2D5A27] mb-2" style={serif}>
            8. Contacto
          </h2>
          <p>
            Para cualquier asunto relacionado con estos términos escríbenos a{' '}
            <a href="mailto:soporte@velli.app" className="text-[#2D5A27] font-semibold hover:underline">
              soporte@velli.app
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-[#999999] italic border-t border-[#F0F0F0] pt-4 mt-2">
          Este documento es una plantilla inicial pendiente de revisión legal.
        </p>
      </div>
    </article>
  );
}
