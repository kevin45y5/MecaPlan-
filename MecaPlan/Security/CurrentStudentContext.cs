using System.Security.Claims;
using MecaPlan.Application.Abstractions.Security;

namespace MecaPlan.Security;

public sealed class CurrentStudentContext(IHttpContextAccessor accessor) : ICurrentStudentContext
{
    public int StudentId
    {
        get
        {
            var value = accessor.HttpContext?.User.FindFirstValue("StudentId");
            if (!int.TryParse(value, out var studentId) || studentId <= 0)
                throw new UnauthorizedAccessException("La identidad de estudiante no es válida.");
            return studentId;
        }
    }
}
