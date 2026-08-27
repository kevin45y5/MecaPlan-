using MecaPlan.Domain.Entities;

namespace MecaPlan.Application.Projects;

public interface IProyectoCreationService
{
    Task<Proyecto> CrearAsync(
        string nombre,
        string descripcion,
        int estudianteId,
        CancellationToken cancellationToken = default);
}
