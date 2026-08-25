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
}
