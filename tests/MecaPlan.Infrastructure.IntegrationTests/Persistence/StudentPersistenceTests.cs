using Microsoft.EntityFrameworkCore;
using MecaPlan.Domain.Entities;
using MecaPlan.Infrastructure.Persistence;
using MecaPlan.Infrastructure.Persistence.Repositories;
using MecaPlan.Infrastructure.Security;
using Xunit;

namespace MecaPlan.Infrastructure.IntegrationTests.Persistence;

public sealed class StudentPersistenceTests
{
    private static MecaPlanDbContext CreateContext()
    {
        var connection = Environment.GetEnvironmentVariable("MECAPLAN_TEST_CONNECTION");
        Assert.False(string.IsNullOrWhiteSpace(connection), "MECAPLAN_TEST_CONNECTION debe apuntar a la base aislada.");
        return new MecaPlanDbContext(new DbContextOptionsBuilder<MecaPlanDbContext>().UseSqlServer(connection).Options);
    }

    [Fact]
    public async Task Registration_persists_a_hash_and_rejects_duplicate_email()
    {
        await using var db = CreateContext();
        var repository = new EstudianteRepository(db);
        var suffix = Guid.NewGuid().ToString("N");
        var draft = new Estudiante("Ana", "Prueba", "TEST-" + suffix, "ana" + suffix + "@example.test", ("ANA" + suffix + "@EXAMPLE.TEST"), "pending");
        var hash = new AspNetPasswordHashService().Hash(draft, "Clave1!x");
        var student = new Estudiante("Ana", "Prueba", draft.Carnet, draft.Email, draft.EmailNormalizado, hash);

        Assert.True(await repository.AddAsync(student));
        Assert.True(new AspNetPasswordHashService().Verify(student, student.PasswordHash, "Clave1!x"));

        var duplicate = new Estudiante("Otra", "Prueba", "OTHER-" + suffix, draft.Email, draft.EmailNormalizado, hash);
        Assert.False(await repository.AddAsync(duplicate));

        var duplicateCarnet = new Estudiante("Otra", "Prueba", draft.Carnet, "other" + suffix + "@example.test", "OTHER" + suffix + "@EXAMPLE.TEST", hash);
        Assert.False(await repository.AddAsync(duplicateCarnet));
    }

    [Fact]
    public async Task Concurrent_registration_with_the_same_email_creates_only_one_account()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var email = "concurrent" + suffix + "@example.test";
        var normalizedEmail = email.ToUpperInvariant();
        var outcomes = await Task.WhenAll(Enumerable.Range(0, 4).Select(async index =>
        {
            await using var db = CreateContext();
            var student = new Estudiante("Ana", "Prueba", "CONCURRENT-" + index + "-" + suffix, email, normalizedEmail, "pending");
            var hash = new AspNetPasswordHashService().Hash(student, "Clave1!x");
            return await new EstudianteRepository(db).AddAsync(new Estudiante("Ana", "Prueba", student.Carnet, email, normalizedEmail, hash));
        }));

        Assert.Equal(1, outcomes.Count(result => result));
    }
}
