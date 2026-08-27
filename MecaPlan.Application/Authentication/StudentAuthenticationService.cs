using System.Net;
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
    private const int MaxNameLength = 100;
    private const int MaxCarnetLength = 50;
    private const int MaxEmailLength = 256;
    private const int MaxPasswordLength = 128;

    public async Task<OperationResult> RegisterAsync(RegisterStudentCommand command, CancellationToken ct = default)
    {
        var email = Normalize(command.Email);
        var carnet = NormalizeCarnet(command.Carnet);
        var nombre = command.Nombre.Trim();
        var apellido = command.Apellido.Trim();
        if (!HasValidLength(nombre, MaxNameLength) ||
            !HasValidLength(apellido, MaxNameLength) ||
            !HasValidLength(carnet, MaxCarnetLength) ||
            email.Length > MaxEmailLength ||
            !IsEmail(command.Email) ||
            command.Password != command.Confirmation ||
            !Strong(command.Password))
            return new(false, "Revise los datos del registro.");
        if (await students.FindByNormalizedEmailAsync(email, ct) is not null || await students.FindByCarnetAsync(carnet, ct) is not null)
            return new(false, "No fue posible completar el registro con esos datos.");
        var draft = new Estudiante(nombre, apellido, carnet, command.Email.Trim(), email, "pending");
        var student = new Estudiante(nombre, apellido, carnet, command.Email.Trim(), email, hasher.Hash(draft, command.Password));
        if (!await students.AddAsync(student, ct)) return new(false, "No fue posible completar el registro con esos datos.");
        await audit.WriteAsync(new(student.EstudianteID, "Registro", "Exito", command.CorrelationId, MinimizeOrigin(command.Origin)), ct);
        return new(true);
    }

    public async Task<LoginResult> LoginAsync(LoginStudentCommand command, CancellationToken ct = default)
    {
        var email = Normalize(command.Email);
        var origin = MinimizeOrigin(command.Origin);
        var attemptKey = $"{email}\n{origin ?? "unknown"}";
        var utcNow = DateTime.UtcNow;
        if (attempts.IsBlocked(attemptKey, utcNow))
        {
            await audit.WriteAsync(new(null, "InicioSesion", "Rechazo", command.CorrelationId, origin), ct);
            return new(false, Error: InvalidLoginMessage);
        }
        var student = await students.FindByNormalizedEmailAsync(email, ct);
        var succeeded = student is not null && student.EstadoBit && hasher.Verify(student, student.PasswordHash, command.Password);
        if (succeeded) attempts.RecordSuccess(attemptKey); else attempts.RecordFailure(attemptKey, utcNow);
        await audit.WriteAsync(new(succeeded ? student!.EstudianteID : null, "InicioSesion", succeeded ? "Exito" : "Rechazo", command.CorrelationId, origin), ct);
        return succeeded ? new(true, student!.EstudianteID, $"{student.Nombre} {student.Apellido}") : new(false, Error: InvalidLoginMessage);
    }

    public static string Normalize(string email) => email.Trim().ToUpperInvariant();
    public static string NormalizeCarnet(string carnet) => carnet.Trim().ToUpperInvariant();
    public static bool Strong(string password) => password.Length is >= 8 and <= MaxPasswordLength && password.Any(char.IsUpper) && password.Any(char.IsLower) && password.Any(char.IsDigit) && password.Any(ch => !char.IsLetterOrDigit(ch));
    private static bool HasValidLength(string value, int maximum) => value.Length is > 0 && value.Length <= maximum;
    private static bool IsEmail(string value) => Regex.IsMatch(value.Trim(), "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static string? MinimizeOrigin(string? origin)
    {
        if (string.IsNullOrWhiteSpace(origin))
            return null;

        if (IPAddress.TryParse(origin, out var address))
            return address.ToString();

        if (Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IdnHost.Length <= 100)
            return uri.IdnHost.ToLowerInvariant();

        return null;
    }
}
