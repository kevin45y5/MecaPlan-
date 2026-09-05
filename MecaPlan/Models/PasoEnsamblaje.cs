namespace MecaPlan.Models
{
    public class PasoEnsamblaje
    {
        public int PasoID { get; set; }
        public int ProyectoID { get; set; }
        public int NumeroPaso { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string? UrlEsquema { get; set; }
        public bool Completado { get; set; }
        public DateTime FechaCreacion { get; set; }
        public Proyecto Proyecto { get; set; } = null!;
    }
}
