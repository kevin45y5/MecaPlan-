namespace MecaPlan.Models
{
    public class Proyecto
    {
        public int ProyectoID { get; set; }
        public int EstudianteID { get; set; }
        public string NombreProyecto { get; set; } = string.Empty;
        public string DescripcionIdea { get; set; } = string.Empty;
        public string NivelComplejidad { get; set; } = string.Empty;
        public string? MaterialesPrevios { get; set; }
        public string? MaterialesRequeridos { get; set; }
        public string? Microcontrolador { get; set; }
        public string? InstruccionesGeneradas { get; set; }
        public string? CodigoGenerado { get; set; }
        public string? ConexionesCanvas { get; set; }
        public string? PosicionesCanvas { get; set; }
        public string Estado { get; set; } = "En Desarrollo";
        public bool Activo { get; set; } = true;
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaEliminacion { get; set; }
        public Estudiante Estudiante { get; set; } = null!;
        public ICollection<ProyectoComponente> ProyectoComponentes { get; set; } = new List<ProyectoComponente>();
        public ICollection<PasoEnsamblaje> PasosEnsamblaje { get; set; } = new List<PasoEnsamblaje>();
        public ICollection<Diagnostico> Diagnosticos { get; set; } = new List<Diagnostico>();
    }
}
