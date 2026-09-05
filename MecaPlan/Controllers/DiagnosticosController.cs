using System.Security.Claims;
using System.Text.Json;
using MecaPlan.Data;
using MecaPlan.Models;
using MecaPlan.Models.ViewModels;
using MecaPlan.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MecaPlan.Controllers
{
    [Authorize]
    public class DiagnosticosController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IAiChatClient _ia;
        private readonly ILogger<DiagnosticosController> _logger;

        public DiagnosticosController(
            ApplicationDbContext context,
            IAiChatClient ia,
            ILogger<DiagnosticosController> logger)
        {
            _context = context;
            _ia = ia;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return Challenge();
            }

            ViewData["Wide"] = true;
            var model = new DiagnosticoIndexViewModel
            {
                Proyectos = await _context.Proyectos
                    .Where(p => p.EstudianteID == estudianteId && p.Activo)
                    .OrderByDescending(p => p.FechaCreacion)
                    .Select(p => new DiagnosticoIndexViewModel.ProyectoSelectorItem
                    {
                        ProyectoID = p.ProyectoID,
                        Nombre = p.NombreProyecto
                    })
                    .ToListAsync()
            };

            return View(model);
        }

        [HttpGet]
        public async Task<IActionResult> Proyectos()
        {
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return Unauthorized();
            }

            var proyectos = await _context.Proyectos
                .Where(p => p.EstudianteID == estudianteId && p.Activo)
                .OrderByDescending(p => p.FechaCreacion)
                .Select(p => new { p.ProyectoID, Nombre = p.NombreProyecto })
                .ToListAsync();

            return Json(new { proyectos });
        }

        [HttpGet]
        public async Task<IActionResult> Historial(int proyectoId)
        {
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return Unauthorized();
            }

            var proyecto = await _context.Proyectos
                .FirstOrDefaultAsync(p => p.ProyectoID == proyectoId && p.EstudianteID == estudianteId && p.Activo);
            if (proyecto is null)
            {
                return NotFound();
            }

            var items = await _context.Diagnosticos
                .Where(d => d.ProyectoID == proyectoId)
                .OrderByDescending(d => d.FechaReporte)
                .Select(d => new
                {
                    d.DiagnosticoID,
                    d.TipoError,
                    d.DescripcionFalla,
                    d.SolucionSugerida,
                    d.FechaReporte,
                    d.FechaResolucion
                })
                .ToListAsync();

            return Json(new { proyectoId, items });
        }

        [HttpPost]
        public async Task<IActionResult> Enviar([FromBody] EnviarDiagnosticoRequest request)
        {
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return Unauthorized();
            }

            if (request is null || request.ProyectoID <= 0 || string.IsNullOrWhiteSpace(request.Mensaje))
            {
                return BadRequest(new { error = "Falta el proyecto o la descripción del problema." });
            }

            var proyecto = await _context.Proyectos
                .FirstOrDefaultAsync(p => p.ProyectoID == request.ProyectoID && p.EstudianteID == estudianteId && p.Activo);
            if (proyecto is null)
            {
                return NotFound();
            }

            var componentes = await _context.ProyectoComponentes
                .Include(pc => pc.Componente)
                .Where(pc => pc.ProyectoID == proyecto.ProyectoID)
                .OrderBy(pc => pc.EnInventario)
                .ToListAsync();

            string respuesta;
            try
            {
                respuesta = await _ia.CompleteTextAsync(
                    DiagnosticoIngenieriaPrompt.ConstruirSystem(),
                    DiagnosticoIngenieriaPrompt.ConstruirUsuario(proyecto, componentes, request.Mensaje));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al generar diagnóstico para proyecto {ProyectoId}", proyecto.ProyectoID);
                return StatusCode(502, new { error = "No se pudo contactar con Claude. " + ex.Message });
            }

            if (string.IsNullOrWhiteSpace(respuesta))
            {
                return StatusCode(502, new { error = "La IA no devolvió una respuesta útil." });
            }

            var registro = new Diagnostico
            {
                ProyectoID = proyecto.ProyectoID,
                TipoError = "Consulta chatbot",
                DescripcionFalla = request.Mensaje,
                SolucionSugerida = respuesta,
                FechaReporte = DateTime.Now
            };

            _context.Diagnosticos.Add(registro);
            await _context.SaveChangesAsync();

            return Json(new { diagnosticoId = registro.DiagnosticoID, respuesta });
        }

        [HttpPost]
        public async Task<IActionResult> Resolver(int id)
        {
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return Unauthorized();
            }

            var diagnostico = await (from d in _context.Diagnosticos
                                     join p in _context.Proyectos on d.ProyectoID equals p.ProyectoID
                                     where d.DiagnosticoID == id && p.EstudianteID == estudianteId && p.Activo
                                     select d).FirstOrDefaultAsync();

            if (diagnostico is null)
            {
                return NotFound();
            }

            diagnostico.FechaResolucion = DateTime.Now;
            await _context.SaveChangesAsync();

            return Json(new { ok = true, fechaResolucion = diagnostico.FechaResolucion });
        }

        private bool TryGetEstudianteId(out int estudianteId)
        {
            var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(idValue, out estudianteId);
        }

    }
}
