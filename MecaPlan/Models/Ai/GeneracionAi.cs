using System.Text.Json.Serialization;

namespace MecaPlan.Models.Ai
{
    public class ListaFaltantesAi
    {
        [JsonPropertyName("faltantes")]
        public List<FaltanteAi> Faltantes { get; set; } = new();
    }

    public class FaltanteAi
    {
        [JsonPropertyName("nombre")]
        public string Nombre { get; set; } = string.Empty;

        [JsonPropertyName("cantidad")]
        public int Cantidad { get; set; } = 1;

        [JsonPropertyName("motivo")]
        public string? Motivo { get; set; }
    }

    public class TutorProyectoAi
    {
        [JsonPropertyName("codigo")]
        public string? Codigo { get; set; }

        [JsonPropertyName("codigoFuente")]
        public string? CodigoFuente { get; set; }

        [JsonPropertyName("conexiones_canvas")]
        public List<ConexionCanvasAi> ConexionesCanvas { get; set; } = new();

        [JsonPropertyName("instrucciones")]
        public string? Instrucciones { get; set; }

        [JsonPropertyName("pasos_ensamblaje")]
        public List<PasoEnsamblajeAi> PasosEnsamblaje { get; set; } = new();

        [JsonIgnore]
        public string CodigoFinal =>
            !string.IsNullOrWhiteSpace(Codigo) ? Codigo : (CodigoFuente ?? string.Empty);
    }

    public class ConexionCanvasAi
    {
        [JsonPropertyName("origen")]
        public string Origen { get; set; } = string.Empty;

        [JsonPropertyName("destino")]
        public string Destino { get; set; } = string.Empty;

        [JsonPropertyName("color_cable")]
        public string ColorCable { get; set; } = "gris";
    }

    public class PasoEnsamblajeAi
    {
        [JsonPropertyName("titulo")]
        public string Titulo { get; set; } = string.Empty;

        [JsonPropertyName("descripcion")]
        public string Descripcion { get; set; } = string.Empty;
    }
}
