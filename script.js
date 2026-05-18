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

let popupX = 0;
let popupY = 0;

let tempX = 0;
let tempY = 0;

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

  const rect =
    mapContainer.getBoundingClientRect();

  tempX =
    ((e.clientX - rect.left) / rect.width) * 100;

  tempY =
    ((e.clientY - rect.top) / rect.height) * 100;

  popup.classList.remove("hidden");

  input.value = "";

  // posisi popup dekat klik
  let popupX = e.clientX + 10;
  let popupY = e.clientY - 20;

  const popupWidth = 260;
  const popupHeight = 140;
  const margin = 20;

  // kanan
  if (
    popupX + popupWidth >
    window.innerWidth - margin
  ) {
    popupX =
      window.innerWidth - popupWidth - margin;
  }

  // bawah
  if (
    popupY + popupHeight >
    window.innerHeight - margin
  ) {
    popupY =
      window.innerHeight - popupHeight - margin;
  }

  // kiri
  if (popupX < margin) {
    popupX = margin;
  }

  // atas
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
/* ======================
   SAVE PIN
====================== */

input.addEventListener("keypress", (e) => {

  if (e.key === "Enter") {
    savePin();
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

document.querySelectorAll(".sort button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sort button")
      .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");

    sortMode = btn.textContent.toLowerCase();
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

    <div class="pin-icon"></div>

    <div class="pin-label">

      ${pin.name}

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

  pins.forEach(from => {

    if (!Array.isArray(from.connections)) return;

    from.connections.forEach(conn => {

     const key =
  [from.id, conn.to]
  .sort()
  .join("-") + "-" + conn.type;

      // hanya gambar sekali
      if (drawn.has(key)) return;

      drawn.add(key);

      const to =
        pins.find(p => p.id == conn.to);

      if (!to) return;

      const color =
        transportData[conn.type]?.color || "blue";

      // GARIS
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );

    const dx = to.x - from.x;
const dy = to.y - from.y;

const length =
  Math.sqrt(dx * dx + dy * dy) || 1;

let offset = 0;

if (conn.type === "train") {
  offset = -1.2;
}

if (conn.type === "bus") {
  offset = 0;
}

if (conn.type === "plane") {
  offset = 1.2;
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

line.setAttribute("x1", x1 + "%");
line.setAttribute("y1", y1 + "%");

      line.setAttribute("x2", to.x + "%");
      line.setAttribute("y2", to.y + "%");

      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", "4");

      line.style.cursor = "pointer";
      line.style.pointerEvents = "auto";

      line.addEventListener("click", () => {

        svg.querySelectorAll("line")
        .forEach(l => {
          l.setAttribute("stroke-width", "4");
        });

        line.setAttribute("stroke-width", "7");

        selectedConnection = {
          fromId: from.id,
          toId: conn.to
        };
      });

      svg.appendChild(line);

      // TEXT
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );

     const midX = (x1 + x2) / 2;
const midY = (y1 + y2) / 2;

      text.setAttribute("x", midX + "%");
      text.setAttribute("y", midY + "%");

      text.setAttribute("fill", color);
      text.setAttribute("font-size", "14");
      text.setAttribute("font-weight", "bold");

      text.textContent =
        `${conn.distance} km`;

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

// let isDragging = false;
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

function clampPan() {
  const rect = container.getBoundingClientRect();

  const maxX = rect.width * (scale - 1);
  const maxY = rect.height * (scale - 1);

  translateX = Math.min(0, Math.max(translateX, -maxX));
  translateY = Math.min(0, Math.max(translateY, -maxY));
}

function updateTransform() {
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

function findAllRoutes(startId, endId, maxRoutes = 10) {
  const results = [];

  function dfs(current, visited, path, totalDistance, totalType) {
    if (results.length >= maxRoutes) return;

    if (current == endId) {
      results.push({
        path: [...path],
        distance: totalDistance
      });
      return;
    }

    const pin = pins.find(p => p.id == current);
    if (!pin) return;

    for (let conn of pin.connections || []) {
      if (visited.includes(conn.to)) continue;

      visited.push(conn.to);
     path.push({
  from: current,
  to: conn.to,
  distance: conn.distance,
  type: conn.type
});

      dfs(
        conn.to,
        visited,
        path,
        totalDistance + conn.distance
      );

      visited.pop();
      path.pop();
    }
  }

  dfs(startId, [startId], [], 0);

  return results;
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

  const fromName = fromInput.value.trim().toLowerCase();
  const toName = toInput.value.trim().toLowerCase();

  const fromPin = pins.find(
    p => p.name.toLowerCase() === fromName
  );

  const toPin = pins.find(
    p => p.name.toLowerCase() === toName
  );

  console.log(fromPin, toPin);

  if (!fromPin || !toPin) return;

  const routes = findAllRoutes(fromPin.id, toPin.id, 10);

  const enriched = routes.map(r => {

    let totalTime = 0;
    let totalCost = 0;

    r.path.forEach(step => {

      const speed =
        step.type === "plane" ? 800 :
        step.type === "train" ? 120 : 60;

      const cost =
        step.distance *
        (step.type === "plane" ? 5 :
         step.type === "train" ? 2 : 1);

      totalTime += (step.distance / speed) * 60;
      totalCost += cost;
    });

    return {
      ...r,
      time: totalTime,
      cost: totalCost
    };
  });

  enriched.sort((a, b) => {
    return sortMode === "cheapest"
      ? a.cost - b.cost
      : a.time - b.time;
  });

  const top10 = enriched.slice(0, 10);

  if (top10.length === 0) {
    routeResults.innerHTML = "Rute tidak ditemukan";
    return;
  }

  top10.forEach((r, index) => {

    const stepsHTML = r.path.map(step => {
      const from = pins.find(p => p.id == step.from);
      const to = pins.find(p => p.id == step.to);

      if (!from || !to) return "";

      return `
        ${from.name} → ${to.name}
        (${step.type}, ${step.distance} km)
      `;
    }).join("<br>");

    const div = document.createElement("div");
    div.className = "route-card";

    div.innerHTML = `
      <div class="route-title">
        Rute ${index + 1}
      </div>

      <div class="route-info">
        ⏱ Durasi: ${r.time.toFixed(1)} menit
      </div>

      <div class="route-info">
        💰 Biaya: Rp ${r.cost.toFixed(0)}
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

    const fromPin = pins.find(
      p => p.id == selectedConnection.fromId
    );

    const toPin = pins.find(
      p => p.id == selectedConnection.toId
    );

    if (!fromPin || !toPin) return;

    fromPin.connections =
      (fromPin.connections || []).filter(
        conn => conn.to != selectedConnection.toId
      );

    toPin.connections =
      (toPin.connections || []).filter(
        conn => conn.to != selectedConnection.fromId
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

  updateTransform();
});