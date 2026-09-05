(() => {
  const root = document.querySelector(".workspace");
  if (!root) {
    return;
  }

  const COLORS = {
    rojo: "#ef4444",
    amarillo: "#eab308",
    verde: "#22c55e",
    azul: "#3b82f6",
    naranja: "#f97316",
    negro: "#111827",
    blanco: "#e5e7eb",
    gris: "#94a3b8",
    morado: "#8b5cf6",
    cafe: "#92400e",
    marron: "#92400e"
  };

  const chat = document.getElementById("workspaceChat");
  const toggleCodigo = document.getElementById("toggleCodigo");
  const toggleDiagnostico = document.getElementById("toggleDiagnostico");
  const canvas = document.getElementById("workspaceCanvas");
  const nodesRoot = document.getElementById("workspaceNodes");
  const svg = document.getElementById("workspaceWires");

  function syncToggles() {
    toggleCodigo?.classList.toggle("is-active", root.classList.contains("show-code"));
    toggleDiagnostico?.classList.toggle("is-active", root.classList.contains("show-chat"));
    window.dispatchEvent(new Event("resize"));
  }

  toggleCodigo?.addEventListener("click", () => {
    root.classList.toggle("show-code");
    syncToggles();
  });
  toggleDiagnostico?.addEventListener("click", () => {
    root.classList.toggle("show-chat");
    chat?.classList.toggle("is-open", root.classList.contains("show-chat"));
    syncToggles();
  });
  document.getElementById("cerrarChat")?.addEventListener("click", () => {
    root.classList.remove("show-chat");
    chat?.classList.remove("is-open");
    syncToggles();
  });
  document.getElementById("cerrarCodigo")?.addEventListener("click", () => {
    root.classList.remove("show-code");
    syncToggles();
  });

  function bindResizers() {
    root.querySelectorAll("[data-resize]").forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        const target = handle.getAttribute("data-resize");
        const startX = event.clientX;
        const startCode = parseFloat(getComputedStyle(root).getPropertyValue("--code-w")) || 220;
        const startChat = parseFloat(getComputedStyle(root).getPropertyValue("--chat-w")) || 250;

        const onMove = (moveEvent) => {
          const delta = moveEvent.clientX - startX;
          const total = root.getBoundingClientRect().width;
          const minCanvas = 280;
          const other = target === "code"
            ? (root.classList.contains("show-chat") ? startChat : 0)
            : (root.classList.contains("show-code") ? startCode : 0);
          const max = Math.max(180, total - other - minCanvas);
          if (target === "code") {
            const width = Math.min(max, Math.max(180, startCode + delta));
            root.style.setProperty("--code-w", `${width}px`);
          } else {
            const width = Math.min(max, Math.max(180, startChat - delta));
            root.style.setProperty("--chat-w", `${width}px`);
          }
        };
        const onUp = () => {
          handle.releasePointerCapture(event.pointerId);
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
          window.dispatchEvent(new Event("resize"));
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
      });
    });
  }

  function readJson(id, fallback) {
    const node = document.getElementById(id);
    if (!node) {
      return fallback;
    }
    try {
      return JSON.parse(node.textContent || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  const codigo = readJson("workspaceCode", "");
  const conexiones = readJson("workspaceConexiones", []);
  const componentes = readJson("workspaceComponentes", []);

  function parseEndpoint(value) {
    const text = String(value || "");
    const idx = text.indexOf("_");
    if (idx < 0) {
      return { component: text || "Componente", pin: "" };
    }
    return { component: text.slice(0, idx), pin: text.slice(idx + 1) };
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function findNode(component) {
    if (!nodesRoot) {
      return null;
    }
    const key = normalize(component);
    return nodesRoot.querySelector(`[data-key="${key}"]`)
      || [...nodesRoot.querySelectorAll(".canvas-node")].find((node) => {
        const nodeKey = node.dataset.key || "";
        return nodeKey.includes(key) || key.includes(nodeKey);
      });
  }

  function renderCanvas() {
    if (!nodesRoot || !canvas) {
      return;
    }

    const names = new Map();
    function addItem(item) {
      if (!item?.nombre) {
        return;
      }
      const key = normalize(item.nombre);
      if (!key) {
        return;
      }
      const current = names.get(key);
      if (!current || item.nombre.length > current.nombre.length) {
        names.set(key, { ...item, key });
      }
    }

    componentes.forEach(addItem);
    conexiones.forEach((link) => {
      const origen = link.origen || link.Origen
        || [link.origenComponente || link.OrigenComponente, link.origenPin || link.OrigenPin].filter(Boolean).join('_');
      const destino = link.destino || link.Destino
        || [link.destinoComponente || link.DestinoComponente, link.destinoPin || link.DestinoPin].filter(Boolean).join('_');
      [origen, destino].forEach((end) => {
        const parsed = parseEndpoint(end);
        addItem({ nombre: parsed.component, enInventario: false });
      });
    });

    nodesRoot.innerHTML = "";
    const items = [...names.values()];
    const box = canvas.getBoundingClientRect();
    const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(items.length || 1))));
    const rows = Math.max(1, Math.ceil(items.length / cols));
    const cellW = Math.max(120, box.width / (cols + 1));
    const cellH = Math.max(70, box.height / (rows + 1));

    items.forEach((item, index) => {
      const node = document.createElement("article");
      node.className = "canvas-node" + (item.enInventario ? " is-stock" : " is-new");
      node.dataset.name = item.nombre;
      node.dataset.key = item.key;
      node.innerHTML = `
        <span class="canvas-node-port canvas-node-port-in"></span>
        <span class="canvas-node-label">${item.nombre}</span>
        <span class="canvas-node-port canvas-node-port-out"></span>`;
      const col = index % cols;
      const row = Math.floor(index / cols);
      node.style.left = `${Math.round(cellW * (col + 0.35))}px`;
      node.style.top = `${Math.round(cellH * (row + 0.35) + (col % 2) * 10)}px`;
      enableDrag(node);
      nodesRoot.appendChild(node);
    });

    drawWires();
  }

  function enableDrag(node) {
    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !canvas) {
        return;
      }
      event.preventDefault();
      node.setPointerCapture(event.pointerId);
      node.classList.add("is-dragging");
      const startX = event.clientX;
      const startY = event.clientY;
      const origL = node.offsetLeft;
      const origT = node.offsetTop;

      const onMove = (moveEvent) => {
        const bounds = canvas.getBoundingClientRect();
        const maxX = Math.max(8, bounds.width - node.offsetWidth - 8);
        const maxY = Math.max(8, bounds.height - node.offsetHeight - 8);
        const left = Math.min(maxX, Math.max(8, origL + (moveEvent.clientX - startX)));
        const top = Math.min(maxY, Math.max(8, origT + (moveEvent.clientY - startY)));
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
        drawWires();
      };
      const onUp = () => {
        node.classList.remove("is-dragging");
        node.removeEventListener("pointermove", onMove);
        node.removeEventListener("pointerup", onUp);
      };
      node.addEventListener("pointermove", onMove);
      node.addEventListener("pointerup", onUp);
    });
  }

  function drawWires() {
    if (!canvas || !svg || !nodesRoot) {
      return;
    }
    const box = canvas.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    svg.innerHTML = "";

    conexiones.forEach((link) => {
      const origen = link.origen || link.Origen
        || [link.origenComponente || link.OrigenComponente, link.origenPin || link.OrigenPin].filter(Boolean).join('_');
      const destino = link.destino || link.Destino
        || [link.destinoComponente || link.DestinoComponente, link.destinoPin || link.DestinoPin].filter(Boolean).join('_');
      const from = parseEndpoint(origen);
      const to = parseEndpoint(destino);
      const a = findNode(from.component);
      const b = findNode(to.component);
      if (!a || !b) {
        return;
      }
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - 6 - box.left;
      const y1 = ra.top + ra.height / 2 - box.top;
      const x2 = rb.left + 6 - box.left;
      const y2 = rb.top + rb.height / 2 - box.top;
      const color = COLORS[String(link.color_cable || "gris").toLowerCase()] || COLORS.gris;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const mid = (x1 + x2) / 2;
      path.setAttribute("d", `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
      path.setAttribute("stroke", color);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-width", "2.5");
      path.setAttribute("stroke-linecap", "round");
      path.classList.add("canvas-wire");
      svg.appendChild(path);
    });
  }

  function monacoTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "vs-dark" : "vs";
  }

  require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" } });
  require(["vs/editor/editor.main"], () => {
    const editor = monaco.editor.create(document.getElementById("monacoEditor"), {
      value: codigo || "// Sin código generado todavía",
      language: "cpp",
      theme: monacoTheme(),
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      scrollBeyondLastLine: false
    });

    window.addEventListener("mecaplan-theme", () => {
      monaco.editor.setTheme(monacoTheme());
    });

    document.getElementById("copiarCodigo")?.addEventListener("click", async () => {
      const button = document.getElementById("copiarCodigo");
      try {
        await navigator.clipboard.writeText(editor.getValue());
        if (button) {
          button.textContent = "Copiado";
          setTimeout(() => { button.textContent = "Copiar"; }, 1400);
        }
      } catch {
        if (button) {
          button.textContent = "Error";
          setTimeout(() => { button.textContent = "Copiar"; }, 1400);
        }
      }
    });

    document.getElementById("guardarCodigo")?.addEventListener("click", async () => {
      const token = document.getElementById("codigoToken")?.value;
      const id = root.getAttribute("data-proyecto-id");
      const body = new URLSearchParams();
      body.set("codigo", editor.getValue());
      body.set("__RequestVerificationToken", token || "");
      const response = await fetch(`/Proyectos/GuardarCodigo/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          RequestVerificationToken: token || ""
        },
        body
      });
      const button = document.getElementById("guardarCodigo");
      if (button) {
        button.textContent = response.ok ? "Guardado" : "Error";
        setTimeout(() => { button.textContent = "Guardar"; }, 1600);
      }
    });
  });

  bindResizers();
  renderCanvas();
  window.addEventListener("resize", () => {
    if (canvas && nodesRoot) {
      const bounds = canvas.getBoundingClientRect();
      nodesRoot.querySelectorAll(".canvas-node").forEach((node) => {
        const maxX = Math.max(8, bounds.width - node.offsetWidth - 8);
        const maxY = Math.max(8, bounds.height - node.offsetHeight - 8);
        node.style.left = `${Math.min(maxX, Math.max(8, node.offsetLeft))}px`;
        node.style.top = `${Math.min(maxY, Math.max(8, node.offsetTop))}px`;
      });
    }
    drawWires();
  });
})();
