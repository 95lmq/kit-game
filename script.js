let matchedKits = [];
let kitMaster = [];
let roundKits = [];
let currentIndex = 0;
let usedIds = new Set(); // track which kits have been shown

let timerInterval = null;
let timeLeft = 0;
let timePerImage = 30; // seconds - can be modified by settings
let roundSize = 10; // number of kits per round - can be modified by settings
let gameMode = 'flashcard'; // 'flashcard' or 'typing'

let dataLoaded = false;
window._domReady = false;
let gameStarted = false;

// Score tracking for typing mode (round only)
let currentRoundCorrect = 0;
let currentRoundIncorrect = 0;

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
  const submitGuessBtn = document.getElementById("submitGuessBtn");
  const guessInput = document.getElementById("guessInput");

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

  submitGuessBtn.addEventListener("click", () => {
    submitGuess();
  });

  guessInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      submitGuess();
    }
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
  currentRoundCorrect = 0;
  currentRoundIncorrect = 0;
  
  document.getElementById("newRoundBtn").style.display = "none";
  document.getElementById("gameSettingsBtn").style.display = "none";
  document.getElementById("nextBtn").disabled = false;
  document.getElementById("nextBtn").classList.remove("disabled");
  document.getElementById("revealBtn").disabled = false;
  document.getElementById("revealBtn").classList.remove("disabled");
  
  updateControlsForMode();

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
  
  // Re-enable the reveal button for new image and reset typing mode controls
  document.getElementById("revealBtn").disabled = false;
  document.getElementById("revealBtn").classList.remove("disabled");
  
  const guessInput = document.getElementById("guessInput");
  const submitGuessBtn = document.getElementById("submitGuessBtn");
  const guessInputWrapper = document.querySelector('.guess-input-wrapper');
  
  if (guessInput) {
    guessInput.value = "";
    guessInput.disabled = false;
    guessInput.classList.remove("correct", "incorrect");
    guessInput.style.transition = ''; // Reset transition
  }
  if (submitGuessBtn) {
    submitGuessBtn.disabled = false;
    submitGuessBtn.classList.remove("disabled");
    submitGuessBtn.style.transition = ''; // Reset transition
  }
  if (guessInputWrapper) {
    guessInputWrapper.style.visibility = 'visible'; // Reset visibility
    guessInputWrapper.style.transition = ''; // Reset transition
  }
  
  // Hide stamp overlay for new image
  const stampOverlay = document.getElementById('stampOverlay');
  if (stampOverlay) {
    stampOverlay.style.display = 'none';
  }
  
  updateControlsForMode();
  
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

