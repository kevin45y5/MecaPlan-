using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace MecaPlan.Web.IntegrationTests.Authorization;

public sealed class DashboardRedirectTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    public DashboardRedirectTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public async Task Visitor_is_redirected_to_login_before_receiving_dashboard_content()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost") });
        var response = await client.GetAsync("/Dashboard/Index");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/Account/Login", response.Headers.Location?.AbsolutePath);
    }
}
