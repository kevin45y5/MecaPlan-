namespace MecaPlan.Models.ViewModels
{
    public class DiagnosticoIndexViewModel
    {
        public List<ProyectoSelectorItem> Proyectos { get; set; } = new();

        public sealed class ProyectoSelectorItem
        {
            public int ProyectoID { get; set; }
            public string Nombre { get; set; } = string.Empty;
        }
    }

    public class DiagnosticoHistorialViewModel
    {
        public int ProyectoID { get; set; }
        public string NombreProyecto { get; set; } = string.Empty;
        public List<DiagnosticoItem> Historial { get; set; } = new();
    }

    public class DiagnosticoItem
    {
        public int DiagnosticoID { get; set; }
        public string TipoError { get; set; } = string.Empty;
        public string DescripcionFalla { get; set; } = string.Empty;
        public string SolucionSugerida { get; set; } = string.Empty;
        public DateTime FechaReporte { get; set; }
        public DateTime? FechaResolucion { get; set; }
    }

    public class EnviarDiagnosticoRequest
    {
        public int ProyectoID { get; set; }
        public string Mensaje { get; set; } = string.Empty;
    }
}
