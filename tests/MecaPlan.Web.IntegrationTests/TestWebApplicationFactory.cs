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
            services.AddSingleton<IStudentAuthenticationService>(Authentication);
            services.AddSingleton<IAuthenticationAuditWriter, NoOpAuditWriter>();
            services.AddSingleton<IProjectIdeaService>(Projects);
        });
    }
}

public sealed class TestProjectIdeaService : IProjectIdeaService
{
    public Task<ProjectResult> CreateAsync(CreateProjectCommand command, CancellationToken ct = default) => Task.FromResult(new ProjectResult(true, 19, command.NombreProyecto, [new("Arduino Uno", 1)]));
    public Task<ProjectResult> GetOwnedAsync(int projectId, CancellationToken ct = default) => Task.FromResult(projectId == 19 ? new ProjectResult(true, 19, "Robot", [new("Arduino Uno", 1)]) : new ProjectResult(false));
}

public sealed class TestAuthenticationService : IStudentAuthenticationService
{
    public bool RegisterSucceeds { get; set; } = true;
    public Task<OperationResult> RegisterAsync(RegisterStudentCommand command, CancellationToken ct = default) =>
        Task.FromResult(RegisterSucceeds ? new OperationResult(true) : new OperationResult(false, "No fue posible completar el registro con esos datos."));
    public Task<LoginResult> LoginAsync(LoginStudentCommand command, CancellationToken ct = default) =>
        Task.FromResult(command.Email.StartsWith("missing", StringComparison.OrdinalIgnoreCase)
            ? new LoginResult(false, Error: "No fue posible iniciar sesión con las credenciales proporcionadas.")
            : new LoginResult(true, 7, "Ana Prueba"));
}

public sealed class NoOpAuditWriter : IAuthenticationAuditWriter
{
    public Task WriteAsync(EventoAutenticacion evento, CancellationToken ct = default) => Task.CompletedTask;
}
