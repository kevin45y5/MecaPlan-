(() => {
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.getAttribute("data-toggle-password"));
      if (!input) {
        return;
      }

      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      button.setAttribute("aria-label", hidden ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  });
})();
