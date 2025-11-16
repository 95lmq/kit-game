// --------------------
// Quiz/game logic
// --------------------
let matchedKits = [];
let kitMaster = [];
let roundKits = [];
let currentIndex = 0;
let usedIds = new Set(); // track which kits have been shown

// Grab DOM elements once, globally
const img = document.getElementById("kitImage");
const result = document.getElementById("result");
const newRoundBtn = document.getElementById("newRoundBtn");

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
  newRoundBtn.style.display = "none";

  const availableKits = matchedKits.filter(
    kit => !usedIds.has(kit.matched_sys_combo_id)
  );

  if (availableKits.length === 0) {
    result.textContent = "No more kits left to play!";
    return;
  }

  roundKits = availableKits.sort(() => 0.5 - Math.random()).slice(0, 10);
  roundKits.forEach(kit => usedIds.add(kit.matched_sys_combo_id));

  currentIndex = 0;
  loadImage();
}

function revealAnswer() {
  const currentKit = roundKits[currentIndex];
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
    result.textContent = text;
  } else {
    result.textContent = "No system info found.";
  }
}

function nextImage() {
  currentIndex++;
  if (currentIndex < roundKits.length) {
    loadImage();
  } else {
    result.textContent = "Round finished! Click 'New Round' to continue.";
    newRoundBtn.style.display = "inline-block";
  }
}

function newRound() {
  startRound();
}

// --------------------
// Zooming setup
// --------------------
const panzoom = Panzoom(img, {
  maxScale: 5,
  minScale: 'fit',
  step: 0.3,
  contain: 'outside'
});
// Attach wheel zoom to the container, not just the image
const container = document.querySelector('.zoom-container');
container.addEventListener('wheel', function (event) {
  event.preventDefault(); // stop page scroll
  panzoom.zoomWithWheel(event);
});

// --------------------
// Image loading
// --------------------
function loadImage() {
  const currentKit = roundKits[currentIndex];
  img.src = currentKit.url;
  result.textContent = "";

  img.onload = () => {
    panzoom.reset({ scale: 'fit' });


/*
    const container = document.querySelector(".zoom-container");
    const rect = container.getBoundingClientRect();

    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    const scaleX = rect.width / natW;
    const scaleY = rect.height / natH;

    // Fit width if image is proportionally wider, else fit height
    const fitScale = (natW / natH > rect.width / rect.height) ? scaleX : scaleY;

    panzoom.zoom(fitScale, { animate: false });

    // Center the image
    const contentW = natW * fitScale;
    const contentH = natH * fitScale;
    const offsetX = (rect.width - contentW) / 2;
    const offsetY = (rect.height - contentH) / 2;
    panzoom.pan(offsetX, offsetY, { animate: false });
    */
  };
}
