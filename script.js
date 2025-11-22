let matchedKits = [];
let kitMaster = [];
let roundKits = [];
let currentIndex = 0;
let usedIds = new Set(); // track which kits have been shown

let timerInterval = null;
let timeLeft = 0;
let timePerImage = 30; // seconds - can be modified by settings
let roundSize = 10; // number of kits per round - can be modified by settings

let dataLoaded = false;
window._domReady = false;
let gameStarted = false;

// Character encoding fix function
function fixCharacterEncoding(text) {
  if (!text) return text;
  
  // Common character replacements for corrupted UTF-8 characters
  const replacements = {
    // French characters
    'V\ufffdhicule': 'Véhicule',
    'Blind\ufffd': 'Blindé', 
    'Tract\ufffd': 'Tracté',
    // German characters
    'Sch\ufffdtzenpanzer': 'Schützenpanzer',
    'BR\ufffdCKENLEGEPANZER': 'BRÜCKENLEGEPANZER',
    // Other common corruptions
    '2S7M\ufffd': '2S7M',
    'PEOPLE\ufffdS': "PEOPLE'S",
    // Generic replacements for common corrupted patterns
    '\ufffd': '', // Remove standalone replacement characters
  };
  
  let fixed = text;
  for (const [corrupt, correct] of Object.entries(replacements)) {
    fixed = fixed.replace(new RegExp(corrupt, 'g'), correct);
  }
  
  return fixed;
}

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
  
  // Initialize loading overlay state (important for GitHub Pages)
  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) {
    loadingOverlay.classList.remove("show");
  }
  
  const revealBtn = document.getElementById("revealBtn");
  const nextBtn = document.getElementById("nextBtn");
  const newRoundBtn = document.getElementById("newRoundBtn");
  const startGameBtn = document.getElementById("startGameBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const gameSettingsBtn = document.getElementById("gameSettingsBtn");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
  const timerSlider = document.getElementById("timerSlider");
  const roundSizeInput = document.getElementById("roundSizeInput");

  revealBtn.addEventListener("click", () => {
    const imgEl = document.getElementById("kitImage");
    imgEl.resetZoom();
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
    updateSliderFill(e.target);
  });

  roundSizeInput.addEventListener("input", (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= 50) {
      e.target.setCustomValidity("");
    } else {
      e.target.setCustomValidity("Please enter a number between 1 and 50");
    }
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
  document.getElementById("revealBtn").disabled = false;
  document.getElementById("revealBtn").classList.remove("disabled");

  const availableKits = matchedKits.filter(kit => {
    // Exclude kits that have already been used
    if (usedIds.has(kit.matched_sys_combo_id)) {
      return false;
    }
    
    // Exclude kits where the matched kit record has DISREGARD: "YES"
    if (kit.DISREGARD === "YES") {
      return false;
    }
    
    // Exclude kits where the master record has DISREGARD: "YES"
    const systemEntry = kitMaster.find(s => s.sys_combo_id === kit.matched_sys_combo_id);
    if (systemEntry && systemEntry.DISREGARD === "YES") {
      return false;
    }
    
    // Exclude kits where the master record has a null Link
    if (systemEntry && systemEntry.Link === null) {
      return false;
    }
    
    return true;
  });

  if (availableKits.length === 0) {
    document.getElementById("result").textContent = "No more kits left to play!";
    return;
  }

  roundKits = availableKits.sort(() => 0.5 - Math.random()).slice(0, roundSize);
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
  document.getElementById("gameSettingsBtn").style.display = "none";
  
  // Re-enable the reveal button for new image
  document.getElementById("revealBtn").disabled = false;
  document.getElementById("revealBtn").classList.remove("disabled");
  
  // Set up loading overlay with delay
  const loadingOverlay = document.getElementById("loadingOverlay");
  let loadingTimeout;
  
  // Ensure overlay is initially hidden (important for GitHub Pages)
  loadingOverlay.classList.remove("show");
  
  // Ensure overlay is initially hidden
  loadingOverlay.classList.remove("show");
  
  // Show loading overlay after 500ms if image hasn't loaded
  loadingTimeout = setTimeout(() => {
    loadingOverlay.classList.add("show");
  }, 500);
  
  // Set up image load handlers before setting src
  imgEl.onload = () => {
    // Clear loading timeout and hide overlay
    clearTimeout(loadingTimeout);
    loadingOverlay.classList.remove("show");
    
    imgEl.resetZoom();
    startTimer(timePerImage);
  };
  
  // Add error handling with retry logic
  let retryCount = 0;
  imgEl.onerror = () => {
    if (retryCount < 2) {
      retryCount++;
      console.warn(`Image failed to load (attempt ${retryCount}), retrying:`, currentKit.url);
      // Retry loading the image with cache-busting parameter
      setTimeout(() => {
        imgEl.src = currentKit.url + '?retry=' + Date.now();
      }, 500 * retryCount); // Increasing delay for each retry
    } else {
      console.error('Image failed to load after retries:', currentKit.url);
      // Clear loading timeout and hide overlay
      clearTimeout(loadingTimeout);
      loadingOverlay.classList.remove("show");
      
      // Select a replacement image from available kits
      console.log('Selecting replacement image...');
      const availableKits = matchedKits.filter(kit => {
        // Exclude kits that have already been used
        if (usedIds.has(kit.matched_sys_combo_id)) {
          return false;
        }
        
        // Exclude kits where the matched kit record has DISREGARD: "YES"
        if (kit.DISREGARD === "YES") {
          return false;
        }
        
        // Exclude kits where the master record has DISREGARD: "YES"
        const systemEntry = kitMaster.find(s => s.sys_combo_id === kit.matched_sys_combo_id);
        if (systemEntry && systemEntry.DISREGARD === "YES") {
          return false;
        }
        
        // Exclude kits where the master record has a null Link
        if (systemEntry && systemEntry.Link === null) {
          return false;
        }
        
        return true;
      });
      
      if (availableKits.length > 0) {
        // Remove the failed kit from used IDs so we can potentially use it later
        usedIds.delete(currentKit.matched_sys_combo_id);
        
        // Select a random replacement and add it to used IDs
        const replacementKit = availableKits[Math.floor(Math.random() * availableKits.length)];
        usedIds.add(replacementKit.matched_sys_combo_id);
        
        // Replace the current kit in the round
        roundKits[currentIndex] = replacementKit;
        
        // Reload with the new image
        console.log('Loading replacement image:', replacementKit.url);
        loadImage();
      } else {
        // No replacement available, skip to next image
        console.warn('No replacement images available');
        imgEl.alt = "No replacement image available";
        if (currentIndex < roundKits.length - 1) {
          setTimeout(() => nextImage(), 1000);
        } else {
          setTimeout(() => endRound(), 1000);
        }
      }
    }
  };
  
  imgEl.src = currentKit.url;
}

function revealAnswer() {
  const currentKit = roundKits[currentIndex];
  if (!currentKit) return;

  // Disable the reveal button after use
  document.getElementById("revealBtn").disabled = true;
  document.getElementById("revealBtn").classList.add("disabled");

  const systemEntry = kitMaster.find(
    s => s.sys_combo_id === currentKit.matched_sys_combo_id
  );

  if (systemEntry) {
    const answers = [systemEntry.Name_1, systemEntry.Name_2, systemEntry.Name_3, systemEntry.Name_4, systemEntry.Name_5]
      .filter(name => name && name.trim() !== "")
      .map(name => fixCharacterEncoding(name)); // Fix character encoding

    let html = `<div style="margin-top:8px;">`;
    answers.forEach(answer => {
      html += `<span class="result-answer-block">${answer}</span>`;
    });
    html += `</div>`;
    
    // Add the system description from the matched kit data
    if (currentKit.system && currentKit.system.trim() !== "") {
      html += `<div style="margin-top:12px;color:var(--muted);font-style:italic;font-size:0.95rem;">${fixCharacterEncoding(currentKit.system)}</div>`;
    }
    
    if (systemEntry.Link && systemEntry.Link.trim() !== "") {
      html += `<div style="margin-top:12px;line-height:1.5;max-width:100%;overflow:hidden;">Learn more: <a href="${systemEntry.Link}" target="_blank" class="result-link">${systemEntry.Link}</a></div>`;
    }

    document.getElementById("result").innerHTML = html;
  } else {
    document.getElementById("result").textContent = "No system info found.";
  }

  // Check if this was the last image in the round
  if (currentIndex >= roundKits.length - 1) {
    endRound();
  }
}

function nextImage() {
  stopTimer();
  currentIndex++;
  if (currentIndex < roundKits.length) {
    loadImage();
  } else {
    endRound();
  }
}

function endRound() {
  // Reset zoom at end of round so buttons aren't covered
  const imgEl = document.getElementById("kitImage");
  imgEl.resetZoom();
  
  // Only update result text if there's no answer currently displayed
  const resultEl = document.getElementById("result");
  if (!resultEl.innerHTML || resultEl.innerHTML.trim() === "" || resultEl.textContent === "Loading images...") {
    resultEl.textContent = "Round finished! Click 'New Round' to continue.";
  } else {
    // If there's an answer displayed, append the round finished message
    const currentHTML = resultEl.innerHTML;
    resultEl.innerHTML = currentHTML + `<div style="margin-top:16px;font-weight:800;color:#ffd400;">Round finished! Click 'New Round' to continue.</div>`;
  }
  
  document.getElementById("newRoundBtn").style.display = "inline-block";
  document.getElementById("gameSettingsBtn").style.display = "inline-block";
  document.getElementById("nextBtn").disabled = true;
  document.getElementById("nextBtn").classList.add("disabled");
  document.getElementById("revealBtn").disabled = true;
  document.getElementById("revealBtn").classList.add("disabled");
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
  const roundSizeInput = document.getElementById("roundSizeInput");
  
  // Set current timer value
  slider.value = timePerImage;
  valueDisplay.textContent = timePerImage;
  updateSliderFill(slider);
  
  // Set current round size
  roundSizeInput.value = roundSize;
  
  modal.classList.remove("hidden");
}

// Update slider fill percentage
function updateSliderFill(slider) {
  const value = slider.value;
  const min = slider.min || 0;
  const max = slider.max || 100;
  const percentage = ((value - min) / (max - min)) * 100;
  slider.style.setProperty('--fill-percent', percentage + '%');
}

function closeSettings() {
  const modal = document.getElementById("settingsModal");
  modal.classList.add("hidden");
}

function saveSettings() {
  const slider = document.getElementById("timerSlider");
  const roundSizeInput = document.getElementById("roundSizeInput");
  
  timePerImage = parseInt(slider.value);
  
  const newRoundSize = parseInt(roundSizeInput.value);
  if (newRoundSize >= 1 && newRoundSize <= 50) {
    roundSize = newRoundSize;
  }
  
  // Save to localStorage for persistence
  localStorage.setItem('guessTheKitTimer', timePerImage);
  localStorage.setItem('guessTheKitRoundSize', roundSize);
  
  closeSettings();
}

function loadSettings() {
  const savedTimer = localStorage.getItem('guessTheKitTimer');
  if (savedTimer) {
    timePerImage = parseInt(savedTimer);
  }
  
  const savedRoundSize = localStorage.getItem('guessTheKitRoundSize');
  if (savedRoundSize) {
    roundSize = parseInt(savedRoundSize);
  }
  
  // Update timer display to match the loaded setting
  const timerEl = document.getElementById("timer");
  if (timerEl) {
    timerEl.textContent = timePerImage;
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
      
      // Reset zoom when timer expires
      const imgEl = document.getElementById("kitImage");
      imgEl.resetZoom();
      
      // auto reveal and allow next
      revealAnswer();
      // revealAnswer() already handles endRound() for the last image
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
        scale = clamp(3.0, minScale, maxScale); 
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