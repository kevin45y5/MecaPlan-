using System.Security.Claims;
using MecaPlan.Data;
using MecaPlan.Models;
using MecaPlan.Models.ViewModels;
using MecaPlan.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MecaPlan.Controllers
{
    public class AccountController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<AccountController> _logger;

        public AccountController(ApplicationDbContext context, ILogger<AccountController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        [AllowAnonymous]
        public IActionResult Login(string? returnUrl = null)
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToLocal(returnUrl);
            }

            ViewData["ReturnUrl"] = returnUrl;
            return View(new LoginViewModel());
        }

        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginViewModel model, string? returnUrl = null)
        {
            ViewData["ReturnUrl"] = returnUrl;
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var email = model.Email.Trim();
            var estudiante = await _context.Estudiantes.FirstOrDefaultAsync(e => e.Email == email);
            var validas = estudiante is not null
                && estudiante.Activo
                && estudiante.FechaEliminacion is null
                && PasswordHasher.Verify(model.Password, estudiante.PasswordHash, estudiante.PasswordSalt);

            if (!validas || estudiante is null)
            {
                ModelState.AddModelError(string.Empty, "Correo o contraseña incorrectos.");
                return View(model);
            }

            await SignInAsync(estudiante, model.RememberMe);
            return RedirectToLocal(returnUrl);
        }

        [HttpGet]
        [AllowAnonymous]
        public IActionResult Register()
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToAction("Index", "Home");
            }

            return View(new RegisterViewModel());
        }

        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Register(RegisterViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var email = model.Email.Trim();
            if (await _context.Estudiantes.AnyAsync(e => e.Email == email))
            {
                ModelState.AddModelError(nameof(model.Email), "Este correo ya está registrado.");
                return View(model);
            }

            var (hash, salt) = PasswordHasher.Hash(model.Password);
            var estudiante = new Estudiante
            {
                Nombre = model.Nombre.Trim(),
                Apellido = model.Apellido.Trim(),
                Email = email,
                PasswordHash = hash,
                PasswordSalt = salt,
                Activo = true,
                FechaRegistro = DateTime.Now
            };

            _context.Estudiantes.Add(estudiante);
            await _context.SaveChangesAsync();
            await SignInAsync(estudiante, rememberMe: false);
            return RedirectToAction("Index", "Home");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return RedirectToAction(nameof(Login));
        }

        [HttpGet]
        [AllowAnonymous]
        public IActionResult AccessDenied() => View();

        private async Task SignInAsync(Estudiante estudiante, bool rememberMe)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, estudiante.EstudianteID.ToString()),
                new(ClaimTypes.Email, estudiante.Email),
                new(ClaimTypes.Name, $"{estudiante.Nombre} {estudiante.Apellido}")
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(identity),
                new AuthenticationProperties
                {
                    IsPersistent = rememberMe,
                    ExpiresUtc = rememberMe ? DateTimeOffset.UtcNow.AddDays(14) : DateTimeOffset.UtcNow.AddHours(8)
                });
        }

        private IActionResult RedirectToLocal(string? returnUrl)
        {
            if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
            {
                return Redirect(returnUrl);
            }

            return RedirectToAction("Index", "Home");
        }
    }
}
