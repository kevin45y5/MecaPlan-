using MecaPlan.Domain.Entities;
using Xunit;

namespace MecaPlan.Domain.Tests.Entities;

public sealed class ProyectoTests
{
    [Fact]
    public void New_project_normalizes_text_and_preserves_utc_creation_time()
    {
        var createdAt = DateTime.UtcNow;

        var project = new Proyecto(" Brazo ", " Descripción ", 7, createdAt);

        Assert.Equal("Brazo", project.Nombre);
        Assert.Equal("Descripción", project.Descripcion);
        Assert.Equal(7, project.EstudianteID);
        Assert.Equal(createdAt, project.FechaCreacion);
        Assert.Equal(DateTimeKind.Utc, project.FechaCreacion.Kind);
    }

    [Fact]
    public void New_project_rejects_invalid_domain_values()
    {
        Assert.Throws<ArgumentException>(() =>
            new Proyecto(" ", "Descripción", 7, DateTime.UtcNow));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new Proyecto("Nombre", "Descripción", 0, DateTime.UtcNow));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new Proyecto(new string('N', 151), "Descripción", 7, DateTime.UtcNow));
    }
}
