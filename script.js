/* ==========================================================================
   1. ELEMEN DOM & STATE
   ========================================================================== */
const mapContainer = document.getElementById("map-container");
const content = document.getElementById("map-content");
const svg = document.getElementById("line-layer");
const mapBg = document.querySelector(".map-bg");

const popup = document.getElementById("popup");
const input = document.getElementById("locationName");
const cancelBtn = document.getElementById("cancelBtn");

const connectPopup = document.getElementById("connectPopup");
const distanceInput = document.getElementById("distanceInput");
const transportSelect = document.getElementById("transportSelect");
const connectSaveBtn = document.getElementById("connectSaveBtn");
const connectCancelBtn = document.getElementById("connectCancelBtn");

const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");
const searchRouteBtn = document.getElementById("searchRouteBtn");
const routeResults = document.getElementById("routeResults");

let connectFrom = null;        
let currentToPin = null;      
let selectedConnection = null; 
let tempX = 0; 
let tempY = 0; 
let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

let sortMode = "fastest"; 

const transportData = {
  train: { color: "#33E339", speed: 120, costPerKm: 500 },
  bus: { color: "#A83BE8", speed: 80, costPerKm: 100 },
  plane: { color: "#000000", speed: 800, costPerKm: 1000 }
};

let pins = JSON.parse(localStorage.getItem("pins")) || [];

/* ==========================================================================
   2. TRANSFORM, CLAMP, SAVE & INITIALIZE
   ========================================================================== */
function save() {
  localStorage.setItem("pins", JSON.stringify(pins));
}

function initializePinsData() {
  pins.forEach(p => {
    if (!p.connections || !Array.isArray(p.connections)) {
      p.connections = [];
    }
  });
  save();
}

function updateTransform() {
  content.style.transformOrigin = "0 0";
  content.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

function clampPan() {
  const rect = mapContainer.getBoundingClientRect();
  const scaledWidth = content.clientWidth * scale;
  const scaledHeight = content.clientHeight * scale;

  const minX = rect.width - scaledWidth;
  const minY = rect.height - scaledHeight;

  translateX = scaledWidth > rect.width ? Math.min(0, Math.max(translateX, minX)) : (rect.width - scaledWidth) / 2;
  translateY = scaledHeight > rect.height ? Math.min(0, Math.max(translateY, minY)) : (rect.height - scaledHeight) / 2;
}

mapBg.onload = () => {
  clampPan();
  updateTransform();
  drawLines();
};

window.onload = () => {
  initializePinsData(); 
  pins.forEach(renderPin);
  if (mapBg.complete) {
    clampPan();
    updateTransform();
    drawLines();
  }
  validateRouteInputs(); 
};

/* ==========================================================================
   3. TAMBAH PINPOINT (DOUBLE CLICK)
   ========================================================================== */
mapContainer.addEventListener("dblclick", (e) => {
  if (e.target.closest(".pin") || e.target.closest(".sidebar") || e.target.closest(".modal-popup") || e.target.closest(".dialog-card")) return;

  const rect = content.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  tempX = ((mouseX / scale) / content.clientWidth) * 100;
  tempY = ((mouseY / scale) / content.clientHeight) * 100;

  popup.classList.remove("hidden");
  input.value = "";
  input.focus();

  popup.style.left = `${Math.min(e.clientX + 10, window.innerWidth - 280)}px`;
  popup.style.top = `${Math.min(e.clientY - 20, window.innerHeight - 150)}px`;
});

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") savePin();
});

cancelBtn.onclick = () => popup.classList.add("hidden");

function savePin() {
  const name = input.value.trim();
  if (!name) return;

  const pin = { id: Date.now(), name, x: tempX, y: tempY, connections: [] };
  pins.push(pin);
  save();
  renderPin(pin);
  validateRouteInputs(); 
  popup.classList.add("hidden");
  drawLines();
}

/* ==========================================================================
   4. RENDER & HAPUS PINPOINT
   ========================================================================== */
