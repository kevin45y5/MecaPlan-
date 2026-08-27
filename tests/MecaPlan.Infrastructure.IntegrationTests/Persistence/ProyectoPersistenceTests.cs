using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using MecaPlan.Application.Projects;
using MecaPlan.Domain.Entities;
using MecaPlan.Infrastructure.Persistence;
using MecaPlan.Infrastructure.Projects;
using Xunit;

namespace MecaPlan.Infrastructure.IntegrationTests.Persistence;

public sealed class ProyectoPersistenceTests
{
    private static MecaPlanDbContext CreateSqlContext()
    {
        var connection = Environment.GetEnvironmentVariable("MECAPLAN_TEST_CONNECTION");
        ArgumentException.ThrowIfNullOrWhiteSpace(connection);
        return new MecaPlanDbContext(
            new DbContextOptionsBuilder<MecaPlanDbContext>().UseSqlServer(connection).Options);
    }

    [Fact]
    public void Proyecto_mapping_matches_the_existing_database_contract()
    {
        using var db = new MecaPlanDbContext(
            new DbContextOptionsBuilder<MecaPlanDbContext>()
                .UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=MecaPlan_ModelOnly")
                .Options);

        var entity = db.Model.FindEntityType(typeof(Proyecto));

        Assert.NotNull(entity);
        Assert.Equal("Proyectos", entity!.GetSchema());
        Assert.Equal("Proyectos", entity.GetTableName());
        Assert.Equal(150, entity.FindProperty(nameof(Proyecto.Nombre))!.GetMaxLength());
        Assert.Equal("nvarchar(4000)", entity.FindProperty(nameof(Proyecto.Descripcion))!.GetColumnType());
        Assert.Equal(DeleteBehavior.NoAction, entity.GetForeignKeys().Single().DeleteBehavior);
    }

    [SqlFact]
    public async Task Creation_invokes_bom_once_with_the_persisted_project()
    {
        await using var db = CreateSqlContext();
        var student = await AddStudentAsync(db);
        var bom = new RecordingBomService();
        var service = new ProyectoCreationService(db, bom);

        var project = await service.CrearAsync(
            "Brazo de prueba",
            "Descripción para BOM",
            student.EstudianteID);

        Assert.True(project.ProyectoID > 0);
        Assert.Equal(1, bom.CallCount);
        Assert.Equal(project.ProyectoID, bom.ProjectId);
        Assert.Equal(project.Descripcion, bom.Description);
        Assert.True(await db.Proyectos.AnyAsync(item => item.ProyectoID == project.ProyectoID));
    }

    [SqlFact]
    public async Task Creation_rolls_back_when_bom_generation_fails()
    {
        await using var db = CreateSqlContext();
        var student = await AddStudentAsync(db);
        var name = "ROLLBACK-" + Guid.NewGuid().ToString("N");
        var service = new ProyectoCreationService(db, new ThrowingBomService());

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CrearAsync(name, "Descripción", student.EstudianteID));

        db.ChangeTracker.Clear();
        Assert.False(await db.Proyectos.AnyAsync(item => item.Nombre == name));
    }

    private static async Task<Estudiante> AddStudentAsync(MecaPlanDbContext db)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var student = new Estudiante(
            "Proyecto",
            "Prueba",
            "PROJECT-" + suffix,
            "project" + suffix + "@example.test",
            "PROJECT" + suffix + "@EXAMPLE.TEST",
            "hash-de-prueba");
        db.Estudiantes.Add(student);
        await db.SaveChangesAsync();
        return student;
    }

    private sealed class RecordingBomService : IBomService
    {
        public int CallCount { get; private set; }
        public int ProjectId { get; private set; }
        public string? Description { get; private set; }

        public Task GenerarBomAsync(int proyectoId, string descripcion)
        {
            CallCount++;
            ProjectId = proyectoId;
            Description = descripcion;
            return Task.CompletedTask;
        }
    }

    private sealed class ThrowingBomService : IBomService
    {
        public Task GenerarBomAsync(int proyectoId, string descripcion) =>
            throw new InvalidOperationException("Fallo BOM simulado.");
    }
}
