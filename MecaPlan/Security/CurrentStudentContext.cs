using System.Security.Claims;
using System.Globalization;
using MecaPlan.Application.Abstractions.Security;

namespace MecaPlan.Security;

public sealed class CurrentStudentContext(IHttpContextAccessor accessor) : ICurrentStudentContext
{
    public int StudentId
    {
        get
        {
            var user = accessor.HttpContext?.User;
            var values = user?.Identities
                .Where(identity => identity.IsAuthenticated)
                .SelectMany(identity => identity.FindAll("StudentId"))
                .Select(claim => claim.Value)
                .ToArray();

            if (values is not [var value] ||
                !int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var studentId) ||
                studentId <= 0)
                throw new UnauthorizedAccessException("La identidad de estudiante no es válida.");
            return studentId;
        }
    }
}
