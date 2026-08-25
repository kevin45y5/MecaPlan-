using Microsoft.EntityFrameworkCore;
using MecaPlan.Application.Authentication;
using MecaPlan.Domain.Entities;

namespace MecaPlan.Infrastructure.Persistence.Repositories;

public sealed class EstudianteRepository(MecaPlanDbContext db) : IEstudianteRepository
{
    public Task<Estudiante?> FindByNormalizedEmailAsync(string email, CancellationToken ct = default) =>
        db.Estudiantes.SingleOrDefaultAsync(x => x.EmailNormalizado == email, ct);

    public Task<Estudiante?> FindByCarnetAsync(string carnet, CancellationToken ct = default) =>
        db.Estudiantes.SingleOrDefaultAsync(x => x.Carnet == carnet, ct);

    public async Task<bool> AddAsync(Estudiante estudiante, CancellationToken ct = default)
    {
        try { db.Estudiantes.Add(estudiante); await db.SaveChangesAsync(ct); return true; }
        catch (DbUpdateException) { return false; }
    }
}
