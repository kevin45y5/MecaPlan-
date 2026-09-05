(() => {
  const projectSelect = document.getElementById("diaProyecto");
  const tokenInput = document.getElementById("diaToken");
  const chatEl = document.getElementById("diaChat");
  const historialEl = document.getElementById("offHistorialContent");
  const offHistEmpty = document.getElementById("offhistEmpty");
  const offcanvas = document.getElementById("diaOffcanvas");
  const overlay = document.getElementById("diaOverlay");
  const form = document.getElementById("diaForm");
  const mensajeInput = document.getElementById("diaMensaje");
  const enviarBtn = document.getElementById("diaEnviar");

  if (!projectSelect || !chatEl) return;

  function diaAbrirHistorial() {
    if (offcanvas) { offcanvas.classList.add("open"); offcanvas.setAttribute("aria-hidden", "false"); }
    if (overlay) overlay.classList.add("open");
  }
  function diaCerrarHistorial() {
    if (offcanvas) { offcanvas.classList.remove("open"); offcanvas.setAttribute("aria-hidden", "true"); }
    if (overlay) overlay.classList.remove("open");
  }
  window.diaAbrirHistorial = diaAbrirHistorial;
  window.diaCerrarHistorial = diaCerrarHistorial;

  const token = () => tokenInput ? tokenInput.value : "";

  function esc(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function renderMarkdown(text) {
    if (!text) return "";
    let t = String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const lines = t.split(/\r?\n/);
    let html = "";
    let inList = false;
    let inCode = false;
    let codeLines = [];

    const closeCode = () => {
      if (!inCode) return;
      html += '<pre class="dia-code">' + esc(codeLines.join("\n")) + "</pre>";
      codeLines = [];
      inCode = false;
    };
    const closeList = () => {
      if (inList) { html += "</ul>"; inList = false; }
    };

    for (const raw of lines) {
      const line = raw.trimEnd();

      if (line.trimStart().startsWith("```")) {
        if (inCode) { closeCode(); }
        else { closeList(); inCode = true; }
        continue;
      }
      if (inCode) { codeLines.push(line); continue; }

      closeCode();

      if (/^(\*\*|__).+(\*\*|__)$/.test(line.trim()) || line.trim().startsWith("#")) {
        closeList();
        html += "<h3 class='dia-sec'>" + inline(line.trim().replace(/^(#+)\s*/, "").replace(/^\*\*/, "").replace(/\*\*$/, "")) + "</h3>";
      } else if (/^\s*[-*•]\s+/.test(line)) {
        if (!inList) { html += "<ul class='dia-list'>"; inList = true; }
        html += "<li>" + inline(line.replace(/^\s*[-*•]\s+/, "")) + "</li>";
      } else if (/^\s*\d+[.)]\s+/.test(line)) {
        if (!inList) { html += "<ul class='dia-list dia-list-num'>"; inList = true; }
        html += "<li>" + inline(line.replace(/^\s*\d+[.)]\s+/, "")) + "</li>";
      } else if (line.trim() === "") {
        closeList();
      } else {
        closeList();
        html += "<p>" + inline(line) + "</p>";
      }
    }
    closeList();
    closeCode();
    return html;
  }

  function inline(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function bubble(rol, texto, fecha) {
    const row = document.createElement("div");
    row.className = "dia-row dia-row-" + rol;

    if (rol === "bot") {
      const avatar = document.createElement("div");
      avatar.className = "dia-avatar";
      avatar.textContent = "⚙";
      avatar.title = "Ingeniero IA";
      row.appendChild(avatar);
    }

    const wrap = document.createElement("div");
    wrap.className = "dia-msg dia-" + rol;
    const body = document.createElement("div");
    body.className = "dia-msg-body";
    body.innerHTML = rol === "bot" ? renderMarkdown(texto) : inline(texto);
    wrap.appendChild(body);
    if (fecha) {
      const time = document.createElement("div");
      time.className = "dia-time";
      time.textContent = fecha;
      wrap.appendChild(time);
    }
    row.appendChild(wrap);
    chatEl.appendChild(row);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function typing() {
    const row = document.createElement("div");
    row.className = "dia-row dia-row-bot";
    const avatar = document.createElement("div");
    avatar.className = "dia-avatar";
    avatar.textContent = "⚙";
    row.appendChild(avatar);
    const wrap = document.createElement("div");
    wrap.className = "dia-msg dia-bot dia-typing";
    wrap.id = "diaTyping";
    wrap.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    row.appendChild(wrap);
    chatEl.appendChild(row);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function clearTyping() {
    const t = document.getElementById("diaTyping");
    if (t) t.remove();
  }

  function fmtFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  async function cargarHistorial() {
    const id = projectSelect.value;
    if (!id) return;
    if (!historialEl) return;
    historialEl.innerHTML = "";
    try {
      const res = await fetch(`/Diagnosticos/Historial?proyectoId=${id}`, { headers: { "RequestVerificationToken": token() } });
      const data = await res.json();
      const items = data.items || [];
      if (items.length === 0) {
        historialEl.style.display = "none";
        if (offHistEmpty) offHistEmpty.style.display = "block";
      } else {
        historialEl.style.display = "block";
        if (offHistEmpty) offHistEmpty.style.display = "none";
        items.forEach((it) => {
          const card = document.createElement("article");
          card.className = "dia-hist-item";
          const solved = it.fechaResolucion ? true : false;
          const fechaFmt = fmtFecha(it.fechaReporte);

          const head = document.createElement("div");
          head.className = "dia-hist-head";
          const tag = document.createElement("span");
          tag.className = "dia-hist-tag dia-" + (solved ? "ok" : "pend");
          tag.textContent = solved ? "Resuelto" : "Pendiente";
          head.appendChild(tag);
          if (fechaFmt) {
            const tf = document.createElement("span");
            tf.className = "dia-hist-fecha";
            tf.textContent = fechaFmt;
            head.appendChild(tf);
          }
          card.appendChild(head);

          const desc = document.createElement("p");
          desc.className = "dia-hist-desc";
          desc.textContent = it.tipoError === "Consulta chatbot" ? it.descripcionFalla : it.tipoError + " — " + it.descripcionFalla;
          card.appendChild(desc);

          const acciones = document.createElement("div");
          acciones.className = "dia-hist-acciones";

          const verBtn = document.createElement("button");
          verBtn.type = "button";
          verBtn.className = "dia-hist-ver";
          verBtn.dataset.falla = it.descripcionFalla;
          verBtn.dataset.sol = it.solucionSugerida || "";
          verBtn.textContent = "Ver en el chat";
          verBtn.addEventListener("click", () => {
            bubble("user", it.descripcionFalla, "");
            bubble("bot", it.solucionSugerida || "", "");
          });
          acciones.appendChild(verBtn);

          if (!solved) {
            const resBtn = document.createElement("button");
            resBtn.type = "button";
            resBtn.className = "dia-hist-resolver";
            resBtn.dataset.id = it.diagnosticoID;
            resBtn.textContent = "Marcar como resuelto";
            resBtn.addEventListener("click", () => marcarResuelto(resBtn, it.diagnosticoID));
            acciones.appendChild(resBtn);
          }

          card.appendChild(acciones);
          historialEl.appendChild(card);
        });
      }
    } catch {
      historialEl.innerHTML = '<p class="app-empty">No se pudo cargar el historial.</p>';
    }
  }

  async function marcarResuelto(btn, id) {
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      const res = await fetch("/Diagnosticos/Resolver?id=" + id, {
        method: "POST",
        headers: { "RequestVerificationToken": token() }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        bubble("bot", "⚠️ " + (data.error || "No se pudo guardar."), "");
        btn.disabled = false;
        btn.textContent = "Marcar como resuelto";
      } else {
        bubble("bot", "✅ Diagnóstico marcado como **resuelto**.", fmtFecha(new Date().toISOString()));
        const card = btn.closest(".dia-hist-item");
        if (card) card.remove();
      }
    } catch {
      bubble("bot", "⚠️ No se pudo conectar. Inténtalo de nuevo.", "");
      btn.disabled = false;
      btn.textContent = "Marcar como resuelto";
    }
  }

  projectSelect.addEventListener("change", () => {
    chatEl.innerHTML = "";
    cargarHistorial();
  });

  function autoGrow() {
    mensajeInput.style.height = "auto";
    mensajeInput.style.height = Math.min(mensajeInput.scrollHeight, 140) + "px";
  }
  mensajeInput.addEventListener("input", autoGrow);
  mensajeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const proyectoId = projectSelect.value;
    const mensaje = mensajeInput.value.trim();
    if (!proyectoId || !mensaje) return;

    bubble("user", mensaje, fmtFecha(new Date().toISOString()));
    mensajeInput.value = "";
    autoGrow();
    typing();
    enviarBtn.disabled = true;

    try {
      const res = await fetch("/Diagnosticos/Enviar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "RequestVerificationToken": token()
        },
        body: JSON.stringify({ proyectoId: Number(proyectoId), mensaje })
      });
      clearTyping();
      const data = await res.json();
      if (!res.ok) {
        bubble("bot", "⚠️ " + (data.error || "Ocurrió un error."), "");
      } else {
        bubble("bot", data.respuesta, fmtFecha(new Date().toISOString()));
        if (data.diagnosticoId) cargarHistorial();
      }
    } catch {
      clearTyping();
      bubble("bot", "⚠️ No se pudo conectar. Inténtalo de nuevo.", "");
    } finally {
      enviarBtn.disabled = false;
      mensajeInput.focus();
    }
  });

  if (projectSelect.value) {
    cargarHistorial();
  }
})();
