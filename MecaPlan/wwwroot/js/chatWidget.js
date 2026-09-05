(function () {
  "use strict";

  function esc(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function inline(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
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
        if (inCode) { closeCode(); } else { closeList(); inCode = true; }
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

  function fmtFecha(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  }

  function makeInstance(root) {
    const chatEl = root.querySelector(".mecachat-chat");
    const form = root.querySelector(".mecachat-form");
    const select = root.querySelector(".mecachat-proyecto");
    const mensaje = root.querySelector(".mecachat-mensaje");
    const enviar = root.querySelector(".mecachat-send");
    if (!chatEl || !form || !select) return;

    let typingId = null;

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
      clearTyping();
      const row = document.createElement("div");
      row.className = "dia-row dia-row-bot";
      const avatar = document.createElement("div");
      avatar.className = "dia-avatar";
      avatar.textContent = "⚙";
      row.appendChild(avatar);
      const wrap = document.createElement("div");
      wrap.className = "dia-msg dia-bot dia-typing";
      wrap.id = (typingId = "mt" + Math.random().toString(36).slice(2));
      wrap.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
      row.appendChild(wrap);
      chatEl.appendChild(row);
      chatEl.scrollTop = chatEl.scrollHeight;
    }

    function clearTyping() {
      if (typingId) {
        const t = document.getElementById(typingId);
        if (t) {
          const row = t.closest(".dia-row");
          if (row) row.remove();
          else t.remove();
        }
        typingId = null;
      }
    }

    function fillSelect(proyectos, preferido) {
      select.innerHTML = "";
      const nulo = document.createElement("option");
      nulo.value = "";
      nulo.textContent = "Elige un proyecto";
      select.appendChild(nulo);
      (proyectos || []).forEach(function (p) {
        const o = document.createElement("option");
        o.value = p.proyectoID ?? p.proyectoId ?? p.ProyectoID;
        o.textContent = p.nombre || p.Nombre || "Proyecto";
        select.appendChild(o);
      });
      if (preferido) select.value = String(preferido);
    }

    function autoGrow() {
      mensaje.style.height = "auto";
      mensaje.style.height = Math.min(mensaje.scrollHeight, 140) + "px";
    }

    function cargarHistorial(proyectoId) {
      if (!proyectoId) return Promise.resolve();
      return fetch("/Diagnosticos/Historial?proyectoId=" + proyectoId, { credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data || !data.items) return;
          const items = data.items.slice().reverse();
          items.forEach(function (it) {
            bubble("user", it.descripcionFalla, fmtFecha(it.fechaReporte));
            bubble("bot", it.solucionSugerida || "(sin solución registrada)", "");
          });
          if (items.length > 0) {
            const sep = document.createElement("div");
            sep.className = "dia-time";
            sep.style.textAlign = "center";
            sep.style.padding = "6px 0";
            sep.textContent = "── Historial anterior ──";
            chatEl.appendChild(sep);
          }
        })
        .catch(function () { /* sin historial, se ignora */ });
    }

    function limpiarChat() {
      chatEl.innerHTML = "";
    }

    select.addEventListener("change", function () {
      limpiarChat();
      if (!select.value) return;
      cargarHistorial(select.value);
    });

    if (mensaje) {
      mensaje.addEventListener("input", autoGrow);
      mensaje.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          form.requestSubmit();
        }
      });
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const proyectoId = select.value;
      const texto = mensaje.value.trim();
      if (!proyectoId || !texto) return;
      bubble("user", texto, fmtFecha(new Date().toISOString()));
      mensaje.value = "";
      autoGrow();
      typing();
      enviar.disabled = true;
      try {
        const res = await fetch("/Diagnosticos/Enviar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ proyectoID: Number(proyectoId), ProyectoID: Number(proyectoId), mensaje: texto })
        });
        clearTyping();
        let data = {};
        try { data = await res.json(); } catch { data = {}; }
        if (!res.ok) {
          bubble("bot", "⚠️ " + (data.error || "Ocurrió un error al consultar a Claude (" + res.status + ")."), "");
        } else {
          bubble("bot", data.respuesta || data.Respuesta || "No recibí texto de Claude.", fmtFecha(new Date().toISOString()));
        }
      } catch {
        clearTyping();
        bubble("bot", "⚠️ No se pudo conectar. Inténtalo de nuevo.", "");
      } finally {
        enviar.disabled = false;
        if (mensaje) mensaje.focus();
      }
    });

    fetch("/Diagnosticos/Proyectos", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        const preferido = root.getAttribute("data-mecachat-proyecto");
        fillSelect(data.proyectos || [], preferido || (root.dataset.proyectoId || ""));
        if (select.value) {
          cargarHistorial(select.value);
        }
      })
      .catch(function () {
        chatEl.innerHTML = '<p class="app-empty">No se pudo cargar el asistente.</p>';
      });
  }

  function initAll() {
    var roots = document.querySelectorAll("[data-mecachat]");
    for (var i = 0; i < roots.length; i++) makeInstance(roots[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
