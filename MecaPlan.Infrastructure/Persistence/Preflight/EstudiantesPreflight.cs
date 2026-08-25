using System.Data;
using Microsoft.EntityFrameworkCore;

namespace MecaPlan.Infrastructure.Persistence.Preflight;

public sealed record EstudiantesPreflightResult(int DuplicateCarnets, int DuplicateEmails, int NullStates, int MissingHashes)
{
    public bool CanMigrate => DuplicateCarnets == 0 && DuplicateEmails == 0 && MissingHashes == 0;
}

/// <summary>Read-only guard used before applying the SP-1 migration to an existing database.</summary>
public sealed class EstudiantesPreflight(MecaPlanDbContext db)
{
    public async Task<EstudiantesPreflightResult> CheckAsync(CancellationToken ct = default)
    {
        var connection = db.Database.GetDbConnection();
        await connection.OpenAsync(ct);
        try
        {
            return new EstudiantesPreflightResult(
                await CountAsync("SELECT COUNT(*) FROM (SELECT Carnet FROM Seguridad.Estudiantes GROUP BY Carnet HAVING COUNT(*) > 1) D", ct),
                await CountAsync("SELECT COUNT(*) FROM (SELECT UPPER(LTRIM(RTRIM(Email))) FROM Seguridad.Estudiantes GROUP BY UPPER(LTRIM(RTRIM(Email))) HAVING COUNT(*) > 1) D", ct),
                await CountAsync("SELECT COUNT(*) FROM Seguridad.Estudiantes WHERE EstadoBit IS NULL", ct),
                await CountAsync("SELECT COUNT(*) FROM Seguridad.Estudiantes WHERE PasswordHash IS NULL OR LTRIM(RTRIM(PasswordHash)) = ''", ct));
        }
        finally { await connection.CloseAsync(); }
    }

    private async Task<int> CountAsync(string sql, CancellationToken ct)
    {
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandText = sql;
        command.CommandType = CommandType.Text;
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
    }
}
