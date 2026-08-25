namespace MecaPlan.Domain.Entities;
public sealed class EventoAutenticacion
{
    private EventoAutenticacion() { }
    public EventoAutenticacion(int? estudianteId, string tipo, string resultado, string correlacion, string? origen) { EstudianteID = estudianteId; TipoEvento = tipo; Resultado = resultado; CorrelationId = correlacion; OrigenMinimizado = origen; FechaUtc = DateTime.UtcNow; }
    public int IdEventoAutenticacion { get; private set; }
    public int? EstudianteID { get; private set; }
    public string TipoEvento { get; private set; } = null!;
    public string Resultado { get; private set; } = null!;
    public DateTime FechaUtc { get; private set; }
    public string CorrelationId { get; private set; } = null!;
    public string? OrigenMinimizado { get; private set; }
}
