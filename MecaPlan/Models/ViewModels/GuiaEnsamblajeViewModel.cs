namespace MecaPlan.Models.ViewModels
{
    public class GuiaEnsamblajeViewModel
    {
        public Proyecto Proyecto { get; set; } = null!;
        public List<GuiaComponenteItem> Componentes { get; set; } = new();
        public List<GuiaConexionItem> Conexiones { get; set; } = new();
    }

    public class GuiaComponenteItem
    {
        public string Nombre { get; set; } = string.Empty;
        public string UrlImagen { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public int Cantidad { get; set; } = 1;
        public bool EnInventario { get; set; }
        public string? Motivo { get; set; }
    }

    public class GuiaConexionItem
    {
        public string OrigenComponente { get; set; } = string.Empty;
        public string OrigenPin { get; set; } = string.Empty;
        public string DestinoComponente { get; set; } = string.Empty;
        public string DestinoPin { get; set; } = string.Empty;
        public string Color { get; set; } = "gris";
    }
}