function renderPin(pin) {
  const div = document.createElement("div");
  div.className = "pin";
  div.style.left = `${pin.x}%`;
  div.style.top = `${pin.y}%`;
  div.dataset.id = pin.id;

  div.innerHTML = `
    <div class="pin-wrapper">
      <div class="pin-label">
        <span class="pin-name">${pin.name}</span>
        <div class="pin-actions">
          <button class="action-btn connect-btn-trigger" title="Hubungkan">🔗</button>
          <button class="action-btn delete-btn-trigger" title="Hapus">🗑️</button>
        </div>
      </div>
      <div class="pin-icon"></div>
    </div>
  `;

  div.querySelector(".connect-btn-trigger").addEventListener("click", (e) => {
    e.stopPropagation(); 
    connectPin(pin.id);
  });

  div.querySelector(".delete-btn-trigger").addEventListener("click", (e) => {
    e.stopPropagation();
    deletePin(pin.id);
  });

  content.appendChild(div);
}

function deletePin(id) {
  pins = pins.filter(p => p.id != id);
  pins.forEach(p => { 
    if (p.connections) {
      p.connections = p.connections.filter(c => c.to != id); 
    }
  });
  save();

  const el = document.querySelector(`[data-id='${id}']`);
  if (el) el.remove();

  drawLines();
  validateRouteInputs(); 
}

/* ==========================================================================
   5. SAMBUNG JALUR ANTAR PIN
   ========================================================================== */
function connectPin(id) {
  connectFrom = id;
  document.querySelectorAll(".pin").forEach(p => p.classList.remove("connecting-glow"));
  const activePinEl = document.querySelector(`[data-id='${id}']`);
  if (activePinEl) activePinEl.classList.add("connecting-glow");
}

mapContainer.addEventListener("click", (e) => {
  const targetPinEl = e.target.closest(".pin");
  if (!targetPinEl || !connectFrom) return;

  const fromPin = pins.find(p => p.id == connectFrom);
  currentToPin = pins.find(p => p.id == targetPinEl.dataset.id);

  if (!fromPin || !currentToPin || fromPin.id == currentToPin.id) return;

  connectPopup.classList.remove("hidden");
  connectPopup.style.left = "50%";
  connectPopup.style.top = "50%";
  connectPopup.style.transform = "translate(-50%, -50%)";
  distanceInput.value = "";
  transportSelect.value = ""; // Mengembalikan opsi ke "Choose mode" placeholder
  distanceInput.focus();
});

connectSaveBtn.onclick = () => {
  if (!connectFrom || !currentToPin) return;

  const fromPin = pins.find(p => p.id == connectFrom);
  const distance = parseFloat(distanceInput.value) || 0;
  const type = transportSelect.value;

  if (distance <= 0 || !type) return;

  if (!fromPin.connections) fromPin.connections = [];
  if (!currentToPin.connections) currentToPin.connections = [];

  const isDuplicate = fromPin.connections.some(c => c.to == currentToPin.id && c.type === type);
  if (isDuplicate) {
    connectPopup.classList.add("hidden");
    document.querySelectorAll(".pin").forEach(p => p.classList.remove("connecting-glow"));
    connectFrom = null;
    return;
  }

  fromPin.connections.push({ from: fromPin.id, to: currentToPin.id, distance, type });
  currentToPin.connections.push({ from: currentToPin.id, to: fromPin.id, distance, type });

  save();
  connectPopup.classList.add("hidden");
  connectFrom = null;
  document.querySelectorAll(".pin").forEach(p => p.classList.remove("connecting-glow"));
  drawLines();
  validateRouteInputs(); 
};

connectCancelBtn.onclick = () => {
  connectPopup.classList.add("hidden");
  connectFrom = null;
  document.querySelectorAll(".pin").forEach(p => p.classList.remove("connecting-glow"));
};

/* ==========================================================================
   6. RENDER LINE & TEKS ANGKA
   ========================================================================== */
