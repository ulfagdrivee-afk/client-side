/* ==========================================================================

   1. DEKLARASI ELEMEN DOM & STATE UTAMA

   ========================================================================== */

const mapContainer = document.getElementById("map-container");

const content = document.getElementById("map-content");

const svg = document.getElementById("line-layer");



// Popup Tambah Pin

const popup = document.getElementById("popup");

const input = document.getElementById("locationName");

const cancelBtn = document.getElementById("cancelBtn");



// Popup Koneksi

const connectPopup = document.getElementById("connectPopup");

const distanceInput = document.getElementById("distanceInput");

const transportSelect = document.getElementById("transportSelect");

const connectSaveBtn = document.getElementById("connectSaveBtn");

const connectCancelBtn = document.getElementById("connectCancelBtn");



// Panel Cari Rute

const fromInput = document.getElementById("fromInput");

const toInput = document.getElementById("toInput");

const searchRouteBtn = document.getElementById("searchRouteBtn");

const routeResults = document.getElementById("routeResults");



// State Global Aplikasi

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



// Data Spesifikasi Transportasi

const transportData = {

  train: { color: "#33E339", speed: 120, costPerKm: 500 },

  bus: { color: "#A83BE8", speed: 80, costPerKm: 100 },

  plane: { color: "#000000", speed: 800, costPerKm: 1000 }

};



let pins = JSON.parse(localStorage.getItem("pins")) || [];



/* ==========================================================================

   2. FUNGSI UTILITY (SAVE & TRANSFORM)

   ========================================================================== */

function save() {

  localStorage.setItem("pins", JSON.stringify(pins));

}



function updateTransform() {

  content.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

}



function clampPan() {

  const rect = mapContainer.getBoundingClientRect();

  const scaledWidth = rect.width * scale;

  const scaledHeight = rect.height * scale;



  const minX = rect.width - scaledWidth;

  const minY = rect.height - scaledHeight;



  translateX = Math.min(0, Math.max(translateX, minX));

  translateY = Math.min(0, Math.max(translateY, minY));

}



/* ==========================================================================

   3. INISIALISASI HALAMAN (ONLOAD)

   ========================================================================== */

window.onload = () => {

  pins.forEach(renderPin);

  drawLines();

  updateTransform();

  validateRouteInputs();

};



/* ==========================================================================

   4. FITUR: TAMBAH PINPOINT (DOUBLE CLICK)

   ========================================================================== */

mapContainer.addEventListener("dblclick", (e) => {

  // Cegah pin baru terbentuk jika klik ganda dilakukan di dalam elemen UI/Modal

  if (

    e.target.closest(".pin") ||

    e.target.closest(".sidebar") ||

    e.target.closest("#popup") ||

    e.target.closest("#connectPopup") ||

    e.target.closest(".dialog-card") ||

    e.target.closest(".modal-popup")

  ) return;



  const rect = content.getBoundingClientRect();



  // Menghitung koordinat relatif terhadap canvas tanpa pengaruh distorsi zoom skala

  const mouseX = e.clientX - rect.left;

  const mouseY = e.clientY - rect.top;



  const worldX = mouseX / scale;

  const worldY = mouseY / scale;



  const originalWidth = content.clientWidth;

  const originalHeight = content.clientHeight;



  tempX = (worldX / originalWidth) * 100;

  tempY = (worldY / originalHeight) * 100;



  popup.classList.remove("hidden");

  input.value = "";

  input.focus();



  let popupX = e.clientX + 10;

  let popupY = e.clientY - 20;

  const popupWidth = 260;

  const popupHeight = 140;

  const margin = 20;



  if (popupX + popupWidth > window.innerWidth - margin) popupX = window.innerWidth - popupWidth - margin;

  if (popupY + popupHeight > window.innerHeight - margin) popupY = window.innerHeight - popupHeight - margin;

  if (popupX < margin) popupX = margin;

  if (popupY < margin) popupY = margin;



  popup.style.left = `${popupX}px`;

  popup.style.top = `${popupY}px`;

  popup.style.transform = "none";

});



input.addEventListener("keypress", (e) => {

  if (e.key === "Enter") {

    savePin();

  }

});



cancelBtn.onclick = () => {

  popup.classList.add("hidden");

};



function savePin() {

  const name = input.value.trim();

  if (!name) return;



  const pin = {

    id: Date.now(),

    name: name,

    x: tempX,

    y: tempY,

    connections: []

  };



  pins.push(pin);

  save();

  renderPin(pin);

  validateRouteInputs();



  popup.classList.add("hidden");

}



