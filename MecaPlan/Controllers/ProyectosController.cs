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
    public class ProyectosController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IGeneradorProyectoService _generador;
        private readonly ILogger<ProyectosController> _logger;

        public ProyectosController(
            ApplicationDbContext context,
            IGeneradorProyectoService generador,
            ILogger<ProyectosController> logger)
        {
            _context = context;
            _generador = generador;
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
            var proyectos = await _context.Proyectos
                .Where(p => p.EstudianteID == estudianteId && p.Activo)
                .OrderByDescending(p => p.FechaCreacion)
                .ToListAsync();

            return View(proyectos);
        }

        [HttpGet]
        public IActionResult Crear() => View(new CrearProyectoViewModel());

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Crear(CrearProyectoViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            if (!TryGetEstudianteId(out var estudianteId))
            {
                return Challenge();
            }

            var proyecto = new Proyecto
            {
                EstudianteID = estudianteId,
                NombreProyecto = model.NombreProyecto.Trim(),
                Microcontrolador = model.Microcontrolador.Trim(),
                NivelComplejidad = model.NivelComplejidad.Trim(),
                DescripcionIdea = model.DescripcionIdea.Trim(),
                MaterialesPrevios = string.IsNullOrWhiteSpace(model.MaterialesPrevios)
                    ? null
                    : model.MaterialesPrevios.Trim(),
                MaterialesRequeridos = string.IsNullOrWhiteSpace(model.MaterialesRequeridos)
                    ? null
                    : model.MaterialesRequeridos.Trim(),
                Estado = "En Desarrollo",
                Activo = true,
                FechaCreacion = DateTime.Now
            };

            _context.Proyectos.Add(proyecto);
            await _context.SaveChangesAsync();

            try
            {
                var lista = await _generador.GenerarFaltantesAsync(proyecto);
                var inventario = InventarioParser.Parsear(proyecto.Microcontrolador, proyecto.MaterialesPrevios);
                var nombresInventario = inventario
                    .Select(i => ComponenteNombres.Normalizar(i.Nombre))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var requisitos = InventarioParser.ParsearLineas(proyecto.MaterialesRequeridos)
                    .Where(r => !nombresInventario.Contains(ComponenteNombres.Normalizar(r.Nombre)))
                    .Select(r =>
                    {
                        r.Motivo = "Indicaste que el proyecto debe usarlo aunque no lo tengas.";
                        return r;
                    })
                    .ToList();
                var nombresRequisitos = requisitos
                    .Select(r => ComponenteNombres.Normalizar(r.Nombre))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var bom = new ValidarBomViewModel
                {
                    ProyectoID = proyecto.ProyectoID,
                    NombreProyecto = proyecto.NombreProyecto,
                    Inventario = inventario,
                    Requisitos = requisitos,
                    Faltantes = lista.Faltantes
                        .Where(f => !nombresInventario.Contains(ComponenteNombres.Normalizar(f.Nombre))
                                 && !nombresRequisitos.Contains(ComponenteNombres.Normalizar(f.Nombre)))
                        .Select(f => new BomItemViewModel
                        {
                            Nombre = f.Nombre,
                            Cantidad = f.Cantidad,
                            Motivo = f.Motivo
                        })
                        .ToList()
                };

                ViewData["Wide"] = true;
                return View("ValidarBom", bom);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "No se pudo generar la lista de materiales del proyecto {ProyectoId}", proyecto.ProyectoID);
                _context.Proyectos.Remove(proyecto);
                await _context.SaveChangesAsync();
                ModelState.AddModelError(string.Empty, ex.Message);
                return View(model);
            }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ConfirmarBom(ValidarBomViewModel model)
        {
            ViewData["Wide"] = true;
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return Challenge();
            }

            var proyecto = await _context.Proyectos
                .FirstOrDefaultAsync(p => p.ProyectoID == model.ProyectoID && p.EstudianteID == estudianteId && p.Activo);
            if (proyecto is null)
            {
                return NotFound();
            }

            var inventario = (model.Inventario ?? []).Where(i => !i.Quitar && i.Cantidad > 0 && !string.IsNullOrWhiteSpace(i.Nombre)).ToList();
            var requisitos = (model.Requisitos ?? []).Where(i => !i.Quitar && i.Cantidad > 0 && !string.IsNullOrWhiteSpace(i.Nombre)).ToList();
            var faltantes = (model.Faltantes ?? []).Where(i => !i.Quitar && i.Cantidad > 0 && !string.IsNullOrWhiteSpace(i.Nombre)).ToList();

            if (inventario.Count + requisitos.Count + faltantes.Count == 0)
            {
                ModelState.AddModelError(string.Empty, "Deja al menos un componente en la lista.");
                model.Inventario = model.Inventario ?? [];
                model.Requisitos = model.Requisitos ?? [];
                model.Faltantes = model.Faltantes ?? [];
                return View("ValidarBom", model);
            }

            try
            {
                await _generador.GuardarBomAsync(proyecto, inventario, requisitos.Concat(faltantes).ToList());
                await _generador.GenerarCodigoYPasosAsync(proyecto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "No se pudo confirmar el BOM del proyecto {ProyectoId}", proyecto.ProyectoID);
                ModelState.AddModelError(string.Empty, ex.Message);
                model.Inventario = inventario;
                model.Requisitos = requisitos;
                model.Faltantes = faltantes;
                return View("ValidarBom", model);
            }

            return RedirectToAction(nameof(Workspace), new { id = proyecto.ProyectoID });
        }

        [HttpGet]
        public async Task<IActionResult> Workspace(int id)
        {
            var proyecto = await CargarProyectoDelUsuarioAsync(id);
            if (proyecto is null)
            {
                return NotFound();
            }

            ViewData["Workspace"] = true;
            ViewData["Title"] = proyecto.NombreProyecto;
            return View(CrearWorkspace(proyecto));
        }

        [HttpGet]
        public async Task<IActionResult> Guia(int id)
        {
            var proyecto = await CargarProyectoDelUsuarioAsync(id);
            if (proyecto is null)
            {
                return NotFound();
            }

            return View(CrearGuia(proyecto));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> GuardarCodigo(int id, [FromForm] string codigo)
        {
            var proyecto = await CargarProyectoDelUsuarioAsync(id);
            if (proyecto is null)
            {
                return NotFound();
            }

            proyecto.CodigoGenerado = codigo ?? string.Empty;
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> GuardarCanvas(int id, [FromForm] string? conexiones, [FromForm] string? posiciones)
        {
            var proyecto = await CargarProyectoDelUsuarioAsync(id);
            if (proyecto is null)
            {
                return NotFound();
            }

            if (!string.IsNullOrWhiteSpace(conexiones))
            {
                proyecto.ConexionesCanvas = conexiones.Trim();
            }
            if (!string.IsNullOrWhiteSpace(posiciones))
            {
                proyecto.PosicionesCanvas = posiciones.Trim();
            }
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ReportarDiagnostico(int id, WorkspaceViewModel model)
        {
            var proyecto = await CargarProyectoDelUsuarioAsync(id);
            if (proyecto is null)
            {
                return NotFound();
            }

            if (string.IsNullOrWhiteSpace(model.TipoError) || string.IsNullOrWhiteSpace(model.DescripcionFalla))
            {
                ViewData["Workspace"] = true;
                ViewData["Title"] = proyecto.NombreProyecto;
                ModelState.AddModelError(string.Empty, "Indica el tipo de error y un detalle.");
                var vista = CrearWorkspace(proyecto);
                vista.TipoError = model.TipoError;
                vista.DescripcionFalla = model.DescripcionFalla;
                return View("Workspace", vista);
            }

            _context.Diagnosticos.Add(new Diagnostico
            {
                ProyectoID = proyecto.ProyectoID,
                TipoError = model.TipoError.Trim(),
                DescripcionFalla = model.DescripcionFalla.Trim(),
                FechaReporte = DateTime.Now
            });
            await _context.SaveChangesAsync();
            TempData["Aviso"] = "Reporte enviado. El panel de diagnóstico lo tiene registrado.";
            return RedirectToAction(nameof(Workspace), new { id });
        }

        [HttpGet]
        public async Task<IActionResult> Detalle(int id)
        {
            if (!TryGetEstudianteId(out var estudianteId))
            {
                return Challenge();
            }

            var proyecto = await _context.Proyectos
                .Include(p => p.ProyectoComponentes)
                    .ThenInclude(pc => pc.Componente)
                .Include(p => p.PasosEnsamblaje)
                .FirstOrDefaultAsync(p => p.ProyectoID == id && p.EstudianteID == estudianteId && p.Activo);

            if (proyecto is null)
            {
                return NotFound();
            }

            ViewData["Wide"] = true;
            return View(proyecto);
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
                .Include(p => p.PasosEnsamblaje)
                .Include(p => p.Diagnosticos)
                .FirstOrDefaultAsync(p => p.ProyectoID == id && p.EstudianteID == estudianteId && p.Activo);
        }

        private static WorkspaceViewModel CrearWorkspace(Proyecto proyecto)
        {
            var componentes = proyecto.ProyectoComponentes
                .Select(pc => new { nombre = pc.Componente.Nombre, enInventario = pc.EnInventario })
                .ToList();

            return new WorkspaceViewModel
            {
                Proyecto = proyecto,
                ConexionesJson = string.IsNullOrWhiteSpace(proyecto.ConexionesCanvas) ? "[]" : proyecto.ConexionesCanvas,
                PosicionesJson = string.IsNullOrWhiteSpace(proyecto.PosicionesCanvas) ? "[]" : proyecto.PosicionesCanvas,
                ComponentesJson = System.Text.Json.JsonSerializer.Serialize(componentes)
            };
        }

        private GuiaEnsamblajeViewModel CrearGuia(Proyecto proyecto)
        {
            var componentes = proyecto.ProyectoComponentes
                .OrderBy(pc => pc.Componente.Nombre)
                .Select(pc => new GuiaComponenteItem
                {
                    Nombre = pc.Componente.Nombre,
                    UrlImagen = ObtenerUrlImagenPorNombre(pc.Componente.Nombre),
                    Descripcion = ObtenerDescripcionPorNombre(pc.Componente.Nombre),
                    Cantidad = pc.CantidadRequerida,
                    EnInventario = pc.EnInventario,
                    Motivo = pc.Motivo
                })
                .ToList();

            return new GuiaEnsamblajeViewModel
            {
                Proyecto = proyecto,
                Componentes = componentes,
                Conexiones = ParsearConexiones(proyecto.ConexionesCanvas)
            };
        }

        private static List<GuiaConexionItem> ParsearConexiones(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new List<GuiaConexionItem>();
            }

            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind != JsonValueKind.Array)
                {
                    return new List<GuiaConexionItem>();
                }

                var resultado = new List<GuiaConexionItem>();
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var (origenComponente, origenPin) = DividirEndpoint(Lee(el, "Origen", "origen"));
                    var (destinoComponente, destinoPin) = DividirEndpoint(Lee(el, "Destino", "destino"));
                    var color = Lee(el, "color_cable", "ColorCable");
                    if (string.IsNullOrWhiteSpace(color))
                    {
                        color = "gris";
                    }

                    resultado.Add(new GuiaConexionItem
                    {
                        OrigenComponente = origenComponente,
                        OrigenPin = origenPin,
                        DestinoComponente = destinoComponente,
                        DestinoPin = destinoPin,
                        Color = color
                    });
                }

                return resultado;
            }
            catch (JsonException)
            {
                return new List<GuiaConexionItem>();
            }
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

        private static string ObtenerUrlImagenPorNombre(string nombre)
        {
            var n = (nombre ?? string.Empty).ToLowerInvariant();

            if (n.Contains("esp32") || n.Contains("arduino") || n.Contains("nodemcu") || n.Contains("placa") || n.Contains("microcontrolador"))
            {
                return "/images/componentes/microcontrolador.svg";
            }

            if (n.Contains("sensor") || n.Contains("ultrasonico") || n.Contains("rtc") || n.Contains("ds3231") || n.Contains("hc-sr04") || n.Contains("buzzer"))
            {
                return "/images/componentes/sensor.svg";
            }

            if (n.Contains("servo") || n.Contains("motor") || n.Contains("mg996r") || n.Contains("actuador"))
            {
                return "/images/componentes/actuador.svg";
            }

            if (n.Contains("fuente") || n.Contains("5v") || n.Contains("vcc") || n.Contains("aliment") || n.Contains("power"))
            {
                return "/images/componentes/fuente.svg";
            }

            if (n.Contains("cable") || n.Contains("jumper") || n.Contains("protoboard"))
            {
                return "/images/componentes/cable.svg";
            }

            return "/images/componentes/placeholder-component.svg";
        }

        private static string ObtenerDescripcionPorNombre(string nombre)
        {
            var n = (nombre ?? string.Empty).ToLowerInvariant();

            if (n.Contains("esp32") || n.Contains("arduino") || n.Contains("nodemcu") || n.Contains("placa") || n.Contains("microcontrolador"))
            {
                return "Es el cerebro del circuito: ejecuta el código y controla todos los pines.";
            }

            if (n.Contains("hc-sr04") || n.Contains("ultrasonico"))
            {
                return "Mide distancias enviando un pulso de ultrasonido y leyendo el eco.";
            }

            if (n.Contains("ds3231") || n.Contains("rtc"))
            {
                return "Reloj en tiempo real: mantiene la hora y la fecha aunque se apague la placa.";
            }

            if (n.Contains("dht") || n.Contains("temperatura") || n.Contains("humedad"))
            {
                return "Mide la temperatura y la humedad del ambiente.";
            }

            if (n.Contains("sensor"))
            {
                return "Detecta cambios del entorno (luz, movimiento, distancia...) y los envía a la placa.";
            }

            if (n.Contains("servo") || n.Contains("mg996r"))
            {
                return "Motor que gira a una posición exacta: mueve brazos, puertas o mecanismos.";
            }

            if (n.Contains("motor") || n.Contains("dc ") || n.Contains("nema") || n.Contains("stepper"))
            {
                return "Motor que convierte la electricidad en movimiento giratorio continuo.";
            }

            if (n.Contains("buzzer"))
            {
                return "Emite sonidos o pitidos para avisar (alarmas, alertas).";
            }

            if (n.Contains("fuente") || n.Contains("aliment") || n.Contains("power") || n.Contains("5v"))
            {
                return "Provee la energía (5V) que necesita todo el circuito para funcionar.";
            }

            if (n.Contains("cable") || n.Contains("jumper"))
            {
                return "Un cable que conecta un pin a otro para llevar la señal o la alimentación.";
            }

            if (n.Contains("protoboard"))
            {
                return "Placa de conexión sin soldadura: organiza el cableado y distribuye alimentación.";
            }

            if (n.Contains("led"))
            {
                return "Pequeña luz que se enciende para indicar un estado o señal visual.";
            }

            if (n.Contains("resistencia"))
            {
                return "Limita la corriente para proteger los componentes (como los LEDs).";
            }

            return "Componente que forma parte del circuito de este proyecto.";
        }

        private bool TryGetEstudianteId(out int estudianteId)
        {
            var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(idValue, out estudianteId);
        }
    }
}
