namespace MecaPlan.Domain.Entities;

public sealed class Proyecto
{
    private Proyecto() { }

    public Proyecto(int estudianteId, string nombreProyecto, string descripcionIdea)
    {
        EstudianteID = estudianteId;
        NombreProyecto = nombreProyecto;
        DescripcionIdea = descripcionIdea;
        FechaCreacion = DateTime.UtcNow;
    }

    public int ProyectoID { get; private set; }
    public int EstudianteID { get; private set; }
    public string NombreProyecto { get; private set; } = null!;
    public string DescripcionIdea { get; private set; } = null!;
    public DateTime FechaCreacion { get; private set; }
    public List<BomProyecto> EntradasBom { get; } = [];
}

public sealed class Componente
{
    private Componente() { }
    public Componente(string nombre) { Nombre = nombre; Tipo = "Componente académico"; }
    public int ComponenteID { get; private set; }
    public string Nombre { get; private set; } = null!;
    public string Tipo { get; private set; } = null!;
}

public sealed class BomProyecto
{
    private BomProyecto() { }
    public BomProyecto(int componenteId, int cantidad) { ComponenteID = componenteId; CantidadRequerida = cantidad; }
    public int BOMID { get; private set; }
    public int ProyectoID { get; private set; }
    public int ComponenteID { get; private set; }
    public int CantidadRequerida { get; private set; }
    public Componente? Componente { get; private set; }
}
