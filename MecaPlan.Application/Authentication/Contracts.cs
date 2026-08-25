using MecaPlan.Domain.Entities;
namespace MecaPlan.Application.Authentication;
public record RegisterStudentCommand(string Nombre,string Apellido,string Carnet,string Email,string Password,string Confirmation,string CorrelationId,string? Origin);
public record LoginStudentCommand(string Email,string Password,string CorrelationId,string? Origin);
public record OperationResult(bool Succeeded,string? Error = null);
public record LoginResult(bool Succeeded,int? StudentId = null,string? Name = null,string? Error = null);
public interface IStudentAuthenticationService { Task<OperationResult> RegisterAsync(RegisterStudentCommand command,CancellationToken ct=default); Task<LoginResult> LoginAsync(LoginStudentCommand command,CancellationToken ct=default); }
public interface IEstudianteRepository { Task<Estudiante?> FindByNormalizedEmailAsync(string email,CancellationToken ct=default); Task<Estudiante?> FindByCarnetAsync(string carnet,CancellationToken ct=default); Task<bool> AddAsync(Estudiante estudiante,CancellationToken ct=default); }
public interface IPasswordHashService { string Hash(Estudiante student,string password); bool Verify(Estudiante student,string hash,string password); }
public interface IAuthenticationAuditWriter { Task WriteAsync(EventoAutenticacion evento,CancellationToken ct=default); }