function drawLines() {
  svg.innerHTML = "";
  const mapWidth = content.clientWidth;
  const mapHeight = content.clientHeight;
  if (mapWidth === 0 || mapHeight === 0) return;

  const pairsMap = new Map();

  pins.forEach(from => {
    if (!from.connections) return;
    from.connections.forEach(conn => {
      const to = pins.find(p => p.id == conn.to);
      if (!to) return;

      const pinIds = [from.id, to.id].sort((a, b) => a - b);
      const pairKey = `${pinIds[0]}-${pinIds[1]}`;

      if (!pairsMap.has(pairKey)) {
        pairsMap.set(pairKey, { p1: pins.find(p => p.id == pinIds[0]), p2: pins.find(p => p.id == pinIds[1]), types: [] });
      }

      const pairData = pairsMap.get(pairKey);
      if (!pairData.types.some(t => t.type === conn.type)) {
        pairData.types.push({ type: conn.type, distance: conn.distance, fromId: from.id, toId: conn.to });
      }
    });
  });

  pairsMap.forEach(pair => {
    const { p1, p2, types } = pair;
    const typeOrder = { train: 0, bus: 1, plane: 2 };
    types.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

    const p1x_px = (p1.x / 100) * mapWidth;
    const p1y_px = (p1.y / 100) * mapHeight;
    const p2x_px = (p2.x / 100) * mapWidth;
    const p2y_px = (p2.y / 100) * mapHeight;

    const dx = p2x_px - p1x_px;
    const dy = p2y_px - p1y_px;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    const dirX = dx / length;
    const dirY = dy / length;
    const perpX = -dy / length;
    const perpY = dx / length;
    
    const spacing = 10; 

    types.forEach(conn => {
      let offset = 0;
      if (conn.type === "train") offset = -spacing;
      if (conn.type === "bus")   offset = 0;
      if (conn.type === "plane") offset = spacing;

      const x1px = p1x_px + perpX * offset;
      const y1px = p1y_px + perpY * offset;
      const x2px = p2x_px + perpX * offset;
      const y2px = p2y_px + perpY * offset;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1px);
      line.setAttribute("y1", y1px);
      line.setAttribute("x2", x2px);
      line.setAttribute("y2", y2px);
      line.setAttribute("stroke", transportData[conn.type].color);
      line.setAttribute("stroke-width", "4");
      line.setAttribute("stroke-linecap", "round");
      line.style.cursor = "pointer";

      line.addEventListener("click", (e) => {
        e.stopPropagation();
        svg.querySelectorAll("line").forEach(l => l.setAttribute("stroke-width", "4"));
        line.setAttribute("stroke-width", "7");
        selectedConnection = { fromId: conn.fromId, toId: conn.toId, type: conn.type };
      });

      svg.appendChild(line);
    });

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle > 90 || angle < -90) angle += 180;

    const mx = (p1x_px + p2x_px) / 2;
    const my = (p1y_px + p2y_px) / 2;

    const labelPadding = -18; 
    const itemSpacing = 34;   
    const startOffset = -((types.length - 1) * itemSpacing) / 2;

    types.forEach((conn, index) => {
      const hOffset = startOffset + (index * itemSpacing);
      const finalX = mx + (perpX * labelPadding) + (dirX * hOffset);
      const finalY = my + (perpY * labelPadding) + (dirY * hOffset);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", finalX);
      text.setAttribute("y", finalY);
      text.setAttribute("transform", `rotate(${angle} ${finalX} ${finalY})`);
      text.setAttribute("fill", transportData[conn.type].color);
      text.setAttribute("font-size", "13");
      text.setAttribute("font-weight", "bold");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("paint-order", "stroke");
      text.setAttribute("stroke", "white");
      text.setAttribute("stroke-width", "4");
      text.setAttribute("stroke-linejoin", "round");
      
      text.textContent = conn.distance;
      svg.appendChild(text);
    });
  });
}

/* ==========================================================================
   7. PAN & ZOOM KANVAS PETA
   ========================================================================== */
mapContainer.addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();

  const rect = mapContainer.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const worldX = (mouseX - translateX) / scale;
  const worldY = (mouseY - translateY) / scale;

  scale = Math.min(Math.max(scale * (e.deltaY < 0 ? 1.1 : 0.9), 1), 5);
  translateX = mouseX - worldX * scale;
  translateY = mouseY - worldY * scale;

  clampPan();
  updateTransform();
}, { passive: false });

mapContainer.addEventListener("mousedown", (e) => {
  if (e.target.closest(".pin") || e.target.closest("input") || e.target.closest(".sidebar") || e.target.closest(".modal-popup") || e.target.closest(".dialog-card")) return;
  isDragging = true;
  startX = e.clientX - translateX;
  startY = e.clientY - translateY;
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  translateX = e.clientX - startX;
  translateY = e.clientY - startY;
  clampPan();
  updateTransform();
});

