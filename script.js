const mapContainer = document.getElementById("map-container");
const popup = document.getElementById("popup");
const input = document.getElementById("locationName");
const saveBtn = document.getElementById("saveBtn");
const svg = document.getElementById("line-layer");
const cancelBtn = document.getElementById("cancelBtn");

const connectPopup = document.getElementById("connectPopup");
const distanceInput = document.getElementById("distanceInput");
const transportSelect = document.getElementById("transportSelect");
const connectSaveBtn = document.getElementById("connectSaveBtn");
const connectCancelBtn = document.getElementById("connectCancelBtn");

let connectFrom = null;
let selectedConnection = null;

let tempX = 0;
let tempY = 0;

const transportData = {
  train: { color: "#33E339" },
  bus: { color: "#A83BE8" },
  plane: { color: "#000000" }
};

let pins = JSON.parse(localStorage.getItem("pins")) || [];

/* ======================
   LOAD DATA
====================== */
window.onload = () => {
  pins.forEach(renderPin);
  drawLines();
};

/* ======================
   DOUBLE CLICK TAMBAH PIN
====================== */
mapContainer.addEventListener("dblclick", (e) => {
  const rect = mapContainer.getBoundingClientRect();

  tempX = ((e.clientX - rect.left) / rect.width) * 100;
  tempY = ((e.clientY - rect.top) / rect.height) * 100;

  popup.classList.remove("hidden");
  input.value = "";
  input.focus();
});

/* ======================
   SAVE PIN
====================== */
saveBtn.onclick = savePin;

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") savePin();
});

cancelBtn.onclick = () => {
  popup.classList.add("hidden");
};

function savePin() {
  const name = input.value.trim();
  if (!name) return;

  const pin = {
    id: Date.now(),
    name,
    x: tempX,
    y: tempY,
    connections: []
  };

  pins.push(pin);
  save();
  renderPin(pin);

  popup.classList.add("hidden");
}

/* ======================
   RENDER PIN
====================== */
function renderPin(pin) {
  const div = document.createElement("div");
  div.className = "pin";
  div.style.left = pin.x + "%";
  div.style.top = pin.y + "%";
  div.dataset.id = pin.id;

 div.innerHTML = `
  <div class="pin-icon">📍</div>

  <div class="pin-label">
    ${pin.name}

    <div class="pin-actions">

      <img
        src="MdiTrashCanOutline.svg"
        class="action-icon"
        title="Hubungkan"
        onclick="connectPin(${pin.id})"
      >

      <img
        src="images/delete.png"
        class="action-icon"
        title="Hapus"
        onclick="deletePin(${pin.id})"
      >

    </div>
  </div>
`;

  // 🔥 PENTING: masuk ke map-content (bukan container)
  document.getElementById("map-content").appendChild(div);
}

/* ======================
   DELETE PIN
====================== */
function deletePin(id) {

  // hapus pin
  pins = pins.filter(p => p.id != id);

  // hapus semua koneksi menuju pin ini
  pins.forEach(pin => {

    pin.connections =
      (pin.connections || []).filter(
        conn => conn.to != id
      );
  });

  save();

  const el =
    document.querySelector(
      `[data-id='${id}']`
    );

  if (el) el.remove();

  drawLines();
}
/* ======================
   CONNECT MODE
====================== */
function connectPin(id) {
  connectFrom = id;

  document.querySelectorAll(".pin").forEach(p => {
    p.style.filter = "none";
  });

  const active = document.querySelector(`[data-id='${id}']`);
  if (active) {
    active.style.filter = "drop-shadow(0 0 10px yellow)";
  }
}

/* ======================
   CLICK TARGET + CONNECT
====================== */
mapContainer.addEventListener("click", (e) => {
  const target = e.target.closest(".pin");
  if (!target || !connectFrom) return;

  const fromPin = pins.find(p => p.id == connectFrom);
  const toPin = pins.find(p => p.id == target.dataset.id);

  if (!fromPin || !toPin || fromPin.id == toPin.id) return;

  connectPopup.classList.remove("hidden");

  connectSaveBtn.onclick = () => {
    const distance = parseFloat(distanceInput.value) || 0;
    const type = transportSelect.value;

  fromPin.connections.push({
  to: toPin.id,
  distance,
  type
});

// koneksi balik
toPin.connections.push({
  to: fromPin.id,
  distance,
  type
});

localStorage.clear();

    save();

    connectPopup.classList.add("hidden");
    connectFrom = null;

    drawLines();
  };

  connectCancelBtn.onclick = () => {
    connectPopup.classList.add("hidden");
    connectFrom = null;
  };
});

