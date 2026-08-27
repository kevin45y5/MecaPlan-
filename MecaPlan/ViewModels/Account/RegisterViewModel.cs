using System.ComponentModel.DataAnnotations;

namespace MecaPlan.ViewModels.Account;

public sealed class RegisterViewModel
{
    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [StringLength(100, ErrorMessage = "El nombre no puede superar 100 caracteres.")]
    public string Nombre { get; set; } = "";

    [Required(ErrorMessage = "El apellido es obligatorio.")]
    [StringLength(100, ErrorMessage = "El apellido no puede superar 100 caracteres.")]
    public string Apellido { get; set; } = "";

    [Required(ErrorMessage = "El carnet es obligatorio.")]
    [StringLength(50, ErrorMessage = "El carnet no puede superar 50 caracteres.")]
    public string Carnet { get; set; } = "";

    [Required(ErrorMessage = "El correo electrónico es obligatorio.")]
    [EmailAddress(ErrorMessage = "Ingrese un correo electrónico válido.")]
    [StringLength(256, ErrorMessage = "El correo electrónico no puede superar 256 caracteres.")]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "La contraseña es obligatoria.")]
    [StringLength(128, MinimumLength = 8, ErrorMessage = "La contraseña debe tener entre 8 y 128 caracteres.")]
    [RegularExpression(@"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^\p{L}\p{N}]).+$", ErrorMessage = "La contraseña debe incluir mayúscula, minúscula, número y símbolo.")]
    [DataType(DataType.Password)]
    public string Password { get; set; } = "";

    [Required(ErrorMessage = "Confirme la contraseña.")]
    [Compare(nameof(Password), ErrorMessage = "Las contraseñas no coinciden.")]
    [DataType(DataType.Password)]
    public string Confirmation { get; set; } = "";
}
