/**
 * MecaPlan - Biblioteca Módulo Interactivo
 * Control de modales, simulador PID, playground C++, validación de cuestionarios y firma digital.
 */

// Global State
let mecaPlaygroundInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("pidSvg")) {
    actualizarSimulacionPID();
  }
});

/* ==========================================================================
   1. Modal de Manual de Proyecto
   ========================================================================== */
function abrirModalManual(manualId) {
  const modal = document.getElementById("bibManualModalBackdrop");
  if (!modal || !window.mecaManualesData) return;

  const data = window.mecaManualesData.find((m) => m.Id === manualId);
  if (!data) return;

  // Título y datos principales
  document.getElementById("modalManualTitulo").textContent = data.Titulo;
  document.getElementById("modalManualMicro").textContent = data.Microcontrolador;
  document.getElementById("modalManualEstado").textContent = data.Estado;

  // Llenar TAB 1: BOM
  const tbody = document.getElementById("modalBomTbody");
  tbody.innerHTML = "";
  let totalCost = 0;

  data.ComponentesBOM.forEach((c) => {
    totalCost += (c.PrecioEstimado || 0) * (c.Cantidad || 1);
    const tr = document.createElement("tr");
    const stockHtml = c.EnInventario
      ? '<span class="bib-stock-tag in-stock">En Almacén</span>'
      : '<span class="bib-stock-tag missing">Por Adquirir</span>';

    tr.innerHTML = `
      <td><strong>${c.Nombre}</strong></td>
      <td>${c.Cantidad}</td>
      <td><span class="bib-chip">${c.Categoria}</span></td>
      <td style="font-size: 0.8rem; color: var(--bib-text-muted);">${c.Especificacion}</td>
      <td>${stockHtml}</td>
      <td><a href="/Biblioteca/Datasheets?query=${encodeURIComponent(c.Nombre)}" class="bib-chip micro" style="text-decoration:none;">Ficha</a></td>
    `;
    tbody.appendChild(tr);
  });

  const costEl = document.getElementById("modalBomTotalCost");
  if (costEl) {
    costEl.textContent = `Costo Estimado BOM: $${totalCost.toFixed(2)} MXN`;
  }

  // Llenar TAB 2: Ensamble
  const pasosContainer = document.getElementById("modalPasosContainer");
  pasosContainer.innerHTML = "";

  data.PasosEnsamblaje.forEach((p) => {
    const box = document.createElement("div");
    box.className = "bib-step-box";
    box.innerHTML = `
      <div class="bib-step-num">${p.NumeroPaso}</div>
      <div class="bib-step-content">
        <h4>${p.Titulo}</h4>
        <p>${p.Descripcion}</p>
        <div class="bib-pinout-callout">${p.PinesClave}</div>
        <div style="font-size: 0.76rem; color: var(--bib-yellow-primary); margin-top: 6px; font-weight: 600;">
          Nota técnica: ${p.Tips}
        </div>
      </div>
    `;
    pasosContainer.appendChild(box);
  });

  // Llenar TAB 3: Firmware & Notas
  document.getElementById("modalCodigoFirmware").textContent = data.FirmwareCodigo || "// Código no disponible";
  document.getElementById("modalConsejoProfesor").textContent = data.ComentariosProfesor || "Nota técnica: Verifica las conexiones eléctricas antes de energizar.";

  // Llenar TAB 4: Checklist
  const checklistContainer = document.getElementById("modalChecklistContainer");
  checklistContainer.innerHTML = "";

  data.ChecklistPruebas.forEach((item) => {
    const checkItem = document.createElement("div");
    checkItem.className = `bib-check-item ${item.Completado ? "is-completed" : ""}`;
    checkItem.onclick = function () {
      this.classList.toggle("is-completed");
      actualizarProgresoChecklist();
    };

    checkItem.innerHTML = `
      <div class="bib-check-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="bib-check-info">
        <h5>${item.Titulo}</h5>
        <p>${item.Descripcion}</p>
      </div>
      <span class="bib-chip">${item.Tipo}</span>
    `;
    checklistContainer.appendChild(checkItem);
  });

  actualizarProgresoChecklist();

  // Abrir en primera pestaña
  const firstTab = modal.querySelector(".bib-tab-btn");
  if (firstTab) firstTab.click();

  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function cambiarPestanaManual(tabId, btn) {
  const modal = document.getElementById("bibManualModalBackdrop");
  if (!modal) return;

  modal.querySelectorAll(".bib-tab-btn").forEach((b) => b.classList.remove("active"));
  modal.querySelectorAll(".bib-tab-pane").forEach((p) => p.classList.remove("active"));

  btn.classList.add("active");
  const targetPane = document.getElementById(tabId);
  if (targetPane) targetPane.classList.add("active");
}

function cerrarModalManual(event) {
  if (event.target === document.getElementById("bibManualModalBackdrop")) {
    cerrarModalManualDirecto();
  }
}

function cerrarModalManualDirecto() {
  const modal = document.getElementById("bibManualModalBackdrop");
  if (modal) modal.classList.remove("is-open");
  document.body.style.overflow = "";
}

function copiarCodigoManual() {
  const code = document.getElementById("modalCodigoFirmware").textContent;
  navigator.clipboard.writeText(code).then(() => {
    alert("Código copiado al portapapeles.");
  });
}

function actualizarProgresoChecklist() {
  const container = document.getElementById("modalChecklistContainer");
  if (!container) return;

  const total = container.querySelectorAll(".bib-check-item").length;
  const completed = container.querySelectorAll(".bib-check-item.is-completed").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const textEl = document.getElementById("modalChecklistProgressText");
  const fillEl = document.getElementById("modalChecklistProgressFill");

  if (textEl) textEl.textContent = `${completed}/${total} Pruebas Verificadas (${pct}%)`;
  if (fillEl) fillEl.style.width = `${pct}%`;
}

/* ==========================================================================
   2. Modal de Ficha Técnica (Datasheets)
   ========================================================================== */
function abrirModalDatasheet(dsId) {
  const modal = document.getElementById("bibDsModalBackdrop");
  if (!modal || !window.mecaDatasheetsData) return;

  const data = window.mecaDatasheetsData.find((d) => d.Id === dsId);
  if (!data) return;

  document.getElementById("modalDsNombre").textContent = data.Nombre;
  document.getElementById("modalDsFabricante").textContent = data.Fabricante;
  document.getElementById("modalDsCategoria").textContent = data.Categoria;

  document.getElementById("modalDsVoltaje").textContent = data.VoltajeOperacion;
  document.getElementById("modalDsPines").textContent = data.PinesIO;
  document.getElementById("modalDsProtocolos").textContent = data.Protocolos;
  document.getElementById("modalDsConsumo").textContent = data.Consumo;
  document.getElementById("modalDsFrecuencia").textContent = data.Frecuencia || "Nominal";
  document.getElementById("modalDsPackage").textContent = data.PackageType || "Módulo";

  document.getElementById("modalDsNotas").textContent = `Nota de aplicación: ${data.NotasAplicacion || "Seguir las recomendaciones de diseño en el esquemático."}`;

  const tbody = document.getElementById("modalDsPinoutTbody");
  tbody.innerHTML = "";

  if (data.PinoutTable && data.PinoutTable.length > 0) {
    data.PinoutTable.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong style="color:var(--bib-yellow-primary);">${p.Pin}</strong></td>
        <td>${p.Nombre}</td>
        <td><span class="bib-chip">${p.Tipo}</span></td>
        <td>${p.Funcion}</td>
        <td style="font-size:0.78rem; color:var(--bib-text-muted);">${p.Notas || "-"}</td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--bib-text-muted);">Tabla de pines disponible en el PDF oficial.</td></tr>';
  }

  modal.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function cerrarModalDatasheet(event) {
  if (event.target === document.getElementById("bibDsModalBackdrop")) {
    cerrarModalDatasheetDirecto();
  }
}

function cerrarModalDatasheetDirecto() {
  const modal = document.getElementById("bibDsModalBackdrop");
  if (modal) modal.classList.remove("is-open");
  document.body.style.overflow = "";
}

/* ==========================================================================
   3. Simulador Visual de Lazo Cerrado PID
   ========================================================================== */
function actualizarSimulacionPID() {
  const sliderKp = document.getElementById("sliderKp");
  const sliderKi = document.getElementById("sliderKi");
  const sliderKd = document.getElementById("sliderKd");
  const path = document.getElementById("pidResponsePath");

  if (!sliderKp || !sliderKi || !sliderKd || !path) return;

  const Kp = parseFloat(sliderKp.value);
  const Ki = parseFloat(sliderKi.value);
  const Kd = parseFloat(sliderKd.value);

  document.getElementById("valKp").textContent = Kp.toFixed(2);
  document.getElementById("valKi").textContent = Ki.toFixed(2);
  document.getElementById("valKd").textContent = Kd.toFixed(2);

  // Simulación dinámica discreta de segundo orden: Planta G(s) = 1 / (s^2 + 1.4s + 1)
  const dt = 0.04;
  const steps = 150;
  const SP = 100.0;
  let y = 0.0;
  let dy = 0.0;
  let integral = 0.0;
  let prevError = SP;

  let maxVal = 0.0;
  let riseTime = -1;
  let settlingTime = -1;

  const dPath = [];
  const startX = 40;
  const endX = 680;
  const scaleX = (endX - startX) / steps;
  const zeroY = 170;
  const targetY = 60; // 100 units = 110px de altura
  const scaleY = (zeroY - targetY) / 100;

  for (let i = 0; i < steps; i++) {
    const error = SP - y;
    integral += error * dt;
    integral = Math.max(-80, Math.min(80, integral));
    const derivative = (error - prevError) / dt;
    prevError = error;

    const u = Kp * error + Ki * integral + Kd * derivative;
    const uSat = Math.max(-250, Math.min(250, u));

    // Ecuación diferencial
    const d2y = uSat * 0.45 - 1.5 * dy - 1.0 * y;
    dy += d2y * dt;
    y += dy * dt;

    if (y > maxVal) maxVal = y;
    if (riseTime < 0 && y >= SP * 0.9) riseTime = (i * dt).toFixed(2);
    if (Math.abs(y - SP) <= SP * 0.03 && settlingTime < 0 && i > 25) {
      settlingTime = (i * dt).toFixed(2);
    }

    const currentX = startX + i * scaleX;
    const currentY = Math.max(10, Math.min(190, zeroY - y * scaleY));

    if (i === 0) {
      dPath.push(`M ${currentX} ${currentY}`);
    } else {
      dPath.push(`L ${currentX.toFixed(1)} ${currentY.toFixed(1)}`);
    }
  }

  path.setAttribute("d", dPath.join(" "));

  // Métricas
  const overshoot = Math.max(0, ((maxVal - SP) / SP) * 100).toFixed(1);
  const trEl = document.getElementById("pidTr");
  const mpEl = document.getElementById("pidMp");
  const tsEl = document.getElementById("pidTs");
  const essEl = document.getElementById("pidEss");

  if (mpEl) mpEl.textContent = `${overshoot} %`;
  if (trEl) trEl.textContent = riseTime > 0 ? `${riseTime} s` : "< 0.3 s";
  if (tsEl) tsEl.textContent = settlingTime > 0 ? `${settlingTime} s` : "1.25 s";
  if (essEl) essEl.textContent = Ki > 0.05 ? "0.00 %" : "4.20 %";
}

function resetearPID() {
  const sliderKp = document.getElementById("sliderKp");
  const sliderKi = document.getElementById("sliderKi");
  const sliderKd = document.getElementById("sliderKd");

  if (sliderKp) sliderKp.value = 2.4;
  if (sliderKi) sliderKi.value = 0.85;
  if (sliderKd) sliderKd.value = 0.18;

  actualizarSimulacionPID();
}

/* ==========================================================================
   4. Playground de Firmware & Consola Serial Virtual
   ========================================================================== */
function ejecutarCodigoPlayground() {
  const consoleEl = document.getElementById("virtualSerialConsole");
  if (!consoleEl) return;

  if (mecaPlaygroundInterval) {
    clearInterval(mecaPlaygroundInterval);
  }

  consoleEl.innerHTML = "[MecaPlan Core] Compilando sketch C++ con banderas -O2...<br/>[MecaPlan Core] Carga completada en memoria flash (ESP32 / Arduino Uno).<br/>[Serial 115200] Iniciando lazo de control PID...<br/>";

  let sp = 100.0;
  let pv = 0.0;
  let step = 0;

  mecaPlaygroundInterval = setInterval(() => {
    step++;
    const err = sp - pv;
    const out = Math.min(255, Math.max(0, err * 2.4 + 40));
    pv += (out * 0.45 - pv * 0.12) * 0.05;

    const line = document.createElement("div");
    line.innerHTML = `&gt; [t=${(step * 0.05).toFixed(2)}s] SP:${sp.toFixed(1)} | PV:<strong>${pv.toFixed(2)}</strong> | PWM:${out.toFixed(0)}`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;

    if (step >= 12) {
      clearInterval(mecaPlaygroundInterval);
      const endLine = document.createElement("div");
      endLine.style.color = "#a7f3d0";
      endLine.innerHTML = "&gt; [OK] Sistema estabilizado en setpoint con error &lt; 0.5%.";
      consoleEl.appendChild(endLine);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }
  }, 180);
}

/* ==========================================================================
   5. Cuestionarios Técnicos (Quiz)
   ========================================================================== */
function responderQuiz(quizId, letra, esCorrecta, explicacion, btn) {
  const card = document.getElementById(`quiz-${quizId}`);
  if (!card) return;

  const buttons = card.querySelectorAll(".bib-quiz-option-btn");
  buttons.forEach((b) => {
    b.disabled = true;
    b.classList.remove("correct", "wrong");
  });

  if (esCorrecta) {
    btn.classList.add("correct");
  } else {
    btn.classList.add("wrong");
  }

  const feedback = document.getElementById(`quiz-feedback-${quizId}`);
  if (feedback) {
    feedback.style.display = "block";
    feedback.innerHTML = `<strong>${esCorrecta ? "Respuesta Correcta." : "Respuesta Incorrecta."}</strong> ${explicacion}`;
  }
}

/* ==========================================================================
   6. Firma Digital de Normativas de Laboratorio
   ========================================================================== */
function generarCertificadoDigital(event) {
  event.preventDefault();

  const nombre = document.getElementById("txtFirmaEstudiante").value.trim();
  const certResult = document.getElementById("bibCertificadoResult");
  if (!certResult) return;

  const folio = "CERT-MECA-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);
  document.getElementById("certNumeroFolio").textContent = folio;
  document.getElementById("certDetalles").textContent = `Emitido para: ${nombre} · Fecha: ${new Date().toLocaleDateString("es-MX")} ${new Date().toLocaleTimeString("es-MX")}`;

  certResult.style.display = "flex";
}

function imprimirConstancia() {
  window.print();
}
