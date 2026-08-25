using Microsoft.AspNetCore.Identity;
using MecaPlan.Application.Authentication;
using MecaPlan.Domain.Entities;

namespace MecaPlan.Infrastructure.Security;

public sealed class AspNetPasswordHashService : IPasswordHashService
{
    private readonly PasswordHasher<Estudiante> _hasher = new();
    public string Hash(Estudiante student, string password) => _hasher.HashPassword(student, password);
    public bool Verify(Estudiante student, string hash, string password) =>
        _hasher.VerifyHashedPassword(student, hash, password) != PasswordVerificationResult.Failed;
}
