using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MecaPlan.Application.Projects;
using MecaPlan.ViewModels.Projects;

namespace MecaPlan.Controllers;

[Authorize]
public sealed class ProjectsController(IProjectIdeaService service) : Controller
{
    [HttpGet] public IActionResult Create() => View();

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CreateProjectViewModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid) return View(model);
        var result = await service.CreateAsync(new(model.NombreProyecto, model.DescripcionIdea), ct);
        if (!result.Succeeded) { ModelState.AddModelError(string.Empty, result.Error!); return View(model); }
        return RedirectToAction(nameof(Result), new { id = result.ProyectoId });
    }

    [HttpGet]
    public async Task<IActionResult> Result(int id, CancellationToken ct)
    {
        var result = await service.GetOwnedAsync(id, ct);
        if (!result.Succeeded) return NotFound();
        return View(new ProjectResultViewModel(result.ProyectoId!.Value, result.NombreProyecto!, result.Bom ?? []));
    }
}