window.addEventListener("mouseup", () => isDragging = false);
window.addEventListener("resize", () => {
  clampPan();
  updateTransform();
});

/* ==========================================================================
   8. CARI & URUTKAN RUTE TERBAIK
   ========================================================================== */
function validateRouteInputs() {
  const fromName = fromInput.value.trim().toLowerCase();
  const toName = toInput.value.trim().toLowerCase();
  
  const isValidFrom = pins.some(p => p.name.toLowerCase() === fromName);
  const isValidTo = pins.some(p => p.name.toLowerCase() === toName);
  
  searchRouteBtn.disabled = !(isValidFrom && isValidTo);
}

fromInput.addEventListener("input", validateRouteInputs);
toInput.addEventListener("input", validateRouteInputs);

document.querySelectorAll(".sort-bar button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sort-bar button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    sortMode = btn.getAttribute("data-sort");
    if (!searchRouteBtn.disabled) searchRouteBtn.click(); 
  });
});

searchRouteBtn.addEventListener("click", () => {
  routeResults.innerHTML = "";
  const fromPin = pins.find(p => p.name.toLowerCase() === fromInput.value.trim().toLowerCase());
  const toPin = pins.find(p => p.name.toLowerCase() === toInput.value.trim().toLowerCase());

  if (!fromPin || !toPin) return;

  const routes = [];
  
  function dfs(currId, visited, path) {
    if (currId == toPin.id) { 
      routes.push([...path]); 
      return; 
    }
    const currNode = pins.find(p => p.id == currId);
    if (!currNode || !currNode.connections) return;

    for (const conn of currNode.connections) {
      if (visited.includes(conn.to)) continue;
      path.push(conn);
      dfs(conn.to, [...visited, conn.to], path);
      path.pop();
    }
  }
  
  dfs(fromPin.id, [fromPin.id], []);

  if (routes.length === 0) {
    routeResults.innerHTML = `<div style="text-align:center; color:#ef4444; font-size:13px; font-weight:bold; padding:10px;">Rute tidak ditemukan! Sambungkan pin terlebih dahulu.</div>`;
    return;
  }

  const dataRoutes = routes.map(path => {
    let time = 0, cost = 0;
    path.forEach(s => {
      time += (s.distance / transportData[s.type].speed) * 60;
      cost += s.distance * transportData[s.type].costPerKm;
    });
    return { path, time, cost };
  });

  dataRoutes.sort((a, b) => sortMode === "cheapest" ? a.cost - b.cost : a.time - b.time);

  dataRoutes.forEach((r, i) => {
    const stepStr = r.path.map(s => {
      const f = pins.find(p => p.id == s.from).name;
      const t = pins.find(p => p.id == s.to).name;
      const modeText = s.type === 'train' ? 'Kereta' : s.type === 'bus' ? 'Bus' : 'Pesawat';
      return `• <b>${f}</b> → <b>${t}</b> (${modeText}, ${s.distance}km)`;
    }).join("<br>");

    const div = document.createElement("div");
    div.className = "route-card";
    div.innerHTML = `
      <div class="route-title">Rute Alternatif ${i + 1}</div>
      <div style="color:#8b5cf6; font-weight:bold; margin:4px 0;">⏱ ${Math.round(r.time)} m | 💰 Rp ${r.cost.toLocaleString('id-ID')}</div>
      <div style="font-size:12px; color:#555; line-height:1.5;">${stepStr}</div>
    `;
    routeResults.appendChild(div);
  });
});

/* ==========================================================================
   9. KEYBOARD EVENT (DELETE JALUR)
   ========================================================================== */
window.addEventListener("keydown", (e) => {
  if ((e.key === "Delete" || e.key === "Backspace") && selectedConnection) {
    const { fromId, toId, type } = selectedConnection;
    const fPin = pins.find(p => p.id == fromId);
    const tPin = pins.find(p => p.id == toId);

    if (fPin && tPin) {
      fPin.connections = fPin.connections.filter(c => !(c.to == toId && c.type === type));
      tPin.connections = tPin.connections.filter(c => !(c.to == fromId && c.type === type));
      save();
      selectedConnection = null;
      drawLines();
      validateRouteInputs(); 
      if (!searchRouteBtn.disabled) searchRouteBtn.click();
    }
  }
});