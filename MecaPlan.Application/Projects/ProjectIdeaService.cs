using MecaPlan.Application.Abstractions.Security;
using MecaPlan.Domain.Entities;

namespace MecaPlan.Application.Projects;

public sealed class ProjectIdeaService(ICurrentStudentContext currentStudent, IProyectoRepository projects, IBomGenerator generator) : IProjectIdeaService
{
    public async Task<ProjectResult> CreateAsync(CreateProjectCommand command, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(command.NombreProyecto) || string.IsNullOrWhiteSpace(command.DescripcionIdea))
            return new(false, Error: "Escriba el nombre y la descripción de la idea.");
        if (command.NombreProyecto.Trim().Length > 150 || command.DescripcionIdea.Trim().Length > 4000)
            return new(false, Error: "La idea excede la longitud permitida.");

        var bom = generator.Generate(command.DescripcionIdea);
        var project = new Proyecto(currentStudent.StudentId, command.NombreProyecto.Trim(), command.DescripcionIdea.Trim());
        var projectId = await projects.CreateWithBomAsync(project, bom, ct);
        return new(true, projectId, project.NombreProyecto, bom);
    }

    public async Task<ProjectResult> GetOwnedAsync(int proyectoId, CancellationToken ct = default)
    {
        var project = await projects.FindOwnedAsync(proyectoId, currentStudent.StudentId, ct);
        if (project is null) return new(false, Error: "No fue posible encontrar el proyecto solicitado.");
        var bom = project.EntradasBom.Select(x => new BomSuggestion(x.Componente?.Nombre ?? "Componente", x.CantidadRequerida)).ToList();
        return new(true, project.ProyectoID, project.NombreProyecto, bom);
    }
}