/* ======================
   DRAW LINES (FIX UTAMA)
====================== */
function drawLines() {
  svg.innerHTML = "";

  pins.forEach(from => {
    if (!Array.isArray(from.connections)) return;

    from.connections.forEach((conn, index) => {
      const to = pins.find(p => p.id == conn.to);
      if (!to) return;

      const dx = to.x - from.x;
      const dy = to.y - from.y;

      const length = Math.sqrt(dx * dx + dy * dy) || 1;

      // offset agar garis tidak bertumpuk
      const offset = (index - from.connections.length / 2) * 1.5;

      const perpX = -dy / length;
      const perpY = dx / length;

      // tetap persen
      const x1 = from.x + perpX * offset;
      const y1 = from.y + perpY * offset;

      const x2 = to.x + perpX * offset;
      const y2 = to.y + perpY * offset;

      const color = transportData[conn.type]?.color || "blue";

      // garis
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );

      line.setAttribute("x1", x1 + "%");
      line.setAttribute("y1", y1 + "%");
      line.setAttribute("x2", x2 + "%");
      line.setAttribute("y2", y2 + "%");

      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", "3");

      line.style.cursor = "pointer";

line.addEventListener("click", () => {

  // reset semua garis
  svg.querySelectorAll("line").forEach(l => {
    l.setAttribute("stroke-width", "3");
  });

  // garis aktif
  line.setAttribute("stroke-width", "6");

  selectedConnection = {
    fromId: from.id,
    toId: conn.to
  };
});

      svg.appendChild(line);

      // label
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      text.setAttribute("x", midX + "%");
      text.setAttribute("y", midY + "%");

      text.textContent = `${conn.distance || 0} km`;

      text.setAttribute("fill", color);
      text.setAttribute("font-size", "12");
      text.setAttribute("font-weight", "bold");

      svg.appendChild(text);
    });
  });
}
/* ======================
   SAVE LOCAL STORAGE
====================== */
function save() {
  localStorage.setItem("pins", JSON.stringify(pins));
}


const container = document.getElementById("map-content");
const content = document.getElementById("map-content");

let scale = 1;
let translateX = 0;
let translateY = 0;

let isDragging = false;
let startX = 0;
let startY = 0;

// function updateTransform() {
//   content.style.transform =
//     `translate(${translateX}px, ${translateY}px) scale(${scale})`;
// }
// =====================
// ZOOM (CTRL + SCROLL)
// =====================
container.addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return;

  e.preventDefault();

  const rect = container.getBoundingClientRect();

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const worldX = (mouseX - translateX) / scale;
  const worldY = (mouseY - translateY) / scale;

  const zoom = e.deltaY < 0 ? 1.1 : 0.9;

  const newScale = Math.min(Math.max(scale * zoom, 1), 5);

  translateX = mouseX - worldX * newScale;
  translateY = mouseY - worldY * newScale;

  scale = newScale;

  updateTransform();
}, { passive: false });
// =====================
// CTRL + / CTRL -
// =====================
window.addEventListener("keydown", (e) => {
  if (!e.ctrlKey) return;

  const rect = container.getBoundingClientRect();

  const mouseX = rect.width / 2;
  const mouseY = rect.height / 2;

  const worldX = (mouseX - translateX) / scale;
  const worldY = (mouseY - translateY) / scale;

  let newScale = scale;

  if (e.key === "+" || e.key === "=") {
    newScale = Math.min(scale * 1.1, 5);
  }

  if (e.key === "-") {
    newScale = Math.max(scale * 0.9, 1);
  }

  translateX = mouseX - worldX * newScale;
  translateY = mouseY - worldY * newScale;

  scale = newScale;

  updateTransform();
});
// =====================
// DRAG / PAN
// =====================
container.addEventListener("mousedown", (e) => {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  container.style.cursor = "grabbing";
});

window.addEventListener("mouseup", () => {
  isDragging = false;
  container.style.cursor = "grab";
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  translateX += dx;
  translateY += dy;

  startX = e.clientX;
  startY = e.clientY;

  updateTransform();
});

function clampPan() {
  const rect = container.getBoundingClientRect();

  const maxX = rect.width * (scale - 1);
  const maxY = rect.height * (scale - 1);

  translateX = Math.min(0, Math.max(translateX, -maxX));
  translateY = Math.min(0, Math.max(translateY, -maxY));
}

