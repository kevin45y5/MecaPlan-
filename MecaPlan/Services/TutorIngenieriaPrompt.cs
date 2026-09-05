namespace MecaPlan.Services
{
    public static class TutorIngenieriaPrompt
    {
        public static string Build(string nombreProyecto, string listaConfirmada, string? microcontrolador)
        {
            var placa = string.IsNullOrWhiteSpace(microcontrolador)
                ? "Arduino Uno"
                : microcontrolador.Trim();

            return $$"""
                Basado en el proyecto "{{nombreProyecto.Trim()}}" y los componentes [{{listaConfirmada}}].
                La placa objetivo es Arduino Uno (ATmega328P), aunque el BOM mencione "{{placa}}".
                Genera un sketch COMPLETO listo para copiar y pegar en el IDE de Arduino y cargarlo en un Arduino Uno. Debe compilar y correr sin cambios.

                Reglas del código:
                - El campo "codigo" contiene SOLO el sketch: includes, #define de pines, setup() y loop(). Sin markdown, sin explicaciones, sin comentarios de ESP32/WiFi.
                - Pines válidos: 2-13 y A0-A5. LED integrado en el pin 13. PWM solo en 3, 5, 6, 9, 10 y 11.
                - Serial.begin(9600). No uses librerías de ESP, analogWrite en pines no PWM, ni WiFi.
                - Usa nombres de pines claros (#define LED_PIN 13) y un comportamiento simple que se note al alimentar la placa.

                En conexiones_canvas usa "Arduino Uno" como origen de pines (ejemplo Arduino Uno_D9, Arduino Uno_5V, Arduino Uno_GND).

                Devuelve ÚNICAMENTE un JSON:
                {
                  "codigo": "/* sketch */",
                  "conexiones_canvas": [
                    {"origen": "Arduino Uno_D9", "destino": "Servo_Signal", "color_cable": "amarillo"},
                    {"origen": "Arduino Uno_5V", "destino": "Protoboard_VCC", "color_cable": "rojo"}
                  ],
                  "instrucciones": "Texto claro que explique, en frases, qué se conecta con qué y qué pin va a qué pin. Ej: 'Conecta el pin D9 del Arduino al pin Signal del servomotor con un cable amarillo. Conecta el pin 5V del Arduino al carril VCC de la protoboard con un cable rojo.'",
                  "pasos_ensamblaje": [
                    {"titulo": "Prepara la protoboard", "descripcion": "Coloca la fuente de 5V y conecta sus cables rojo (VCC) y negro (GND) a los carriles + y - de la protoboard."},
                    {"titulo": "Conecta el Arduino", "descripcion": "Une el pin GND del Arduino al carril - de la protoboard para compartir tierra."}
                  ]
                }
                """;
        }
    }
}
