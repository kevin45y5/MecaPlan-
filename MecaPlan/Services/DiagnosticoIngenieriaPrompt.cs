using System.Text;
using System.Text.Json;
using MecaPlan.Models;

namespace MecaPlan.Services
{
    public static class DiagnosticoIngenieriaPrompt
    {
        public static string ConstruirSystem()
        {
            var sb = new StringBuilder();
            sb.AppendLine("Eres un ingeniero electrónico experto y pedagogo. Ayudas a estudiantes a diagnosticar fallas en sus proyectos de electrónica con Arduino/Microcontroladores.");
            sb.AppendLine();
            sb.AppendLine("Recibes el CONTEXTO REAL del proyecto (lista de materiales, conexiones del circuito, código y se te describirá una falla).");
            sb.AppendLine();
            sb.AppendLine("Debes responder en español, de forma clara y ordenada.");
            sb.AppendLine();
            sb.AppendLine("PRIMERO aplica las siguientes REGLAS DE DESCARTE (causas imposibles) basándote SIEMPRE en el contexto real proporcionado, NUNCA inventes materiales ni conexiones que no aparezcan:");
            sb.AppendLine("1. Si un componente/actuador/sensor NO aparece en la lista de materiales del proyecto, descártalo como causa de la falla y no lo menciones como solución.");
            sb.AppendLine("2. Si un componente aparece como FALTANTE (no lo tiene el estudiante), no puede estar causando la falla; descártalo y recomienda conseguirlo/agregarlo antes.");
            sb.AppendLine("3. Si un componente sí está en la lista pero NO tiene ninguna conexión de cables en el circuito, descarta 'mala conexión del componente' y señala que hace falta cablearlo.");
            sb.AppendLine("4. Si un pin que se usa en el código NO está asignado en las conexiones del circuito, indícalo como posible causa de que ese pin no funcione.");
            sb.AppendLine("5. No asumas pines, colores de cable ni componentes que no estén en el contexto.");
            sb.AppendLine();
            sb.AppendLine();
            sb.AppendLine("Responde SIEMPRE como Claude, con texto nuevo según el mensaje y el contexto. No uses frases fijas ni plantillas memorizadas.");
            sb.AppendLine("Si el mensaje es un saludo o una pregunta general, responde de forma natural y breve, y ofrece ayuda concreta sobre ESTE proyecto (componentes, conexiones o código).");
            sb.AppendLine();
            sb.AppendLine("Después (SOLO si hay una falla concreta), entrega la respuesta con EXACTAMENTE esta estructura usando los encabezados en negrita:");
            sb.AppendLine("**Causas descartadas:** una lista breve de lo que NO es el problema y por qué.");
            sb.AppendLine("**Causa más probable:** explica cuál es la causa más probable con base en el contexto.");
            sb.AppendLine("**Cómo comprobarlo:** pasos concretos para verificar la causa (mediciones, revisión de cable, de código).");
            sb.AppendLine("**Solución:** pasos claros para corregirlo.");
            sb.AppendLine("Si no tienes suficiente contexto para decidir, dilo y pide el dato que hace falta.");
            return sb.ToString();
        }

        public static string ConstruirUsuario(Proyecto proyecto, IReadOnlyList<ProyectoComponente> componentes, string falla)
        {
            var sb = new StringBuilder();

            sb.AppendLine("## CONTEXTO DEL PROYECTO");
            sb.AppendLine($"- Nombre: {proyecto.NombreProyecto}");
            sb.AppendLine($"- Nivel de complejidad: {proyecto.NivelComplejidad}");
            if (!string.IsNullOrWhiteSpace(proyecto.Microcontrolador))
            {
                sb.AppendLine($"- Microcontrolador/placa: {proyecto.Microcontrolador}");
            }

            sb.AppendLine();
            sb.AppendLine("### Lista de materiales (componentes reales)");
            if (componentes.Count == 0)
            {
                sb.AppendLine("- (sin componentes registrados)");
            }
            else
            {
                foreach (var c in componentes)
                {
                    var estado = c.EnInventario ? "en inventario" : "FALTANTE";
                    var motivo = string.IsNullOrWhiteSpace(c.Motivo) ? "" : $" — {c.Motivo}";
                    sb.AppendLine($"- {c.Componente.Nombre} (x{c.CantidadRequerida}, {estado}){motivo}");
                }
            }

            var conexiones = ParsearConexiones(proyecto.ConexionesCanvas);
            sb.AppendLine();
            sb.AppendLine("### Conexiones del circuito (origen -> destino)");
            if (conexiones.Count == 0)
            {
                sb.AppendLine("- (sin conexiones registradas aún)");
            }
            else
            {
                foreach (var ci in conexiones)
                {
                    sb.AppendLine($"- {ci.OrigenComponente}{ci.OrigenPin} -> {ci.DestinoComponente}{ci.DestinoPin} (cable {ci.Color})");
                }
            }

            sb.AppendLine();
            sb.AppendLine("### Código del programa (primeras líneas)");
            if (string.IsNullOrWhiteSpace(proyecto.CodigoGenerado))
            {
                sb.AppendLine("- (sin código generado)");
            }
            else
            {
                var lineas = proyecto.CodigoGenerado.Split('\n');
                var mostrar = string.Join("\n", lineas.Take(60));
                sb.AppendLine("```cpp");
                sb.AppendLine(mostrar);
                sb.AppendLine("```");
                if (lineas.Length > 60)
                {
                    sb.AppendLine($"(... {lineas.Length - 60} líneas más)");
                }
            }

            sb.AppendLine();
            sb.AppendLine("## FALLA REPORTADA POR EL ESTUDIANTE");
            sb.AppendLine(falla);

            return sb.ToString();
        }

        private static List<ConexionSimple> ParsearConexiones(string? json)
        {
            var resultado = new List<ConexionSimple>();
            if (string.IsNullOrWhiteSpace(json))
            {
                return resultado;
            }

            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind != JsonValueKind.Array)
                {
                    return resultado;
                }

                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var origen = Lee(el, "Origen", "origen");
                    var destino = Lee(el, "Destino", "destino");
                    var color = Lee(el, "color_cable", "ColorCable");
                    resultado.Add(new ConexionSimple(origen, destino, string.IsNullOrWhiteSpace(color) ? "gris" : color));
                }
            }
            catch (JsonException)
            {
            }

            return resultado;
        }

        private static string Lee(JsonElement el, params string[] claves)
        {
            foreach (var clave in claves)
            {
                if (el.TryGetProperty(clave, out var prop) && prop.ValueKind == JsonValueKind.String)
                {
                    return prop.GetString() ?? string.Empty;
                }
            }
            return string.Empty;
        }

        private sealed record ConexionSimple(string Origen, string Destino, string Color)
        {
            public string OrigenComponente { get; set; } = Origen;
            public string OrigenPin { get; set; } = Origen.Contains('_') ? Origen[(Origen.IndexOf('_') + 1)..].Trim() : "";
            public string DestinoComponente { get; set; } = Destino;
            public string DestinoPin { get; set; } = Destino.Contains('_') ? Destino[(Destino.IndexOf('_') + 1)..].Trim() : "";
        }
    }
}