/* ==========================================================================

   5. FITUR: RENDER & HAPUS PINPOINT

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

        <div class="pin-top">

          <span class="pin-name">${pin.name}</span>

          <div class="pin-actions">

            <button class="action-btn connect-btn-trigger" title="Hubungkan Lokasi" style="background:none; border:none; cursor:pointer;">🔗</button>

            <button class="action-btn delete-btn-trigger" title="Hapus Pinpoint" style="background:none; border:none; cursor:pointer;">🗑️</button>

          </div>

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

  pins.forEach(pin => {

    pin.connections = (pin.connections || []).filter(conn => conn.to != id);

  });



  save();



  const el = document.querySelector(`[data-id='${id}']`);

  if (el) el.remove();



  drawLines();

  validateRouteInputs();

}



/* ==========================================================================

   6. FITUR: MENGHUBUNGKAN LOKASI (SAMBUNG PIN)

   ========================================================================== */

function connectPin(id) {

  connectFrom = id;

  document.querySelectorAll(".pin").forEach(p => p.classList.remove("connecting-glow"));



  const activePinEl = document.querySelector(`[data-id='${id}']`);

  if (activePinEl) {

    activePinEl.classList.add("connecting-glow");

  }

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

  distanceInput.focus();

});



connectSaveBtn.onclick = () => {

  if (!connectFrom || !currentToPin) return;



  const fromPin = pins.find(p => p.id == connectFrom);

  const distance = parseFloat(distanceInput.value) || 0;

  const type = transportSelect.value;



  if (distance <= 0) {

    alert("Mohon masukkan jarak yang valid (lebih dari 0 km)!");

    return;

  }



  const isDuplicate = fromPin.connections.some(c => c.to == currentToPin.id && c.type === type);

  if (isDuplicate) {

    alert(`Koneksi dengan moda transportasi ${type} sudah terdaftar di antara kedua titik ini!`);

    return;

  }



  fromPin.connections.push({ from: fromPin.id, to: currentToPin.id, distance, type });

  currentToPin.connections.push({ from: currentToPin.id, to: fromPin.id, distance, type });



  save();

  connectPopup.classList.add("hidden");



  connectFrom = null;

  currentToPin = null;

  document.querySelectorAll(".pin").forEach(p => p.classList.remove("connecting-glow"));



  drawLines();

};



connectCancelBtn.onclick = () => {

  connectPopup.classList.add("hidden");

  connectFrom = null;

  currentToPin = null;

  document.querySelectorAll(".pin").forEach(p => p.classList.remove("connecting-glow"));

};



/* ==========================================================================

   7. FITUR: RENDER MULTI-LINE SVG & TEKS JARAK PARALEL SINKRON

   ========================================================================== */

