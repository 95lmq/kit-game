let matchedKits = [];
let kitMaster = [];
let roundKits = [];
let currentIndex = 0;
let usedIds = new Set(); // track which kits have been shown

let timerInterval = null;
let timeLeft = 0;
const timePerImage = 20; // seconds

let dataLoaded = false;
window._domReady = false;

// Load JSON data but do not auto-start; wait for user to press Start
Promise.all([
  fetch("matched_kits_cutdown.json").then(r => r.json()),
  fetch("List_of_kit_master.json").then(r => r.json())
]).then(([kitsData, masterData]) => {
  matchedKits = kitsData;
  kitMaster = masterData;
  dataLoaded = true;
  // If DOM already ready, start the round now; otherwise DOMContentLoaded handler will start it.
  if (window._domReady) startRound();
}).catch(err => {
  console.error('Failed to load kit data', err);
  const res = document.getElementById('result');
  if (res) res.textContent = 'Failed to load data.';
  dataLoaded = false;
});

document.addEventListener("DOMContentLoaded", () => {
  window._domReady = true;
  const revealBtn = document.getElementById("revealBtn");
  const nextBtn = document.getElementById("nextBtn");
  const newRoundBtn = document.getElementById("newRoundBtn");

  revealBtn.addEventListener("click", () => {
    revealAnswer();
    stopTimer();
  });

  nextBtn.addEventListener("click", () => {
    nextImage();
  });

  newRoundBtn.addEventListener("click", () => {
    newRound();
  });

  // Setup zoom & pan after DOM is ready
  setupImageInteractions();
  // Start the round only after data is loaded. If data isn't ready yet, show a Loading message;
  // the fetch promise will call startRound() when it's ready.
  if (dataLoaded) startRound();
  else {
    const res = document.getElementById('result');
    if (res) res.textContent = 'Loading images...';
  }
});

function startRound() {
  document.getElementById("newRoundBtn").style.display = "none";

  const availableKits = matchedKits.filter(
    kit => !usedIds.has(kit.matched_sys_combo_id)
  );

  if (availableKits.length === 0) {
    document.getElementById("result").textContent = "No more kits left to play!";
    return;
  }

  roundKits = availableKits.sort(() => 0.5 - Math.random()).slice(0, 10);
  roundKits.forEach(kit => usedIds.add(kit.matched_sys_combo_id));

  currentIndex = 0;
  loadImage();
}

function loadImage() {
  const currentKit = roundKits[currentIndex];
  if (!currentKit) return;
  const imgEl = document.getElementById("kitImage");
  imgEl.src = currentKit.url;
  document.getElementById("result").textContent = "";
  document.getElementById("newRoundBtn").style.display = "none";
  startTimer(timePerImage);
}

function revealAnswer() {
  const currentKit = roundKits[currentIndex];
  if (!currentKit) return;

  const systemEntry = kitMaster.find(
    s => s.sys_combo_id === currentKit.matched_sys_combo_id
  );

  if (systemEntry) {
    const answers = [systemEntry.Name_1, systemEntry.Name_2, systemEntry.Name_3, systemEntry.Name_4]
      .filter(name => name && name.trim() !== "");

    let text = `Possible correct answers: ${answers.join(", ")}`;
    if (systemEntry.Link && systemEntry.Link.trim() !== "") {
      text += `\nLearn more: ${systemEntry.Link}`;
    }

    document.getElementById("result").textContent = text;
  } else {
    document.getElementById("result").textContent = "No system info found.";
  }
}

function nextImage() {
  stopTimer();
  currentIndex++;
  if (currentIndex < roundKits.length) {
    loadImage();
  } else {
    document.getElementById("result").textContent = "Round finished! Click 'New Round' to continue.";
    document.getElementById("newRoundBtn").style.display = "inline-block";
  }
}

function newRound() {
  startRound();
}

function startTimer(seconds) {
  const timerEl = document.getElementById("timer");
  clearInterval(timerInterval);
  timeLeft = seconds;
  timerEl.textContent = timeLeft;
  timerEl.style.display = "inline-block";
  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      // auto reveal and allow next
      revealAnswer();
      document.getElementById("newRoundBtn").style.display = "inline-block";
    }
  }, 1000);
}

function stopTimer() {
  const timerEl = document.getElementById("timer");
  clearInterval(timerInterval);
  timerInterval = null;
  timerEl.style.display = "none";
}

