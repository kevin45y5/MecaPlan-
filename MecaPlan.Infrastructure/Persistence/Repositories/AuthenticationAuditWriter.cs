using MecaPlan.Application.Authentication;
using MecaPlan.Domain.Entities;

namespace MecaPlan.Infrastructure.Persistence.Repositories;

public sealed class AuthenticationAuditWriter(MecaPlanDbContext db) : IAuthenticationAuditWriter
{
    public async Task WriteAsync(EventoAutenticacion evento, CancellationToken ct = default)
    {
        db.EventosAutenticacion.Add(evento);
        await db.SaveChangesAsync(ct);
    }
}
