let matchedKits = [];
let kitMaster = [];
let roundKits = [];
let currentIndex = 0;
let usedIds = new Set(); // track which kits have been shown

// Load both JSON files
Promise.all([
  fetch("matched_kits_cutdown.json").then(r => r.json()),
  fetch("List_of_kit_master.json").then(r => r.json())
]).then(([kitsData, masterData]) => {
  matchedKits = kitsData;
  kitMaster = masterData;
  
  startRound();
});

function startRound() {
  // Hide the New Round button at the start of a round
  document.getElementById("newRoundBtn").style.display = "none";

  // Filter out kits already used
  const availableKits = matchedKits.filter(
    kit => !usedIds.has(kit.matched_sys_combo_id)
  );

  if (availableKits.length === 0) {
    document.getElementById("result").textContent =
      "No more kits left to play!";
    return;
  }

  // Pick up to 10 random kits from the remaining pool
  roundKits = availableKits.sort(() => 0.5 - Math.random()).slice(0, 10);

  // Mark them as used
  roundKits.forEach(kit => usedIds.add(kit.matched_sys_combo_id));

  currentIndex = 0;
  loadImage();
}

function loadImage() {
  const currentKit = roundKits[currentIndex];
  document.getElementById("kitImage").src = currentKit.url;
  document.getElementById("result").textContent = "";
}

function revealAnswer() {
  const currentKit = roundKits[currentIndex];

  // Find matching system entry by sys_combo_id
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
  currentIndex++;
  if (currentIndex < roundKits.length) {
    loadImage();
  } else {
    document.getElementById("result").textContent =
      "Round finished! Click 'New Round' to continue.";
    // Show the New Round button when the round ends
    document.getElementById("newRoundBtn").style.display = "inline-block";
  }
}

function newRound() {
  startRound();
}



// Improved zoom and pan features (desktop + mobile)
const img = document.getElementById("kitImage");

let scale = 1;
const minScale = 1;
const maxScale = 3; // slightly lower for MVP
let startScale = 1;
let startDist = 0;

let isPanning = false;
let isPinching = false;
let startPanX = 0;
let startPanY = 0;
// panX/panY are visual pixel offsets (how much the image is moved on screen)
let panX = 0;
let panY = 0;

let lastTouchTime = 0; // for double-tap detection

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function clampPan() {
  const baseW = img.offsetWidth;
  const baseH = img.offsetHeight;
  const halfExtraW = Math.max(0, (baseW * scale - baseW) / 2);
  const halfExtraH = Math.max(0, (baseH * scale - baseH) / 2);
  panX = clamp(panX, -halfExtraW, halfExtraW);
  panY = clamp(panY, -halfExtraH, halfExtraH);
}

function setTransform() {
  // Because we're using `translate(...) scale(...)`, the translate values are affected by scale.
  // To make `panX/panY` represent visual pixel offsets, divide by `scale` when applying translate.
  const tx = panX / Math.max(0.0001, scale);
  const ty = panY / Math.max(0.0001, scale);
  img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

function getDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function getMidpoint(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

function setOriginRelative(clientX, clientY) {
  const rect = img.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  img.style.transformOrigin = `${x}% ${y}%`;
}

// Touch handlers
img.addEventListener("touchstart", e => {
  if (e.touches.length === 2) {
    // start pinch
    isPinching = true;
    startDist = getDistance(e.touches);
    startScale = scale;
    const mid = getMidpoint(e.touches);
    setOriginRelative(mid.x, mid.y);
    // remember pan origin so panning continues smoothly
    startPanX = panX;
    startPanY = panY;
  } else if (e.touches.length === 1) {
    const t = e.touches[0];
    const now = Date.now();
    // double-tap to toggle zoom
    if (now - lastTouchTime < 300) {
      if (scale === 1) {
        setOriginRelative(t.clientX, t.clientY);
        scale = clamp(2.5, minScale, maxScale);
        translateX = 0;
        translateY = 0;
        img.classList.add("zooming");
      } else {
        // reset
        scale = 1;
        translateX = 0;
        translateY = 0;
        img.classList.remove("zooming");
      }
      setTransform();
      e.preventDefault();
      lastTouchTime = 0;
      return;
    }
    lastTouchTime = now;

    // start pan
    isPanning = true;
    startPanX = t.clientX - panX;
    startPanY = t.clientY - panY;
  }
}, { passive: false });

img.addEventListener("touchmove", e => {
  if (isPinching && e.touches.length >= 2) {
    const dist = getDistance(e.touches);
    scale = clamp(startScale * (dist / startDist), minScale, maxScale);
    img.classList.add("zooming");
    // keep pan values as-is (user likely wants to pinch around the midpoint)
    clampPan();
    setTransform();
    e.preventDefault();
  } else if (isPanning && e.touches.length === 1 && scale > 1) {
    const t = e.touches[0];
    panX = t.clientX - startPanX;
    panY = t.clientY - startPanY;
    clampPan();
    setTransform();
    e.preventDefault();
  }
}, { passive: false });

img.addEventListener("touchend", e => {
  if (e.touches.length === 0) {
    isPinching = false;
    isPanning = false;
    // if scale returned to near 1, reset fully
    if (scale <= 1.01) {
      scale = 1;
      panX = 0;
      panY = 0;
      img.classList.remove("zooming");
      setTransform();
    }
  } else if (e.touches.length === 1) {
    // still one finger on screen after pinch
    isPinching = false;
    isPanning = true;
    const t = e.touches[0];
    startPanX = t.clientX - panX;
    startPanY = t.clientY - panY;
  }
});

// Wheel zoom (desktop)
img.addEventListener("wheel", e => {
  e.preventDefault();
  // Simple behavior for MVP: change scale and center the image (pan reset)
  const delta = -e.deltaY;
  const zoomFactor = delta > 0 ? 1.12 : 0.88;
  scale = clamp(scale * zoomFactor, minScale, maxScale);
  if (scale <= 1.01) {
    scale = 1;
    panX = 0;
    panY = 0;
    img.classList.remove("zooming");
  } else {
    // center after wheel zoom for MVP
    panX = 0;
    panY = 0;
    img.classList.add("zooming");
  }
  clampPan();
  setTransform();
}, { passive: false });

// Mouse panning
let isMouseDown = false;
img.addEventListener("mousedown", e => {
  if (scale > 1) {
    isMouseDown = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    e.preventDefault();
  }
});

document.addEventListener("mousemove", e => {
  if (!isMouseDown) return;
  panX = e.clientX - startPanX;
  panY = e.clientY - startPanY;
  clampPan();
  setTransform();
});

document.addEventListener("mouseup", () => {
  isMouseDown = false;
  if (scale <= 1.01) {
    scale = 1;
    panX = 0;
    panY = 0;
    img.classList.remove("zooming");
    setTransform();
  }
});

// Prevent browser drag behavior
img.addEventListener("dragstart", e => e.preventDefault());