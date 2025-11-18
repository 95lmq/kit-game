let matchedKits = [];
let kitMaster = [];
let roundKits = [];
let currentIndex = 0;
let usedIds = new Set(); // track which kits have been shown

let timerInterval = null;
let timeLeft = 0;
let timePerImage = 20; // seconds - can be modified by settings

let dataLoaded = false;
window._domReady = false;
let gameStarted = false;

// Load JSON data but do not auto-start; wait for user to press Start
Promise.all([
  fetch("matched_kits_cutdown.json").then(r => r.json()),
  fetch("List_of_kit_master.json").then(r => r.json())
]).then(([kitsData, masterData]) => {
  matchedKits = kitsData;
  kitMaster = masterData;
  dataLoaded = true;
  // Data is loaded, but don't start the game until user clicks start
  updateSplashScreen();
}).catch(err => {
  console.error('Failed to load kit data', err);
  const splashScreen = document.getElementById('splashScreen');
  if (splashScreen) {
    const content = splashScreen.querySelector('.splash-content');
    if (content) {
      content.innerHTML = '<h1 class="splash-title">Error</h1><p class="splash-description">Failed to load game data. Please refresh the page.</p>';
    }
  }
  dataLoaded = false;
});

document.addEventListener("DOMContentLoaded", () => {
  window._domReady = true;
  const revealBtn = document.getElementById("revealBtn");
  const nextBtn = document.getElementById("nextBtn");
  const newRoundBtn = document.getElementById("newRoundBtn");
  const startGameBtn = document.getElementById("startGameBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const gameSettingsBtn = document.getElementById("gameSettingsBtn");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
  const timerSlider = document.getElementById("timerSlider");

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

  startGameBtn.addEventListener("click", () => {
    startGame();
  });

  settingsBtn.addEventListener("click", () => {
    openSettings();
  });

  gameSettingsBtn.addEventListener("click", () => {
    openSettings();
  });

  saveSettingsBtn.addEventListener("click", () => {
    saveSettings();
  });

  cancelSettingsBtn.addEventListener("click", () => {
    closeSettings();
  });

  timerSlider.addEventListener("input", (e) => {
    document.getElementById("timerValue").textContent = e.target.value;
  });

  // Setup zoom & pan after DOM is ready
  setupImageInteractions();
  
  // Load saved settings
  loadSettings();
  
  // Update splash screen status
  updateSplashScreen();
});

function startRound() {
  document.getElementById("newRoundBtn").style.display = "none";
  document.getElementById("gameSettingsBtn").style.display = "none";
  document.getElementById("nextBtn").disabled = false;
  document.getElementById("nextBtn").classList.remove("disabled");

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
  document.getElementById("result").textContent = "";
  document.getElementById("newRoundBtn").style.display = "none";
  
  // Set up image load handler before setting src
  imgEl.onload = () => {
    if (typeof imgEl.resetZoom === 'function') imgEl.resetZoom();
    startTimer(timePerImage);
  };
  
  imgEl.src = currentKit.url;
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

    let html = `<div>Possible correct answers:</div><div style="margin-top:8px;">`;
    answers.forEach(answer => {
      html += `<span class="result-answer-block">${answer}</span>`;
    });
    html += `</div>`;
    
    if (systemEntry.Link && systemEntry.Link.trim() !== "") {
      html += `<div style="margin-top:12px;">Learn more: <a href="${systemEntry.Link}" target="_blank" class="result-link">${systemEntry.Link}</a></div>`;
    }

    document.getElementById("result").innerHTML = html;
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
    document.getElementById("gameSettingsBtn").style.display = "inline-block";
    document.getElementById("nextBtn").disabled = true;
    document.getElementById("nextBtn").classList.add("disabled");
  }
}

function newRound() {
  startRound();
}

function updateSplashScreen() {
  const startGameBtn = document.getElementById("startGameBtn");
  if (!startGameBtn) return;
  
  if (dataLoaded) {
    startGameBtn.textContent = "Start Game";
    startGameBtn.disabled = false;
    startGameBtn.style.opacity = "1";
  } else {
    startGameBtn.textContent = "Loading...";
    startGameBtn.disabled = true;
    startGameBtn.style.opacity = "0.6";
  }
}

function startGame() {
  if (!dataLoaded) return;
  
  gameStarted = true;
  const splashScreen = document.getElementById("splashScreen");
  
  if (splashScreen) {
    splashScreen.classList.add("hidden");
    
    // Remove the splash screen from DOM after transition
    setTimeout(() => {
      splashScreen.style.display = "none";
    }, 500);
  }
  
  // Start the first round
  startRound();
}

