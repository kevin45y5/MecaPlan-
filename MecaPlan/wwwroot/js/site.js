(() => {
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("appNavMenu");
  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    });
  }

  window.mecaplanSetLoading = function (button, text) {
    if (!button || button.classList.contains("is-loading")) {
      return;
    }
    button.classList.add("is-loading");
    button.disabled = true;
    const label = text || button.textContent || "Cargando…";
    button.replaceChildren();
    const spinner = document.createElement("span");
    spinner.className = "btn-spinner";
    spinner.setAttribute("aria-hidden", "true");
    const caption = document.createElement("span");
    caption.textContent = label;
    button.append(spinner, caption);
  };

  document.querySelectorAll("form[data-loading-button]").forEach((form) => {
    form.addEventListener("submit", () => {
      const button = form.querySelector(form.getAttribute("data-loading-button"));
      if (!button) {
        return;
      }
      if (window.jQuery && window.jQuery(form).data("validator") && !window.jQuery(form).valid()) {
        return;
      }
      window.mecaplanSetLoading(button, button.getAttribute("data-loading-text") || "Generando…");
    });
  });
})();
