(() => {
  const STORAGE_KEY = "mecaplan-theme";
  const html = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");

  if (!html.getAttribute("data-theme")) {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme) {
      html.setAttribute("data-theme", savedTheme);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      html.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      html.style.colorScheme = next;
      localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent("mecaplan-theme", { detail: next }));
    });
  }
})();
