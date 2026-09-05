namespace MecaPlan.Models.ViewModels
{
    public class SimuladorIndexViewModel
    {
        public Proyecto Proyecto { get; set; } = null!;
        public List<SimuladorComponenteVm> Componentes { get; set; } = new();
        public List<SimuladorConexionVm> Conexiones { get; set; } = new();
        public string Codigo { get; set; } = string.Empty;
    }

    public class SimuladorComponenteVm
    {
        public string Nombre { get; set; } = string.Empty;
        public int Cantidad { get; set; }
        public bool EnInventario { get; set; }
    }

    public class SimuladorConexionVm
    {
        public string OrigenComponente { get; set; } = string.Empty;
        public string OrigenPin { get; set; } = string.Empty;
        public string DestinoComponente { get; set; } = string.Empty;
        public string DestinoPin { get; set; } = string.Empty;
        public string Color { get; set; } = "gris";
    }
}
