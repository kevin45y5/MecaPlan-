using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MecaPlan.Controllers
{
    [Authorize]
    public class GaleriaController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Wide"] = true;
            return View();
        }
    }
}
