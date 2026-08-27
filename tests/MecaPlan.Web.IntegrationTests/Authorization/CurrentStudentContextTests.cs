using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using MecaPlan.Security;
using Xunit;

namespace MecaPlan.Web.IntegrationTests.Authorization;

public sealed class CurrentStudentContextTests
{
    [Fact]
    public void Accepts_only_a_positive_student_claim()
    {
        var http = new DefaultHttpContext();
        http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("StudentId", "23")], "test"));
        var accessor = new HttpContextAccessor { HttpContext = http };

        Assert.Equal(23, new CurrentStudentContext(accessor).StudentId);
    }

    [Fact]
    public void Rejects_missing_or_invalid_student_claim()
    {
        var accessor = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        Assert.Throws<UnauthorizedAccessException>(() => new CurrentStudentContext(accessor).StudentId);
    }

    [Fact]
    public void Rejects_a_student_claim_from_an_unauthenticated_identity()
    {
        var http = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("StudentId", "23")]))
        };
        var accessor = new HttpContextAccessor { HttpContext = http };

        Assert.Throws<UnauthorizedAccessException>(() => new CurrentStudentContext(accessor).StudentId);
    }

    [Fact]
    public void Rejects_ambiguous_student_claims()
    {
        var http = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim("StudentId", "23"), new Claim("StudentId", "24")],
                "test"))
        };
        var accessor = new HttpContextAccessor { HttpContext = http };

        Assert.Throws<UnauthorizedAccessException>(() => new CurrentStudentContext(accessor).StudentId);
    }
}