function openSettings() {
  const modal = document.getElementById("settingsModal");
  const slider = document.getElementById("timerSlider");
  const valueDisplay = document.getElementById("timerValue");
  
  // Set current timer value
  slider.value = timePerImage;
  valueDisplay.textContent = timePerImage;
  
  modal.classList.remove("hidden");
}

function closeSettings() {
  const modal = document.getElementById("settingsModal");
  modal.classList.add("hidden");
}

function saveSettings() {
  const slider = document.getElementById("timerSlider");
  timePerImage = parseInt(slider.value);
  
  // Save to localStorage for persistence
  localStorage.setItem('guessTheKitTimer', timePerImage);
  
  closeSettings();
}

function loadSettings() {
  const savedTimer = localStorage.getItem('guessTheKitTimer');
  if (savedTimer) {
    timePerImage = parseInt(savedTimer);
  }
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
  const maxScale = 7.5;
  let startScale = 1;
  let startDist = 0;

  let isPanning = false;
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
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }
  function setOriginRelative(clientX, clientY){
    const rect = img.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
  }

  img.addEventListener("touchstart", e => {
    const t = e.touches[0]; 
    const now = Date.now();
    
    // Handle double tap for zoom
    if (now - lastTouchTime < 300) {
      if (scale === 1) { 
        setOriginRelative(t.clientX, t.clientY); 
        scale = clamp(2.5, minScale, maxScale); 
        img.classList.add("zooming"); 
      } else { 
        scale = 1; 
        panX = 0; 
        panY = 0; 
        img.classList.remove("zooming"); 
      }
      setTransform(); 
      e.preventDefault(); 
      e.stopPropagation();
      lastTouchTime = 0; 
      return;
    }
    
    lastTouchTime = now;
    
    // Always prepare for panning
    startPanX = t.clientX - panX; 
    startPanY = t.clientY - panY;
    isPanning = false; // Reset panning state
    
    // Always prevent default to take full control
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });

  img.addEventListener("touchmove", e => {
    if (e.touches.length === 1 && scale > 1) {
      const t = e.touches[0];
      
      // Activate panning
      isPanning = true;
      
      panX = t.clientX - startPanX; 
      panY = t.clientY - startPanY; 
      clampPan(); 
      setTransform(); 
      
      // Debug logging
      console.log(`Panning: panX=${panX.toFixed(1)}, panY=${panY.toFixed(1)}, scale=${scale}`);
      
      e.preventDefault();
      e.stopPropagation();
    }
  }, { passive: false });

  img.addEventListener("touchend", e => {
    isPanning = false;
    if (scale <= 1.01) { 
      scale = 1; 
      panX = 0; 
      panY = 0; 
      img.classList.remove("zooming"); 
      setTransform(); 
    }
  });

  img.addEventListener("wheel", e => {
    e.preventDefault();
    const delta = -e.deltaY;
    // even gentler zoom steps
    const zoomFactor = delta > 0 ? 1.04 : 0.96;
    
    // get cursor position relative to image
    const rect = img.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // calculate cursor position in image coordinates (before zoom)
    const imgX = (mouseX - rect.width/2) / scale - panX / scale;
    const imgY = (mouseY - rect.height/2) / scale - panY / scale;
    
    const prevScale = scale;
    scale = clamp(scale * zoomFactor, minScale, maxScale);
    
    if (scale <= 1.01) {
      // reset to default
      scale = 1;
      panX = 0; panY = 0;
      img.classList.remove("zooming");
      img.style.transformOrigin = '50% 50%';
    } else {
      img.classList.add("zooming");
      // adjust pan to keep cursor over the same point
      panX = mouseX - rect.width/2 - imgX * scale;
      panY = mouseY - rect.height/2 - imgY * scale;
      img.style.transformOrigin = '50% 50%';
    }
    
    clampPan();
    setTransform();
  }, { passive: false });

  // double-click to zoom to cursor (desktop)
  img.addEventListener('dblclick', e => {
    e.preventDefault();
    if (scale === 1) {
      setOriginRelative(e.clientX, e.clientY);
      scale = clamp(3, minScale, maxScale);
      img.classList.add('zooming');
    } else {
      scale = 1; panX = 0; panY = 0; img.classList.remove('zooming'); img.style.transformOrigin = '50% 50%';
    }
    clampPan(); setTransform();
  });

  // expose a reset function so caller can reset zoom/pan when loading new images
  img.resetZoom = function(){
    scale = 1; panX = 0; panY = 0; img.classList.remove('zooming'); img.style.transformOrigin = '50% 50%'; setTransform();
  };

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
  img.addEventListener("dragstart", e => e.preventDefault());
}

  // Signal that the main script executed (helps remote debugging)
  window.__app_initialized = true;