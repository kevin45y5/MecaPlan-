using MecaPlan.Application.Projects;
using MecaPlan.Domain.Entities;
using MecaPlan.Infrastructure.Persistence;

namespace MecaPlan.Infrastructure.Projects;

public sealed class ProyectoCreationService(
    MecaPlanDbContext db,
    IBomService bom) : IProyectoCreationService
{
    public async Task<Proyecto> CrearAsync(
        string nombre,
        string descripcion,
        int estudianteId,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var project = new Proyecto(nombre, descripcion, estudianteId, DateTime.UtcNow);
        db.Proyectos.Add(project);
        await db.SaveChangesAsync(cancellationToken);

        await bom.GenerarBomAsync(project.ProyectoID, project.Descripcion);
        await transaction.CommitAsync(cancellationToken);
        return project;
    }
}