function drawLines() {

  svg.innerHTML = "";

  const drawnPairs = new Set();

 

  // Menggunakan dimensi dasar konstan (clientWidth/Height) agar garis tidak melenceng saat di-zoom

  const mapWidth = content.clientWidth;

  const mapHeight = content.clientHeight;



  pins.forEach(from => {

    if (!from.connections) return;



    from.connections.forEach(conn => {

      const key = [from.id, conn.to].sort().join("-") + "-" + conn.type;

      if (drawnPairs.has(key)) return;

      drawnPairs.add(key);



      const to = pins.find(p => p.id == conn.to);

      if (!to) return;



      const color = transportData[conn.type]?.color || "#000000";



      // Normalisasi Arah (Selalu hitung dari kiri ke kanan agar konstan)

      let p1 = from, p2 = to;

      if (from.x > to.x) {

        p1 = to;

        p2 = from;

      }



      const dx = p2.x - p1.x;

      const dy = p2.y - p1.y;

      const length = Math.sqrt(dx * dx + dy * dy) || 1;



      // Spacing jarak sumbu paralel rute bertumpuk (12px)

      let offset = 0;

      const spacing = 12;



      if (conn.type === "train") offset = -spacing; // Jalur Hijau (Atas)

      if (conn.type === "bus")   offset = 0;        // Jalur Ungu (Tengah)

      if (conn.type === "plane") offset = spacing;  // Jalur Hitam (Bawah)



      const perpX = -dy / length;

      const perpY = dx / length;



      // Geser titik koordinat dalam persentase (%)

      const x1 = p1.x + perpX * (offset / mapWidth * 100);

      const y1 = p1.y + perpY * (offset / mapHeight * 100);

      const x2 = p2.x + perpX * (offset / mapWidth * 100);

      const y2 = p2.y + perpY * (offset / mapHeight * 100);



      // Konversi % ke nilai Pixel Aktual SVG

      const x1px = (x1 / 100) * mapWidth;

      const y1px = (y1 / 100) * mapHeight;

      const x2px = (x2 / 100) * mapWidth;

      const y2px = (y2 / 100) * mapHeight;



      // Render Garis

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

      line.setAttribute("x1", x1px);

      line.setAttribute("y1", y1px);

      line.setAttribute("x2", x2px);

      line.setAttribute("y2", y2px);

      line.setAttribute("stroke", color);

      line.setAttribute("stroke-width", "4");

      line.setAttribute("stroke-linecap", "round");

      line.style.cursor = "pointer";



      line.addEventListener("click", (e) => {

        e.stopPropagation();

        svg.querySelectorAll("line").forEach(l => l.setAttribute("stroke-width", "4"));

        line.setAttribute("stroke-width", "7");



        selectedConnection = {

          fromId: from.id,

          toId: conn.to,

          type: conn.type

        };

      });



      svg.appendChild(line);



      // Kalkulasi Teks Angka Jarak Tepat Mengikuti Sumbu Jalur Masing-Masing

      const mx = (x1px + x2px) / 2;

      const my = (y1px + y2px) / 2;

      const vx = x2px - x1px;

      const vy = y2px - y1px;

      const lineLen = Math.sqrt(vx * vx + vy * vy) || 1;



      let angle = Math.atan2(vy, vx) * (180 / Math.PI);

      // Normalisasi teks agar tidak terbalik

      if (angle > 90 || angle < -90) angle += 180;



      const normalX = -vy / lineLen;

      const normalY = vx / lineLen;



      // Beri padding elevasi konstan sebesar -10px ke arah sisi atas garis masing-masing

      const labelPadding = -10;

      const finalX = mx + normalX * labelPadding;

      const finalY = my + normalY * labelPadding;



      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

      text.setAttribute("x", finalX);

      text.setAttribute("y", finalY);

      text.setAttribute("transform", `rotate(${angle} ${finalX} ${finalY})`);

      text.setAttribute("fill", color);

      text.setAttribute("font-size", "12");

      text.setAttribute("font-weight", "bold");

      text.setAttribute("text-anchor", "middle");

      text.setAttribute("dominant-baseline", "middle");

      text.setAttribute("paint-order", "stroke");

      text.setAttribute("stroke", "white");

      text.setAttribute("stroke-width", "4");

      text.setAttribute("stroke-linejoin", "round");

      text.style.pointerEvents = "none";

     

      text.textContent = `${conn.distance}`;



      svg.appendChild(text);

    });

  });

}



/* ==========================================================================

   8. FITUR: PAN & ZOOM (MENGIKUTI POSISI KURSOR MOUSE)

   ========================================================================== */

mapContainer.addEventListener("wheel", (e) => {

  if (!e.ctrlKey) return;

  e.preventDefault();



  const rect = mapContainer.getBoundingClientRect();

  const mouseX = e.clientX - rect.left;

  const mouseY = e.clientY - rect.top;



  const worldX = (mouseX - translateX) / scale;

  const worldY = (mouseY - translateY) / scale;



  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

  const newScale = Math.min(Math.max(scale * zoomFactor, 1), 5);



  translateX = mouseX - worldX * newScale;

  translateY = mouseY - worldY * newScale;



  scale = newScale;

  clampPan();

  updateTransform();

}, { passive: false });



mapContainer.addEventListener("mousedown", (e) => {

  if (scale <= 1) return;

  if (e.target.closest(".pin") || e.target.closest("input") || e.target.closest(".sidebar") || e.target.closest("#popup") || e.target.closest("#connectPopup")) return;



  isDragging = true;

  startX = e.clientX - translateX;

  startY = e.clientY - translateY;

  mapContainer.style.cursor = "grabbing";

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

  mapContainer.style.cursor = "grab";

});



/* ==========================================================================

   9. FITUR: TEMUKAN RUTE TERBAIK & VALIDASI INPUT KATA KUNCI TEPAT

   ========================================================================== */

function validateRouteInputs() {

  const fromName = fromInput.value.trim().toLowerCase();

  const toName = toInput.value.trim().toLowerCase();



  const fromExists = pins.some(p => p.name.toLowerCase() === fromName);

  const toExists = pins.some(p => p.name.toLowerCase() === toName);



  searchRouteBtn.disabled = !(fromExists && toExists);

}



fromInput.addEventListener("input", validateRouteInputs);

toInput.addEventListener("input", validateRouteInputs);



const sortButtons = document.querySelectorAll(".sort-bar button");

sortButtons.forEach(btn => {

  btn.addEventListener("click", () => {

    sortButtons.forEach(b => b.classList.remove("active"));

    btn.classList.add("active");



    sortMode = btn.getAttribute("data-sort") || "fastest";

   

    if (!searchRouteBtn.disabled) {

      searchRouteBtn.click();

    }

  });

});



