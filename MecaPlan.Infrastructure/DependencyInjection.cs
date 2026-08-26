using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MecaPlan.Application.Authentication;
using MecaPlan.Application.Authentication.RateLimiting;
using MecaPlan.Infrastructure.Persistence;
using MecaPlan.Infrastructure.Persistence.Repositories;
using MecaPlan.Infrastructure.Security;
using MecaPlan.Application.Projects;
using MecaPlan.Infrastructure.Projects;

namespace MecaPlan.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MecaPlan")
            ?? throw new InvalidOperationException("La cadena de conexión MecaPlan debe configurarse fuera del repositorio.");
        services.AddDbContext<MecaPlanDbContext>(options => options.UseSqlServer(connectionString));
        services.AddScoped<IEstudianteRepository, EstudianteRepository>();
        services.AddSingleton<IPasswordHashService, AspNetPasswordHashService>();
        services.AddScoped<IAuthenticationAuditWriter, AuthenticationAuditWriter>();
        services.AddSingleton<IAuthenticationAttemptPolicy, AuthenticationAttemptPolicy>();
        services.AddScoped<IStudentAuthenticationService, StudentAuthenticationService>();
        services.AddScoped<IProyectoRepository, ProyectoRepository>();
        services.AddSingleton<IBomGenerator, KeywordBomGenerator>();
        services.AddScoped<IProjectIdeaService, ProjectIdeaService>();
        return services;
    }
}
