using System.Text.RegularExpressions;

namespace MecaPlan.Services
{
    public static class ComponenteNombres
    {
        private static readonly Regex Parens = new(@"\(.*?\)", RegexOptions.CultureInvariant);
        private static readonly Regex NoAlfa = new(@"[^a-z0-9]+", RegexOptions.CultureInvariant);
        private static readonly Regex Espacios = new(@"\s+", RegexOptions.CultureInvariant);

        private static readonly string[] Ruido =
        {
            "placa de desarrollo", "placa de desarrollo node mcu", "de desarrollo",
            "node mcu", "nodemcu", "board", "genuino", "compatible", "modelo",
            "version", "kit con", "placa", "r3", "r4", "uno r3", "uno wifi", "node"
        };

        public static string Normalizar(string? nombre)
        {
            if (string.IsNullOrWhiteSpace(nombre))
            {
                return string.Empty;
            }

            var n = nombre.ToLowerInvariant();
            n = n.Replace("á", "a").Replace("é", "e").Replace("í", "i")
                .Replace("ó", "o").Replace("ú", "u").Replace("ü", "u").Replace("ñ", "n");
            n = Parens.Replace(n, " ");
            n = NoAlfa.Replace(n, " ");

            foreach (var ruido in Ruido)
            {
                n = n.Replace(ruido, " ");
            }

            n = Espacios.Replace(n, " ").Trim();
            return n;
        }
    }
}
