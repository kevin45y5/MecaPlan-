namespace MecaPlan.Application.Abstractions.Security;

/// <summary>Provides the student identity derived exclusively from an authenticated session.</summary>
public interface ICurrentStudentContext
{
    int StudentId { get; }
}
