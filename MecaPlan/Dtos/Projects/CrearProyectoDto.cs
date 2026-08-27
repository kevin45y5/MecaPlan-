using System.ComponentModel.DataAnnotations;

namespace MecaPlan.Dtos.Projects;

public sealed class CrearProyectoDto
{
    public CrearProyectoDto()
    {
    }

    public CrearProyectoDto(string nombre, string descripcion, int estudianteID)
    {
        Nombre = nombre;
        Descripcion = descripcion;
        EstudianteID = estudianteID;
    }

    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [StringLength(150, ErrorMessage = "El nombre no puede superar 150 caracteres.")]
    public string Nombre { get; init; } = string.Empty;

    [Required(ErrorMessage = "La descripción es obligatoria.")]
    [StringLength(4000, ErrorMessage = "La descripción no puede superar 4000 caracteres.")]
    public string Descripcion { get; init; } = string.Empty;

    [Range(1, int.MaxValue, ErrorMessage = "El identificador de estudiante no es válido.")]
    public int EstudianteID { get; init; }
}

public sealed record ProyectoCreadoDto(
    int ProyectoID,
    string Nombre,
    string Descripcion,
    DateTime FechaCreacion,
    int EstudianteID);
