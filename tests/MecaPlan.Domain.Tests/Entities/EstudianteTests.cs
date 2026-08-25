using MecaPlan.Domain.Entities;
using Xunit;

namespace MecaPlan.Domain.Tests.Entities;

public sealed class EstudianteTests
{
    [Fact]
    public void New_student_is_active_and_uses_utc_registration_time()
    {
        var before = DateTime.UtcNow;
        var student = new Estudiante("Ana", "Prueba", "MECA-001", "ana@example.test", "ANA@EXAMPLE.TEST", "hash");
        var after = DateTime.UtcNow;

        Assert.True(student.EstadoBit);
        Assert.InRange(student.FechaRegistro, before, after);
        Assert.Equal("ANA@EXAMPLE.TEST", student.EmailNormalizado);
    }
}