// Image zoom/pan interactions
function setupImageInteractions(){
  const img = document.getElementById("kitImage");
  if (!img) return;

  let scale = 1;
  const minScale = 1;
  const maxScale = 3;
  let startScale = 1;
  let startDist = 0;

  let isPanning = false;
  let isPinching = false;
  let startPanX = 0;
  let startPanY = 0;
  let panX = 0;
  let panY = 0;
  let lastTouchTime = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function clampPan(){
    const baseW = img.offsetWidth;
    const baseH = img.offsetHeight;
    const halfExtraW = Math.max(0, (baseW * scale - baseW) / 2);
    const halfExtraH = Math.max(0, (baseH * scale - baseH) / 2);
    panX = clamp(panX, -halfExtraW, halfExtraW);
    panY = clamp(panY, -halfExtraH, halfExtraH);
  }
  function setTransform(){
    const tx = panX / Math.max(0.0001, scale);
    const ty = panY / Math.max(0.0001, scale);
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }
  function getDistance(touches){
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }
  function getMidpoint(touches){
    return { x: (touches[0].clientX + touches[1].clientX)/2, y: (touches[0].clientY + touches[1].clientY)/2 };
  }
  function setOriginRelative(clientX, clientY){
    const rect = img.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
  }

  img.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      isPinching = true; startDist = getDistance(e.touches); startScale = scale; const mid = getMidpoint(e.touches); setOriginRelative(mid.x, mid.y); startPanX = panX; startPanY = panY;
    } else if (e.touches.length === 1) {
      const t = e.touches[0]; const now = Date.now();
      if (now - lastTouchTime < 300) {
        if (scale === 1) { setOriginRelative(t.clientX, t.clientY); scale = clamp(2.5, minScale, maxScale); img.classList.add("zooming"); }
        else { scale = 1; panX = 0; panY = 0; img.classList.remove("zooming"); }
        setTransform(); e.preventDefault(); lastTouchTime = 0; return;
      }
      lastTouchTime = now;
      isPanning = true; startPanX = t.clientX - panX; startPanY = t.clientY - panY;
    }
    if (isPinching && e.touches.length >= 2) {
      const dist = getDistance(e.touches); scale = clamp(startScale * (dist / startDist), minScale, maxScale); img.classList.add("zooming"); clampPan(); setTransform(); e.preventDefault();
    } else if (isPanning && e.touches.length === 1 && scale > 1) {
      const t = e.touches[0]; panX = t.clientX - startPanX; panY = t.clientY - startPanY; clampPan(); setTransform(); e.preventDefault();
    }
  }, { passive: false });

  img.addEventListener("touchend", e => {
    if (e.touches.length === 0) { isPinching = false; isPanning = false; if (scale <= 1.01) { scale = 1; panX = 0; panY = 0; img.classList.remove("zooming"); setTransform(); } }
    else if (e.touches.length === 1) { isPinching = false; isPanning = true; const t = e.touches[0]; startPanX = t.clientX - panX; startPanY = t.clientY - panY; }
  });

  img.addEventListener("wheel", e => {
    e.preventDefault(); const delta = -e.deltaY; const zoomFactor = delta > 0 ? 1.12 : 0.88; scale = clamp(scale * zoomFactor, minScale, maxScale); if (scale <= 1.01) { scale = 1; panX = 0; panY = 0; img.classList.remove("zooming"); } else { panX = 0; panY = 0; img.classList.add("zooming"); } clampPan(); setTransform();
  }, { passive: false });

  let isMouseDown = false;
  img.addEventListener("mousedown", e => { if (scale > 1) { isMouseDown = true; startPanX = e.clientX - panX; startPanY = e.clientY - panY; e.preventDefault(); } });
  document.addEventListener("mousemove", e => { if (!isMouseDown) return; panX = e.clientX - startPanX; panY = e.clientY - startPanY; clampPan(); setTransform(); });
  document.addEventListener("mouseup", () => { isMouseDown = false; if (scale <= 1.01) { scale = 1; panX = 0; panY = 0; img.classList.remove("zooming"); setTransform(); } });
  img.addEventListener("dragstart", e => e.preventDefault());
}

  // Signal that the main script executed (helps remote debugging)
  window.__app_initialized = true;