function findAllRoutes(startId, endId, maxRoutes = 10) {

  const routes = [];



  function dfs(currentId, visited, path) {

    if (routes.length >= maxRoutes) return;



    if (currentId == endId) {

      routes.push({ path: [...path] });

      return;

    }



    const currentPin = pins.find(p => p.id == currentId);

    if (!currentPin) return;



    for (const conn of currentPin.connections || []) {

      if (visited.includes(conn.to)) continue;



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



searchRouteBtn.addEventListener("click", () => {

  routeResults.innerHTML = "";



  const fromName = fromInput.value.trim().toLowerCase();

  const toName = toInput.value.trim().toLowerCase();



  const fromPin = pins.find(p => p.name.toLowerCase() === fromName);

  const toPin = pins.find(p => p.name.toLowerCase() === toName);



  if (!fromPin || !toPin) {

    routeResults.innerHTML = `<div style="color:red;font-size:13px;">Pinpoint tidak ditemukan!</div>`;

    return;

  }



  const routes = findAllRoutes(fromPin.id, toPin.id, 10);



  if (routes.length === 0) {

    routeResults.innerHTML = `<div style="color:red;font-size:13px;">Tidak ada rute yang terhubung.</div>`;

    return;

  }



  const enrichedRoutes = routes.map(route => {

    let totalTime = 0;

    let totalCost = 0;



    route.path.forEach(step => {

      const spec = transportData[step.type];

      totalTime += (step.distance / spec.speed) * 60;

      totalCost += step.distance * spec.costPerKm;

    });



    return { ...route, time: totalTime, cost: totalCost };

  });



  // Sorting Handler

  enrichedRoutes.sort((a, b) => {

    if (sortMode === "cheapest") {

      return a.cost === b.cost ? a.time - b.time : a.cost - b.cost;

    }

    return a.time === b.time ? a.cost - b.cost : a.time - b.time;

  });



  // Render HTML Cards

  enrichedRoutes.forEach((r, index) => {

    const stepsHTML = r.path.map(step => {

      const fromNode = pins.find(p => p.id == step.from);

      const toNode = pins.find(p => p.id == step.to);

      const transportName = step.type === "train" ? "Kereta" : step.type === "bus" ? "Bus" : "Pesawat";

      return `• <strong>${fromNode.name}</strong> → <strong>${toNode.name}</strong> naik ${transportName} (${step.distance} km)`;

    }).join("<br>");



    const hours = Math.floor(r.time / 60);

    const minutes = Math.round(r.time % 60);

    const durationText = hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes} menit`;



    const div = document.createElement("div");

    div.className = "route-card";

    div.innerHTML = `

      <div class="route-title">Rute Alternatif ${index + 1}</div>

      <div class="route-info" style="margin: 5px 0; font-weight: bold; color: #8b5cf6;">

        ⏱ ${durationText} | 💰 Rp${r.cost.toLocaleString("id-ID")}

      </div>

      <div class="route-step" style="line-height:1.4; font-size: 13px; color: #555;">${stepsHTML}</div>

    `;

    routeResults.appendChild(div);

  });

});



/* ==========================================================================

   10. FITUR: PENGHAPUSAN KONEKSI LINE VIA KEYBOARD & ZOOM HOTKEY (+ / -)

   ========================================================================== */

window.addEventListener("keydown", (e) => {

  if (e.key === "Delete" || e.key === "Backspace") {

    if (!selectedConnection) return;



    const { fromId, toId, type } = selectedConnection;

    const fromPin = pins.find(p => p.id == fromId);

    const toPin = pins.find(p => p.id == toId);



    if (!fromPin || !toPin) return;



    fromPin.connections = (fromPin.connections || []).filter(c => !(c.to == toId && c.type === type));

    toPin.connections = (toPin.connections || []).filter(c => !(c.to == fromId && c.type === type));



    selectedConnection = null;

    save();

    drawLines();

   

    if (!searchRouteBtn.disabled) searchRouteBtn.click();

  }



  if (!e.ctrlKey) return;



  if (e.key === "+" || e.key === "=" || e.key === "-") {

    e.preventDefault();



    const rect = mapContainer.getBoundingClientRect();

    const mouseX = rect.width / 2;

    const mouseY = rect.height / 2;



    const worldX = (mouseX - translateX) / scale;

    const worldY = (mouseY - translateY) / scale;



    let newScale = scale;

    if (e.key === "+" || e.key === "=") newScale = Math.min(scale * 1.1, 5);

    if (e.key === "-") newScale = Math.max(scale * 0.9, 1);



    translateX = mouseX - worldX * newScale;

    translateY = mouseY - worldY * newScale;



    scale = newScale;

    clampPan();

    updateTransform();

  }

});