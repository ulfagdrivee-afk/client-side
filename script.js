const mapContainer = document.getElementById("map-container");
const popup = document.getElementById("popup");
const input = document.getElementById("locationName");
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

// localStorage.clear();
let sortMode = "fastest";

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
 popup.classList.add("hidden");
mapContainer.addEventListener("dblclick", (e) => {

  const rect = mapContainer.getBoundingClientRect();

  // posisi mouse relatif terhadap container
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // konversi ke koordinat map asli       
  const worldX = (mouseX - translateX) / scale;
  const worldY = (mouseY - translateY) / scale;

  tempX = (worldX / rect.width) * 100;
  tempY = (worldY / rect.height) * 100;

  popup.classList.remove("hidden");

  input.value = "";

  let popupX = e.clientX + 10;
  let popupY = e.clientY - 20;

  const popupWidth = 260;
  const popupHeight = 140;
  const margin = 20;

  if (popupX + popupWidth > window.innerWidth - margin) {
    popupX = window.innerWidth - popupWidth - margin;
  }

  if (popupY + popupHeight > window.innerHeight - margin) {
    popupY = window.innerHeight - popupHeight - margin;
  }

  if (popupX < margin) {
    popupX = margin;
  }

  if (popupY < margin) {
    popupY = margin;
  }

  popup.style.left = popupX + "px";
  popup.style.top = popupY + "px";

  popup.style.transform = "none";

  input.focus();
});
/* ENTER INPUT */
input.addEventListener("keypress", (e) => {

  if (e.key === "Enter") {

    savePin();

    popup.classList.add("hidden");
  }
});
/* CLOSE */
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

const sortButtons = document.querySelectorAll(".sort-bar button");

