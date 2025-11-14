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



// Zoom and pan features
const img = document.getElementById("kitImage");
let isZooming = false;

function startZoom(e) {
  isZooming = true;
  img.classList.add("zooming");
  updateZoom(e); // zoom immediately at the press point
}

function endZoom() {
  isZooming = false;
  img.classList.remove("zooming");
}

function updateZoom(e) {
  if (!isZooming) return;

  const rect = img.getBoundingClientRect();
  let x, y;
  if (e.touches && e.touches.length > 0) {
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }

  const xPercent = (x / rect.width) * 100;
  const yPercent = (y / rect.height) * 100;

  img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
}

// Mouse events
img.addEventListener("mousedown", startZoom);
img.addEventListener("mousemove", updateZoom);   // keep updating while held
document.addEventListener("mouseup", endZoom);

// Touch events
img.addEventListener("touchstart", startZoom);
img.addEventListener("touchmove", updateZoom);   // keep updating while held
document.addEventListener("touchend", endZoom);
// Prevent browser drag behavior
img.addEventListener("dragstart", e => e.preventDefault());