using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;
using MecaPlan.Dtos.Projects;
using Xunit;

namespace MecaPlan.Web.IntegrationTests.Projects;

public sealed class ProyectosEndpointTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public ProyectosEndpointTests(TestWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task Post_requires_an_authenticated_student()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsJsonAsync(
            "/api/proyectos",
            new CrearProyectoDto("Brazo", "Descripción", 7));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Authenticated_student_can_create_a_project_for_their_identity()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
            BaseAddress = new Uri("https://localhost")
        });
        var loginPage = await client.GetStringAsync("/Account/Login");
        var login = await client.PostAsync("/Account/Login", Form(
            AntiforgeryToken(loginPage),
            new Dictionary<string, string>
            {
                ["Email"] = "ana@example.test",
                ["Password"] = "Clave1!x"
            }));
        Assert.Equal(HttpStatusCode.Redirect, login.StatusCode);

        var response = await client.PostAsJsonAsync(
            "/api/proyectos",
            new CrearProyectoDto("Brazo", "Descripción", 7));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("/api/proyectos/99", response.Headers.Location?.OriginalString);
        var project = await response.Content.ReadFromJsonAsync<ProyectoCreadoDto>();
        Assert.NotNull(project);
        Assert.Equal(7, project!.EstudianteID);
    }

    private static string AntiforgeryToken(string html)
    {
        var match = Regex.Match(
            html,
            "<input[^>]*name=\"__RequestVerificationToken\"[^>]*value=\"([^\"]+)\"",
            RegexOptions.IgnoreCase);
        Assert.True(match.Success, "No se encontró el token antiforgery en el formulario.");
        return match.Groups[1].Value;
    }

    private static FormUrlEncodedContent Form(
        string token,
        IEnumerable<KeyValuePair<string, string>> values) =>
        new(values.Append(new("__RequestVerificationToken", token)));
}
