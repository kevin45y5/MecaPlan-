using System.ComponentModel.DataAnnotations;

namespace MecaPlan.ViewModels.Account;

public sealed class LoginViewModel
{
    [Required(ErrorMessage = "El correo electrónico es obligatorio.")]
    [EmailAddress(ErrorMessage = "Ingrese un correo electrónico válido.")]
    [StringLength(256, ErrorMessage = "El correo electrónico no puede superar 256 caracteres.")]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "La contraseña es obligatoria.")]
    [StringLength(128, ErrorMessage = "La contraseña no puede superar 128 caracteres.")]
    [DataType(DataType.Password)]
    public string Password { get; set; } = "";

    public string? ReturnUrl { get; set; }
}
