using MecaPlan.Application.Projects;

namespace MecaPlan.Infrastructure.Bom;

/// <summary>
/// Punto de extensión inicial. No inventa materiales hasta que exista una regla de BOM aprobada.
/// </summary>
public sealed class DummyBomService : IBomService
{
    public Task GenerarBomAsync(int proyectoId, string descripcion) => Task.CompletedTask;
}
