using System.Text.RegularExpressions;
using MecaPlan.Application.Authentication.RateLimiting;
using MecaPlan.Domain.Entities;

namespace MecaPlan.Application.Authentication;

public sealed class StudentAuthenticationService(
    IEstudianteRepository students,
    IPasswordHashService hasher,
    IAuthenticationAuditWriter audit,
    IAuthenticationAttemptPolicy attempts) : IStudentAuthenticationService
{
    private const string InvalidLoginMessage = "No fue posible iniciar sesión con las credenciales proporcionadas.";

    public async Task<OperationResult> RegisterAsync(RegisterStudentCommand command, CancellationToken ct = default)
    {
        var email = Normalize(command.Email);
        var carnet = command.Carnet.Trim();
        if (string.IsNullOrWhiteSpace(command.Nombre) || string.IsNullOrWhiteSpace(command.Apellido) || string.IsNullOrWhiteSpace(carnet) || !IsEmail(command.Email) || command.Password != command.Confirmation || !Strong(command.Password))
            return new(false, "Revise los datos del registro.");
        if (await students.FindByNormalizedEmailAsync(email, ct) is not null || await students.FindByCarnetAsync(carnet, ct) is not null)
            return new(false, "No fue posible completar el registro con esos datos.");
        var draft = new Estudiante(command.Nombre.Trim(), command.Apellido.Trim(), carnet, command.Email.Trim(), email, "pending");
        var student = new Estudiante(command.Nombre.Trim(), command.Apellido.Trim(), carnet, command.Email.Trim(), email, hasher.Hash(draft, command.Password));
        if (!await students.AddAsync(student, ct)) return new(false, "No fue posible completar el registro con esos datos.");
        await audit.WriteAsync(new(student.EstudianteID, "Registro", "Exito", command.CorrelationId, MinimizeOrigin(command.Origin)), ct);
        return new(true);
    }

    public async Task<LoginResult> LoginAsync(LoginStudentCommand command, CancellationToken ct = default)
    {
        var email = Normalize(command.Email);
        if (attempts.IsBlocked(email, DateTime.UtcNow))
        {
            await audit.WriteAsync(new(null, "InicioSesion", "Rechazo", command.CorrelationId, MinimizeOrigin(command.Origin)), ct);
            return new(false, Error: InvalidLoginMessage);
        }
        var student = await students.FindByNormalizedEmailAsync(email, ct);
        var succeeded = student is not null && student.EstadoBit && hasher.Verify(student, student.PasswordHash, command.Password);
        if (succeeded) attempts.RecordSuccess(email); else attempts.RecordFailure(email, DateTime.UtcNow);
        await audit.WriteAsync(new(succeeded ? student!.EstudianteID : null, "InicioSesion", succeeded ? "Exito" : "Rechazo", command.CorrelationId, MinimizeOrigin(command.Origin)), ct);
        return succeeded ? new(true, student!.EstudianteID, $"{student.Nombre} {student.Apellido}") : new(false, Error: InvalidLoginMessage);
    }

    public static string Normalize(string email) => email.Trim().ToUpperInvariant();
    public static bool Strong(string password) => password.Length >= 8 && password.Any(char.IsUpper) && password.Any(char.IsLower) && password.Any(char.IsDigit) && password.Any(ch => !char.IsLetterOrDigit(ch));
    private static bool IsEmail(string value) => Regex.IsMatch(value.Trim(), "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static string? MinimizeOrigin(string? origin) =>
        Uri.TryCreate(origin, UriKind.Absolute, out var uri) ? uri.Host : null;
}
