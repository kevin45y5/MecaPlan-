namespace MecaPlan.Models
{
    public class SimulacionDiseno
    {
        public int SimulacionDisenoID { get; set; }
        public int ProyectoID { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Autor { get; set; }
        public string? PinoutJson { get; set; }
        public string? Codigo { get; set; }
        public string? ThumbnailBase64 { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaActualizacion { get; set; }
        public Proyecto Proyecto { get; set; } = null!;
    }
}
