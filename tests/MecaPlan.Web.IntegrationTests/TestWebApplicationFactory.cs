using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MecaPlan.Application.Authentication;
using MecaPlan.Domain.Entities;
using MecaPlan.Application.Projects;

namespace MecaPlan.Web.IntegrationTests;

public sealed class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    public TestAuthenticationService Authentication { get; } = new();
    public TestProjectIdeaService Projects { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:MecaPlan", "Server=(localdb)\\MSSQLLocalDB;Database=MecaPlan_NotUsedByWebTests;Trusted_Connection=True");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IStudentAuthenticationService>();
            services.RemoveAll<IAuthenticationAuditWriter>();
            services.RemoveAll<IProjectIdeaService>();
            services.RemoveAll<IProyectoCreationService>();
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            services.AddSingleton<IStudentAuthenticationService>(Authentication);
            services.AddSingleton<IAuthenticationAuditWriter, NoOpAuditWriter>();
            services.AddSingleton<IProjectIdeaService>(Projects);
            services.AddSingleton<IProyectoCreationService, TestProyectoCreationService>();
        });
    }
}

public sealed class TestProjectIdeaService : IProjectIdeaService
{
    public Task<ProjectResult> CreateAsync(CreateProjectCommand command, CancellationToken ct = default) => Task.FromResult(new ProjectResult(true, 19, command.NombreProyecto, [new("Arduino Uno", 1)]));
    public Task<ProjectResult> GetOwnedAsync(int projectId, CancellationToken ct = default) => Task.FromResult(projectId == 19 ? new ProjectResult(true, 19, "Robot", [new("Arduino Uno", 1)], DescripcionIdea: "Arduino y motor") : new ProjectResult(false));
}

public sealed class TestProyectoCreationService : IProyectoCreationService
{
    public Task<Proyecto> CrearAsync(string nombre, string descripcion, int estudianteId, CancellationToken cancellationToken = default)
    {
        var project = new Proyecto(nombre, descripcion, estudianteId, DateTime.UtcNow);
        typeof(Proyecto).GetProperty(nameof(Proyecto.ProyectoID))!.SetValue(project, 99);
        return Task.FromResult(project);
    }
}

public sealed class TestAuthenticationService : IStudentAuthenticationService
{
    public bool RegisterSucceeds { get; set; } = true;
    public int RegisterCallCount { get; private set; }
    public Task<OperationResult> RegisterAsync(RegisterStudentCommand command, CancellationToken ct = default) =>
        RegisterAsyncCore();

    private Task<OperationResult> RegisterAsyncCore()
    {
        RegisterCallCount++;
        return Task.FromResult(RegisterSucceeds ? new OperationResult(true) : new OperationResult(false, "No fue posible completar el registro con esos datos."));
    }
    public Task<LoginResult> LoginAsync(LoginStudentCommand command, CancellationToken ct = default) =>
        Task.FromResult(command.Email.StartsWith("missing", StringComparison.OrdinalIgnoreCase)
            ? new LoginResult(false, Error: "No fue posible iniciar sesión con las credenciales proporcionadas.")
            : new LoginResult(true, 7, "Ana Prueba"));
}

public sealed class NoOpAuditWriter : IAuthenticationAuditWriter
{
    public Task WriteAsync(EventoAutenticacion evento, CancellationToken ct = default) => Task.CompletedTask;
}