function updateTransform() {
  clampPan();

  content.style.transform =
    `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

updateTransform();

const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");

const searchRouteBtn =
  document.getElementById("searchRouteBtn");

const routeResults =
  document.getElementById("routeResults");

const sortType =
  document.getElementById("sortType");

/* =========================
   VALIDASI INPUT
========================= */

function validateRouteInputs() {

  const fromExists = pins.some(
    p => p.name.toLowerCase() ===
    fromInput.value.toLowerCase()
  );

  const toExists = pins.some(
    p => p.name.toLowerCase() ===
    toInput.value.toLowerCase()
  );

  searchRouteBtn.disabled =
    !(fromExists && toExists);
}

fromInput.addEventListener(
  "input",
  validateRouteInputs
);

toInput.addEventListener(
  "input",
  validateRouteInputs
);


searchRouteBtn.addEventListener("click", () => {

  routeResults.innerHTML = "";

  const fromName = fromInput.value.toLowerCase();
  const toName = toInput.value.toLowerCase();

  const fromPin = pins.find(
    p => p.name.toLowerCase() === fromName
  );

  const toPin = pins.find(
    p => p.name.toLowerCase() === toName
  );

  if (!fromPin || !toPin) {
    routeResults.innerHTML = "Lokasi tidak ditemukan";
    return;
  }

  // ======================
  // DIJKSTRA SEDERHANA
  // ======================

  let distances = {};
  let previous = {};
  let visited = [];

  pins.forEach(pin => {
    distances[pin.id] = Infinity;
    previous[pin.id] = null;
  });

  distances[fromPin.id] = 0;

  while (visited.length < pins.length) {

    let current = null;

    pins.forEach(pin => {
      if (
        !visited.includes(pin.id) &&
        (
          current === null ||
          distances[pin.id] < distances[current]
        )
      ) {
        current = pin.id;
      }
    });

    if (current === null) break;

    visited.push(current);

    const currentPin =
  pins.find(p => p.id == current);

(currentPin.connections || []).forEach(conn => {

  const newDistance =
    distances[current] + conn.distance;

  if (newDistance < distances[conn.to]) {

    distances[conn.to] = newDistance;

    previous[conn.to] = {
      from: current,
      type: conn.type,
      distance: conn.distance
    };
  }
});
  }

  // ======================
  // BANGUN RUTE
  // ======================

  let path = [];
  let current = toPin.id;

  while (current !== fromPin.id) {

    const prev = previous[current];

    if (!prev) {
      routeResults.innerHTML =
        "Rute tidak ditemukan";
      return;
    }

    path.unshift({
      from: prev.from,
      to: current,
      type: prev.type,
      distance: prev.distance
    });

    current = prev.from;
  }

  // ======================
  // HITUNG TOTAL
  // ======================

  let totalDistance = 0;
  let totalDuration = 0;
  let totalCost = 0;

  let steps = [];

  path.forEach(step => {

    const from =
      pins.find(p => p.id == step.from);

    const to =
      pins.find(p => p.id == step.to);

    totalDistance += step.distance;

    const speed =
      step.type === "plane"
      ? 800
      : step.type === "train"
      ? 120
      : 60;

    const duration =
      (step.distance / speed) * 60;

    totalDuration += duration;

    const cost =
      step.distance *
      (
        step.type === "plane"
        ? 5
        : step.type === "train"
        ? 2
        : 1
      );

    totalCost += cost;

    steps.push(
      `${from.name} → ${to.name}
       (${step.type} ${step.distance} km)`
    );
  });

  // ======================
  // TAMPILKAN
  // ======================

  const div = document.createElement("div");

  div.className = "route-card";

  div.innerHTML = `
    <div class="route-title">
      ${fromPin.name} → ${toPin.name}
    </div>

    <div class="route-info">
      📏 Jarak:
      ${totalDistance} km
    </div>

    <div class="route-info">
      ⏱ Durasi:
      ${totalDuration.toFixed(1)} menit
    </div>

    <div class="route-info">
      💰 Total Biaya:
      Rp ${totalCost.toFixed(0)}
    </div>

    <div class="route-step">
      ${steps.join("<br>")}
    </div>
  `;

  routeResults.appendChild(div);

});


window.addEventListener("keydown", (e) => {

  if (
    e.key !== "Delete" &&
    e.key !== "Backspace"
  ) return;

  if (!selectedConnection) return;

  const fromPin =
    pins.find(
      p => p.id == selectedConnection.fromId
    );

  if (!fromPin) return;

  fromPin.connections =
    (fromPin.connections || []).filter(
      conn => conn.to != selectedConnection.toId
    );

  // hapus koneksi balik juga
  const toPin =
    pins.find(
      p => p.id == selectedConnection.toId
    );

  if (toPin) {

    toPin.connections =
      (toPin.connections || []).filter(
        conn => conn.to != selectedConnection.fromId
      );
  }

  selectedConnection = null;

  save();

  drawLines();
});