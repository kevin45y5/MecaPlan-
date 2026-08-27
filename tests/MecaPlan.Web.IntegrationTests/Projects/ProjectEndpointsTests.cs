using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace MecaPlan.Web.IntegrationTests.Projects;

public sealed class ProjectEndpointsTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;
    public ProjectEndpointsTests(TestWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task Visitor_is_redirected_and_authenticated_student_can_create_an_idea()
    {
        var visitor = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost") });
        Assert.Equal(HttpStatusCode.Redirect, (await visitor.GetAsync("/Projects/Create")).StatusCode);

        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost") });
        var login = await client.GetStringAsync("/Account/Login");
        await client.PostAsync("/Account/Login", Form(Token(login), [new("Email", "ana@example.test"), new("Password", "Clave1!x")]));
        var page = await client.GetStringAsync("/Projects/Create");
        var created = await client.PostAsync("/Projects/Create", Form(Token(page), [new("NombreProyecto", "Robot"), new("DescripcionIdea", "Arduino y motor") ]));
        Assert.Equal("/Projects/Result/19", created.Headers.Location?.OriginalString);
    }
    private static string Token(string html) => Regex.Match(html, "name=\"__RequestVerificationToken\"[^>]*value=\"([^\"]+)", RegexOptions.IgnoreCase).Groups[1].Value;
    private static FormUrlEncodedContent Form(string token, IEnumerable<KeyValuePair<string,string>> values) => new(values.Append(new("__RequestVerificationToken", token)));
}
