using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using MecaPlan.Application.Authentication;
using MecaPlan.Domain.Entities;
using MecaPlan.ViewModels.Account;

namespace MecaPlan.Controllers;

public sealed class AccountController(IStudentAuthenticationService service, IAuthenticationAuditWriter audit) : Controller
{
    [HttpGet] public IActionResult Register() => View();

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(RegisterViewModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid) return View(model);
        var result = await service.RegisterAsync(new(model.Nombre, model.Apellido, model.Carnet, model.Email, model.Password, model.Confirmation, HttpContext.TraceIdentifier, HttpContext.Connection.RemoteIpAddress?.ToString()), ct);
        if (!result.Succeeded) { ModelState.AddModelError(string.Empty, result.Error!); return View(model); }
        TempData["Success"] = "Registro completado. Ya puede iniciar sesión.";
        return RedirectToAction(nameof(Login));
    }

    [HttpGet] public IActionResult Login(string? returnUrl) => View(new LoginViewModel { ReturnUrl = IsLocalReturnUrl(returnUrl) ? returnUrl : null });

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginViewModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid) return View(model);
        var result = await service.LoginAsync(new(model.Email, model.Password, HttpContext.TraceIdentifier, HttpContext.Connection.RemoteIpAddress?.ToString()), ct);
        if (!result.Succeeded) { ModelState.AddModelError(string.Empty, result.Error!); return View(model); }
        var claims = new[] { new Claim("StudentId", result.StudentId!.Value.ToString()), new Claim(ClaimTypes.Name, result.Name!) };
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
        return LocalRedirect(IsLocalReturnUrl(model.ReturnUrl) ? model.ReturnUrl! : "/Dashboard/Index");
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        int? id = int.TryParse(User.FindFirstValue("StudentId"), out var studentId) ? studentId : null;
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        await audit.WriteAsync(new EventoAutenticacion(id, "CierreSesion", "Exito", HttpContext.TraceIdentifier, null), ct);
        return RedirectToAction(nameof(Login));
    }

    private static bool IsLocalReturnUrl(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.StartsWith('/') && !value.StartsWith("//", StringComparison.Ordinal) && !value.StartsWith("/\\", StringComparison.Ordinal);
}
