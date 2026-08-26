using Microsoft.EntityFrameworkCore;
using MecaPlan.Application.Projects;
using MecaPlan.Domain.Entities;

namespace MecaPlan.Infrastructure.Persistence.Repositories;

public sealed class ProyectoRepository(MecaPlanDbContext db) : IProyectoRepository
{
    public async Task<int> CreateWithBomAsync(Proyecto proyecto, IReadOnlyList<BomSuggestion> bom, CancellationToken ct = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.Proyectos.Add(proyecto); await db.SaveChangesAsync(ct);
        foreach (var suggestion in bom)
        {
            var component = await db.Componentes.SingleOrDefaultAsync(x => x.Nombre == suggestion.Componente, ct);
            if (component is null)
            {
                component = new Componente(suggestion.Componente);
                db.Componentes.Add(component);
                await db.SaveChangesAsync(ct);
            }
            proyecto.EntradasBom.Add(new BomProyecto(component.ComponenteID, suggestion.Cantidad));
        }
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return proyecto.ProyectoID;
    }

    public Task<Proyecto?> FindOwnedAsync(int proyectoId, int estudianteId, CancellationToken ct = default) =>
        db.Proyectos.Include(x => x.EntradasBom).ThenInclude(x => x.Componente).SingleOrDefaultAsync(x => x.ProyectoID == proyectoId && x.EstudianteID == estudianteId, ct);
}
