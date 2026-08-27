(() => {
    const section = document.querySelector("[data-source-code-url]");
    if (!section) return;

    const board = document.getElementById("target-board");
    const preview = document.getElementById("generated-source-code");
    const details = document.getElementById("code-file-details");
    const download = document.getElementById("download-source-code");
    let generatedCode;

    async function loadCode() {
        download.disabled = true;
        details.textContent = "Generando código…";
        try {
            const separator = section.dataset.sourceCodeUrl.includes("?") ? "&" : "?";
            const response = await fetch(`${section.dataset.sourceCodeUrl}${separator}board=${encodeURIComponent(board.value)}`, { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error("No fue posible generar el código.");
            generatedCode = await response.json();
            preview.textContent = generatedCode.code;
            details.textContent = `Archivo listo: ${generatedCode.fileName} (${generatedCode.fileType}).`;
            download.disabled = false;
        } catch (error) {
            generatedCode = undefined;
            preview.textContent = "";
            details.textContent = error.message;
        }
    }

    download.addEventListener("click", () => {
        if (!generatedCode) return;
        const blob = new Blob([generatedCode.code], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = generatedCode.fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
    });

    board.addEventListener("change", loadCode);
    loadCode();
})();