sortButtons.forEach(btn => {
  btn.addEventListener("click", () => {

    sortButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    sortMode = btn.getAttribute("data-sort") || "fastest";

    console.log("SORT MODE CHANGED:", sortMode);

    // 🔥 WAJIB: paksa trigger ulang search
    searchRouteBtn.click();
  });
});

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

    <div class="pin-wrapper">

      <!-- BOX ATAS -->
      <div class="pin-label">

        <div class="pin-top">

          <span class="pin-name">
            ${pin.name}
          </span>

          <div class="pin-actions">

            <img
              src="MdiTransitConnectionVariant.svg"
              class="action-icon"
              onclick="connectPin(${pin.id})"
            >

            <img
              src="MdiTrashCanOutline.svg"
              class="action-icon"
              onclick="deletePin(${pin.id})"
            >

          </div>

        </div>

      </div>

      <!-- GAMBAR PINPOINT -->
      <div class="pin-icon"></div>

    </div>
  `;

  document
    .getElementById("map-content")
    .appendChild(div);
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
      conn => pins.some(p => p.id == conn.to)
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
    from: fromPin.id,
    to: toPin.id,
    distance,
    type
  });

  toPin.connections.push({
    from: toPin.id,
    to: fromPin.id,
    distance,
    type
  });

  console.log(pins);

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

  const drawn = new Set();

  const mapRect =
    mapContainer.getBoundingClientRect();

  pins.forEach(from => {

    if (!Array.isArray(from.connections)) return;

    from.connections.forEach(conn => {

      const key =
        [from.id, conn.to]
        .sort()
        .join("-") + "-" + conn.type;

      if (drawn.has(key)) return;

      drawn.add(key);

      const to =
        pins.find(p => p.id == conn.to);

      if (!to) return;

      const color =
        transportData[conn.type]?.color || "blue";

      // =========================
      // HITUNG POSISI ASLI
      // =========================

      const dx = to.x - from.x;
      const dy = to.y - from.y;

      const length =
        Math.sqrt(dx * dx + dy * dy) || 1;

      let offset = 0;
      const spacing = 1.5;

      if (conn.type === "train") {
        offset = -spacing;
      }

      if (conn.type === "bus") {
        offset = 0;
      }

      if (conn.type === "plane") {
        offset = spacing;
      }

      const perpX = -dy / length;
      const perpY = dx / length;

      const x1 =
        from.x + perpX * offset;

      const y1 =
        from.y + perpY * offset;

      const x2 =
        to.x + perpX * offset;

      const y2 =
        to.y + perpY * offset;

      // =========================
      // KONVERSI KE PIXEL
      // =========================

      const x1px =
        (x1 / 100) * mapRect.width;

      const y1px =
        (y1 / 100) * mapRect.height;

      const x2px =
        (x2 / 100) * mapRect.width;

      const y2px =
        (y2 / 100) * mapRect.height;

      // =========================
      // GARIS
      // =========================

      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );

      line.setAttribute("x1", x1px);
      line.setAttribute("y1", y1px);

      line.setAttribute("x2", x2px);
      line.setAttribute("y2", y2px);

      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", "4");

      line.style.cursor = "pointer";

      // =========================
      // CLICK SELECT
      // =========================

      line.addEventListener("click", () => {

        svg.querySelectorAll("line")
          .forEach(l =>
            l.setAttribute("stroke-width", "4")
          );

        line.setAttribute("stroke-width", "7");

        selectedConnection = {
          fromId: from.id,
          toId: conn.to,
          type: conn.type
        };
      });

      svg.appendChild(line);

      // =========================
      // TEXT JARAK
      // =========================

      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );

      // midpoint
      const mx = (x1px + x2px) / 2;
      const my = (y1px + y2px) / 2;

      // normal vector
      const vx = x2px - x1px;
      const vy = y2px - y1px;

      const len =
        Math.sqrt(vx * vx + vy * vy) || 1;

      const nx = -vy / len;
      const ny = vx / len;

      // offset text
      const labelOffset = 30;

      const labelX =
        mx + nx * labelOffset;

      const labelY =
        my + ny * labelOffset;

      text.setAttribute("x", labelX);
      text.setAttribute("y", labelY);

      // rotate text
      let angle =
        Math.atan2(vy, vx) * 180 / Math.PI;

      // supaya text tidak terbalik
      if (angle > 90 || angle < -90) {
        angle += 180;
      }

      text.setAttribute(
        "transform",
        `rotate(${angle} ${labelX} ${labelY})`
      );

      // style
      text.setAttribute("fill", color);
      text.setAttribute("font-size", "12");
      text.setAttribute("font-weight", "bold");

      text.setAttribute("text-anchor", "middle");

      text.setAttribute(
        "dominant-baseline",
        "middle"
      );

      text.style.pointerEvents = "none";

      text.textContent =
        `${conn.distance} km`;
      svg.appendChild(line);
      svg.appendChild(text);

    });
  });
}function drawLines() {

  svg.innerHTML = "";

  const drawn = new Set();

  const mapRect =
    mapContainer.getBoundingClientRect();

  pins.forEach(from => {

    if (!Array.isArray(from.connections)) return;

    from.connections.forEach(conn => {

      const key =
        [from.id, conn.to]
        .sort()
        .join("-") + "-" + conn.type;

      if (drawn.has(key)) return;

      drawn.add(key);

      const to =
        pins.find(p => p.id == conn.to);

      if (!to) return;

      const color =
        transportData[conn.type]?.color || "blue";

      // =========================
      // HITUNG POSISI ASLI
      // =========================

      const dx = to.x - from.x;
      const dy = to.y - from.y;

      const length =
        Math.sqrt(dx * dx + dy * dy) || 1;

      let offset = 0;
      const spacing = 1.5;

      if (conn.type === "train") {
        offset = -spacing;
      }

      if (conn.type === "bus") {
        offset = 0;
      }

      if (conn.type === "plane") {
        offset = spacing;
      }

      const perpX = -dy / length;
      const perpY = dx / length;

      const x1 =
        from.x + perpX * offset;

      const y1 =
        from.y + perpY * offset;

      const x2 =
        to.x + perpX * offset;

      const y2 =
        to.y + perpY * offset;

      // =========================
      // KONVERSI KE PIXEL
      // =========================

      const x1px =
        (x1 / 100) * mapRect.width;

      const y1px =
        (y1 / 100) * mapRect.height;

      const x2px =
        (x2 / 100) * mapRect.width;

      const y2px =
        (y2 / 100) * mapRect.height;

      // =========================
      // GARIS
      // =========================

      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );

      line.setAttribute("x1", x1px);
      line.setAttribute("y1", y1px);

      line.setAttribute("x2", x2px);
      line.setAttribute("y2", y2px);

      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", "4");
      line.setAttribute("stroke-linecap", "round");

      line.style.cursor = "pointer";

      // =========================
      // CLICK SELECT
      // =========================

      line.addEventListener("click", () => {

        svg.querySelectorAll("line")
          .forEach(l =>
            l.setAttribute("stroke-width", "4")
          );

        line.setAttribute("stroke-width", "7");

        selectedConnection = {
          fromId: from.id,
          toId: conn.to,
          type: conn.type
        };
      });

      svg.appendChild(line);

// =========================
// TEXT JARAK
// =========================

const mx = (x1px + x2px) / 2;
const my = (y1px + y2px) / 2;

const vx = x2px - x1px;
const vy = y2px - y1px;

const len = Math.sqrt(vx * vx + vy * vy) || 1;

// sudut garis
let angle =
  Math.atan2(vy, vx) * 180 / Math.PI;

// supaya text tidak terbalik
if (angle > 90 || angle < -90) {
  angle += 180;
}

// =========================
// OFFSET MENYAMPING
// =========================

let sideOffset = 0;

// hijau kiri
if (conn.type === "train") {
  sideOffset = -40;
}

// ungu tengah
if (conn.type === "bus") {
  sideOffset = 0;
}

// hitam kanan
if (conn.type === "plane") {
  sideOffset = 40;
}

// posisi mengikuti arah garis
const tx = mx + (vx / len) * sideOffset;
const ty = my + (vy / len) * sideOffset;

// sedikit naik di atas garis
const nx = -vy / len;
const ny = vx / len;

const finalX = tx + nx * -18;
const finalY = ty + ny * -18;

// =========================
// BUAT TEXT
// =========================

const text = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "text"
);

text.setAttribute("x", finalX);
text.setAttribute("y", finalY);

text.setAttribute(
  "transform",
  `rotate(${angle} ${finalX} ${finalY})`
);

text.setAttribute("fill", color);

text.setAttribute("font-size", "14");

text.setAttribute("font-weight", "bold");

text.setAttribute("text-anchor", "middle");

text.setAttribute(
  "dominant-baseline",
  "middle"
);

// outline putih biar jelas
text.setAttribute("paint-order", "stroke");

text.setAttribute("stroke", "white");

text.setAttribute("stroke-width", "4");

text.setAttribute("stroke-linejoin", "round");

text.style.pointerEvents = "none";

text.textContent = conn.distance;

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
  clampPan();
  updateTransform();
}, { passive: false });

function clampPan() {

  const rect = container.getBoundingClientRect();

  const scaledWidth = rect.width * scale;
  const scaledHeight = rect.height * scale;

  const minX = rect.width - scaledWidth;
  const minY = rect.height - scaledHeight;

  translateX = Math.min(0, Math.max(translateX, minX));
  translateY = Math.min(0, Math.max(translateY, minY));
}

function updateTransform() {

  content.style.transform =
    `translate(${translateX}px, ${translateY}px) scale(${scale})`;

  drawLines();
}

updateTransform();

const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");

const searchRouteBtn =
  document.getElementById("searchRouteBtn");

const routeResults =
  document.getElementById("routeResults");

/* =========================
   VALIDASI INPUT
========================= */

function findAllRoutes(startId, endId, maxRoutes = 10) {

  const routes = [];

  function dfs(currentId, visited, path) {

    // kalau sudah cukup
    if (routes.length >= maxRoutes) return;

    // sampai tujuan
    if (currentId == endId) {

      routes.push({
        path: [...path]
      });

      return;
    }

    const currentPin =
      pins.find(p => p.id == currentId);

    if (!currentPin) return;

    for (const conn of currentPin.connections || []) {

      // hindari loop
      if (visited.includes(conn.to)) {
        continue;
      }

    dfs(conn.to, [...visited, conn.to], [...path, {
  from: currentId,
  to: conn.to,
  distance: Number(conn.distance),
  type: conn.type
}]);
    }
  }

  dfs(startId, [startId], []);

  return routes;
}



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

  const fromName =
    fromInput.value.trim().toLowerCase();

  const toName =
    toInput.value.trim().toLowerCase();

  const fromPin = pins.find(
    p => p.name.toLowerCase() === fromName
  );

  const toPin = pins.find(
    p => p.name.toLowerCase() === toName
  );

  console.log(fromPin, toPin);

  if (!fromPin || !toPin) {
    routeResults.innerHTML = `
      <div class="route-card">
        Pin tidak ditemukan
      </div>
    `;
    return;
  }

  // ======================
  // CARI SEMUA RUTE
  // ======================
  const routes =
    findAllRoutes(fromPin.id, toPin.id, 10);

  // ======================
  // TIDAK ADA RUTE
  // ======================
  if (routes.length === 0) {

    routeResults.innerHTML = `
      <div class="route-card">
        Rute tidak ditemukan
      </div>
    `;

    return;
  }

  // ======================
  // HITUNG WAKTU + BIAYA
  // ======================
  const enriched = routes.map(r => {

    let totalTime = 0;
    let totalCost = 0;

    r.path.forEach(step => {



const transportInfo = {
  train: {
    speed: 120,      // km/jam
    costPerKm: 500,  // Rp/km
    color: "#33E339"
  },

  bus: {
    speed: 80,
    costPerKm: 100,
    color: "#A83BE8"
  },

  plane: {
    speed: 800,
    costPerKm: 1000,
    color: "#000000"
  }
};

const info = transportInfo[step.type];

// waktu dalam menit
totalTime += (step.distance / info.speed) * 60;

// biaya
totalCost += step.distance * info.costPerKm;
  
    });

    return {
      ...r,
      time: totalTime,
      cost: totalCost
    };
  });
console.log("ENRICHED ROUTES:");
console.table(enriched.map(r => ({
  time: r.time,
  cost: r.cost
})));
  // ======================
  // SORT
  // ======================
enriched.sort((a, b) => {
  if (sortMode === "cheapest") {
    if (a.cost === b.cost) {
      return a.time - b.time;
    }
    return a.cost - b.cost;
  }

  // FASTEST
  if (a.time === b.time) {
    return a.cost - b.cost;
  }

  return a.time - b.time;
});
  // ======================
  // AMBIL 10 TERBAIK
  // ======================
  const top10 = enriched.slice(0, 10);

  // ======================
  // RENDER
  // ======================
  top10.forEach((r, index) => {

    const stepsHTML = r.path.map(step => {

      const from =
        pins.find(p => p.id == step.from);

      const to =
        pins.find(p => p.id == step.to);

      if (!from || !to) return "";

      return `
        ${from.name} → ${to.name}
        (${step.type}, ${step.distance} km)
      `;
    }).join("<br>");

    const div =
      document.createElement("div");

    div.className = "route-card";

    div.innerHTML = `
      <div class="route-title">
        Rute ${index + 1}
      </div>

      <div class="route-info">
        ⏱ ${(r.time / 60).toFixed(1)} jam
      </div>

      <div class="route-info">
        💰 Rp${r.cost.toLocaleString("id-ID")}
      </div>

      <div class="route-step">
        ${stepsHTML}
      </div>
    `;

    routeResults.appendChild(div);
  });

});

window.addEventListener("keydown", (e) => {
  // =========================
  // DELETE CONNECTION (1 KEYDOWN SAJA)
  // =========================
if (e.key === "Delete" || e.key === "Backspace") {
  if (!selectedConnection) return;

  const { fromId, toId, type } = selectedConnection;

  const fromPin = pins.find(p => p.id == fromId);
  const toPin = pins.find(p => p.id == toId);

  if (!fromPin || !toPin) return;

  // HAPUS HANYA 1 GARIS YANG MATCH SEMUA KRITERIA
  fromPin.connections = (fromPin.connections || []).filter(conn =>
    !(conn.to == toId && conn.type == type)
  );

  toPin.connections = (toPin.connections || []).filter(conn =>
    !(conn.to == fromId && conn.type == type)
  );

  selectedConnection = null;

  save();
  drawLines();
}
  // =========================
  // ZOOM KEYBOARD
  // =========================
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
  clampPan();
  updateTransform();

  
});

/* =====================
   DRAG / PAN MAP
===================== */

container.addEventListener("mousedown", (e) => {

  // hanya bisa drag kalau zoom > 1
  if (scale <= 1) return;

  isDragging = true;

  startX = e.clientX - translateX;
  startY = e.clientY - translateY;

  container.style.cursor = "grabbing";
});

window.addEventListener("mousemove", (e) => {

  if (!isDragging) return;

  translateX = e.clientX - startX;
  translateY = e.clientY - startY;

  clampPan();
  updateTransform();
});

window.addEventListener("mouseup", () => {

  isDragging = false;

  container.style.cursor = "grab";
});