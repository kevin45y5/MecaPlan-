using MecaPlan.Application.Authentication;
using MecaPlan.Application.Authentication.RateLimiting;
using MecaPlan.Domain.Entities;
using Xunit;

namespace MecaPlan.Application.Tests.Authentication;

public sealed class StudentAuthenticationServiceTests
{
    [Theory]
    [InlineData("Clave1!x", true)]
    [InlineData("clave1!x", false)]
    [InlineData("CLAVE1!X", false)]
    [InlineData("ClaveSinSimbolo1", false)]
    public void Strong_requires_the_configured_password_policy(string password, bool expected) =>
        Assert.Equal(expected, StudentAuthenticationService.Strong(password));

    [Fact]
    public async Task Register_hashes_the_password_and_never_passes_it_to_the_repository()
    {
        var repository = new FakeRepository();
        var service = new StudentAuthenticationService(repository, new FakeHasher(), new FakeAudit(), new AuthenticationAttemptPolicy());

        var result = await service.RegisterAsync(new("Ana", "López", "MECA-001", " ana@example.com ", "Clave1!x", "Clave1!x", "test", null));

        Assert.True(result.Succeeded);
        Assert.NotNull(repository.Added);
        Assert.Equal("HASH:Clave1!x", repository.Added!.PasswordHash);
        Assert.Equal("ANA@EXAMPLE.COM", repository.Added.EmailNormalizado);
    }

    [Fact]
    public void Attempt_policy_blocks_the_sixth_attempt_after_five_failures()
    {
        var policy = new AuthenticationAttemptPolicy();
        var now = DateTime.UtcNow;
        for (var attempt = 0; attempt < 5; attempt++) policy.RecordFailure("ANA@EXAMPLE.COM", now);

        Assert.True(policy.IsBlocked("ANA@EXAMPLE.COM", now.AddMinutes(1)));
        Assert.False(policy.IsBlocked("ANA@EXAMPLE.COM", now.AddMinutes(16)));
    }

    private sealed class FakeRepository : IEstudianteRepository
    {
        public Estudiante? Added { get; private set; }
        public Task<Estudiante?> FindByNormalizedEmailAsync(string email, CancellationToken ct = default) => Task.FromResult<Estudiante?>(null);
        public Task<Estudiante?> FindByCarnetAsync(string carnet, CancellationToken ct = default) => Task.FromResult<Estudiante?>(null);
        public Task<bool> AddAsync(Estudiante estudiante, CancellationToken ct = default) { Added = estudiante; return Task.FromResult(true); }
    }

    private sealed class FakeHasher : IPasswordHashService
    {
        public string Hash(Estudiante student, string password) => "HASH:" + password;
        public bool Verify(Estudiante student, string hash, string password) => hash == "HASH:" + password;
    }

    private sealed class FakeAudit : IAuthenticationAuditWriter
    {
        public Task WriteAsync(EventoAutenticacion evento, CancellationToken ct = default) => Task.CompletedTask;
    }
}
