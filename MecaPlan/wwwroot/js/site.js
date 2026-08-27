document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("form[data-submitting-text]").forEach(form => {
        form.addEventListener("submit", () => {
            const jqueryForm = window.jQuery ? window.jQuery(form) : null;
            if (!form.checkValidity() || (jqueryForm?.valid && !jqueryForm.valid())) {
                return;
            }

            const button = form.querySelector("button[type='submit']");
            if (!button) {
                return;
            }

            button.disabled = true;
            button.setAttribute("aria-busy", "true");
            button.textContent = form.dataset.submittingText;
        });
    });
});
