namespace MecaPlan.Application.Projects;

public interface IBomService
{
    Task GenerarBomAsync(int proyectoId, string descripcion);
}
