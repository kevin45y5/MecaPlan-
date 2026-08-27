namespace MecaPlan.Domain.Entities;

public sealed class Proyecto
{
    private Proyecto() { }

    public Proyecto(int estudianteId, string nombreProyecto, string descripcionIdea)
        : this(nombreProyecto, descripcionIdea, estudianteId, DateTime.UtcNow)
    {
    }

    public Proyecto(string nombre, string descripcion, int estudianteId, DateTime fechaCreacion)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(nombre);
        ArgumentException.ThrowIfNullOrWhiteSpace(descripcion);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(estudianteId);
        nombre = nombre.Trim();
        descripcion = descripcion.Trim();
        if (nombre.Length > 150) throw new ArgumentOutOfRangeException(nameof(nombre), "El nombre no puede superar 150 caracteres.");
        if (descripcion.Length > 4000) throw new ArgumentOutOfRangeException(nameof(descripcion), "La descripcion no puede superar 4000 caracteres.");
        EstudianteID = estudianteId;
        Nombre = nombre;
        Descripcion = descripcion;
        FechaCreacion = fechaCreacion.Kind == DateTimeKind.Utc ? fechaCreacion : fechaCreacion.ToUniversalTime();
    }

    public int ProyectoID { get; private set; }
    public int EstudianteID { get; private set; }
    public string Nombre { get; private set; } = null!;
    public string Descripcion { get; private set; } = null!;
    public string NombreProyecto => Nombre;
    public string DescripcionIdea => Descripcion;
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
