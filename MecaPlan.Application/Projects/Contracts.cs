using MecaPlan.Domain.Entities;

namespace MecaPlan.Application.Projects;

public record CreateProjectCommand(string NombreProyecto, string DescripcionIdea);
public record BomSuggestion(string Componente, int Cantidad);
public record ProjectResult(bool Succeeded, int? ProyectoId = null, string? NombreProyecto = null, IReadOnlyList<BomSuggestion>? Bom = null, string? Error = null);

public interface IBomGenerator { IReadOnlyList<BomSuggestion> Generate(string descripcionIdea); }
public interface IProyectoRepository { Task<int> CreateWithBomAsync(Proyecto proyecto, IReadOnlyList<BomSuggestion> bom, CancellationToken ct = default); Task<Proyecto?> FindOwnedAsync(int proyectoId, int estudianteId, CancellationToken ct = default); }
public interface IProjectIdeaService { Task<ProjectResult> CreateAsync(CreateProjectCommand command, CancellationToken ct = default); Task<ProjectResult> GetOwnedAsync(int proyectoId, CancellationToken ct = default); }
