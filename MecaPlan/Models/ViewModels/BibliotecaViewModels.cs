using System;
using System.Collections.Generic;

namespace MecaPlan.Models.ViewModels
{
    public class BibliotecaIndexViewModel
    {
        public int TotalManuales { get; set; }
        public int TotalDatasheets { get; set; }
        public int TotalNormativas { get; set; }
        public int TotalGuias { get; set; }
        public int ComponentesEnBomActivo { get; set; }
        public int ProyectosActivosEstudiante { get; set; }
    }

    public class BomComponenteItem
    {
        public string Nombre { get; set; } = string.Empty;
        public int Cantidad { get; set; }
        public string Categoria { get; set; } = string.Empty;
        public bool EnInventario { get; set; }
        public string Especificacion { get; set; } = string.Empty;
        public string DatasheetId { get; set; } = string.Empty;
        public decimal PrecioEstimado { get; set; }
    }

    public class PasoManualItem
    {
        public int NumeroPaso { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string PinesClave { get; set; } = string.Empty;
        public string Tips { get; set; } = string.Empty;
        public string? UrlEsquema { get; set; }
    }

    public class ChecklistItem
    {
        public string Id { get; set; } = string.Empty;
        public string Titulo { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string Tipo { get; set; } = "Continuidad"; // Continuidad, Señal, Lógica, Carga
        public bool Completado { get; set; }
    }

    public class ManualItemViewModel
    {
        public string Id { get; set; } = string.Empty;
        public string Titulo { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string Icono { get; set; } = "robot"; // robot, car, iot, arm, drone, cnc
        public string Estado { get; set; } = "Prototipado Activo";
        public string EstadoCss { get; set; } = "badge-active";
        public string Microcontrolador { get; set; } = "ESP32";
        public string NivelComplejidad { get; set; } = "Intermedio";
        public bool EsProyectoUsuario { get; set; }
        public string FechaActualizacion { get; set; } = string.Empty;
        public List<BomComponenteItem> ComponentesBOM { get; set; } = new();
        public List<PasoManualItem> PasosEnsamblaje { get; set; } = new();
        public string FirmwareCodigo { get; set; } = string.Empty;
        public string ComentariosProfesor { get; set; } = string.Empty;
        public List<ChecklistItem> ChecklistPruebas { get; set; } = new();
    }

    public class ManualesListViewModel
    {
        public List<ManualItemViewModel> Manuales { get; set; } = new();
        public string? FiltroEstado { get; set; }
        public string? FiltroMicro { get; set; }
        public string? Query { get; set; }
    }

    public class PinoutItem
    {
        public string Pin { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Tipo { get; set; } = "GPIO"; // Power, GPIO, ADC, I2C, SPI, UART, PWM
        public string Funcion { get; set; } = string.Empty;
        public string Notas { get; set; } = string.Empty;
    }

    public class DatasheetItemViewModel
    {
        public string Id { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Fabricante { get; set; } = string.Empty;
        public string Categoria { get; set; } = "Microcontroladores";
        public string DescripcionCorta { get; set; } = string.Empty;
        public string VoltajeOperacion { get; set; } = string.Empty;
        public string PinesIO { get; set; } = string.Empty;
        public string Protocolos { get; set; } = string.Empty;
        public string Consumo { get; set; } = string.Empty;
        public string Frecuencia { get; set; } = string.Empty;
        public int StockInventario { get; set; }
        public bool EnBomUsuario { get; set; }
        public string? ProyectoBomNombre { get; set; }
        public List<string> TagsTecnicos { get; set; } = new();
        public string UrlImagen { get; set; } = string.Empty;
        public string UrlPdf { get; set; } = string.Empty;
        public List<PinoutItem> PinoutTable { get; set; } = new();
        public string NotasAplicacion { get; set; } = string.Empty;
        public string PackageType { get; set; } = "DIP / Módulo";
    }

    public class DatasheetsListViewModel
    {
        public List<DatasheetItemViewModel> Componentes { get; set; } = new();
        public List<string> Categorias { get; set; } = new();
        public string? CategoriaSeleccionada { get; set; }
        public string? Query { get; set; }
        public bool SoloEnBom { get; set; }
    }

    public class ProcedimientoPaso
    {
        public int Paso { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string Advertencia { get; set; } = string.Empty;
    }

    public class NormativaItemViewModel
    {
        public string Id { get; set; } = string.Empty;
        public string Titulo { get; set; } = string.Empty;
        public string CodigoNorma { get; set; } = string.Empty;
        public string Categoria { get; set; } = "Seguridad Eléctrica"; // Seguridad Eléctrica, Procedimientos de Laboratorio, Estándares Académicos
        public string NivelRiesgo { get; set; } = "Alto"; // Alto, Medio, Informativo
        public string Descripcion { get; set; } = string.Empty;
        public List<string> RequisitosEPP { get; set; } = new();
        public List<ProcedimientoPaso> PasosProcedimiento { get; set; } = new();
        public List<string> AlertasProyectosRelacionados { get; set; } = new();
        public bool RequiereFirmaEstudiante { get; set; }
        public string EnlaceDocReferencia { get; set; } = string.Empty;
    }

    public class NormativasHubViewModel
    {
        public List<NormativaItemViewModel> Normativas { get; set; } = new();
        public string NombreEstudiante { get; set; } = string.Empty;
        public string EmailEstudiante { get; set; } = string.Empty;
        public string FechaActual { get; set; } = string.Empty;
        public List<string> CertificadosActivos { get; set; } = new();
    }

    public class VideoCapitulo
    {
        public string Tiempo { get; set; } = string.Empty;
        public string Titulo { get; set; } = string.Empty;
    }

    public class QuizOpcion
    {
        public string Letra { get; set; } = string.Empty;
        public string Texto { get; set; } = string.Empty;
        public bool EsCorrecta { get; set; }
    }

    public class QuizPregunta
    {
        public string Id { get; set; } = string.Empty;
        public string Enunciado { get; set; } = string.Empty;
        public List<QuizOpcion> Opciones { get; set; } = new();
        public string Explicacion { get; set; } = string.Empty;
    }

    public class GuiaPaso
    {
        public int Numero { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Contenido { get; set; } = string.Empty;
        public string? Formula { get; set; }
        public string? Tip { get; set; }
    }

    public class GuiaItemViewModel
    {
        public string Id { get; set; } = string.Empty;
        public string Titulo { get; set; } = string.Empty;
        public string Subtitulo { get; set; } = string.Empty;
        public string Categoria { get; set; } = "Control & Automatización";
        public string NivelDificultad { get; set; } = "Intermedio"; // Principiante, Intermedio, Avanzado
        public string TiempoEstimado { get; set; } = "25 min";
        public string Icono { get; set; } = "chart";
        public List<GuiaPaso> Pasos { get; set; } = new();
        public bool TieneSimuladorPID { get; set; }
        public bool TienePlaygroundCodigo { get; set; }
        public bool TieneVideoTutorial { get; set; }
        public string CodigoEjemplo { get; set; } = string.Empty;
        public string VideoThumbnail { get; set; } = string.Empty;
        public List<VideoCapitulo> VideoCapitulos { get; set; } = new();
        public List<QuizPregunta> PreguntasQuiz { get; set; } = new();
    }

    public class GuiasListViewModel
    {
        public List<GuiaItemViewModel> Guias { get; set; } = new();
        public string? GuiaSeleccionadaId { get; set; }
        public string? FiltroNivel { get; set; }
        public string? FiltroCategoria { get; set; }
    }
}
