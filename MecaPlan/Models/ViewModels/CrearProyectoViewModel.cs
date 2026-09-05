using System.ComponentModel.DataAnnotations;

namespace MecaPlan.Models.ViewModels
{
    public class CrearProyectoViewModel
    {
        [Required(ErrorMessage = "El nombre del proyecto es obligatorio.")]
        [StringLength(150, ErrorMessage = "El nombre no puede superar 150 caracteres.")]
        [Display(Name = "Nombre del proyecto")]
        public string NombreProyecto { get; set; } = string.Empty;

        [Required(ErrorMessage = "Indica la placa o microcontrolador.")]
        [StringLength(80, ErrorMessage = "La placa no puede superar 80 caracteres.")]
        [Display(Name = "Placa / microcontrolador")]
        public string Microcontrolador { get; set; } = string.Empty;

        [Required(ErrorMessage = "Selecciona el nivel de complejidad.")]
        [StringLength(50)]
        [Display(Name = "Nivel de complejidad")]
        public string NivelComplejidad { get; set; } = string.Empty;

        [Required(ErrorMessage = "Describe tu idea.")]
        [Display(Name = "Idea del proyecto")]
        public string DescripcionIdea { get; set; } = string.Empty;

        [Display(Name = "Materiales que ya tienes")]
        public string? MaterialesPrevios { get; set; }

        [Display(Name = "Materiales requeridos (no los tienes)")]
        public string? MaterialesRequeridos { get; set; }
    }

    public class ValidarBomViewModel
    {
        public int ProyectoID { get; set; }
        public string NombreProyecto { get; set; } = string.Empty;
        public List<BomItemViewModel> Inventario { get; set; } = new();
        public List<BomItemViewModel> Requisitos { get; set; } = new();
        public List<BomItemViewModel> Faltantes { get; set; } = new();
    }

    public class BomItemViewModel
    {
        [Required]
        [StringLength(100)]
        public string Nombre { get; set; } = string.Empty;

        [Range(1, 999, ErrorMessage = "La cantidad debe ser al menos 1.")]
        public int Cantidad { get; set; } = 1;

        [StringLength(300)]
        public string? Motivo { get; set; }

        public bool Quitar { get; set; }
    }
}
