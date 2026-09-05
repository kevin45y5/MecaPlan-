using MecaPlan.Models;
using MecaPlan.Models.Ai;
using MecaPlan.Models.ViewModels;

namespace MecaPlan.Services
{
    public interface IGeneradorProyectoService
    {
        Task<ListaFaltantesAi> GenerarFaltantesAsync(Proyecto proyecto, CancellationToken cancellationToken = default);

        Task GuardarBomAsync(
            Proyecto proyecto,
            IReadOnlyList<BomItemViewModel> inventario,
            IReadOnlyList<BomItemViewModel> faltantes,
            CancellationToken cancellationToken = default);

        Task GenerarCodigoYPasosAsync(Proyecto proyecto, CancellationToken cancellationToken = default);
    }
}
