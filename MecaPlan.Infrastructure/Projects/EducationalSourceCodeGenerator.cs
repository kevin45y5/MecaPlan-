using System.Text;
using MecaPlan.Application.Projects;

namespace MecaPlan.Infrastructure.Projects;

/// <summary>
/// Adaptador local que conserva el contrato de una IA. El mensaje de sistema obliga a una salida
/// compilable y pedagógica, por lo que puede enviarse sin cambios al proveedor de IA configurado.
/// </summary>
public sealed class EducationalSourceCodeGenerator : ISourceCodeGenerator
{
    public const string SystemPrompt = """
        Genera únicamente código fuente listo para compilar para la placa indicada. Incluye comentarios pedagógicos en español que expliquen las librerías, constantes de pines, setup, loop y cada función principal. No uses Markdown ni bloques de código. Conserva UTF-8 y saltos de línea LF. Devuelve la extensión recomendada para el IDE de la placa.
        """;

    public GeneratedSourceCode Generate(SourceCodeRequest request)
    {
        var safeName = FileName(request.ProjectName);
        return request.Board switch
        {
            TargetBoard.Esp32 => new(Esp32(request), "C++ para ESP32", ".cpp", safeName + ".cpp"),
            TargetBoard.Pic => new(Pic(request), "C para PIC", ".c", safeName + ".c"),
            _ => new(Arduino(request), "Arduino Sketch", ".ino", safeName + ".ino")
        };
    }

    private static string Arduino(SourceCodeRequest request) => $$"""
        // Proyecto: {{request.ProjectName}}
        // Idea: {{request.Description}}
        // Este archivo está listo para abrirse en Arduino IDE.

        // Configuración del pin del LED integrado para la primera prueba física.
        const byte LED_PIN = LED_BUILTIN;

        // setup se ejecuta una sola vez: prepara los pines y el monitor serial.
        void setup() {
          pinMode(LED_PIN, OUTPUT);
          Serial.begin(9600);
          Serial.println("{{request.ProjectName}} iniciado");
        }

        // loop se repite continuamente y contiene el comportamiento principal del prototipo.
        void loop() {
          digitalWrite(LED_PIN, HIGH);
          delay(500);
          digitalWrite(LED_PIN, LOW);
          delay(500);
        }
        """;

    private static string Esp32(SourceCodeRequest request) => $$"""
        // Proyecto: {{request.ProjectName}}
        // Idea: {{request.Description}}
        // Compatible con el core Arduino para ESP32; guárdelo como .cpp o inclúyalo en un sketch.

        #include <Arduino.h> // Declara pinMode, digitalWrite, Serial y delay.
        constexpr int LED_PIN = 2; // GPIO 2 suele controlar el LED integrado de desarrollo.

        // setup configura el hardware una sola vez al encender la placa.
        void setup() {
          pinMode(LED_PIN, OUTPUT);
          Serial.begin(115200);
          Serial.println("{{request.ProjectName}} iniciado");
        }

        // loop ejecuta de forma cíclica la lógica principal del prototipo.
        void loop() {
          digitalWrite(LED_PIN, !digitalRead(LED_PIN));
          delay(500);
        }
        """;

    private static string Pic(SourceCodeRequest request) => $$"""
        /* Proyecto: {{request.ProjectName}}
           Idea: {{request.Description}}
           Seleccione el dispositivo PIC y el oscilador correctos en MPLAB X antes de compilar. */

        #include <xc.h> // Cabecera XC8: expone registros y configuración del PIC seleccionado.
        #define _XTAL_FREQ 8000000UL // Frecuencia usada por __delay_ms; ajústela al oscilador configurado.

        // main configura los puertos una sola vez y después mantiene el comportamiento principal.
        void main(void) {
            TRISBbits.TRISB0 = 0; // RB0 es salida para conectar un LED con resistencia.

            while (1) { // Equivalente pedagógico de loop: se ejecuta indefinidamente.
                LATBbits.LATB0 = 1;
                __delay_ms(500);
                LATBbits.LATB0 = 0;
                __delay_ms(500);
            }
        }
        """;

    private static string FileName(string name)
    {
        var builder = new StringBuilder(name.Length);
        foreach (var character in name.Normalize(NormalizationForm.FormD))
            if (char.IsLetterOrDigit(character)) builder.Append(character);
            else if (char.IsWhiteSpace(character) || character is '-' or '_') builder.Append('_');
        return builder.ToString().Trim('_') is { Length: > 0 } fileName ? fileName : "proyecto";
    }
}
