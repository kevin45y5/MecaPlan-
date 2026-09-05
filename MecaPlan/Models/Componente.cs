namespace MecaPlan.Models
{
    public class Componente
    {
        public int ComponenteID { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Categoria { get; set; } = string.Empty;
        public int StockDisponible { get; set; }
        public decimal PrecioEstimado { get; set; }
        public string? UrlImagen { get; set; }
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaEliminacion { get; set; }
        public ICollection<ProyectoComponente> ProyectoComponentes { get; set; } = new List<ProyectoComponente>();
    }
}
