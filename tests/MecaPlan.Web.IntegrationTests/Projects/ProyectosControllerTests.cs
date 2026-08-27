using Microsoft.AspNetCore.Mvc;
using MecaPlan.Application.Abstractions.Security;
using MecaPlan.Application.Projects;
using MecaPlan.Controllers;
using MecaPlan.Domain.Entities;
using MecaPlan.Dtos.Projects;
using Xunit;

namespace MecaPlan.Web.IntegrationTests.Projects;

public sealed class ProyectosControllerTests
{
    [Fact]
    public async Task Crear_returns_created_with_the_persisted_project()
    {
        var service = new FakeProyectoCreationService();
        var controller = new ProyectosController(service, new FakeCurrentStudentContext(7));

        var result = await controller.Crear(
            new CrearProyectoDto(" Brazo clasificador ", " Separa piezas por color. ", 7),
            CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(result);
        Assert.Equal("/api/proyectos/42", created.Location);
        var response = Assert.IsType<ProyectoCreadoDto>(created.Value);
        Assert.Equal(42, response.ProyectoID);
        Assert.Equal("Brazo clasificador", response.Nombre);
        Assert.Equal(7, response.EstudianteID);
        Assert.Equal(DateTimeKind.Utc, response.FechaCreacion.Kind);
    }

    [Fact]
    public async Task Crear_does_not_call_the_service_when_model_state_is_invalid()
    {
        var service = new FakeProyectoCreationService();
        var controller = new ProyectosController(service, new FakeCurrentStudentContext(7));
        controller.ModelState.AddModelError(nameof(CrearProyectoDto.Nombre), "El nombre es obligatorio.");

        var result = await controller.Crear(
            new CrearProyectoDto("", "Descripción", 7),
            CancellationToken.None);

        var validation = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(400, validation.StatusCode);
        Assert.Equal(0, service.CallCount);
    }

    [Fact]
    public async Task Crear_forbids_a_student_id_that_does_not_match_the_session()
    {
        var service = new FakeProyectoCreationService();
        var controller = new ProyectosController(service, new FakeCurrentStudentContext(7));

        var result = await controller.Crear(
            new CrearProyectoDto("Brazo", "Descripción", 8),
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
        Assert.Equal(0, service.CallCount);
    }

    [Fact]
    public async Task Crear_rejects_an_invalid_authenticated_identity()
    {
        var service = new FakeProyectoCreationService();
        var controller = new ProyectosController(service, new InvalidCurrentStudentContext());

        var result = await controller.Crear(
            new CrearProyectoDto("Brazo", "Descripción", 7),
            CancellationToken.None);

        Assert.IsType<UnauthorizedResult>(result);
        Assert.Equal(0, service.CallCount);
    }

    private sealed class FakeCurrentStudentContext(int studentId) : ICurrentStudentContext
    {
        public int StudentId { get; } = studentId;
    }

    private sealed class InvalidCurrentStudentContext : ICurrentStudentContext
    {
        public int StudentId => throw new UnauthorizedAccessException();
    }

    private sealed class FakeProyectoCreationService : IProyectoCreationService
    {
        public int CallCount { get; private set; }

        public Task<Proyecto> CrearAsync(
            string nombre,
            string descripcion,
            int estudianteId,
            CancellationToken cancellationToken = default)
        {
            CallCount++;
            var project = new Proyecto(nombre, descripcion, estudianteId, DateTime.UtcNow);
            typeof(Proyecto).GetProperty(nameof(Proyecto.ProyectoID))!.SetValue(project, 42);
            return Task.FromResult(project);
        }
    }
}
