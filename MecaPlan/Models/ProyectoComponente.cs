namespace MecaPlan.Models
{
    public class ProyectoComponente
    {
        public int ProyectoComponenteID { get; set; }
        public int ProyectoID { get; set; }
        public int ComponenteID { get; set; }
        public int CantidadRequerida { get; set; }
        public bool EnInventario { get; set; }
        public string? Motivo { get; set; }
        public Proyecto Proyecto { get; set; } = null!;
        public Componente Componente { get; set; } = null!;
    }
}
