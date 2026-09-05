namespace MecaPlan.Models
{
    public class Diagnostico
    {
        public int DiagnosticoID { get; set; }
        public int ProyectoID { get; set; }
        public string TipoError { get; set; } = string.Empty;
        public string DescripcionFalla { get; set; } = string.Empty;
        public string? SolucionSugerida { get; set; }
        public DateTime FechaReporte { get; set; }
        public DateTime? FechaResolucion { get; set; }
        public Proyecto Proyecto { get; set; } = null!;
    }
}
