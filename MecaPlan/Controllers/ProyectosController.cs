using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MecaPlan.Application.Abstractions.Security;
using MecaPlan.Application.Projects;
using MecaPlan.Dtos.Projects;

namespace MecaPlan.Controllers;

[ApiController]
[Authorize]
[Route("api/proyectos")]
public sealed class ProyectosController(
    IProyectoCreationService projects,
    ICurrentStudentContext currentStudent) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Crear(
        CrearProyectoDto dto,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ValidationProblemDetails(ModelState));

        int studentId;
        try
        {
            studentId = currentStudent.StudentId;
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }

        if (dto.EstudianteID != studentId)
            return Forbid();

        var project = await projects.CrearAsync(
            dto.Nombre.Trim(),
            dto.Descripcion.Trim(),
            studentId,
            cancellationToken);

        var response = new ProyectoCreadoDto(
            project.ProyectoID,
            project.Nombre,
            project.Descripcion,
            project.FechaCreacion,
            project.EstudianteID);

        return Created($"/api/proyectos/{project.ProyectoID}", response);
    }
}
