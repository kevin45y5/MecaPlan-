using System.ComponentModel.DataAnnotations;
namespace MecaPlan.ViewModels.Projects;
public sealed class CreateProjectViewModel { [Required, StringLength(150)] public string NombreProyecto { get; set; } = ""; [Required, StringLength(4000)] public string DescripcionIdea { get; set; } = ""; }
public sealed record ProjectResultViewModel(int ProyectoId, string NombreProyecto, IReadOnlyList<MecaPlan.Application.Projects.BomSuggestion> Bom);
