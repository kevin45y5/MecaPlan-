using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace MecaPlan.Web.IntegrationTests.Account;

public sealed class AccountEndpointTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;
    public AccountEndpointTests(TestWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task Register_requires_antiforgery_and_never_echoes_the_password()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost") });
        var withoutToken = await client.PostAsync("/Account/Register", new FormUrlEncodedContent([]));
        Assert.Equal(HttpStatusCode.BadRequest, withoutToken.StatusCode);

        var page = await client.GetStringAsync("/Account/Register");
        var token = AntiforgeryToken(page);
        var password = "Clave1!x";
        var response = await client.PostAsync("/Account/Register", Form(token, new Dictionary<string, string>
        {
            ["Nombre"] = "Ana", ["Apellido"] = "Prueba", ["Carnet"] = "MECA-001", ["Email"] = "ana@example.test", ["Password"] = password, ["Confirmation"] = password
        }));
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var login = await client.GetStringAsync("/Account/Login");
        Assert.DoesNotContain(password, login);
        Assert.Contains("Registro completado", login);
    }

    [Fact]
    public async Task Login_uses_cookie_redirects_only_to_local_url_and_logout_revokes_access()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true, BaseAddress = new Uri("https://localhost") });
        var loginPage = await client.GetStringAsync("/Account/Login");
        var response = await client.PostAsync("/Account/Login", Form(AntiforgeryToken(loginPage), new Dictionary<string, string> { ["Email"] = "ana@example.test", ["Password"] = "Clave1!x", ["ReturnUrl"] = "https://example.test" }));
        Assert.Equal("/Dashboard/Index", response.Headers.Location?.OriginalString);
        Assert.Contains(response.Headers, header => header.Key == "Set-Cookie" && header.Value.Any(value => value.Contains("httponly", StringComparison.OrdinalIgnoreCase) && value.Contains("samesite=lax", StringComparison.OrdinalIgnoreCase)));

        var dashboard = await client.GetAsync("/Dashboard/Index");
        Assert.Equal(HttpStatusCode.OK, dashboard.StatusCode);
        var dashboardPage = await dashboard.Content.ReadAsStringAsync();
        var logout = await client.PostAsync("/Account/Logout", Form(AntiforgeryToken(dashboardPage), []));
        Assert.Equal(HttpStatusCode.Redirect, logout.StatusCode);
        var afterLogout = await client.GetAsync("/Dashboard/Index");
        Assert.Equal(HttpStatusCode.Redirect, afterLogout.StatusCode);
    }

    [Fact]
    public async Task Invalid_credentials_always_use_the_same_safe_message()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        var page = await client.GetStringAsync("/Account/Login");
        var response = await client.PostAsync("/Account/Login", Form(AntiforgeryToken(page), new Dictionary<string, string> { ["Email"] = "missing@example.test", ["Password"] = "Clave1!x" }));
        var html = await response.Content.ReadAsStringAsync();
        Assert.Contains("No fue posible iniciar sesión con las credenciales proporcionadas.", WebUtility.HtmlDecode(html));
    }

    private static string AntiforgeryToken(string html)
    {
        var match = Regex.Match(html, "<input[^>]*name=\"__RequestVerificationToken\"[^>]*value=\"([^\"]+)\"", RegexOptions.IgnoreCase);
        Assert.True(match.Success, "No se encontró el token antiforgery en el formulario.");
        return match.Groups[1].Value;
    }
    private static FormUrlEncodedContent Form(string token, IEnumerable<KeyValuePair<string, string>> values) => new(values.Append(new("__RequestVerificationToken", token)));
}
