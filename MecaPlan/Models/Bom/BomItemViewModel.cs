namespace MecaPlan.Models.Bom;

public sealed class BomItemViewModel
{
    public int BomId { get; set; }
    public string Nombre { get; set; } = "";
    public string Tipo { get; set; } = "";
    public decimal PrecioEstimado { get; set; }
    public int CantidadRequerida { get; set; }
    public bool EsFaltante { get; set; }
    public decimal Subtotal => PrecioEstimado * CantidadRequerida;
}

public sealed class BomChecklistViewModel
{
    public int ProyectoId { get; set; }
    public string NombreProyecto { get; set; } = "";
    public List<BomItemViewModel> Items { get; set; } = new();
    public decimal CostoPendiente => Items.Where(i => i.EsFaltante).Sum(i => i.Subtotal);
}
