using System.Text.RegularExpressions;
using MecaPlan.Models.ViewModels;

namespace MecaPlan.Services
{
    public static class InventarioParser
    {
        private static readonly Regex CantidadAlInicio = new(@"^(\d+)\s*[x×]?\s+(.+)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        private static readonly Regex CantidadAlFinal = new(@"^(.+?)\s*[x×]\s*(\d+)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        private static readonly string[] FrasesVacio =
        {
            "ninguno", "ninguna", "nada", "no tengo", "no cuento", "no poseo",
            "no dispongo", "no tengo ni uno", "no tengo ni un", "no tengo nada",
            "carezco", "todo lo necesito", "no tengo ninguno", "sin materiales",
            "vacio", "no tengo materiales", "no tengo componentes"
        };

        public static List<BomItemViewModel> Parsear(string? microcontrolador, string? materialesUsuario)
        {
            var items = ParsearLineas(materialesUsuario);
            if (!string.IsNullOrWhiteSpace(microcontrolador))
            {
                var placa = ParsearLineas(microcontrolador);
                if (placa.Count > 0 && items.All(i => !string.Equals(i.Nombre, placa[0].Nombre, StringComparison.OrdinalIgnoreCase)))
                {
                    items.Insert(0, placa[0]);
                }
            }

            return items;
        }

        public static List<BomItemViewModel> ParsearLineas(string? texto)
        {
            var items = new List<BomItemViewModel>();
            var vistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(texto))
            {
                return items;
            }

            foreach (var parte in texto.Split([',', ';', '\n', '\r'], StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            {
                if (EsFraseVacia(parte))
                {
                    continue;
                }

                var (nombre, cantidad) = Extraer(parte);
                if (nombre.Length == 0 || !vistos.Add(nombre))
                {
                    continue;
                }

                items.Add(new BomItemViewModel
                {
                    Nombre = nombre.Length > 100 ? nombre[..100] : nombre,
                    Cantidad = cantidad
                });
            }

            return items;
        }

        private static bool EsFraseVacia(string texto)
        {
            var normalizado = System.Text.RegularExpressions.Regex.Replace(
                texto.Trim().ToLowerInvariant(),
                @"[^a-z0-9\s]",
                " ");

            foreach (var frase in FrasesVacio)
            {
                if (normalizado.Contains(frase))
                {
                    return true;
                }
            }

            return false;
        }

        private static (string Nombre, int Cantidad) Extraer(string texto)
        {
            var valor = texto.Trim();
            var inicio = CantidadAlInicio.Match(valor);
            if (inicio.Success)
            {
                return (inicio.Groups[2].Value.Trim(), Math.Max(1, int.Parse(inicio.Groups[1].Value)));
            }

            var final = CantidadAlFinal.Match(valor);
            if (final.Success)
            {
                return (final.Groups[1].Value.Trim(), Math.Max(1, int.Parse(final.Groups[2].Value)));
            }

            return (valor, CantidadPorDefecto(valor));
        }

        private static int CantidadPorDefecto(string nombre)
        {
            var n = nombre.ToLowerInvariant();

            if (Contiene(n, "cable", "jumper", "dupont", "macho-hembra", "macho-macho", "hembra-hembra"))
            {
                return EsUnaPieza(n) ? 1 : 10;
            }
            if (Contiene(n, "resistencia", "resistor", "led", "diodo", "capacitor", "capacit", "botón", "pulsador", "push"))
            {
                return EsUnaPieza(n) ? 1 : 4;
            }
            if (Contiene(n, "tornillo", "tuerca", "espárrago", "separador", "espaciador", "soporte", "m2", "m3", "m4"))
            {
                return EsUnaPieza(n) ? 1 : 8;
            }
            if (Contiene(n, "pilas", "batería", "bateria"))
            {
                return 2;
            }

            return 1;
        }

        private static bool EsUnaPieza(string n)
        {
            return Contiene(n, "unidad", "pieza", "uno", "single", "1 u", "x1");
        }

        private static bool Contiene(string texto, params string[] terminos)
        {
            foreach (var t in terminos)
            {
                if (texto.Contains(t, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }
    }
}
