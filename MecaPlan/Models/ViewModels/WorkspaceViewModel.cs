using System.ComponentModel.DataAnnotations;

namespace MecaPlan.Models.ViewModels
{
    public class WorkspaceViewModel
    {
        public Proyecto Proyecto { get; set; } = null!;
        public string ConexionesJson { get; set; } = "[]";
        public string PosicionesJson { get; set; } = "[]";
        public string ComponentesJson { get; set; } = "[]";

        [Required(ErrorMessage = "Describe el problema.")]
        [Display(Name = "¿Qué ocurrió?")]
        public string TipoError { get; set; } = string.Empty;

        [Required(ErrorMessage = "Agrega un poco más de detalle.")]
        [Display(Name = "Detalle")]
        public string DescripcionFalla { get; set; } = string.Empty;
    }
}
