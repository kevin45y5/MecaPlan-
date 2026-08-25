(function () {
    "use strict";

    var root = document.querySelector("[data-bom-checklist]");
    if (!root) return;

    var toggleUrl = root.getAttribute("data-toggle-url") || "/Bom/Toggle";
    var totalEl = document.getElementById("bom-costo-total");
    var rows = Array.prototype.slice.call(root.querySelectorAll("[data-bom-row]"));

    function subtotalDe(row) {
        return parseFloat(row.getAttribute("data-subtotal")) || 0;
    }

    function recalcular() {
        var total = 0;
        rows.forEach(function (row) {
            var chk = row.querySelector("input[type=checkbox]");
            if (chk && !chk.checked) {
                total += subtotalDe(row);
            }
        });
        if (totalEl) {
            totalEl.textContent = "$" + total.toFixed(2);
        }
    }

    function persistir(bomId, esFaltante) {
        if (!toggleUrl) return Promise.resolve();
        return fetch(toggleUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bomId: bomId, esFaltante: esFaltante })
        }).catch(function () {
            console.warn("El endpoint " + toggleUrl + " todavía no está disponible; el cambio no se guardó.");
        });
    }

    rows.forEach(function (row) {
        var chk = row.querySelector("input[type=checkbox]");
        if (!chk) return;
        chk.addEventListener("change", function () {
            var esFaltante = !chk.checked;
            recalcular();
            persistir(parseInt(chk.getAttribute("data-bom-id"), 10), esFaltante);
        });
    });

    recalcular();
})();
