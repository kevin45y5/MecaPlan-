using System.Text.Json;
using MecaPlan.Data;
using MecaPlan.Models;
using MecaPlan.Models.Ai;
using MecaPlan.Models.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace MecaPlan.Services
{
    public class GeneradorProyectoService : IGeneradorProyectoService
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        private readonly ApplicationDbContext _context;
        private readonly IAiChatClient _ai;

        public GeneradorProyectoService(ApplicationDbContext context, IAiChatClient ai)
        {
            _context = context;
            _ai = ai;
        }

        public async Task<ListaFaltantesAi> GenerarFaltantesAsync(Proyecto proyecto, CancellationToken cancellationToken = default)
        {
            var system = ArquitectoHardwarePrompt.Build(
                proyecto.NombreProyecto,
                proyecto.Microcontrolador ?? string.Empty,
                proyecto.DescripcionIdea,
                proyecto.MaterialesPrevios,
                proyecto.MaterialesRequeridos);

            var json = await _ai.CompleteJsonAsync(
                system,
                "Genera ahora el JSON de faltantes.",
                cancellationToken);

            var lista = JsonSerializer.Deserialize<ListaFaltantesAi>(json, JsonOptions) ?? new ListaFaltantesAi();
            lista.Faltantes = lista.Faltantes
                .Where(f => !string.IsNullOrWhiteSpace(f.Nombre))
                .Select(f => new FaltanteAi
                {
                    Nombre = Recortar(f.Nombre, 100),
                    Cantidad = f.Cantidad < 1 ? 1 : f.Cantidad,
                    Motivo = Recortar(f.Motivo, 300)
                })
                .ToList();

            return lista;
        }

        public async Task GuardarBomAsync(
            Proyecto proyecto,
            IReadOnlyList<BomItemViewModel> inventario,
            IReadOnlyList<BomItemViewModel> faltantes,
            CancellationToken cancellationToken = default)
        {
            var existentes = _context.ProyectoComponentes.Where(pc => pc.ProyectoID == proyecto.ProyectoID);
            _context.ProyectoComponentes.RemoveRange(existentes);
            await _context.SaveChangesAsync(cancellationToken);

            var inventarioNombres = new HashSet<string>(
                inventario.Select(i => ComponenteNombres.Normalizar(i.Nombre)),
                StringComparer.OrdinalIgnoreCase);

            await GuardarItemsAsync(proyecto.ProyectoID, inventario, enInventario: true, cancellationToken);

            var vistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var faltantesLimpios = new List<BomItemViewModel>();
            foreach (var f in faltantes)
            {
                var clave = ComponenteNombres.Normalizar(f.Nombre);
                if (inventarioNombres.Contains(clave) || !vistos.Add(clave))
                {
                    continue;
                }
                faltantesLimpios.Add(f);
            }
            await GuardarItemsAsync(proyecto.ProyectoID, faltantesLimpios, enInventario: false, cancellationToken);
        }

        public async Task GenerarCodigoYPasosAsync(Proyecto proyecto, CancellationToken cancellationToken = default)
        {
            var listaGuardada = await ArmarListaComponentesAsync(proyecto.ProyectoID, cancellationToken);
            if (string.IsNullOrWhiteSpace(listaGuardada))
            {
                throw new InvalidOperationException("Confirma al menos un componente en la lista de materiales.");
            }

            var system = TutorIngenieriaPrompt.Build(
                proyecto.NombreProyecto,
                listaGuardada,
                proyecto.Microcontrolador);
            var json = await _ai.CompleteJsonAsync(
                system,
                "Genera ahora el JSON con el código C++ y las conexiones del canvas.",
                cancellationToken);

            var tutor = JsonSerializer.Deserialize<TutorProyectoAi>(json, JsonOptions);
            if (tutor is null || string.IsNullOrWhiteSpace(tutor.CodigoFinal))
            {
                throw new InvalidOperationException("La IA no devolvió el código C++.");
            }

            var conexiones = tutor.ConexionesCanvas
                .Where(c => !string.IsNullOrWhiteSpace(c.Origen) && !string.IsNullOrWhiteSpace(c.Destino))
                .Select(c => new ConexionCanvasAi
                {
                    Origen = Recortar(c.Origen, 80),
                    Destino = Recortar(c.Destino, 80),
                    ColorCable = string.IsNullOrWhiteSpace(c.ColorCable) ? "gris" : Recortar(c.ColorCable, 30)
                })
                .ToList();

            proyecto.CodigoGenerado = tutor.CodigoFinal.Trim();
            proyecto.ConexionesCanvas = JsonSerializer.Serialize(conexiones);
            proyecto.InstruccionesGeneradas = string.IsNullOrWhiteSpace(tutor.Instrucciones) ? null : tutor.Instrucciones.Trim();
            proyecto.Estado = "En Desarrollo";

            var pasosExistentes = _context.PasosEnsamblaje.Where(p => p.ProyectoID == proyecto.ProyectoID);
            _context.PasosEnsamblaje.RemoveRange(pasosExistentes);

            var numero = 1;
            foreach (var paso in tutor.PasosEnsamblaje)
            {
                if (string.IsNullOrWhiteSpace(paso.Titulo))
                {
                    continue;
                }

                _context.PasosEnsamblaje.Add(new PasoEnsamblaje
                {
                    ProyectoID = proyecto.ProyectoID,
                    NumeroPaso = numero++,
                    Titulo = Recortar(paso.Titulo, 150),
                    Descripcion = Recortar(paso.Descripcion, 1000).Trim(),
                    Completado = false,
                    FechaCreacion = DateTime.Now
                });
            }

            _context.Proyectos.Update(proyecto);
            await _context.SaveChangesAsync(cancellationToken);
        }

        private async Task GuardarItemsAsync(
            int proyectoId,
            IReadOnlyList<BomItemViewModel> items,
            bool enInventario,
            CancellationToken cancellationToken)
        {
            foreach (var item in items)
            {
                var nombre = Recortar(item.Nombre, 100);
                if (string.IsNullOrWhiteSpace(nombre) || item.Quitar || item.Cantidad < 1)
                {
                    continue;
                }

                var componente = await _context.Componentes.FirstOrDefaultAsync(
                    c => c.Activo && c.Nombre.ToLower() == nombre.ToLower(),
                    cancellationToken);

                if (componente is null)
                {
                    componente = new Componente
                    {
                        Nombre = nombre,
                        Categoria = enInventario ? "Inventario" : "Faltante",
                        StockDisponible = enInventario ? item.Cantidad : 0,
                        PrecioEstimado = 0,
                        Activo = true,
                        FechaCreacion = DateTime.Now
                    };
                    _context.Componentes.Add(componente);
                    await _context.SaveChangesAsync(cancellationToken);
                }

                _context.ProyectoComponentes.Add(new ProyectoComponente
                {
                    ProyectoID = proyectoId,
                    ComponenteID = componente.ComponenteID,
                    CantidadRequerida = item.Cantidad,
                    EnInventario = enInventario,
                    Motivo = string.IsNullOrWhiteSpace(item.Motivo) ? null : Recortar(item.Motivo, 300)
                });
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        private async Task<string> ArmarListaComponentesAsync(int proyectoId, CancellationToken cancellationToken)
        {
            var items = await _context.ProyectoComponentes
                .Where(pc => pc.ProyectoID == proyectoId)
                .Include(pc => pc.Componente)
                .Select(pc => pc.EnInventario
                    ? $"{pc.Componente.Nombre} x{pc.CantidadRequerida} (en inventario)"
                    : $"{pc.Componente.Nombre} x{pc.CantidadRequerida}")
                .ToListAsync(cancellationToken);

            return string.Join("; ", items);
        }

        private static string Recortar(string? value, int max)
        {
            var text = (value ?? string.Empty).Trim();
            if (text.Length == 0)
            {
                return string.Empty;
            }

            return text.Length <= max ? text : text[..max];
        }
    }
}
