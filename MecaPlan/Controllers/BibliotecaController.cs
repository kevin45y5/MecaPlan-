using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using MecaPlan.Data;
using MecaPlan.Models;
using MecaPlan.Models.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MecaPlan.Controllers
{
    [Authorize]
    public class BibliotecaController : Controller
    {
        private readonly ApplicationDbContext _context;

        public BibliotecaController(ApplicationDbContext context)
        {
            _context = context;
        }

        private bool TryGetEstudianteId(out int estudianteId)
        {
            var idValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(idValue, out estudianteId);
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            ViewData["Full"] = true;

            int estudianteId = 0;
            TryGetEstudianteId(out estudianteId);

            var proyectosUsuario = await _context.Proyectos
                .Where(p => p.EstudianteID == estudianteId && p.Activo)
                .CountAsync();

            var componentesBomUsuario = await _context.ProyectoComponentes
                .Include(pc => pc.Proyecto)
                .Where(pc => pc.Proyecto != null && pc.Proyecto.EstudianteID == estudianteId && pc.Proyecto.Activo)
                .CountAsync();

            var vm = new BibliotecaIndexViewModel
            {
                TotalManuales = 6 + proyectosUsuario,
                TotalDatasheets = 9,
                TotalNormativas = 6,
                TotalGuias = 5,
                ComponentesEnBomActivo = componentesBomUsuario > 0 ? componentesBomUsuario : 4,
                ProyectosActivosEstudiante = proyectosUsuario
            };

            return View(vm);
        }

        [HttpGet]
        public async Task<IActionResult> Manuales(string? q = null, string? estado = null, string? micro = null)
        {
            ViewData["Full"] = true;
            ViewData["Title"] = "Manuales de Proyecto";

            var manuales = GetCuratedManuales();

            // Incorporar proyectos reales del usuario si existen
            if (TryGetEstudianteId(out var estudianteId))
            {
                var userProjects = await _context.Proyectos
                    .Include(p => p.ProyectoComponentes)
                        .ThenInclude(pc => pc.Componente)
                    .Include(p => p.PasosEnsamblaje)
                    .Where(p => p.EstudianteID == estudianteId && p.Activo)
                    .ToListAsync();

                foreach (var up in userProjects)
                {
                    var userManual = new ManualItemViewModel
                    {
                        Id = "usr-" + up.ProyectoID,
                        Titulo = up.NombreProyecto,
                        Descripcion = up.DescripcionIdea ?? "Proyecto generado en el espacio de trabajo de MecaPlan.",
                        Icono = "project",
                        Estado = string.IsNullOrEmpty(up.Estado) ? "Prototipado Activo" : up.Estado,
                        EstadoCss = GetEstadoCss(up.Estado),
                        Microcontrolador = string.IsNullOrEmpty(up.Microcontrolador) ? "Arduino Uno" : up.Microcontrolador,
                        NivelComplejidad = string.IsNullOrEmpty(up.NivelComplejidad) ? "Intermedio" : up.NivelComplejidad,
                        EsProyectoUsuario = true,
                        FechaActualizacion = up.FechaCreacion.ToString("dd/MM/yyyy"),
                        FirmwareCodigo = string.IsNullOrEmpty(up.CodigoGenerado) ? "// Sketch C++ generado en Workspace\nvoid setup() {\n  Serial.begin(9600);\n}\nvoid loop() {\n}" : up.CodigoGenerado,
                        ComentariosProfesor = "Nota técnica: Valida las conexiones en el Canvas y verifica la continuidad eléctrica antes de encender la fuente.",
                        ComponentesBOM = up.ProyectoComponentes.Select(pc => new BomComponenteItem
                        {
                            Nombre = pc.Componente?.Nombre ?? "Componente",
                            Cantidad = pc.CantidadRequerida,
                            Categoria = pc.Componente?.Categoria ?? "General",
                            EnInventario = pc.EnInventario,
                            Especificacion = pc.Motivo ?? "Uso en circuito principal",
                            DatasheetId = "ds-" + (pc.ComponenteID),
                            PrecioEstimado = pc.Componente?.PrecioEstimado ?? 0
                        }).ToList(),
                        PasosEnsamblaje = up.PasosEnsamblaje.OrderBy(p => p.NumeroPaso).Select(p => new PasoManualItem
                        {
                            NumeroPaso = p.NumeroPaso,
                            Titulo = p.Titulo,
                            Descripcion = p.Descripcion,
                            PinesClave = "Pines según diagrama esquemático",
                            Tips = "Verifica la polaridad de VCC y GND antes de alimentar.",
                            UrlEsquema = p.UrlEsquema
                        }).ToList(),
                        ChecklistPruebas = new List<ChecklistItem>
                        {
                            new ChecklistItem { Id = "chk-1", Titulo = "Continuidad de Rieles 5V y GND", Descripcion = "Verificar con multímetro que no haya cortocircuito entre alimentación y tierra.", Tipo = "Continuidad", Completado = true },
                            new ChecklistItem { Id = "chk-2", Titulo = "Carga de Firmware vía USB", Descripcion = "Compilación sin errores y verificación de respuesta en puerto Serial 9600 baud.", Tipo = "Lógica", Completado = true },
                            new ChecklistItem { Id = "chk-3", Titulo = "Señales de Sensores y Actuadores", Descripcion = "Validar rangos analógicos / digitales con el monitor serie activo.", Tipo = "Señal", Completado = false },
                            new ChecklistItem { Id = "chk-4", Titulo = "Prueba de Estrés Mecánico y Térmico", Descripcion = "Monitorear temperatura del microcontrolador y drivers tras 10 min de ciclo continuo.", Tipo = "Carga", Completado = false }
                        }
                    };

                    if (userManual.PasosEnsamblaje.Count == 0)
                    {
                        userManual.PasosEnsamblaje.Add(new PasoManualItem
                        {
                            NumeroPaso = 1,
                            Titulo = "Distribución en Protoboard y Microcontrolador",
                            Descripcion = "Montar la placa base y distribuir los rieles de alimentación 5V y GND.",
                            PinesClave = "Vin, 5V, GND",
                            Tips = "Usa cables rojos para VCC y negros para GND para mantener orden en el banco."
                        });
                        userManual.PasosEnsamblaje.Add(new PasoManualItem
                        {
                            NumeroPaso = 2,
                            Titulo = "Conexión de Señales y Control",
                            Descripcion = "Conectar pines digitales de PWM y pines analógicos a los actuadores y sensores.",
                            PinesClave = "GPIO PWM / ADC",
                            Tips = "Comprueba que la corriente requerida no exceda los límites de disipación por pin."
                        });
                    }

                    manuales.Insert(0, userManual);
                }
            }

            // Filtrado
            var resultado = manuales.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(q))
            {
                var queryLower = q.Trim().ToLowerInvariant();
                resultado = resultado.Where(m =>
                    m.Titulo.ToLowerInvariant().Contains(queryLower) ||
                    m.Descripcion.ToLowerInvariant().Contains(queryLower) ||
                    m.Microcontrolador.ToLowerInvariant().Contains(queryLower));
            }

            if (!string.IsNullOrWhiteSpace(estado) && estado != "Todos")
            {
                resultado = resultado.Where(m => m.Estado.Equals(estado, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(micro) && micro != "Todos")
            {
                resultado = resultado.Where(m => m.Microcontrolador.Contains(micro, StringComparison.OrdinalIgnoreCase));
            }

            var vm = new ManualesListViewModel
            {
                Manuales = resultado.ToList(),
                FiltroEstado = estado,
                FiltroMicro = micro,
                Query = q
            };

            return View(vm);
        }

        [HttpGet]
        public async Task<IActionResult> Datasheets(string? categoria = null, string? query = null, bool soloBom = false)
        {
            ViewData["Full"] = true;
            ViewData["Title"] = "Fichas Técnicas";

            var datasheets = GetCuratedDatasheets();

            // Marcar componentes presentes en el BOM activo del usuario
            if (TryGetEstudianteId(out var estudianteId))
            {
                var bomComponentesNombres = await _context.ProyectoComponentes
                    .Include(pc => pc.Componente)
                    .Include(pc => pc.Proyecto)
                    .Where(pc => pc.Proyecto != null && pc.Proyecto.EstudianteID == estudianteId && pc.Proyecto.Activo)
                    .Select(pc => new { pc.Componente.Nombre, Proyecto = pc.Proyecto.NombreProyecto })
                    .ToListAsync();

                foreach (var ds in datasheets)
                {
                    var match = bomComponentesNombres.FirstOrDefault(b =>
                        ds.Nombre.ToLowerInvariant().Contains(b.Nombre.ToLowerInvariant()) ||
                        b.Nombre.ToLowerInvariant().Contains(ds.Nombre.ToLowerInvariant()));

                    if (match != null)
                    {
                        ds.EnBomUsuario = true;
                        ds.ProyectoBomNombre = match.Proyecto;
                    }
                }
            }

            var items = datasheets.AsEnumerable();

            if (!string.IsNullOrWhiteSpace(query))
            {
                var q = query.Trim().ToLowerInvariant();
                items = items.Where(d =>
                    d.Nombre.ToLowerInvariant().Contains(q) ||
                    d.Fabricante.ToLowerInvariant().Contains(q) ||
                    d.DescripcionCorta.ToLowerInvariant().Contains(q) ||
                    d.TagsTecnicos.Any(t => t.ToLowerInvariant().Contains(q)) ||
                    d.PinesIO.ToLowerInvariant().Contains(q) ||
                    d.Protocolos.ToLowerInvariant().Contains(q) ||
                    d.VoltajeOperacion.ToLowerInvariant().Contains(q));
            }

            if (!string.IsNullOrWhiteSpace(categoria) && categoria != "Todas")
            {
                items = items.Where(d => d.Categoria.Equals(categoria, StringComparison.OrdinalIgnoreCase));
            }

            if (soloBom)
            {
                items = items.Where(d => d.EnBomUsuario);
            }

            var vm = new DatasheetsListViewModel
            {
                Componentes = items.ToList(),
                Categorias = new List<string> { "Todas", "Microcontroladores", "Sensores", "Actuadores y Motores", "Drivers y Potencia", "Módulos de Comunicación" },
                CategoriaSeleccionada = categoria ?? "Todas",
                Query = query,
                SoloEnBom = soloBom
            };

            return View(vm);
        }

        [HttpGet]
        public IActionResult Normativas()
        {
            ViewData["Full"] = true;
            ViewData["Title"] = "Normativas y Seguridad";

            var estudianteNombre = User.Identity?.Name ?? "Estudiante de Mecatrónica";
            var estudianteEmail = User.FindFirstValue(ClaimTypes.Email) ?? "estudiante@mecaplan.edu";

            var vm = new NormativasHubViewModel
            {
                Normativas = GetCuratedNormativas(),
                NombreEstudiante = estudianteNombre,
                EmailEstudiante = estudianteEmail,
                FechaActual = DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
                CertificadosActivos = new List<string> { "CERT-ELEC-2026-042", "CERT-SOLD-2026-118" }
            };

            return View(vm);
        }

        [HttpGet]
        public IActionResult Guias(string? id = null, string? nivel = null, string? categoria = null)
        {
            ViewData["Full"] = true;
            ViewData["Title"] = "Guías y Tutoriales";

            var guias = GetCuratedGuias();
            var items = guias.AsEnumerable();

            if (!string.IsNullOrWhiteSpace(nivel) && nivel != "Todos")
            {
                items = items.Where(g => g.NivelDificultad.Equals(nivel, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(categoria) && categoria != "Todas")
            {
                items = items.Where(g => g.Categoria.Equals(categoria, StringComparison.OrdinalIgnoreCase));
            }

            var vm = new GuiasListViewModel
            {
                Guias = items.ToList(),
                GuiaSeleccionadaId = string.IsNullOrEmpty(id) ? guias.FirstOrDefault()?.Id : id,
                FiltroNivel = nivel,
                FiltroCategoria = categoria
            };

            return View(vm);
        }

        #region Mock Data Helpers

        private static string GetEstadoCss(string? estado) => estado switch
        {
            "Prototipado Activo" or "En Desarrollo" => "badge-active",
            "Completado" => "badge-completed",
            "Pausado" => "badge-paused",
            "Archivado" => "badge-archived",
            _ => "badge-active"
        };

        private static List<ManualItemViewModel> GetCuratedManuales()
        {
            return new List<ManualItemViewModel>
            {
                new ManualItemViewModel
                {
                    Id = "man-1",
                    Titulo = "Brazo Robótico Articulado 4-DOF con Cinemática Inversa",
                    Descripcion = "Manipulador mecatrónico de 4 grados de libertad para tareas pick & place con servomotores MG996R, cinemática analítica y control por WiFi/WebSockets.",
                    Icono = "project",
                    Estado = "Prototipado Activo",
                    EstadoCss = "badge-active",
                    Microcontrolador = "ESP32 Dual-Core (240MHz)",
                    NivelComplejidad = "Avanzado",
                    FechaActualizacion = "24/08/2026",
                    ComentariosProfesor = "Nota del catedrático: Alimentar los 4 servos con una fuente externa estabilizada de 5V a 4A. No tomar corriente de potencia de los pines 5V del microcontrolador para evitar caídas de tensión (brownout).",
                    ComponentesBOM = new List<BomComponenteItem>
                    {
                        new BomComponenteItem { Nombre = "ESP32-WROOM-32D", Cantidad = 1, Categoria = "Microcontroladores", EnInventario = true, Especificacion = "Placa de control central con 240MHz y WiFi/BLE", DatasheetId = "ds-esp32", PrecioEstimado = 145.00m },
                        new BomComponenteItem { Nombre = "MG996R Servomotor Metálico", Cantidad = 4, Categoria = "Actuadores", EnInventario = true, Especificacion = "Torque 11 kg·cm a 6V con engranes metálicos", DatasheetId = "ds-mg996r", PrecioEstimado = 120.00m },
                        new BomComponenteItem { Nombre = "Fuente Conmutada 5V 5A", Cantidad = 1, Categoria = "Potencia", EnInventario = false, Especificacion = "Alimentación dedicada de alta corriente para servos", DatasheetId = "ds-fuente5v", PrecioEstimado = 190.00m },
                        new BomComponenteItem { Nombre = "Estructura Acrílica 4-DOF", Cantidad = 1, Categoria = "Estructura", EnInventario = true, Especificacion = "Chasis cortado en láser 3mm con rodamientos axiales", DatasheetId = "ds-chasis4dof", PrecioEstimado = 280.00m },
                        new BomComponenteItem { Nombre = "Sensor de Corriente ACS712-05B", Cantidad = 1, Categoria = "Sensores", EnInventario = true, Especificacion = "Medición de consumo y detección de atasco mecánico", DatasheetId = "ds-acs712", PrecioEstimado = 65.00m }
                    },
                    PasosEnsamblaje = new List<PasoManualItem>
                    {
                        new PasoManualItem
                        {
                            NumeroPaso = 1,
                            Titulo = "Montaje de Base Giratoria y Servomotor de Cintura",
                            Descripcion = "Fijar el primer servomotor MG996R al plato base con tornillos M3x10mm. Colocar el balero axial para absorber cargas laterales.",
                            PinesClave = "Servo Base -> GPIO 13 (PWM Timer 0 Canal 0)",
                            Tips = "Centrar el servo mecánicamente a 90° antes de atornillar el cuerno principal.",
                            UrlEsquema = "/images/componentes/actuador.svg"
                        },
                        new PasoManualItem
                        {
                            NumeroPaso = 2,
                            Titulo = "Eslabón de Hombro y Codo con Refuerzo de Par",
                            Descripcion = "Ensamblar los eslabones de hombro y codo. Verificar que el centro de masa quede balanceado para reducir el torque estático.",
                            PinesClave = "Servo Hombro -> GPIO 12, Servo Codo -> GPIO 14",
                            Tips = "Añadir arandelas de teflón en las articulaciones para disminuir fricción.",
                            UrlEsquema = "/images/componentes/actuador.svg"
                        },
                        new PasoManualItem
                        {
                            NumeroPaso = 3,
                            Titulo = "Montaje del Efector Final (Pinza Paralela)",
                            Descripcion = "Instalar la pinza de agarre acoplada al micro-servo MG90S con almohadillas de caucho de alta adherencia en las puntas.",
                            PinesClave = "Servo Pinza -> GPIO 27",
                            Tips = "Limitar el ángulo máximo de cierre por software para no forzar los topes mecánicos.",
                            UrlEsquema = "/images/componentes/actuador.svg"
                        },
                        new PasoManualItem
                        {
                            NumeroPaso = 4,
                            Titulo = "Conexión Eléctrica y Rieles de Alimentación",
                            Descripcion = "Unir tierras (GND común) entre el ESP32 y la fuente externa de 5V. Conectar las 4 líneas de señal PWM a los GPIOs configurados.",
                            PinesClave = "GND Fuente == GND ESP32; +5V Fuente -> Riel VCC Servos",
                            Tips = "Usar condensador electrolítico de 1000 µF / 16V en paralelo con la línea de 5V de los servos.",
                            UrlEsquema = "/images/componentes/fuente.svg"
                        }
                    },
                    FirmwareCodigo = """
// MecaPlan Firmware: Brazo Robótico 4-DOF con Cinemática Inversa
#include <ESP32Servo.h>
#include <math.h>

Servo servoBase, servoHombro, servoCodo, servoPinza;
const float L1 = 120.0; // Longitud eslabón 1 (mm)
const float L2 = 115.0; // Longitud eslabón 2 (mm)

void setup() {
  Serial.begin(115200);
  servoBase.attach(13, 500, 2400);
  servoHombro.attach(12, 500, 2400);
  servoCodo.attach(14, 500, 2400);
  servoPinza.attach(27, 500, 2400);
  
  // Posición Home Segura
  moverHome();
  Serial.println("[MecaPlan] Brazo 4-DOF inicializado en posición Home.");
}

void loop() {
  if (Serial.available() > 0) {
    float x = Serial.parseFloat();
    float y = Serial.parseFloat();
    float z = Serial.parseFloat();
    resolverCinematicaInversa(x, y, z);
  }
}

void moverHome() {
  servoBase.write(90);
  servoHombro.write(90);
  servoCodo.write(90);
  servoPinza.write(45); // Abierta
}

void resolverCinematicaInversa(float x, float y, float z) {
  float thetaBase = atan2(y, x) * 180.0 / M_PI;
  float r = sqrt(x*x + y*y);
  float d = sqrt(r*r + z*z);
  if (d > (L1 + L2)) {
    Serial.println("[ERROR] Posicion fuera del espacio de trabajo!");
    return;
  }
  float cosCodo = (d*d - L1*L1 - L2*L2) / (2 * L1 * L2);
  float thetaCodo = acos(cosCodo) * 180.0 / M_PI;
  servoBase.write((int)thetaBase);
  servoCodo.write((int)thetaCodo);
}
""",
                    ChecklistPruebas = new List<ChecklistItem>
                    {
                        new ChecklistItem { Id = "chk-b1", Titulo = "Tierra Común (GND) Verificada", Descripcion = "Medir 0.0V entre GND del ESP32 y GND de la fuente externa de 5V.", Tipo = "Continuidad", Completado = true },
                        new ChecklistItem { Id = "chk-b2", Titulo = "Calibración de Recorrido 0°-180°", Descripcion = "Verificar que ningún servomotor toque topes físicos antes de alcanzar el límite de pulso.", Tipo = "Señal", Completado = true },
                        new ChecklistItem { Id = "chk-b3", Titulo = "Cálculo Cinemático en Cuadrante 1 y 2", Descripcion = "Comprobar precisión de posicionamiento milimétrico con regla graduada.", Tipo = "Lógica", Completado = false },
                        new ChecklistItem { Id = "chk-b4", Titulo = "Ensayo de Consumo Máximo Bajo Carga (300g)", Descripcion = "Registrar corriente total con amperímetro: no debe exceder los 3.2A en movimiento simultáneo.", Tipo = "Carga", Completado = false }
                    }
                },
                new ManualItemViewModel
                {
                    Id = "man-2",
                    Titulo = "Vehículo Autónomo Seguidor de Línea y Evasor con Control PID",
                    Descripcion = "Robot móvil diferencial con arreglo de 8 sensores infrarrojos QTR-8A, driver puente H L298N, algoritmo PID a 100Hz y sensor ultrasónico HC-SR04 para detección de obstáculos.",
                    Icono = "project",
                    Estado = "En Desarrollo",
                    EstadoCss = "badge-active",
                    Microcontrolador = "Arduino Uno R3 (ATmega328P)",
                    NivelComplejidad = "Intermedio",
                    FechaActualizacion = "28/08/2026",
                    ComentariosProfesor = "Nota técnica: Ajustar la constante Proporcional (Kp) primero hasta que el robot oscile suavemente sobre la línea, luego incrementar Kd para amortiguar el sobreimpulso.",
                    ComponentesBOM = new List<BomComponenteItem>
                    {
                        new BomComponenteItem { Nombre = "Arduino Uno R3", Cantidad = 1, Categoria = "Microcontroladores", EnInventario = true, Especificacion = "Microcontrolador 16MHz ATmega328P", DatasheetId = "ds-arduino-uno", PrecioEstimado = 110.00m },
                        new BomComponenteItem { Nombre = "Módulo Driver Puente H L298N", Cantidad = 1, Categoria = "Drivers", EnInventario = true, Especificacion = "Control de 2 motores DC hasta 2A por canal", DatasheetId = "ds-l298n", PrecioEstimado = 75.00m },
                        new BomComponenteItem { Nombre = "Arreglo Sensores QTR-8A Reflectivos", Cantidad = 1, Categoria = "Sensores", EnInventario = true, Especificacion = "8 fototransistores infrarrojos analógicos", DatasheetId = "ds-qtr8a", PrecioEstimado = 160.00m },
                        new BomComponenteItem { Nombre = "Motorreductores DC Metálicos 6V 300RPM", Cantidad = 2, Categoria = "Actuadores", EnInventario = true, Especificacion = "Relación de engranes 1:30 con encoders magnéticos", DatasheetId = "ds-motor-dc", PrecioEstimado = 95.00m },
                        new BomComponenteItem { Nombre = "Batería LiPo 2S 7.4V 1500mAh", Cantidad = 1, Categoria = "Potencia", EnInventario = false, Especificacion = "Descarga 25C para alta respuesta dinámica", DatasheetId = "ds-lipo2s", PrecioEstimado = 210.00m }
                    },
                    PasosEnsamblaje = new List<PasoManualItem>
                    {
                        new PasoManualItem { NumeroPaso = 1, Titulo = "Montaje de Motores y Chasis Diferencial", Descripcion = "Fijar los soportes de los motorreductores con tornillos M3 y montar las ruedas de goma de alto agarre.", PinesClave = "Driver L298N Out1/Out2 (Motor Izq), Out3/Out4 (Motor Der)" },
                        new PasoManualItem { NumeroPaso = 2, Titulo = "Instalación de la Barra de Sensores QTR-8A", Descripcion = "Calibrar la altura de la barra entre 3mm y 5mm del suelo para máxima discriminación entre blanco y negro.", PinesClave = "Sensores A0 a A7 -> Pines Analógicos Arduino" },
                        new PasoManualItem { NumeroPaso = 3, Titulo = "Conexión de Señales PWM y Habilitadores de Giro", Descripcion = "Conectar ENA y ENB del L298N a pines PWM del Arduino Uno (D5 y D6). Conectar IN1-IN4 a D7, D8, D9, D10.", PinesClave = "ENA->Pin 5, ENB->Pin 6, IN1->Pin 7, IN2->Pin 8, IN3->Pin 9, IN4->Pin 10" }
                    },
                    FirmwareCodigo = """
// MecaPlan: Seguidor de Línea PID
const int ENA = 5, ENB = 6;
const int IN1 = 7, IN2 = 8, IN3 = 9, IN4 = 10;
float Kp = 0.08, Ki = 0.0001, Kd = 0.65;
int P, I, D, errorAnterior = 0, velocidadBase = 160;

void setup() {
  pinMode(ENA, OUTPUT); pinMode(ENB, OUTPUT);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  int posicionPonderada = 3500;
  int error = posicionPonderada - 3500;
  P = error;
  I += error;
  D = error - errorAnterior;
  errorAnterior = error;
  
  int correccion = (int)(Kp*P + Ki*I + Kd*D);
  int velIzq = constrain(velocidadBase + correccion, 0, 255);
  int velDer = constrain(velocidadBase - correccion, 0, 255);
  
  analogWrite(ENA, velIzq);
  analogWrite(ENB, velDer);
}
""",
                    ChecklistPruebas = new List<ChecklistItem>
                    {
                        new ChecklistItem { Id = "chk-v1", Titulo = "Lectura Analógica en Pista Blanca y Negra", Descripcion = "Verificar lectura > 700 en negro y < 150 en blanco.", Tipo = "Señal", Completado = true },
                        new ChecklistItem { Id = "chk-v2", Titulo = "Dirección de Giro en Ambos Motores", Descripcion = "Asegurar que comando hacia adelante gire ambas ruedas en sentido horario.", Tipo = "Lógica", Completado = true },
                        new ChecklistItem { Id = "chk-v3", Titulo = "Frenado por Obstáculo Ultrasónico (<15cm)", Descripcion = "Parada de emergencia inmediata cuando el HC-SR04 detecte objeto.", Tipo = "Lógica", Completado = false }
                    }
                },
                new ManualItemViewModel
                {
                    Id = "man-3",
                    Titulo = "Sistema IoT de Monitoreo Ambiental e Invernadero Automatizado",
                    Descripcion = "Estación telemétrica con sensores BME280 (temperatura, humedad, presión), sensor capacitivo de humedad de suelo, relé de estado sólido y telemetría MQTT hacia dashboard.",
                    Icono = "project",
                    Estado = "Completado",
                    EstadoCss = "badge-completed",
                    Microcontrolador = "ESP32-WROOM-32D",
                    NivelComplejidad = "Intermedio",
                    FechaActualizacion = "15/08/2026",
                    ComentariosProfesor = "Nota técnica: Implementación adecuada del protocolo MQTT. Se sugiere activar Deep Sleep para estaciones en campo con panel solar.",
                    ComponentesBOM = new List<BomComponenteItem>
                    {
                        new BomComponenteItem { Nombre = "ESP32-WROOM-32D", Cantidad = 1, Categoria = "Microcontroladores", EnInventario = true, Especificacion = "WiFi/BLE 2.4GHz SoC", DatasheetId = "ds-esp32", PrecioEstimado = 145.00m },
                        new BomComponenteItem { Nombre = "Sensor Ambiental BME280", Cantidad = 1, Categoria = "Sensores", EnInventario = true, Especificacion = "Presión, Humedad y Temperatura I2C", DatasheetId = "ds-bme280", PrecioEstimado = 95.00m },
                        new BomComponenteItem { Nombre = "Sensor Humedad Suelo Capacitivo v1.2", Cantidad = 2, Categoria = "Sensores", EnInventario = true, Especificacion = "Inmune a la corrosión por electrólisis", DatasheetId = "ds-suelo-cap", PrecioEstimado = 45.00m },
                        new BomComponenteItem { Nombre = "Módulo Relé 5V Optoacoplado", Cantidad = 2, Categoria = "Actuadores", EnInventario = true, Especificacion = "Conmutación 250VAC 10A para bomba y ventilador", DatasheetId = "ds-rele", PrecioEstimado = 40.00m }
                    },
                    PasosEnsamblaje = new List<PasoManualItem>
                    {
                        new PasoManualItem { NumeroPaso = 1, Titulo = "Bus I2C para BME280 y Pantalla OLED", Descripcion = "Conectar SDA a GPIO 21 y SCL a GPIO 22 del ESP32 con resistencias pull-up de 4.7kΩ.", PinesClave = "SDA -> GPIO 21, SCL -> GPIO 22" },
                        new PasoManualItem { NumeroPaso = 2, Titulo = "Calibración en Seco y en Agua de Sensores Capacitivos", Descripcion = "Medir valor analógico en aire (100% seco = 3200 ADC) y sumergido en agua (100% húmedo = 1400 ADC).", PinesClave = "ADC1_CH6 -> GPIO 34, ADC1_CH7 -> GPIO 35" }
                    },
                    FirmwareCodigo = """
// MecaPlan: Nodo IoT Invernadero MQTT
#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;
WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  bme.begin(0x76);
  WiFi.begin("SSID_LAB", "PASS_LAB");
  client.setServer("broker.hivemq.com", 1883);
}

void loop() {
  client.loop();
  float temp = bme.readTemperature();
  float hum = bme.readHumidity();
  char payload[64];
  snprintf(payload, sizeof(payload), "{\"temp\":%.2f,\"hum\":%.2f}", temp, hum);
  client.publish("mecaplan/invernadero/telemetria", payload);
  delay(5000);
}
""",
                    ChecklistPruebas = new List<ChecklistItem>
                    {
                        new ChecklistItem { Id = "chk-i1", Titulo = "Reconocimiento de Dirección I2C 0x76", Descripcion = "I2C scanner detecta BME280 sin colisiones.", Tipo = "Continuidad", Completado = true },
                        new ChecklistItem { Id = "chk-i2", Titulo = "Publicación MQTT a 1 paquete / 5s", Descripcion = "Dashboard web recibe telemetría JSON validada.", Tipo = "Lógica", Completado = true }
                    }
                },
                new ManualItemViewModel
                {
                    Id = "man-4",
                    Titulo = "Péndulo Invertido Auto-Balanceado con IMU y Filtro Kalman",
                    Descripcion = "Sistema no lineal de control reactivo rápido con giroscopio/acelerómetro MPU-6050, encoders ópticos y lazo cerrado a 200 Hz.",
                    Icono = "project",
                    Estado = "Prototipado Activo",
                    EstadoCss = "badge-active",
                    Microcontrolador = "STM32F401 BlackPill (84MHz)",
                    NivelComplejidad = "Avanzado",
                    FechaActualizacion = "27/08/2026",
                    ComentariosProfesor = "Nota técnica: El tiempo de muestreo (Ts) debe ser determinístico. Emplear interrupciones de timer por hardware (TIM2 a 5ms).",
                    ComponentesBOM = new List<BomComponenteItem>
                    {
                        new BomComponenteItem { Nombre = "STM32F401CCU6 BlackPill", Cantidad = 1, Categoria = "Microcontroladores", EnInventario = true, Especificacion = "Cortex-M4 con FPU 84MHz", DatasheetId = "ds-stm32f4", PrecioEstimado = 130.00m },
                        new BomComponenteItem { Nombre = "MPU-6050 Módulo IMU 6-DOF", Cantidad = 1, Categoria = "Sensores", EnInventario = true, Especificacion = "Giroscopio y acelerómetro con DMP integrado", DatasheetId = "ds-mpu6050", PrecioEstimado = 55.00m },
                        new BomComponenteItem { Nombre = "Motor NEMA 17 + Driver A4988", Cantidad = 2, Categoria = "Actuadores", EnInventario = true, Especificacion = "Paso a paso con microstepping 1/16", DatasheetId = "ds-a4988", PrecioEstimado = 180.00m }
                    },
                    PasosEnsamblaje = new List<PasoManualItem>
                    {
                        new PasoManualItem { NumeroPaso = 1, Titulo = "Montaje Vertical del Sensor MPU-6050", Descripcion = "Alinear el eje Z del MPU-6050 con el eje del péndulo para evitar desalineación angular.", PinesClave = "I2C1_SCL -> PB6, I2C1_SDA -> PB7" }
                    },
                    FirmwareCodigo = """
// MecaPlan: Lazo Balanceador LQR STM32
#include <Wire.h>
#define MPU_ADDR 0x68
float anguloFilt = 0, gyroY = 0, dt = 0.005;

void loopControlTimer() {
  anguloFilt = 0.98 * (anguloFilt + gyroY * dt);
}
""",
                    ChecklistPruebas = new List<ChecklistItem>
                    {
                        new ChecklistItem { Id = "chk-p1", Titulo = "Lectura de Giroscopio a 200 Hz", Descripcion = "Muestreo por Timer sin jitter.", Tipo = "Señal", Completado = true }
                    }
                },
                new ManualItemViewModel
                {
                    Id = "man-5",
                    Titulo = "Estación de Clasificación de Piezas con Visión y Neumática",
                    Descripcion = "Banda transportadora con sensor de color RGB TCS3200, electroválvula neumática 5/2 y cilindro actuador eyector.",
                    Icono = "project",
                    Estado = "Archivado",
                    EstadoCss = "badge-archived",
                    Microcontrolador = "Arduino Mega 2560",
                    NivelComplejidad = "Avanzado",
                    FechaActualizacion = "02/06/2026",
                    ComentariosProfesor = "Nota técnica: Documentación de referencia para proyectos con actuadores electroneumáticos industriales.",
                    ComponentesBOM = new List<BomComponenteItem>
                    {
                        new BomComponenteItem { Nombre = "Arduino Mega 2560 R3", Cantidad = 1, Categoria = "Microcontroladores", EnInventario = true, Especificacion = "54 pines GPIO digitales", DatasheetId = "ds-mega2560", PrecioEstimado = 230.00m },
                        new BomComponenteItem { Nombre = "Sensor de Color TCS3200", Cantidad = 1, Categoria = "Sensores", EnInventario = true, Especificacion = "Matriz de fotodiodos RGB", DatasheetId = "ds-tcs3200", PrecioEstimado = 85.00m },
                        new BomComponenteItem { Nombre = "Electroválvula Neumática 5/2 24VDC", Cantidad = 1, Categoria = "Actuadores", EnInventario = true, Especificacion = "Control por transistor MOSFET IRF540N", DatasheetId = "ds-valvula52", PrecioEstimado = 320.00m }
                    },
                    PasosEnsamblaje = new List<PasoManualItem>
                    {
                        new PasoManualItem { NumeroPaso = 1, Titulo = "Aislamiento de la Etapa de Potencia 24V Neumática", Descripcion = "Usar optoacoplador 4N35 para separar la lógica de 5V del Arduino del solenoide inductivo de 24V.", PinesClave = "Pin 22 -> Optoacoplador -> Gate MOSFET" }
                    },
                    FirmwareCodigo = """
// MecaPlan: Clasificador Neumatico
void activarPiston() {
  digitalWrite(22, HIGH);
  delay(150);
  digitalWrite(22, LOW);
}
""",
                    ChecklistPruebas = new List<ChecklistItem>
                    {
                        new ChecklistItem { Id = "chk-c1", Titulo = "Diodo Flyback 1N4007 en Solenoide", Descripcion = "Protección contra picos de fuerza contraelectromotriz (Back-EMF).", Tipo = "Continuidad", Completado = true }
                    }
                },
                new ManualItemViewModel
                {
                    Id = "man-6",
                    Titulo = "Dron Cuadricóptero Miniatura con Control de Vuelo Custom",
                    Descripcion = "Controlador de actitud con barómetro BMP280, giróscopo MPU-6050, motores brushless con ESC DShot300 y telemetría por ESP-NOW.",
                    Icono = "project",
                    Estado = "En Desarrollo",
                    EstadoCss = "badge-active",
                    Microcontrolador = "ESP32-S3 Dual-Core",
                    NivelComplejidad = "Avanzado",
                    FechaActualizacion = "29/08/2026",
                    ComentariosProfesor = "Nota técnica: Realizar las pruebas de calibración de motores sin hélices instaladas dentro del laboratorio.",
                    ComponentesBOM = new List<BomComponenteItem>
                    {
                        new BomComponenteItem { Nombre = "ESP32-S3 DevKitC", Cantidad = 1, Categoria = "Microcontroladores", EnInventario = true, Especificacion = "Soporte Vectorial AI", DatasheetId = "ds-esp32", PrecioEstimado = 195.00m },
                        new BomComponenteItem { Nombre = "Motores Brushless 2205 2300KV", Cantidad = 4, Categoria = "Actuadores", EnInventario = false, Especificacion = "Empuje 850g por motor con hélices 5045", DatasheetId = "ds-brushless", PrecioEstimado = 480.00m },
                        new BomComponenteItem { Nombre = "ESC 4-en-1 30A BLHeli_S", Cantidad = 1, Categoria = "Drivers", EnInventario = false, Especificacion = "Protocolo digital DShot600", DatasheetId = "ds-esc4in1", PrecioEstimado = 360.00m }
                    },
                    PasosEnsamblaje = new List<PasoManualItem>
                    {
                        new PasoManualItem { NumeroPaso = 1, Titulo = "Amortiguación de Vibraciones en la Placa IMU", Descripcion = "Montar la IMU sobre almohadillas de silicona antivibración para no contaminar las lecturas de aceleración.", PinesClave = "SPI / I2C Bus dedicado" }
                    },
                    FirmwareCodigo = """
// MecaPlan Drone FC
void loopRate() {
  // Bucle de vuelo
}
""",
                    ChecklistPruebas = new List<ChecklistItem>
                    {
                        new ChecklistItem { Id = "chk-d1", Titulo = "Protocolo de Armado / Desarmado de Motores", Descripcion = "Stick izquierdo abajo a la derecha para armar con confirmación sonora.", Tipo = "Lógica", Completado = true }
                    }
                }
            };
        }

        private static List<DatasheetItemViewModel> GetCuratedDatasheets()
        {
            return new List<DatasheetItemViewModel>
            {
                new DatasheetItemViewModel
                {
                    Id = "ds-esp32",
                    Nombre = "ESP32-WROOM-32D",
                    Fabricante = "Espressif Systems",
                    Categoria = "Microcontroladores",
                    DescripcionCorta = "SoC de alto rendimiento con microprocesador Xtensa Dual-Core de 32 bits a 240 MHz, conectividad Wi-Fi 802.11 b/g/n y Bluetooth v4.2 BR/EDR & BLE.",
                    VoltajeOperacion = "3.0V a 3.6V (3.3V nominal / 600mA)",
                    PinesIO = "38 pines (18 ADC 12-bit, 2 DAC 8-bit, 3 UART, 2 I2C, 4 SPI, 16 PWM)",
                    Protocolos = "Wi-Fi, BLE, I2C, SPI, UART, I2S, CAN 2.0",
                    Consumo = "80 mA activo, 5 µA Deep Sleep",
                    Frecuencia = "Hasta 240 MHz",
                    StockInventario = 6,
                    TagsTecnicos = new List<string> { "3.3V", "Wi-Fi", "Bluetooth", "Dual-Core", "ADC 12-bit", "PWM", "I2C", "SPI" },
                    UrlImagen = "/images/componentes/microcontrolador.svg",
                    UrlPdf = "#",
                    PackageType = "Módulo SMD 38-Pin / DevKit",
                    NotasAplicacion = "Requiere desacople cerámico de 100nF cerca de los pines VDD. Los pines GPIO 6 a 11 se reservan para la memoria flash interna.",
                    PinoutTable = new List<PinoutItem>
                    {
                        new PinoutItem { Pin = "Pin 1", Nombre = "3V3", Tipo = "Power", Funcion = "Alimentación 3.3V", Notas = "No superar 3.6V." },
                        new PinoutItem { Pin = "Pin 2", Nombre = "EN", Tipo = "Control", Funcion = "Reset (Activo en Alto)", Notas = "Pull-up interno a 3.3V." },
                        new PinoutItem { Pin = "Pin 3", Nombre = "GPIO 36 / SENSOR_VP", Tipo = "ADC", Funcion = "Entrada ADC1 Canal 0", Notas = "Solo entrada analógica." },
                        new PinoutItem { Pin = "Pin 4", Nombre = "GPIO 39 / SENSOR_VN", Tipo = "ADC", Funcion = "Entrada ADC1 Canal 3", Notas = "Bajo nivel de ruido." },
                        new PinoutItem { Pin = "Pin 23", Nombre = "GPIO 21 / SDA", Tipo = "I2C", Funcion = "Datos I2C", Notas = "Requiere pull-up de 4.7kΩ." },
                        new PinoutItem { Pin = "Pin 24", Nombre = "GPIO 22 / SCL", Tipo = "I2C", Funcion = "Reloj I2C", Notas = "Hasta 400 kHz." },
                        new PinoutItem { Pin = "Pin 34", Nombre = "GPIO 1 / TX0", Tipo = "UART", Funcion = "Transmisor Serial U0TXD", Notas = "Conexión USB-Serial." },
                        new PinoutItem { Pin = "Pin 35", Nombre = "GPIO 3 / RX0", Tipo = "UART", Funcion = "Receptor Serial U0RXD", Notas = "Conexión USB-Serial." }
                    }
                },
                new DatasheetItemViewModel
                {
                    Id = "ds-mpu6050",
                    Nombre = "MPU-6050 Módulo IMU 6-DOF",
                    Fabricante = "InvenSense / TDK",
                    Categoria = "Sensores",
                    DescripcionCorta = "Unidad de medición inercial de 6 grados de libertad: giroscopio MEMS de 3 ejes, acelerómetro de 3 ejes y procesador digital de movimiento (DMP).",
                    VoltajeOperacion = "3.3V a 5.0V (Módulo GY-521)",
                    PinesIO = "8 pines (VCC, GND, SCL, SDA, XDA, XCL, AD0, INT)",
                    Protocolos = "I2C Fast Mode (400 kHz), Dirección 0x68 / 0x69",
                    Consumo = "3.8 mA activo, 5 µA Sleep",
                    Frecuencia = "Giroscopio hasta 8 kHz, Acelerómetro hasta 1 kHz",
                    StockInventario = 8,
                    TagsTecnicos = new List<string> { "I2C", "3.3V", "5V", "IMU", "Giroscopio", "Acelerómetro", "6-DOF" },
                    UrlImagen = "/images/componentes/sensor.svg",
                    UrlPdf = "#",
                    PackageType = "Módulo GY-521 DIP-8",
                    NotasAplicacion = "Colocar la IMU cerca del centro de gravedad del prototipo para reducir ruidos mecánicos.",
                    PinoutTable = new List<PinoutItem>
                    {
                        new PinoutItem { Pin = "Pin 1", Nombre = "VCC", Tipo = "Power", Funcion = "Alimentación 3.3V - 5V", Notas = "Regulador LDO integrado." },
                        new PinoutItem { Pin = "Pin 2", Nombre = "GND", Tipo = "Power", Funcion = "Tierra común", Notas = "Referencia 0V." },
                        new PinoutItem { Pin = "Pin 3", Nombre = "SCL", Tipo = "I2C", Funcion = "Reloj I2C", Notas = "Línea de sincronismo." },
                        new PinoutItem { Pin = "Pin 4", Nombre = "SDA", Tipo = "I2C", Funcion = "Datos I2C", Notas = "Línea bidireccional." },
                        new PinoutItem { Pin = "Pin 7", Nombre = "AD0", Tipo = "Control", Funcion = "Selección de Dirección", Notas = "GND = 0x68, VCC = 0x69." },
                        new PinoutItem { Pin = "Pin 8", Nombre = "INT", Tipo = "Interrupción", Funcion = "Salida de Interrupción", Notas = "Alerta de nuevos datos." }
                    }
                },
                new DatasheetItemViewModel
                {
                    Id = "ds-l298n",
                    Nombre = "L298N Driver Puente H Dual",
                    Fabricante = "STMicroelectronics",
                    Categoria = "Drivers y Potencia",
                    DescripcionCorta = "Controlador de potencia de doble puente H para cargas inductivas: motores de corriente continua (DC), solenoides y motores paso a paso.",
                    VoltajeOperacion = "Lógica: 5V | Potencia: 5V a 35V DC",
                    PinesIO = "Borneras de Potencia + 6 Pines Lógicos (ENA, IN1-IN4, ENB)",
                    Protocolos = "Control PWM y Señales Digitales",
                    Consumo = "2A pico por canal (hasta 25W con disipador)",
                    Frecuencia = "PWM recomendado hasta 40 kHz",
                    StockInventario = 4,
                    TagsTecnicos = new List<string> { "Puente H", "PWM", "Motores DC", "12V", "24V", "2A", "Potencia" },
                    UrlImagen = "/images/componentes/actuador.svg",
                    UrlPdf = "#",
                    PackageType = "Módulo con disipador de aluminio",
                    NotasAplicacion = "Si la tensión de motores supera los 12V, retirar el jumper de 5V integrado y alimentar la lógica externamente.",
                    PinoutTable = new List<PinoutItem>
                    {
                        new PinoutItem { Pin = "Bornera 1", Nombre = "+12V (VMS)", Tipo = "Power", Funcion = "Alimentación de Motores", Notas = "5V - 35V DC." },
                        new PinoutItem { Pin = "Bornera 2", Nombre = "GND", Tipo = "Power", Funcion = "Tierra común", Notas = "Unir con GND del microcontrolador." },
                        new PinoutItem { Pin = "Bornera 3", Nombre = "+5V", Tipo = "Power", Funcion = "Salida/Entrada 5V", Notas = "Regulado interno si VMS <= 12V." },
                        new PinoutItem { Pin = "Pin ENA", Nombre = "ENA", Tipo = "PWM", Funcion = "Velocidad Motor A", Notas = "Inyección de señal PWM." },
                        new PinoutItem { Pin = "Pines IN1/IN2", Nombre = "IN1 / IN2", Tipo = "GPIO", Funcion = "Dirección Motor A", Notas = "Control de sentido de giro." }
                    }
                },
                new DatasheetItemViewModel
                {
                    Id = "ds-arduino-uno",
                    Nombre = "Arduino Uno R3 (ATmega328P)",
                    Fabricante = "Arduino / Microchip",
                    Categoria = "Microcontroladores",
                    DescripcionCorta = "Placa de desarrollo microcontrolada basada en el procesador AVR de 8 bits ATmega328P con 32KB de memoria Flash.",
                    VoltajeOperacion = "5V Operación | Entrada Vin: 7V a 12V DC",
                    PinesIO = "14 Pines Digitales (6 PWM), 6 Entradas Analógicas ADC 10-bit",
                    Protocolos = "UART (D0/D1), I2C (A4/A5), SPI (D10-D13)",
                    Consumo = "45 mA en funcionamiento nominal",
                    Frecuencia = "16 MHz",
                    StockInventario = 10,
                    TagsTecnicos = new List<string> { "5V", "ATmega328P", "16MHz", "PWM", "ADC 10-bit", "I2C", "SPI", "UART" },
                    UrlImagen = "/images/componentes/microcontrolador.svg",
                    UrlPdf = "#",
                    PackageType = "Placa DIP-28 socket / USB-B",
                    NotasAplicacion = "La corriente máxima por pin GPIO es de 40 mA (recomendado 20 mA continuo).",
                    PinoutTable = new List<PinoutItem>
                    {
                        new PinoutItem { Pin = "D0 / RX", Nombre = "0 (RX)", Tipo = "UART", Funcion = "Receptor Serial 5V", Notas = "Puerto de comunicación USB." },
                        new PinoutItem { Pin = "D1 / TX", Nombre = "1 (TX)", Tipo = "UART", Funcion = "Transmisor Serial 5V", Notas = "Puerto de comunicación USB." },
                        new PinoutItem { Pin = "D3, D5, D6, D9, D10, D11", Nombre = "PWM (~)", Tipo = "PWM", Funcion = "Salidas PWM", Notas = "Frecuencia 490 Hz / 980 Hz." },
                        new PinoutItem { Pin = "A4 / SDA", Nombre = "A4", Tipo = "I2C", Funcion = "Datos I2C", Notas = "Entrada analógica o bus I2C." },
                        new PinoutItem { Pin = "A5 / SCL", Nombre = "A5", Tipo = "I2C", Funcion = "Reloj I2C", Notas = "Entrada analógica o bus I2C." }
                    }
                },
                new DatasheetItemViewModel
                {
                    Id = "ds-hcsr04",
                    Nombre = "HC-SR04 Sensor de Distancia Ultrasónico",
                    Fabricante = "ElecFreaks / Genérico",
                    Categoria = "Sensores",
                    DescripcionCorta = "Sensor de telemetría acústica sin contacto con rango de medición de 2 cm a 400 cm mediante ultrasonido a 40 kHz.",
                    VoltajeOperacion = "5.0V DC",
                    PinesIO = "4 pines (VCC, Trig, Echo, GND)",
                    Protocolos = "Pulso digital TTL (Trigger 10µs, Echo proporcional)",
                    Consumo = "15 mA en operación",
                    Frecuencia = "40 kHz acústica",
                    StockInventario = 12,
                    TagsTecnicos = new List<string> { "5V", "Ultrasonido", "Distancia", "40kHz", "TTL", "Evasor" },
                    UrlImagen = "/images/componentes/sensor.svg",
                    UrlPdf = "#",
                    PackageType = "Módulo transductores cilíndricos",
                    NotasAplicacion = "Distancia en cm = Tiempo de eco en microsegundos dividido por 58.2.",
                    PinoutTable = new List<PinoutItem>
                    {
                        new PinoutItem { Pin = "Pin 1", Nombre = "VCC", Tipo = "Power", Funcion = "Alimentación 5V", Notas = "5V estabilizados." },
                        new PinoutItem { Pin = "Pin 2", Nombre = "Trig", Tipo = "GPIO", Funcion = "Disparo Ultrasónico", Notas = "Pulso HIGH de 10 µs." },
                        new PinoutItem { Pin = "Pin 3", Nombre = "Echo", Tipo = "GPIO", Funcion = "Recepción de Eco", Notas = "Pulso proporcional a distancia." },
                        new PinoutItem { Pin = "Pin 4", Nombre = "GND", Tipo = "Power", Funcion = "Tierra", Notas = "Referencia 0V." }
                    }
                },
                new DatasheetItemViewModel
                {
                    Id = "ds-mg996r",
                    Nombre = "MG996R Servomotor Metálico de Alto Torque",
                    Fabricante = "TowerPro",
                    Categoria = "Actuadores y Motores",
                    DescripcionCorta = "Servomotor de posición angular con engranajes metálicos, doble rodamiento de bolas y par de torsión de hasta 11 kg·cm a 6V.",
                    VoltajeOperacion = "4.8V a 7.2V DC (6.0V recomendado)",
                    PinesIO = "3 hilos (GND, VCC, Señal PWM)",
                    Protocolos = "PWM Analógico (50 Hz, pulso 1.0 ms a 2.0 ms)",
                    Consumo = "500-900 mA en movimiento, hasta 2.5A en stall",
                    Frecuencia = "50 Hz periodo 20 ms",
                    StockInventario = 5,
                    TagsTecnicos = new List<string> { "5V-6V", "PWM", "Servo", "Alto Torque", "Metálico" },
                    UrlImagen = "/images/componentes/actuador.svg",
                    UrlPdf = "#",
                    PackageType = "Carcasa estándar 40.7 × 19.7 × 42.9 mm",
                    NotasAplicacion = "Requiere fuente independiente con capacidad de al menos 2.5A por actuador.",
                    PinoutTable = new List<PinoutItem>
                    {
                        new PinoutItem { Pin = "Cable Negro", Nombre = "GND", Tipo = "Power", Funcion = "Tierra común", Notas = "Unir con GND general." },
                        new PinoutItem { Pin = "Cable Rojo", Nombre = "VCC", Tipo = "Power", Funcion = "Alimentación (5V - 6V)", Notas = "Fuente externa dedicada." },
                        new PinoutItem { Pin = "Cable Amarillo", Nombre = "PWM", Tipo = "PWM", Funcion = "Señal de Control", Notas = "1ms = 0°, 2ms = 180°." }
                    }
                },
                new DatasheetItemViewModel
                {
                    Id = "ds-bme280",
                    Nombre = "BME280 Sensor Ambiental de Precisión",
                    Fabricante = "Bosch Sensortec",
                    Categoria = "Sensores",
                    DescripcionCorta = "Sensor digital combinado de presión barométrica, temperatura y humedad relativa de bajo consumo.",
                    VoltajeOperacion = "1.71V a 3.6V (Módulo con LDO a 5V)",
                    PinesIO = "6 pines (VCC, GND, SCL, SDA, CSB, SDO)",
                    Protocolos = "I2C (hasta 3.4 MHz) y SPI (hasta 10 MHz)",
                    Consumo = "3.6 µA a 1 Hz, 0.1 µA Sleep",
                    Frecuencia = "Muestreo hasta 157 Hz",
                    StockInventario = 7,
                    TagsTecnicos = new List<string> { "I2C", "SPI", "3.3V", "Temperatura", "Humedad", "Presión" },
                    UrlImagen = "/images/componentes/sensor.svg",
                    UrlPdf = "#",
                    PackageType = "Módulo Breakout",
                    NotasAplicacion = "Dirección I2C por defecto 0x76 (SDO a GND) o 0x77 (SDO a VCC).",
                    PinoutTable = new List<PinoutItem>
                    {
                        new PinoutItem { Pin = "VCC", Nombre = "VCC", Tipo = "Power", Funcion = "Alimentación 3.3V", Notas = "Tolerante 5V con regulador." },
                        new PinoutItem { Pin = "GND", Nombre = "GND", Tipo = "Power", Funcion = "Tierra", Notas = "Referencia 0V." },
                        new PinoutItem { Pin = "SCL", Nombre = "SCL", Tipo = "I2C", Funcion = "Reloj Serial", Notas = "Sincronismo I2C." },
                        new PinoutItem { Pin = "SDA", Nombre = "SDA", Tipo = "I2C", Funcion = "Datos Seriales", Notas = "Línea bidireccional." }
                    }
                },
                new DatasheetItemViewModel
                {
                    Id = "ds-a4988",
                    Nombre = "A4988 Driver para Motor Paso a Paso",
                    Fabricante = "Allegro MicroSystems",
                    Categoria = "Drivers y Potencia",
                    DescripcionCorta = "Controlador microstepping bipolar con control simplificado por pines STEP (Paso) y DIR (Dirección).",
                    VoltajeOperacion = "Lógica: 3.0V a 5.5V | Motor: 8V a 35V DC",
                    PinesIO = "16 pines DIP (STEP, DIR, MS1-MS3, ENABLE, etc.)",
                    Protocolos = "Pulsos de paso y dirección (1/1 a 1/16 micropaso)",
                    Consumo = "Hasta 2A con disipador",
                    Frecuencia = "Pulsos hasta 250 kHz",
                    StockInventario = 7,
                    TagsTecnicos = new List<string> { "Driver", "Paso a Paso", "NEMA 17", "Microstepping", "CNC" },
                    UrlImagen = "/images/componentes/actuador.svg",
                    UrlPdf = "#",
                    PackageType = "Módulo DIP-16",
                    NotasAplicacion = "Ajustar la corriente máxima con el potenciómetro VREF antes de energizar.",
                    PinoutTable = new List<PinoutItem>
                    {
                        new PinoutItem { Pin = "VMOT", Nombre = "VMOT", Tipo = "Power", Funcion = "Alimentación Motor (8V-35V)", Notas = "Capacitor 100µF en paralelo." },
                        new PinoutItem { Pin = "VDD", Nombre = "VDD", Tipo = "Power", Funcion = "Alimentación Lógica (3.3V-5V)", Notas = "Conectar a VCC lógica." },
                        new PinoutItem { Pin = "STEP", Nombre = "STEP", Tipo = "GPIO", Funcion = "Pulso de Paso", Notas = "Un pulso = un micropaso." },
                        new PinoutItem { Pin = "DIR", Nombre = "DIR", Tipo = "GPIO", Funcion = "Sentido de Giro", Notas = "HIGH / LOW." }
                    }
                },
                new DatasheetItemViewModel
                {
                    Id = "ds-tcs3200",
                    Nombre = "TCS3200 Sensor de Reconocimiento de Color RGB",
                    Fabricante = "ams-TAOS",
                    Categoria = "Sensores",
                    DescripcionCorta = "Convertidor programable de luz a frecuencia con fotodiodos filtrados en Rojo, Verde, Azul y Blanco.",
                    VoltajeOperacion = "2.7V a 5.5V DC",
                    PinesIO = "8 pines (S0-S3, OUT, OE, VCC, GND)",
                    Protocolos = "Frecuencia digital cuadrada proporcional",
                    Consumo = "2 mA nominal",
                    Frecuencia = "Hasta 500 kHz",
                    StockInventario = 3,
                    TagsTecnicos = new List<string> { "Sensor de Color", "RGB", "Frecuencia", "5V", "Fotodiodos" },
                    UrlImagen = "/images/componentes/sensor.svg",
                    UrlPdf = "#",
                    PackageType = "Módulo con LEDs blancos",
                    NotasAplicacion = "Configurar escala de frecuencia con S0/S1 y seleccionar canal de color con S2/S3.",
                    PinoutTable = new List<PinoutItem>
                    {
                        new PinoutItem { Pin = "S0 / S1", Nombre = "S0, S1", Tipo = "GPIO", Funcion = "Escala de Frecuencia", Notas = "Ajuste de rango 20% o 100%." },
                        new PinoutItem { Pin = "S2 / S3", Nombre = "S2, S3", Tipo = "GPIO", Funcion = "Filtro de Color", Notas = "Selección R, G, B o Clear." },
                        new PinoutItem { Pin = "OUT", Nombre = "OUT", Tipo = "GPIO", Funcion = "Salida de Frecuencia", Notas = "Lectura de periodo con microcontrolador." }
                    }
                }
            };
        }

        private static List<NormativaItemViewModel> GetCuratedNormativas()
        {
            return new List<NormativaItemViewModel>
            {
                new NormativaItemViewModel
                {
                    Id = "norm-1",
                    Titulo = "Protocolo de Soldadura Segura y Manejo Térmico en Banco",
                    CodigoNorma = "IPC-A-610G / NOM-001-SEDE",
                    Categoria = "Procedimientos de Laboratorio",
                    NivelRiesgo = "Alto",
                    Descripcion = "Directrices obligatorias para operaciones de unión térmica, estañado y retrabajo de componentes electrónicos para prevenir quemaduras, intoxicación por humos y daño por sobrecalentamiento de circuitos.",
                    RequisitosEPP = new List<string>
                    {
                        "Gafas de seguridad con protección lateral",
                        "Extractor de humos de soldadura con filtro de carbón activado",
                        "Pulsera antiestática (ESD) conectada a tierra física",
                        "Tapete de silicona ignífugo de grado térmico"
                    },
                    PasosProcedimiento = new List<ProcedimientoPaso>
                    {
                        new ProcedimientoPaso { Paso = 1, Titulo = "Inspección Previa del Equipo", Descripcion = "Verificar cable de alimentación del cautín libre de cortes y punta limpia sin oxidación.", Advertencia = "No usar cautines con mangos rotos o clavija sin terminal de tierra." },
                        new ProcedimientoPaso { Paso = 2, Titulo = "Ajuste de Temperatura Nominal", Descripcion = "Fijar temperatura en la estación entre 320°C y 350°C para soldadura Sn63/Pb37 (o 360°C para aleación libre de plomo).", Advertencia = "Temperaturas mayores a 380°C carbonizan el flux y pueden levantar pistas de cobre." },
                        new ProcedimientoPaso { Paso = 3, Titulo = "Regla de Contacto Térmico Máximo de 3 Segundos", Descripcion = "Aplicar calor en la unión pad-terminal, alimentar el alambre de estaño y retirar en un lapso no mayor a 3 segundos.", Advertencia = "El sobrecalentamiento destruye microcontroladores y semiconductores sensibles." },
                        new ProcedimientoPaso { Paso = 4, Titulo = "Limpieza de Residuos con Alcohol Isopropílico", Descripcion = "Esperar a que la placa se enfríe y limpiar con alcohol isopropílico al 99% y cepillo antiestático.", Advertencia = "El alcohol es inflamable: verificar que el cautín esté apagado antes de limpiar." }
                    },
                    AlertasProyectosRelacionados = new List<string>
                    {
                        "Aplica a: Brazo Robótico 4-DOF (Terminales de potencia de los servomotores)",
                        "Aplica a: Seguidor de Línea PID (Soldadura de pines de barra de sensores)"
                    },
                    RequiereFirmaEstudiante = true,
                    EnlaceDocReferencia = "Norma Técnica IPC J-STD-001H"
                },
                new NormativaItemViewModel
                {
                    Id = "norm-2",
                    Titulo = "Seguridad en Circuitos de Potencia y Protección contra Corrientes Inductivas",
                    CodigoNorma = "IEEE Std 1584 / NFPA 70E",
                    Categoria = "Seguridad Eléctrica",
                    NivelRiesgo = "Alto",
                    Descripcion = "Reglas fundamentales para el manejo de fuentes de alimentación de alta corriente, aislamiento galvánico de microcontroladores y mitigación de sobretensiones por rebote inductivo (Back-EMF).",
                    RequisitosEPP = new List<string>
                    {
                        "Calzado con suela aislante",
                        "Multímetro digital calibrado",
                        "Herramientas de mano con aislamiento certificado"
                    },
                    PasosProcedimiento = new List<ProcedimientoPaso>
                    {
                        new ProcedimientoPaso { Paso = 1, Titulo = "Límite de Corriente Antes de Conectar", Descripcion = "Configurar el limitador de corriente de la fuente de laboratorio al 120% del consumo nominal estimado.", Advertencia = "Evita que un cortocircuito accidental dañe pistas de PCB o componentes." },
                        new ProcedimientoPaso { Paso = 2, Titulo = "Instalación de Diodos Flyback", Descripcion = "Colocar siempre un diodo rápido en antiparalelo con cada bobina, relé o motor DC.", Advertencia = "La desconexión de una carga inductiva sin diodo genera picos de sobretensión destructivos." },
                        new ProcedimientoPaso { Paso = 3, Titulo = "Aislamiento de Tierras y Optoacoplamiento", Descripcion = "En sistemas con tensiones superiores a 24V o presencia de motores industriales, aislar la lógica con optoacopladores.", Advertencia = "No compartir GND de potencia sin desacoplo adecuado para evitar reinicios continuos." }
                    },
                    AlertasProyectosRelacionados = new List<string>
                    {
                        "Aviso de seguridad: Drivers de motor y servomotores de alto torque manejan corrientes de pico superiores a 2A."
                    },
                    RequiereFirmaEstudiante = true,
                    EnlaceDocReferencia = "Estándar IEEE de Seguridad en Laboratorio"
                },
                new NormativaItemViewModel
                {
                    Id = "norm-3",
                    Titulo = "Protocolo de Carga, Almacenamiento y Seguridad de Baterías LiPo",
                    CodigoNorma = "UN 38.3 / IEC 62133",
                    Categoria = "Seguridad Eléctrica",
                    NivelRiesgo = "Alto",
                    Descripcion = "Procedimiento para el manejo de acumuladores de polímero de litio utilizados en robótica móvil, previniendo sobrecargas, fuga térmica e incidentes químicos.",
                    RequisitosEPP = new List<string>
                    {
                        "Bolsa ignífuga LiPo Guard para carga y transporte",
                        "Cargador inteligente con balanceador de celdas",
                        "Extintor de incendios de polvo químico seco disponible en área"
                    },
                    PasosProcedimiento = new List<ProcedimientoPaso>
                    {
                        new ProcedimientoPaso { Paso = 1, Titulo = "Inspección Visual de Integridad Física", Descripcion = "Verificar que la batería no presente hinchazón, perforaciones o deformación en las celdas.", Advertencia = "Baterías infladas deben desecharse en contenedor especial de reciclaje." },
                        new ProcedimientoPaso { Paso = 2, Titulo = "Carga Balanceada a Máximo 1C", Descripcion = "Cargar siempre en modo LiPo BALANCE conectando el conector principal y el puerto de balanceo.", Advertencia = "No cargar a más de 1C (ej: batería de 1500mAh se carga a máximo 1.5A)." },
                        new ProcedimientoPaso { Paso = 3, Titulo = "Límite Mínimo de Descarga", Descripcion = "Configurar alarma de bajo voltaje a 3.5V por celda. No permitir que una celda caiga por debajo de 3.2V.", Advertencia = "La sobredescarga por debajo de 3.0V produce daño irreversible." }
                    },
                    AlertasProyectosRelacionados = new List<string>
                    {
                        "Aplica a: Seguidor de Línea y Dron alimentados por baterías LiPo 2S / 3S."
                    },
                    RequiereFirmaEstudiante = true,
                    EnlaceDocReferencia = "Manual de Seguridad de Materiales"
                },
                new NormativaItemViewModel
                {
                    Id = "norm-4",
                    Titulo = "Protección contra Descargas Electrostáticas (ESD)",
                    CodigoNorma = "ANSI/ESD S20.20-2021",
                    Categoria = "Procedimientos de Laboratorio",
                    NivelRiesgo = "Medio",
                    Descripcion = "Control de electricidad estática en el banco de trabajo para evitar la degradación de compuertas MOSFET en microcontroladores y sensores I2C.",
                    RequisitosEPP = new List<string>
                    {
                        "Pulsera antiestática conductora ajustada a la muñeca",
                        "Bolsas antiestáticas para almacenamiento de circuitos integrados"
                    },
                    PasosProcedimiento = new List<ProcedimientoPaso>
                    {
                        new ProcedimientoPaso { Paso = 1, Titulo = "Conexión de Pulsera a Tierra Común", Descripcion = "Abrochar la pinza caimán al borne de tierra de la mesa de trabajo.", Advertencia = "El cuerpo humano puede acumular cargas electrostáticas que dañan componentes de 3.3V." }
                    },
                    AlertasProyectosRelacionados = new List<string>
                    {
                        "Aplica a todos los proyectos con microcontroladores ESP32, STM32 y sensores MEMS."
                    },
                    RequiereFirmaEstudiante = false,
                    EnlaceDocReferencia = "Guía ESD Association"
                },
                new NormativaItemViewModel
                {
                    Id = "norm-5",
                    Titulo = "Estándar de Documentación de Requerimientos y Trazabilidad BOM",
                    CodigoNorma = "IEEE Std 29148-2018",
                    Categoria = "Estándares Académicos",
                    NivelRiesgo = "Informativo",
                    Descripcion = "Estructura formal para la especificación de componentes de la lista de materiales (BOM), diagramas esquemáticos y trazabilidad de cambios.",
                    RequisitosEPP = new List<string> { "Acceso a MecaPlan Workspace y Git para control de versiones" },
                    PasosProcedimiento = new List<ProcedimientoPaso>
                    {
                        new ProcedimientoPaso { Paso = 1, Titulo = "Validación de Especificaciones Técnicas en BOM", Descripcion = "Todo componente ingresado al BOM debe contar con número de parte exacto, tolerancia y potencia.", Advertencia = "Especificar valores completos de resistencia y potencia nominal en Watts." }
                    },
                    AlertasProyectosRelacionados = new List<string>
                    {
                        "Aplica a la entrega formal de reportes de proyectos mecatrónicos."
                    },
                    RequiereFirmaEstudiante = false,
                    EnlaceDocReferencia = "Plantilla IEEE de Especificación de Requerimientos"
                },
                new NormativaItemViewModel
                {
                    Id = "norm-6",
                    Titulo = "Estándar de Codificación de Firmware Seguro (MISRA C Adaptado)",
                    CodigoNorma = "MISRA C:2012 / Embedded C",
                    Categoria = "Estándares Académicos",
                    NivelRiesgo = "Informativo",
                    Descripcion = "Reglas de desarrollo de software embebido: evitar delays bloqueantes en lazos de control críticos, uso de tipos de datos de ancho fijo (uint8_t, int16_t) y rutinas de interrupción concisas.",
                    RequisitosEPP = new List<string> { "Linter C++ configurado en el IDE / Workspace MecaPlan" },
                    PasosProcedimiento = new List<ProcedimientoPaso>
                    {
                        new ProcedimientoPaso { Paso = 1, Titulo = "Reemplazo de delay() por millis() o Timers", Descripcion = "El lazo principal no debe detener la CPU para permitir la lectura continua de sensores.", Advertencia = "Un delay prolongado bloquea la capacidad del sistema de responder a paradas de emergencia." }
                    },
                    AlertasProyectosRelacionados = new List<string>
                    {
                        "Requisito para aprobación del código generado en Workspace."
                    },
                    RequiereFirmaEstudiante = false,
                    EnlaceDocReferencia = "Directrices MISRA C para Software Embebido"
                }
            };
        }

        private static List<GuiaItemViewModel> GetCuratedGuias()
        {
            return new List<GuiaItemViewModel>
            {
                new GuiaItemViewModel
                {
                    Id = "guia-pid",
                    Titulo = "Control PID en Lazo Cerrado para Motores DC y Servomecanismos",
                    Subtitulo = "Fundamentos matemáticos, sintonización práctica interactiva e implementación del algoritmo en C++ para microcontroladores.",
                    Categoria = "Control y Automatización",
                    NivelDificultad = "Intermedio",
                    TiempoEstimado = "30 min",
                    Icono = "chart",
                    TieneSimuladorPID = true,
                    TienePlaygroundCodigo = true,
                    TieneVideoTutorial = true,
                    VideoThumbnail = "/images/componentes/actuador.svg",
                    VideoCapitulos = new List<VideoCapitulo>
                    {
                        new VideoCapitulo { Tiempo = "00:00", Titulo = "Introducción al Lazo Cerrado y Señal de Error" },
                        new VideoCapitulo { Tiempo = "04:15", Titulo = "Efecto de la Ganancia Proporcional (Kp)" },
                        new VideoCapitulo { Tiempo = "09:30", Titulo = "Eliminación del Error Estacionario con la Ganancia Integral (Ki)" },
                        new VideoCapitulo { Tiempo = "15:45", Titulo = "Amortiguamiento del Sobreimpulso con la Ganancia Derivativa (Kd)" },
                        new VideoCapitulo { Tiempo = "22:10", Titulo = "Implementación Eficiente en Arduino y ESP32 con Anti-Windup" }
                    },
                    Pasos = new List<GuiaPaso>
                    {
                        new GuiaPaso
                        {
                            Numero = 1,
                            Titulo = "Ecuación del Controlador PID en Tiempo Continuo y Discreto",
                            Contenido = "El controlador calcula la señal de control u(t) en función de la diferencia entre el valor de referencia deseado (Setpoint, SP) y el valor actual medido por el sensor (Process Variable, PV).",
                            Formula = "u(t) = K_p * e(t) + K_i * int(e(tau)) + K_d * de/dt",
                            Tip = "En microcontroladores discretizamos la integral como suma acumulativa e integral trapezoidal, y la derivada como la diferencia finita (error - errorAnterior) / dt."
                        },
                        new GuiaPaso
                        {
                            Numero = 2,
                            Titulo = "Sintonización Práctica por Método Heurístico",
                            Contenido = "1) Iniciar con Ki = 0 y Kd = 0. Aumentar Kp hasta que el sistema responda rápidamente con una oscilación leve pero estable.\n2) Incrementar Kd para disipar la oscilación y reducir el sobreimpulso.\n3) Añadir un valor pequeño de Ki para llevar el error de posición en estado estacionario a cero.",
                            Formula = "e_ss -> 0 con accion integral activada",
                            Tip = "Cuando el sensor tiene ruido eléctrico, el término Kd amplificará el ruido en la salida del actuador. Conviene aplicar un filtro pasabajas a la derivada."
                        },
                        new GuiaPaso
                        {
                            Numero = 3,
                            Titulo = "Prevención de Saturación Integral (Anti-Windup)",
                            Contenido = "Si el actuador alcanza su límite físico (ej: PWM a 255), el término integral continúa acumulando error si el sistema no reacciona a tiempo, causando un retraso en la recuperación.",
                            Formula = "u_sat(t) = constrain(u(t), -255, 255)",
                            Tip = "Detener la suma integral cada vez que la salida calculada exceda los límites admisibles del driver de potencia."
                        }
                    },
                    CodigoEjemplo = """
// Controlador PID Discreto
#include <Arduino.h>

float Kp = 2.40;   // Ganancia Proporcional
float Ki = 0.85;   // Ganancia Integral
float Kd = 0.18;   // Ganancia Derivativa

float setpoint = 100.0;
float pv = 0.0;
float error = 0.0, errorAnterior = 0.0;
float integral = 0.0, derivada = 0.0;
unsigned long tiempoAnterior = 0;
const float dt = 0.02; // 20 ms

void setup() {
  Serial.begin(115200);
  Serial.println("[MecaPlan] PID Playground Inicializado.");
}

void loop() {
  unsigned long ahora = millis();
  if (ahora - tiempoAnterior >= (dt * 1000)) {
    tiempoAnterior = ahora;

    error = setpoint - pv;
    float P = Kp * error;

    integral += error * dt;
    integral = constrain(integral, -150.0, 150.0);
    float I = Ki * integral;

    derivada = (error - errorAnterior) / dt;
    float D = Kd * derivada;
    errorAnterior = error;

    float controlOut = P + I + D;
    controlOut = constrain(controlOut, 0.0, 255.0);

    pv += (controlOut * 0.45 - pv * 0.12) * dt;

    Serial.print("SP:"); Serial.print(setpoint);
    Serial.print(",PV:"); Serial.print(pv);
    Serial.print(",OutPWM:"); Serial.println(controlOut);
  }
}
""",
                    PreguntasQuiz = new List<QuizPregunta>
                    {
                        new QuizPregunta
                        {
                            Id = "q1",
                            Enunciado = "¿Cuál es el efecto principal de aumentar en exceso la ganancia derivativa (Kd) en un sistema con ruido sensorial?",
                            Opciones = new List<QuizOpcion>
                            {
                                new QuizOpcion { Letra = "A", Texto = "Elimina completamente el error en estado estacionario.", EsCorrecta = false },
                                new QuizOpcion { Letra = "B", Texto = "Amplifica el ruido provocando vibración excesiva y calentamiento en los actuadores.", EsCorrecta = true },
                                new QuizOpcion { Letra = "C", Texto = "Disminuye la velocidad de procesamiento del microcontrolador.", EsCorrecta = false },
                                new QuizOpcion { Letra = "D", Texto = "Convierte el sistema en un lazo abierto sin realimentación.", EsCorrecta = false }
                            },
                            Explicacion = "La derivada de una señal con ruido de alta frecuencia produce picos abruptos en la señal de control calculada, sobrecargando los motores y la etapa de potencia."
                        },
                        new QuizPregunta
                        {
                            Id = "q2",
                            Enunciado = "¿Qué técnica evita que la acción integral continúe creciendo descontroladamente cuando el motor ya está al 100% de potencia?",
                            Opciones = new List<QuizOpcion>
                            {
                                new QuizOpcion { Letra = "A", Texto = "Anti-Windup Integral.", EsCorrecta = true },
                                new QuizOpcion { Letra = "B", Texto = "Filtro Pasa-Altas en el Setpoint.", EsCorrecta = false },
                                new QuizOpcion { Letra = "C", Texto = "Aumento de la frecuencia del cristal oscilador.", EsCorrecta = false },
                                new QuizOpcion { Letra = "D", Texto = "Inversión de polaridad del sensor encoder.", EsCorrecta = false }
                            },
                            Explicacion = "El Anti-Windup limita o congela la integración mientras el actuador se encuentre saturado, asegurando una recuperación inmediata al cambiar el Setpoint."
                        }
                    }
                },
                new GuiaItemViewModel
                {
                    Id = "guia-iot-mqtt",
                    Titulo = "Comunicaciones IoT en Tiempo Real con ESP32, MQTT y WebSockets",
                    Subtitulo = "Conexión de prototipos mecatrónicos a la red, publicación de telemetría en JSON y recepción de comandos de control bidireccional.",
                    Categoria = "IoT y Telecomunicaciones",
                    NivelDificultad = "Intermedio",
                    TiempoEstimado = "25 min",
                    Icono = "wifi",
                    TieneSimuladorPID = false,
                    TienePlaygroundCodigo = true,
                    TieneVideoTutorial = false,
                    CodigoEjemplo = """
// MecaPlan: MQTT IoT Client
#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "LAB_MECATRONICA";
const char* mqtt_broker = "broker.emqx.io";
WiFiClient espClient;
PubSubClient client(espClient);

void callback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (int i=0; i<length; i++) msg += (char)payload[i];
  if (msg == "MOTOR_ON") digitalWrite(2, HIGH);
  if (msg == "MOTOR_OFF") digitalWrite(2, LOW);
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  WiFi.begin(ssid, "PasswordSeguro2026");
  client.setServer(mqtt_broker, 1883);
  client.setCallback(callback);
}
""",
                    Pasos = new List<GuiaPaso>
                    {
                        new GuiaPaso { Numero = 1, Titulo = "Arquitectura Publicador / Suscriptor MQTT", Contenido = "El protocolo MQTT permite desacoplar los nodos sensores de los tableros de visualización mediante tópicos estructurados.", Formula = "Topico: mecaplan/estudiante/proyecto/telemetria" },
                        new GuiaPaso { Numero = 2, Titulo = "Optimización de Ancho de Banda y Formato JSON", Contenido = "Estructura la información en payloads compactos para no saturar la red local del laboratorio." }
                    },
                    PreguntasQuiz = new List<QuizPregunta>
                    {
                        new QuizPregunta
                        {
                            Id = "q_iot1",
                            Enunciado = "¿Qué nivel de Quality of Service (QoS) en MQTT garantiza que el mensaje se entregue exactamente una sola vez?",
                            Opciones = new List<QuizOpcion>
                            {
                                new QuizOpcion { Letra = "A", Texto = "QoS 0 (At most once)", EsCorrecta = false },
                                new QuizOpcion { Letra = "B", Texto = "QoS 1 (At least once)", EsCorrecta = false },
                                new QuizOpcion { Letra = "C", Texto = "QoS 2 (Exactly once)", EsCorrecta = true },
                                new QuizOpcion { Letra = "D", Texto = "QoS 3 (Broadcast stream)", EsCorrecta = false }
                            },
                            Explicacion = "QoS 2 es el nivel más seguro mediante un handshake de 4 pasos (PUBLISH, PUBREC, PUBREL, PUBCOMP)."
                        }
                    }
                },
                new GuiaItemViewModel
                {
                    Id = "guia-imu-kalman",
                    Titulo = "Fusión Sensorial con Filtro Complementario y Filtro de Kalman para IMU",
                    Subtitulo = "Combinación de la estabilidad en baja frecuencia del acelerómetro con la rapidez del giroscopio para estimar ángulos precisos.",
                    Categoria = "Control y Automatización",
                    NivelDificultad = "Avanzado",
                    TiempoEstimado = "35 min",
                    Icono = "compass",
                    TieneSimuladorPID = false,
                    TienePlaygroundCodigo = true,
                    TieneVideoTutorial = true,
                    VideoThumbnail = "/images/componentes/sensor.svg",
                    VideoCapitulos = new List<VideoCapitulo>
                    {
                        new VideoCapitulo { Tiempo = "00:00", Titulo = "Problema de la deriva (Drift) en giroscopios" },
                        new VideoCapitulo { Tiempo = "06:20", Titulo = "Ruido de aceleraciones lineales en acelerómetros" },
                        new VideoCapitulo { Tiempo = "14:00", Titulo = "Implementación del Filtro Complementario en C++" },
                        new VideoCapitulo { Tiempo = "24:30", Titulo = "Filtro de Kalman Unidimensional de Estado" }
                    },
                    Pasos = new List<GuiaPaso>
                    {
                        new GuiaPaso { Numero = 1, Titulo = "Ecuación del Filtro Complementario", Contenido = "Pondera el giroscopio con un filtro pasa-altas y el acelerómetro con un filtro pasa-bajas para obtener un ángulo limpio y reactivo.", Formula = "theta_k = alpha * (theta_prev + omega * dt) + (1 - alpha) * theta_accel" }
                    },
                    CodigoEjemplo = """
// Filtro Complementario para MPU-6050
float pitch = 0.0;
float alpha = 0.98;

void actualizarAngulo(float accelPitch, float gyroY_rate, float dt) {
  pitch = alpha * (pitch + gyroY_rate * dt) + (1.0 - alpha) * accelPitch;
  Serial.print("Pitch:"); Serial.println(pitch);
}
""",
                    PreguntasQuiz = new List<QuizPregunta>()
                },
                new GuiaItemViewModel
                {
                    Id = "guia-kicad-pcb",
                    Titulo = "Diseño de PCB de 2 Capas en KiCad 8: Del Esquemático al Archivo Gerber",
                    Subtitulo = "Ruteo de pistas de señal y potencia, creación de planos de tierra (Ground Plane) y exportación de archivos para manufactura.",
                    Categoria = "Diseño de Circuitos y PCB",
                    NivelDificultad = "Principiante",
                    TiempoEstimado = "40 min",
                    Icono = "chip",
                    TieneSimuladorPID = false,
                    TienePlaygroundCodigo = false,
                    TieneVideoTutorial = true,
                    VideoThumbnail = "/images/componentes/microcontrolador.svg",
                    VideoCapitulos = new List<VideoCapitulo>
                    {
                        new VideoCapitulo { Tiempo = "00:00", Titulo = "Creación de símbolos y footprint en KiCad 8" },
                        new VideoCapitulo { Tiempo = "10:15", Titulo = "Reglas de diseño eléctrico (ERC)" },
                        new VideoCapitulo { Tiempo = "18:40", Titulo = "Ruteo de pistas: Ancho según corriente (IPC-2152)" },
                        new VideoCapitulo { Tiempo = "31:00", Titulo = "Plano de masa y generación de archivos Gerber / Drill" }
                    },
                    Pasos = new List<GuiaPaso>
                    {
                        new GuiaPaso { Numero = 1, Titulo = "Cálculo de Ancho de Pista por Corriente", Contenido = "Las pistas de potencia (5V, 12V, GND) deben ser notablemente más anchas que las pistas de datos para evitar caídas de tensión y calentamiento.", Formula = "W = I / (k * delta_T^b) (Norma IPC-2221)" }
                    },
                    PreguntasQuiz = new List<QuizPregunta>()
                },
                new GuiaItemViewModel
                {
                    Id = "guia-pwm-servos",
                    Titulo = "Generación y Temporización de PWM por Hardware para Servomotores",
                    Subtitulo = "Control de posición precisa de actuadores mecatrónicos sin bloqueos en la CPU mediante timers por hardware en Arduino y ESP32.",
                    Categoria = "Firmware y Microcontroladores",
                    NivelDificultad = "Principiante",
                    TiempoEstimado = "20 min",
                    Icono = "cpu",
                    TieneSimuladorPID = false,
                    TienePlaygroundCodigo = true,
                    TieneVideoTutorial = false,
                    CodigoEjemplo = """
// ESP32 LEDC PWM para Servomotores
const int pinServo = 18;
const int canalPWM = 0;
const int frecuencia = 50; // 50 Hz = 20ms periodo
const int resolucion = 16; // 16 bits (0 - 65535)

void setup() {
  ledcSetup(canalPWM, frecuencia, resolucion);
  ledcAttachPin(pinServo, canalPWM);
}

void moverAngulo(int angulo) {
  int duty = map(angulo, 0, 180, 3276, 6553);
  ledcWrite(canalPWM, duty);
}
""",
                    Pasos = new List<GuiaPaso>
                    {
                        new GuiaPaso { Numero = 1, Titulo = "Temporización Estándar de Servomotores RC", Contenido = "Un servomotor estándar espera un pulso positivo cada 20 milisegundos (50 Hz). El ancho del pulso entre 1.0 ms y 2.0 ms codifica el ángulo mecánico entre 0° y 180°." }
                    },
                    PreguntasQuiz = new List<QuizPregunta>()
                }
            };
        }

        #endregion
    }
}
