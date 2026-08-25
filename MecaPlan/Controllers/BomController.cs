using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MecaPlan.Infrastructure.Persistence;
using MecaPlan.Models.Bom;

namespace MecaPlan.Controllers;

public class BomController : Controller
{
    private readonly MecaPlanDbContext _db;

    public BomController(MecaPlanDbContext db) => _db = db;

    public async Task<IActionResult> Index()
    {
        var proyecto = await _db.Database
            .SqlQuery<ProyectoRefDto>($"""
                SELECT TOP (1) ProyectoID AS Id, NombreProyecto AS Nombre
                FROM Proyectos.Proyectos
                ORDER BY ProyectoID
                """)
            .SingleOrDefaultAsync();

        if (proyecto is null)
        {
            TempData["Mensaje"] = "Aún no hay proyectos registrados.";
            return View(new BomChecklistViewModel());
        }

        var items = await _db.Database
            .SqlQuery<BomItemViewModel>($"""
                SELECT b.BOMID AS BomId, c.Nombre, c.Tipo,
                       c.PrecioEstimado, b.CantidadRequerida, b.EsFaltante
                FROM Proyectos.BOMProyectos b
                JOIN Inventario.Componentes c ON c.ComponenteID = b.ComponenteID
                WHERE b.ProyectoID = {proyecto.Id}
                ORDER BY b.BOMID
                """)
            .ToListAsync();

        return View(new BomChecklistViewModel
        {
            ProyectoId = proyecto.Id,
            NombreProyecto = proyecto.Nombre,
            Items = items
        });
    }

    [HttpPost("Toggle")]
    public async Task<IActionResult> Toggle(int bomId, bool esFaltante)
    {
        await _db.Database
            .ExecuteSqlRawAsync($"UPDATE Proyectos.BOMProyectos SET EsFaltante = {esFaltante} WHERE BOMID = {bomId}");
        return Ok(new { bomId, esFaltante });
    }

    private sealed class ProyectoRefDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = "";
    }
}