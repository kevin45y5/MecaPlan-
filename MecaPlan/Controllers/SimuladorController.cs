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
    public class SimuladorController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IAiChatClient _ia;
        private readonly ILogger<SimuladorController> _logger;

        public SimuladorController(
            ApplicationDbContext context,
            IAiChatClient ia,
            ILogger<SimuladorController> logger)
        {
            _context = context;
            _ia = ia;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> Index(int id = 0)
        {
            if (id <= 0)
            {
                if (!TryGetEstudianteId(out var estudianteId))
                {
                    return Challenge();
                }

                var ultimoId = await _context.Proyectos
                    .Where(p => p.EstudianteID == estudianteId && p.Activo)
                    .OrderByDescending(p => p.FechaCreacion)
                    .Select(p => p.ProyectoID)
                    .FirstOrDefaultAsync();

                if (ultimoId <= 0)
                {
                    TempData["Aviso"] = "Crea un proyecto para abrir el simulador 2D.";
                    return RedirectToAction("Index", "Proyectos");
                }

                var diseno = Request.Query["diseno"].ToString();
                if (!string.IsNullOrWhiteSpace(diseno))
                {
                    return RedirectToAction(nameof(Index), new { id = ultimoId, diseno });
                }

                return RedirectToAction(nameof(Index), new { id = ultimoId });
            }

            var proyecto = await CargarProyectoDelUsuarioAsync(id);
            if (proyecto is null)
            {
                return NotFound();
            }

            ViewData["Title"] = proyecto.NombreProyecto;

            var componentes = proyecto.ProyectoComponentes
                .Select(pc => new SimuladorComponenteVm
                {
                    Nombre = pc.Componente.Nombre,
                    Cantidad = pc.CantidadRequerida,
                    EnInventario = pc.EnInventario
                })
                .ToList();

            var conexiones = ParsearConexiones(proyecto.ConexionesCanvas);

            var vm = new SimuladorIndexViewModel
            {
                Proyecto = proyecto,
                Componentes = componentes,
                Conexiones = conexiones,
                Codigo = proyecto.CodigoGenerado ?? string.Empty
            };

            return View(vm);
        }

        // ============ API CRUD de diseños 2D ============

        [HttpGet]
        [Route("api/simulacion/designs")]
        public async Task<IActionResult> ApiListDesigns(int proyectoId)
        {
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return Unauthorized();
            }

            var diseños = await (from d in _context.SimulacionDisenos
                                 join p in _context.Proyectos on d.ProyectoID equals p.ProyectoID
                                 where p.EstudianteID == estudianteId && d.Activo
                                       && (proyectoId <= 0 || d.ProyectoID == proyectoId)
                                 orderby d.FechaActualizacion ?? d.FechaCreacion descending
                                 select new
                                 {
                                     d.SimulacionDisenoID,
                                     d.ProyectoID,
                                     d.Nombre,
                                     d.Autor,
                                     d.FechaCreacion,
                                     d.FechaActualizacion,
                                     d.ThumbnailBase64
                                 })
                                 .ToListAsync();

            return Json(new { data = diseños });
        }

        [HttpGet]
        [Route("api/simulacion/designs/{id}")]
        public async Task<IActionResult> ApiGetDesign(int id)
        {
            var d = await ObtenerDisenoAutorizadoAsync(id);
            if (d is null)
            {
                return NotFound(new { error = "Diseño no encontrado." });
            }

            return Json(new
            {
                data = new
                {
                    d.SimulacionDisenoID,
                    d.Nombre,
                    d.Autor,
                    d.PinoutJson,
                    d.Codigo
                }
            });
        }

        [HttpPost]
        [Route("api/simulacion/designs")]
        public async Task<IActionResult> ApiSaveDesign([FromBody] SimulacionGuardarRequest req)
        {
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return Unauthorized();
            }

            int proyectoId = req.ProyectoId;
            if (proyectoId <= 0 && req.Id > 0)
            {
                var existente = await ObtenerDisenoAutorizadoAsync(req.Id);
                if (existente is null)
                {
                    return NotFound(new { error = "Diseño no encontrado." });
                }
                proyectoId = existente.ProyectoID;
            }

            var proyecto = await _context.Proyectos
                .FirstOrDefaultAsync(p => p.ProyectoID == proyectoId && p.EstudianteID == estudianteId && p.Activo);
            if (proyecto is null)
            {
                return NotFound(new { error = "Proyecto no válido." });
            }

            SimulacionDiseno? diseno;
            if (req.Id > 0)
            {
                diseno = await ObtenerDisenoAutorizadoAsync(req.Id);
                if (diseno is null)
                {
                    return NotFound(new { error = "Diseño no encontrado." });
                }
                diseno.Nombre = string.IsNullOrWhiteSpace(req.Nombre) ? diseno.Nombre : req.Nombre.Trim();
                diseno.PinoutJson = req.PinoutJson;
                diseno.Codigo = req.Codigo;
                diseno.ThumbnailBase64 = req.ThumbnailBase64 ?? diseno.ThumbnailBase64;
                diseno.FechaActualizacion = DateTime.Now;
            }
            else
            {
                diseno = new SimulacionDiseno
                {
                    ProyectoID = proyectoId,
                    Nombre = string.IsNullOrWhiteSpace(req.Nombre) ? "Mi circuito" : req.Nombre.Trim(),
                    Autor = req.Autor,
                    PinoutJson = req.PinoutJson,
                    Codigo = req.Codigo,
                    ThumbnailBase64 = req.ThumbnailBase64,
                    FechaCreacion = DateTime.Now,
                    Activo = true
                };
                _context.SimulacionDisenos.Add(diseno);
            }

            // Sincronizar las conexiones del lienzo 2D hacia ConexionesCanvas
            // para que el "diagrama" y la "guía de ensamblaje" reflejen los
            // mismos cables editados en el simulador 2D.
            SincronizarConexionesCanvas(proyecto, req.PinoutJson);

            await _context.SaveChangesAsync();
            return Json(new { data = new { id = diseno.SimulacionDisenoID, nombre = diseno.Nombre } });
        }

        // Convierte el PinoutJson (node ids) a ConexionesCanvas (Componente_Pin)
        // y lo escribe en el proyecto, alineando diagrama y simulador 2D.
        private static void SincronizarConexionesCanvas(Proyecto proyecto, string? pinoutJson)
        {
            proyecto.ConexionesCanvas = PinoutAConnexionesCanvas(pinoutJson);
        }

        private static string PinoutAConnexionesCanvas(string? pinoutJson)
        {
            if (string.IsNullOrWhiteSpace(pinoutJson))
            {
                return "[]";
            }

            try
            {
                using var doc = JsonDocument.Parse(pinoutJson);
                var root = doc.RootElement;

                var nodos = new Dictionary<string, (string compId, string pin)>();
                if (root.TryGetProperty("nodes", out var nodesEl) && nodesEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var n in nodesEl.EnumerateArray())
                    {
                        var id = Str(n, "id");
                        if (string.IsNullOrEmpty(id)) continue;
                        var compId = Str(n, "compId") ?? string.Empty;
                        var pin = Str(n, "pinName") ?? Str(n, "label");
                        if (string.IsNullOrEmpty(pin)) pin = Str(n, "role");
                        if (string.IsNullOrEmpty(pin)) pin = id;
                        nodos[id] = (compId, pin);
                    }
                }

                var etiquetas = new Dictionary<string, string>();
                if (root.TryGetProperty("components", out var compsEl) && compsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var c in compsEl.EnumerateArray())
                    {
                        var id = Str(c, "id");
                        var label = Str(c, "label");
                        if (!string.IsNullOrEmpty(id)) etiquetas[id] = string.IsNullOrEmpty(label) ? id : label;
                    }
                }

                var conexiones = new List<object>();
                if (root.TryGetProperty("connections", out var connsEl) && connsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var cn in connsEl.EnumerateArray())
                    {
                        var from = Str(cn, "from");
                        var to = Str(cn, "to");
                        var color = Str(cn, "color") ?? "gris";
                        if (string.IsNullOrEmpty(from) || string.IsNullOrEmpty(to)) continue;
                        if (!nodos.TryGetValue(from, out var f) || !nodos.TryGetValue(to, out var t)) continue;
                        etiquetas.TryGetValue(f.compId, out var fComp);
                        etiquetas.TryGetValue(t.compId, out var tComp);
                        conexiones.Add(new
                        {
                            origen = $"{fComp}_{f.pin}",
                            destino = $"{tComp}_{t.pin}",
                            color_cable = color
                        });
                    }
                }

                return JsonSerializer.Serialize(conexiones);
            }
            catch (JsonException)
            {
                return "[]";
            }
        }

        private static string? Str(JsonElement el, string nombre)
        {
            if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(nombre, out var prop) &&
                prop.ValueKind == JsonValueKind.String)
            {
                return prop.GetString();
            }
            return null;
        }

        [HttpDelete]
        [Route("api/simulacion/designs/{id}")]
        public async Task<IActionResult> ApiDeleteDesign(int id)
        {
            var diseno = await ObtenerDisenoAutorizadoAsync(id);
            if (diseno is null)
            {
                return NotFound(new { error = "Diseño no encontrado." });
            }

            diseno.Activo = false;
            diseno.FechaActualizacion = DateTime.Now;
            await _context.SaveChangesAsync();
            return Json(new { success = true });
        }

        [HttpPost]
        [Route("api/simulacion/gemini/debug")]
        public async Task<IActionResult> ApiGeminiDebug([FromBody] SimulacionDebugRequest req)
        {
            try
            {
                var pinoutJson = req.Pinout ?? "{}";
                var code = req.Code ?? string.Empty;

                var system = "Eres un tutor experto en circuitos Arduino y electrónica. " +
                    "Analiza el circuito (JSON pinout) y el código C++. Identifica cortocircuitos, " +
                    "pines mal conectados, problemas de alimentación y errores de código. " +
                    "Responde en español con un formato claro de secciones y viñetas.";

                var user = $"CIRCUITO (JSON):\n{pinoutJson}\n\nCÓDIGO C++:\n{code}";

                var texto = await _ia.CompleteTextAsync(system, user);
                return Json(new { data = new { text = texto } });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falló el proxy Gemini del simulador.");
                return StatusCode(502, new { error = "No se pudo contactar al asistente: " + ex.Message });
            }
        }

        [HttpPost]
        [Route("api/simulacion/ai/connections")]
        public async Task<IActionResult> ApiAiManageConnections([FromBody] SimulacionAiRequest req)
        {
            try
            {
                var pinoutJson = req.Pinout ?? "{}";
                var code = req.Code ?? string.Empty;
                var objetivo = string.IsNullOrWhiteSpace(req.Objetivo)
                    ? "valida y corrige las conexiones para que sean eléctricamente coherentes"
                    : req.Objetivo.Trim();

                var system =
                    "Eres un experto en circuitos Arduino (wokwi). Recibes el PinoutJson de un editor 2D " +
                    "que contiene una lista 'nodes' (cada uno con un 'id') y una lista 'connections' " +
                    "(cada una con from/to = node id y color). Tu tarea: " +
                    $"cuando el usuario pide «{objetivo}», revisa electricidad del circuito: fuentes VCC/GND " +
                    "conectadas a todas las cargas, señales en pines GPIO válidos y sin cortocircuitos. " +
                    "Devuelve SIEMPRE un JSON válido con esta forma EXACTA:\n" +
                    "{\"connections\":[{\"from\":\"<nodeId>\",\"to\":\"<nodeId>\",\"color\":\"gris\"}],\"observaciones\":\"texto breve\"}\n" +
                    "Reglas:\n" +
                    "- Solo usa nodeId que EXISTAN en el campo 'nodes'. Descarto/corrige cualquier from/to que no exista.\n" +
                    "- Mantén la cantidad de cables razonable y evita duplicados.\n" +
                    "- Preserva el JSON, sin markdown ni texto extra.";

                var user = $"PinoutJson:\n{pinoutJson}\n\nCódigo C++:\n{code}\n\n" +
                           "Metas: " + (string.IsNullOrWhiteSpace(req.Objetivo) ? objetivo : req.Objetivo) +
                           "\n\nDevuelve el JSON de connections+observaciones ahora.";

                var resp = await _ia.CompleteJsonAsync(system, user);

                var nodosValidos = new HashSet<string>();
                try
                {
                    using var doc = JsonDocument.Parse(pinoutJson);
                    if (doc.RootElement.TryGetProperty("nodes", out var nodesEl))
                    {
                        foreach (var n in nodesEl.EnumerateArray())
                        {
                            if (n.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String)
                            {
                                nodosValidos.Add(idEl.GetString()!);
                            }
                        }
                    }
                }
                catch (JsonException) { }

                var conexiones = new List<object>();
                string observaciones = string.Empty;
                try
                {
                    using var doc = JsonDocument.Parse(resp);
                    if (doc.RootElement.TryGetProperty("connections", out var connsEl))
                    {
                        foreach (var cn in connsEl.EnumerateArray())
                        {
                            var from = LeeCn(cn, "from");
                            var to = LeeCn(cn, "to");
                            var color = LeeCn(cn, "color") ?? "gris";
                            if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to)) continue;
                            if (!nodosValidos.Contains(from) || !nodosValidos.Contains(to)) continue;
                            conexiones.Add(new { from, to, color });
                        }
                    }
                    if (doc.RootElement.TryGetProperty("observaciones", out var obsEl) &&
                        obsEl.ValueKind == JsonValueKind.String)
                    {
                        observaciones = obsEl.GetString() ?? string.Empty;
                    }
                }
                catch (JsonException)
                {
                    return StatusCode(502, new { error = "La IA devolvió JSON inválido." });
                }

                return Json(new { data = new { connections = conexiones, observaciones } });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falló el asistente AI de conexiones del simulador.");
                return StatusCode(502, new { error = "No se pudo contactar al asistente: " + ex.Message });
            }
        }

        private static string? LeeCn(JsonElement el, string nombre)
        {
            if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(nombre, out var prop)
                && prop.ValueKind == JsonValueKind.String)
            {
                return prop.GetString();
            }
            return null;
        }

        // ============ Helpers ============

        private async Task<SimulacionDiseno?> ObtenerDisenoAutorizadoAsync(int id)
        {
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return null;
            }

            return await (from d in _context.SimulacionDisenos
                          join p in _context.Proyectos on d.ProyectoID equals p.ProyectoID
                          where d.SimulacionDisenoID == id && d.Activo && p.EstudianteID == estudianteId
                          select d)
                          .FirstOrDefaultAsync();
        }

        private async Task<Proyecto?> CargarProyectoDelUsuarioAsync(int id)
        {
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return null;
            }

            return await _context.Proyectos
                .Include(p => p.ProyectoComponentes)
                    .ThenInclude(pc => pc.Componente)
                .FirstOrDefaultAsync(p => p.ProyectoID == id && p.EstudianteID == estudianteId && p.Activo);
        }

        private static List<SimuladorConexionVm> ParsearConexiones(string? json)
        {
            var resultado = new List<SimuladorConexionVm>();
            if (string.IsNullOrWhiteSpace(json))
            {
                return resultado;
            }

            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind != JsonValueKind.Array)
                {
                    return resultado;
                }

                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var origenComp = Lee(el, "OrigenComponente", "origenComponente");
                    var origenPin = Lee(el, "OrigenPin", "origenPin");
                    var destinoComp = Lee(el, "DestinoComponente", "destinoComponente");
                    var destinoPin = Lee(el, "DestinoPin", "destinoPin");
                    if (string.IsNullOrWhiteSpace(origenComp))
                    {
                        (origenComp, origenPin) = DividirEndpoint(Lee(el, "Origen", "origen"));
                    }
                    if (string.IsNullOrWhiteSpace(destinoComp))
                    {
                        (destinoComp, destinoPin) = DividirEndpoint(Lee(el, "Destino", "destino"));
                    }
                    var color = Lee(el, "color_cable", "ColorCable", "Color", "color");
                    if (string.IsNullOrWhiteSpace(color))
                    {
                        color = "gris";
                    }

                    resultado.Add(new SimuladorConexionVm
                    {
                        OrigenComponente = origenComp,
                        OrigenPin = origenPin,
                        DestinoComponente = destinoComp,
                        DestinoPin = destinoPin,
                        Color = color
                    });
                }
            }
            catch (JsonException)
            {
                // se ignora
            }

            return resultado;
        }

        private static (string componente, string pin) DividirEndpoint(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return ("", "");
            }

            var idx = value.LastIndexOf('_');
            if (idx <= 0)
            {
                return (value.Trim(), "");
            }

            return (value[..idx].Trim(), value[(idx + 1)..].Trim());
        }

        private static string Lee(JsonElement el, params string[] nombres)
        {
            foreach (var nombre in nombres)
            {
                if (el.TryGetProperty(nombre, out var prop) && prop.ValueKind == JsonValueKind.String)
                {
                    return prop.GetString() ?? string.Empty;
                }
            }

            return string.Empty;
        }

        private bool TryGetEstudianteId(out int estudianteId)
        {
            var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(idValue, out estudianteId);
        }

        // ============ request/response DTOs ============
        public sealed class SimulacionGuardarRequest
        {
            public int Id { get; set; }
            public int ProyectoId { get; set; }
            public string? Nombre { get; set; }
            public string? Autor { get; set; }
            public string? PinoutJson { get; set; }
            public string? Codigo { get; set; }
            public string? ThumbnailBase64 { get; set; }
        }

        public sealed class SimulacionDebugRequest
        {
            public string? Pinout { get; set; }
            public string? Code { get; set; }
        }

        public sealed class SimulacionAiRequest
        {
            public string? Pinout { get; set; }
            public string? Code { get; set; }
            public string? Objetivo { get; set; }
        }
    }
}