function revealAnswer(isCorrect = null, isPartial = false) {
  const currentKit = roundKits[currentIndex];
  if (!currentKit) return;

  // Reset zoom when revealing answer
  const imgEl = document.getElementById("kitImage");
  if (imgEl && imgEl.resetZoom) {
    imgEl.resetZoom();
  }

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

    // Show stamp overlay for typing mode
    if (gameMode === 'typing' && isCorrect !== null) {
      const stampOverlay = document.getElementById('stampOverlay');
      if (stampOverlay) {
        // Randomize position (40-60% range for both axes to keep it centered)
        const randomX = 40 + Math.random() * 20; // 40-60%
        const randomY = 40 + Math.random() * 20; // 40-60%
        const randomAngle = -20 + Math.random() * 40; // -20 to +20 degrees
        
        const scoreHtml = `<div class="stamp-score"><span class="score-correct">✓${currentRoundCorrect}</span> <span class="score-incorrect">✗${currentRoundIncorrect}</span></div>`;
        if (isCorrect && isPartial) {
          // Partial match - orange stamp
          stampOverlay.className = 'stamp-overlay stamp-partial';
          stampOverlay.innerHTML = `<div class="stamp-text"><span class="stamp-icon">✓</span> PARTIALLY CORRECT</div>${scoreHtml}`;
        } else if (isCorrect) {
          // Full correct match - green stamp
          stampOverlay.className = 'stamp-overlay stamp-correct';
          stampOverlay.innerHTML = `<div class="stamp-text"><span class="stamp-icon">✓</span> CORRECT</div>${scoreHtml}`;
        } else {
          // Incorrect - red stamp
          stampOverlay.className = 'stamp-overlay stamp-incorrect';
          stampOverlay.innerHTML = `<div class="stamp-text"><span class="stamp-icon">✗</span> INCORRECT</div>${scoreHtml}`;
        }
        stampOverlay.style.left = `${randomX}%`;
        stampOverlay.style.top = `${randomY}%`;
        stampOverlay.style.setProperty('--stamp-angle', `${randomAngle}deg`);
        stampOverlay.style.display = 'flex';
      }
    }
    
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

function normalizeAnswer(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Levenshtein distance - calculates the minimum number of edits needed to transform one string into another
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

// Calculate similarity ratio (0-1, where 1 is identical)
function similarityRatio(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

function extractBaseModel(designationString) {
  // Extract base model from a military designation
  // Examples: "T-72BM" -> "T-72", "BMP-1KSH" -> "BMP-1", "M1A2" -> "M1", "T-72EA" -> "T-72"
  
  if (!designationString || designationString.length < 3) return designationString;
  
  const normalized = normalizeAnswer(designationString);
  
  // Pattern 1: Letter(s) + number(s) with optional suffix
  // Handles: T-72BM, T-72EA, BMP-1KSH, 2S9, etc.
  // After normalization: t72bm, t72ea, bmp1ksh, 2s9
  const pattern1 = /^([a-z]*\d+)([a-z]+\d*)?$/;
  const match1 = normalized.match(pattern1);
  
  if (match1 && match1[1] && match1[2]) {
    // Has a suffix, return base
    return match1[1];
  }
  
  // Pattern 2: More complex with internal numbers (e.g., BMP-1KSH -> bmp1ksh)
  // Match letters+numbers, then more letters/numbers as suffix
  const pattern2 = /^([a-z]+\d+)([a-z]+)$/;
  const match2 = normalized.match(pattern2);
  
  if (match2 && match2[1] && match2[2]) {
    return match2[1];
  }
  
  // Pattern 3: Multi-word, extract first word base if it looks like a model number
  const words = normalized.split(' ');
  if (words.length > 1 && words[0].length >= 2) {
    const firstWordBase = extractBaseModel(words[0]);
    if (firstWordBase !== words[0]) {
      return firstWordBase;
    }
  }
  
  return normalized;
}

function checkAnswer(userGuess) {
  const currentKit = roundKits[currentIndex];
  if (!currentKit) return { correct: false, partial: false };
  
  const systemEntry = kitMaster.find(
    s => s.sys_combo_id === currentKit.matched_sys_combo_id
  );
  
  if (!systemEntry) return { correct: false, partial: false };
  
  const correctAnswers = [
    systemEntry.Name_1,
    systemEntry.Name_2,
    systemEntry.Name_3,
    systemEntry.Name_4,
    systemEntry.Name_5
  ].filter(name => name && name.trim() !== "");
  
  const normalizedGuess = normalizeAnswer(userGuess);
  
  // Require minimum length to prevent trivial matches
  if (normalizedGuess.length < 3) {
    return { correct: false, partial: false };
  }
  
  let isPartialMatch = false;
  
  // Check if the guess matches any of the correct answers
  const hasMatch = correctAnswers.some(answer => {
    const normalizedAnswer = normalizeAnswer(answer);
    
    // 1. Exact match
    if (normalizedAnswer === normalizedGuess) {
      return true;
    }
    
    // 2. Full fuzzy match - allow 85% similarity for complete answers
    // This handles typos like "alligater" -> "alligator"
    const fullSimilarity = similarityRatio(normalizedGuess, normalizedAnswer);
    if (fullSimilarity >= 0.85) {
      return true;
    }
    
    // 3. Check if guess is a substantial substring (useful for short designations)
    if (normalizedAnswer.includes(normalizedGuess) && normalizedGuess.length >= 4) {
      return true;
    }
    
    // 3b. Base model matching - extract base from user guess and check if it matches
    // This handles "T-72BM" when "T-72" is correct, or "BMP-1KSH" when "BMP-1" is correct
    const baseGuess = extractBaseModel(normalizedGuess);
    if (baseGuess !== normalizedGuess && baseGuess.length >= 2) {
      // Check if the base matches the answer exactly
      if (normalizedAnswer === baseGuess) {
        isPartialMatch = true;
        return true;
      }
      // Check if answer contains the base (for multi-word answers)
      if (normalizedAnswer.includes(baseGuess) && baseGuess.length >= 3) {
        isPartialMatch = true;
        return true;
      }
    }
    
    // 4. Word-based matching for multi-word answers
    const guessWords = normalizedGuess.split(' ').filter(w => w.length > 0);
    const answerWords = normalizedAnswer.split(' ').filter(w => w.length > 0);
    
    // Single word guesses need stricter matching
    if (guessWords.length === 1) {
      const guessWord = guessWords[0];
      if (guessWord.length < 4) return false;
      
      // Check if it fuzzy matches any word in the answer
      return answerWords.some(answerWord => {
        // Exact word match or very close
        if (answerWord === guessWord || similarityRatio(guessWord, answerWord) >= 0.85) {
          return true;
        }
        // Prefix match for longer words (e.g., "allig" matches "alligator")
        if (guessWord.length >= 5 && answerWord.startsWith(guessWord)) {
          return true;
        }
        return false;
      });
    }
    
    // Multi-word guesses - check if words match with fuzzy tolerance
    if (guessWords.length >= 2) {
      const matchedWords = guessWords.filter(guessWord => 
        answerWords.some(answerWord => 
          answerWord === guessWord || 
          answerWord.includes(guessWord) || 
          guessWord.includes(answerWord) ||
          similarityRatio(guessWord, answerWord) >= 0.8
        )
      );
      
      // Need at least 2 words to match or 50% of guess words
      const requiredMatches = Math.max(2, Math.ceil(guessWords.length * 0.5));
      if (matchedWords.length >= requiredMatches) {
        return true;
      }
    }
    
    return false;
  });
  
  return { correct: hasMatch, partial: isPartialMatch };
}

function submitGuess() {
  const guessInput = document.getElementById("guessInput");
  const userGuess = guessInput.value.trim();
  
  if (!userGuess) {
    guessInput.classList.add("shake");
    setTimeout(() => guessInput.classList.remove("shake"), 500);
    return;
  }
  
  const result = checkAnswer(userGuess);
  const isCorrect = result.correct;
  const isPartial = result.partial;
  
  // Stop the timer
  stopTimer();
  
  // Update scores - count partial as correct for scoring
  if (isCorrect) {
    currentRoundCorrect++;
    guessInput.classList.add("correct");
    guessInput.classList.remove("incorrect");
  } else {
    currentRoundIncorrect++;
    guessInput.classList.add("incorrect");
    guessInput.classList.remove("correct");
  }
  
  // Disable input and submit button
  guessInput.disabled = true;
  const submitGuessBtn = document.getElementById("submitGuessBtn");
  submitGuessBtn.disabled = true;
  submitGuessBtn.classList.add("disabled");
  
  // Show the correct answer, passing partial status
  revealAnswer(isCorrect, isPartial);
}

function updateControlsForMode() {
  const revealBtn = document.getElementById("revealBtn");
  const guessInputWrapper = document.querySelector(".guess-input-wrapper");
  
  if (gameMode === 'typing') {
    revealBtn.style.display = "none";
    if (guessInputWrapper) guessInputWrapper.style.display = "flex";
  } else {
    revealBtn.style.display = "inline-block";
    if (guessInputWrapper) guessInputWrapper.style.display = "none";
  }
}

function updateScoreDisplay() {
  const scoreDisplay = document.getElementById("scoreDisplay");
  if (scoreDisplay) {
    scoreDisplay.innerHTML = `
      <div class="score-item">
        <span class="score-label">Score:</span>
        <span class="score-value correct">✓ ${currentRoundCorrect}</span>
        <span class="score-value incorrect">✗ ${currentRoundIncorrect}</span>
      </div>
    `;
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
  const gameModeSelect = document.getElementById("gameModeSelect");
  
  // Set current timer value
  slider.value = timePerImage;
  valueDisplay.textContent = timePerImage;
  updateSliderFill(slider);
  
  // Set current round size
  roundSizeInput.value = roundSize;
  
  // Set current game mode
  if (gameModeSelect) {
    gameModeSelect.value = gameMode;
  }
  
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
  const gameModeSelect = document.getElementById("gameModeSelect");
  
  timePerImage = parseInt(slider.value);
  
  const newRoundSize = parseInt(roundSizeInput.value);
  if (newRoundSize >= 1 && newRoundSize <= 50) {
    roundSize = newRoundSize;
  }
  
  if (gameModeSelect) {
    gameMode = gameModeSelect.value;
  }
  
  // Save to localStorage for persistence
  localStorage.setItem('guessTheKitTimer', timePerImage);
  localStorage.setItem('guessTheKitRoundSize', roundSize);
  localStorage.setItem('guessTheKitGameMode', gameMode);
  
  // Update controls to match new mode
  updateControlsForMode();
  
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
  
  const savedGameMode = localStorage.getItem('guessTheKitGameMode');
  if (savedGameMode) {
    gameMode = savedGameMode;
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
      
      // In typing mode, treat timeout as incorrect
      if (gameMode === 'typing') {
        const guessInput = document.getElementById("guessInput");
        const submitGuessBtn = document.getElementById("submitGuessBtn");
        
        // Mark as incorrect if no answer submitted
        if (guessInput && !guessInput.disabled) {
          currentRoundIncorrect++;
          guessInput.disabled = true;
          guessInput.classList.add("incorrect");
          if (submitGuessBtn) {
            submitGuessBtn.disabled = true;
            submitGuessBtn.classList.add("disabled");
          }
        }
      }
      
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
    const stampOverlay = document.getElementById('stampOverlay');
    const guessInputWrapper = document.querySelector('.guess-input-wrapper');
    const guessInput = document.getElementById('guessInput');
    if (scale <= 1.01) { 
      scale = 1; 
      panX = 0; 
      panY = 0; 
      img.classList.remove("zooming"); 
      setTransform();
      // Show stamp overlay when zoom resets
      if (stampOverlay && stampOverlay.style.display === 'flex') {
        stampOverlay.style.visibility = 'visible';
      }
      // Show input wrapper when zoom resets (if answer has been revealed)
      if (guessInputWrapper && guessInput && guessInput.disabled) {
        const submitBtn = document.getElementById('submitGuessBtn');
        guessInputWrapper.style.transition = 'none';
        guessInput.style.transition = 'none';
        if (submitBtn) submitBtn.style.transition = 'none';
        guessInputWrapper.style.visibility = 'visible';
      }
    } else {
      // Hide stamp overlay when zoomed in
      if (stampOverlay && stampOverlay.style.display === 'flex') {
        stampOverlay.style.visibility = 'hidden';
      }
      // Hide input wrapper when zoomed in (if answer has been revealed)
      if (guessInputWrapper && guessInput && guessInput.disabled) {
        const submitBtn = document.getElementById('submitGuessBtn');
        guessInputWrapper.style.transition = 'none';
        guessInput.style.transition = 'none';
        if (submitBtn) submitBtn.style.transition = 'none';
        guessInputWrapper.style.visibility = 'hidden';
      }
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
    
    const stampOverlay = document.getElementById('stampOverlay');
    const guessInputWrapper = document.querySelector('.guess-input-wrapper');
    const guessInput = document.getElementById('guessInput');
    if (scale <= 1.01) {
      // reset to default
      scale = 1;
      panX = 0; panY = 0;
      img.classList.remove("zooming");
      img.style.transformOrigin = '50% 50%';
      // Show stamp overlay when zoom resets
      if (stampOverlay && stampOverlay.style.display === 'flex') {
        stampOverlay.style.visibility = 'visible';
      }
      // Show input wrapper when zoom resets (if answer has been revealed)
      if (guessInputWrapper && guessInput && guessInput.disabled) {
        const submitBtn = document.getElementById('submitGuessBtn');
        guessInputWrapper.style.transition = 'none';
        guessInput.style.transition = 'none';
        if (submitBtn) submitBtn.style.transition = 'none';
        guessInputWrapper.style.visibility = 'visible';
      }
    } else {
      img.classList.add("zooming");
      // adjust pan to keep cursor over the same point
      panX = mouseX - rect.width/2 - imgX * scale;
      panY = mouseY - rect.height/2 - imgY * scale;
      img.style.transformOrigin = '50% 50%';
      // Hide stamp overlay when zooming in
      if (stampOverlay && stampOverlay.style.display === 'flex') {
        stampOverlay.style.visibility = 'hidden';
      }
      // Hide input wrapper when zooming in (if answer has been revealed)
      if (guessInputWrapper && guessInput && guessInput.disabled) {
        const submitBtn = document.getElementById('submitGuessBtn');
        guessInputWrapper.style.transition = 'none';
        guessInput.style.transition = 'none';
        if (submitBtn) submitBtn.style.transition = 'none';
        guessInputWrapper.style.visibility = 'hidden';
      }
    }
    
    clampPan();
    setTransform();
  }, { passive: false });

  // double-click to zoom to cursor (desktop)
  img.addEventListener('dblclick', e => {
    e.preventDefault();
    const stampOverlay = document.getElementById('stampOverlay');
    const guessInputWrapper = document.querySelector('.guess-input-wrapper');
    const guessInput = document.getElementById('guessInput');
    if (scale === 1) {
      setOriginRelative(e.clientX, e.clientY);
      scale = clamp(3, minScale, maxScale);
      img.classList.add('zooming');
      // Hide stamp overlay when zooming in
      if (stampOverlay && stampOverlay.style.display === 'flex') {
        stampOverlay.style.visibility = 'hidden';
      }
      // Hide input wrapper when zooming in (if answer has been revealed)
      if (guessInputWrapper && guessInput && guessInput.disabled) {
        const submitBtn = document.getElementById('submitGuessBtn');
        guessInputWrapper.style.transition = 'none';
        guessInput.style.transition = 'none';
        if (submitBtn) submitBtn.style.transition = 'none';
        guessInputWrapper.style.visibility = 'hidden';
      }
    } else {
      scale = 1; panX = 0; panY = 0; img.classList.remove('zooming'); img.style.transformOrigin = '50% 50%';
      // Show stamp overlay when zoom resets
      if (stampOverlay && stampOverlay.style.display === 'flex') {
        stampOverlay.style.visibility = 'visible';
      }
      // Show input wrapper when zoom resets (if answer has been revealed)
      if (guessInputWrapper && guessInput && guessInput.disabled) {
        const submitBtn = document.getElementById('submitGuessBtn');
        guessInputWrapper.style.transition = 'none';
        guessInput.style.transition = 'none';
        if (submitBtn) submitBtn.style.transition = 'none';
        guessInputWrapper.style.visibility = 'visible';
      }
    }
    clampPan(); setTransform();
  });

  // expose a reset function so caller can reset zoom/pan when loading new images
  img.resetZoom = function(){
    scale = 1; panX = 0; panY = 0; img.classList.remove('zooming'); img.style.transformOrigin = '50% 50%'; setTransform();
    // Show stamp overlay when zoom resets
    const stampOverlay = document.getElementById('stampOverlay');
    if (stampOverlay && stampOverlay.style.display === 'flex') {
      stampOverlay.style.visibility = 'visible';
    }
    // Show input wrapper when zoom resets
    const guessInputWrapper = document.querySelector('.guess-input-wrapper');
    const guessInput = document.getElementById('guessInput');
    if (guessInputWrapper && guessInput && guessInput.disabled) {
      const submitBtn = document.getElementById('submitGuessBtn');
      guessInputWrapper.style.transition = 'none';
      guessInput.style.transition = 'none';
      if (submitBtn) submitBtn.style.transition = 'none';
      guessInputWrapper.style.visibility = 'visible';
    }
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