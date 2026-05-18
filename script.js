/* ============== Emojiword game logic ============== */
(function () {
  "use strict";

  // ---------- Emoji pool ----------
  // 60+ kid-friendly emojis; 26 are picked & shuffled per game.
  const EMOJI_POOL = [
    "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
    "🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦆","🦄",
    "🐝","🐛","🦋","🐢","🐬","🐳","🐙","🦀","🐠","🐟",
    "🌸","🌼","🌻","🌹","🌷","🌵","🌳","🍀","⭐","🌈",
    "🍎","🍌","🍇","🍓","🍉","🍕","🍔","🍟","🍩","🍪",
    "🍦","🍫","⚽","🏀","🚀","🚂","🚗","🎈","🎁","🎨",
    "🎵","🎮","🪁","🪀","🧩","🦖"
  ];

  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // ---------- State ----------
  const state = {
    mode: "random",        // "random" | "two"
    twoPhase: "input",     // for two-player: "input" | "play"
    targetPhrase: "",      // uppercase letters + spaces
    cipher: {},            // letter -> emoji
    decipher: {},          // emoji -> letter
    guessed: new Set(),    // letters the player has tapped
    slots: [],             // { el, letter, isLetter, emoji }
    won: false,
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const phraseArea = $("phrase-area");
  const keyGrid    = $("key-grid");
  const keyboard   = $("keyboard");
  const gameScreen = $("game-screen");
  const p1Screen   = $("p1-screen");
  const p1Input    = $("p1-input");
  const p1Submit   = $("p1-submit");
  const p1Error    = $("p1-error");
  const modeRandomBtn = $("mode-random");
  const modeTwoBtn    = $("mode-two");
  const resetBtn      = $("reset-btn");
  const winOverlay    = $("win-overlay");
  const winPhraseEl   = $("win-phrase");
  const winNextBtn    = $("win-next");

  // ---------- Helpers ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function makeCipher() {
    const emojis = shuffle(EMOJI_POOL).slice(0, 26);
    const cipher = {};
    const decipher = {};
    LETTERS.forEach((L, i) => {
      cipher[L] = emojis[i];
      decipher[emojis[i]] = L;
    });
    return { cipher, decipher };
  }

  function sanitizePhrase(raw) {
    // Uppercase, keep letters + spaces, collapse repeated spaces, trim.
    return raw.toUpperCase().replace(/[^A-Z ]+/g, "").replace(/\s+/g, " ").trim();
  }

  function pickRandomPhrase() {
    const list = (window.PHRASES || []);
    if (!list.length) return "HELLO WORLD";
    return sanitizePhrase(list[Math.floor(Math.random() * list.length)]);
  }

  // ---------- Render ----------
  function renderPhrase() {
    phraseArea.innerHTML = "";
    state.slots = [];
    const words = state.targetPhrase.split(" ");
    words.forEach((word) => {
      const wordEl = document.createElement("div");
      wordEl.className = "word";
      for (const ch of word) {
        const slot = document.createElement("div");
        slot.className = "slot";
        const emoji = document.createElement("div");
        emoji.className = "emoji";
        const letter = document.createElement("div");
        letter.className = "letter";
        emoji.textContent = state.cipher[ch] || "";
        letter.textContent = "";
        slot.appendChild(emoji);
        slot.appendChild(letter);
        wordEl.appendChild(slot);
        state.slots.push({ el: slot, letterEl: letter, letter: ch, isLetter: true });
      }
      phraseArea.appendChild(wordEl);
    });
  }

  function renderKey() {
    keyGrid.innerHTML = "";
    LETTERS.forEach((L) => {
      const cell = document.createElement("div");
      cell.className = "key-cell";
      const ke = document.createElement("div");
      ke.className = "ke";
      ke.textContent = state.cipher[L];
      const kl = document.createElement("div");
      kl.className = "kl";
      kl.textContent = L;
      cell.appendChild(ke);
      cell.appendChild(kl);
      cell.dataset.letter = L;
      keyGrid.appendChild(cell);
    });
  }

  function renderKeyboard() {
    keyboard.innerHTML = "";
    const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
    rows.forEach((row, i) => {
      const rowEl = document.createElement("div");
      rowEl.className = "kb-row r" + (i + 1);
      for (const L of row) {
        const btn = document.createElement("button");
        btn.className = "key";
        btn.type = "button";
        btn.textContent = L;
        btn.dataset.letter = L;
        btn.addEventListener("click", () => handleLetter(L));
        rowEl.appendChild(btn);
      }
      keyboard.appendChild(rowEl);
    });
  }

  function markKeyUsed(letter) {
    const btn = keyboard.querySelector(`.key[data-letter="${letter}"]`);
    if (btn) btn.classList.add("used");
    const cell = keyGrid.querySelector(`.key-cell[data-letter="${letter}"]`);
    if (cell) cell.classList.add("used");
  }

  // ---------- Game flow ----------
  function startRandomGame() {
    state.mode = "random";
    state.won = false;
    state.guessed = new Set();
    const { cipher, decipher } = makeCipher();
    state.cipher = cipher;
    state.decipher = decipher;
    state.targetPhrase = pickRandomPhrase();
    showGameScreen();
    renderAll();
  }

  function startTwoPlayerInput() {
    state.mode = "two";
    state.twoPhase = "input";
    p1Error.textContent = "";
    p1Input.value = "";
    p1Screen.classList.remove("hidden");
    gameScreen.classList.add("hidden");
    hideWin();
    setTimeout(() => p1Input.focus(), 50);
  }

  function startTwoPlayerPlay(phrase) {
    state.mode = "two";
    state.twoPhase = "play";
    state.won = false;
    state.guessed = new Set();
    const { cipher, decipher } = makeCipher();
    state.cipher = cipher;
    state.decipher = decipher;
    state.targetPhrase = phrase;
    showGameScreen();
    renderAll();
  }

  function showGameScreen() {
    p1Screen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    hideWin();
  }

  function renderAll() {
    renderPhrase();
    renderKey();
    renderKeyboard();
  }

  function handleLetter(L) {
    if (state.won) return;
    if (state.guessed.has(L)) return;
    state.guessed.add(L);

    // Find matching slots and reveal
    let matched = false;
    state.slots.forEach((s) => {
      if (s.letter === L) {
        matched = true;
        s.letterEl.textContent = L;
        s.el.classList.add("correct", "flash");
        setTimeout(() => s.el.classList.remove("flash"), 250);
      }
    });

    if (!matched) {
      // Tiny "no-op" feedback: shake the key-cell with that letter
      const cell = keyGrid.querySelector(`.key-cell[data-letter="${L}"]`);
      if (cell) {
        cell.classList.add("shake");
        setTimeout(() => cell.classList.remove("shake"), 300);
      }
    }

    markKeyUsed(L);
    checkWin();
  }

  function checkWin() {
    const allFilled = state.slots.every((s) => s.letterEl.textContent === s.letter);
    if (allFilled) {
      state.won = true;
      winPhraseEl.textContent = state.targetPhrase;
      winOverlay.classList.remove("hidden");
    }
  }

  function hideWin() {
    winOverlay.classList.add("hidden");
  }

  // ---------- Mode buttons ----------
  function selectMode(mode) {
    modeRandomBtn.classList.toggle("active", mode === "random");
    modeTwoBtn.classList.toggle("active", mode === "two");
    modeRandomBtn.setAttribute("aria-selected", mode === "random" ? "true" : "false");
    modeTwoBtn.setAttribute("aria-selected", mode === "two" ? "true" : "false");
    if (mode === "random") {
      startRandomGame();
    } else {
      startTwoPlayerInput();
    }
  }

  // ---------- Reset behavior ----------
  function onReset() {
    hideWin();
    if (state.mode === "random") {
      startRandomGame();
    } else {
      startTwoPlayerInput();
    }
  }

  // ---------- Two-player submit ----------
  function onP1Submit() {
    const raw = p1Input.value || "";
    const cleaned = sanitizePhrase(raw);
    if (!cleaned || cleaned.replace(/ /g, "").length < 2) {
      p1Error.textContent = "Please type at least a couple of letters!";
      return;
    }
    if (cleaned.replace(/ /g, "").length > 60) {
      p1Error.textContent = "Whoa, that's a bit long! Try something shorter.";
      return;
    }
    startTwoPlayerPlay(cleaned);
  }

  // ---------- Event wiring ----------
  modeRandomBtn.addEventListener("click", () => selectMode("random"));
  modeTwoBtn.addEventListener("click", () => selectMode("two"));
  resetBtn.addEventListener("click", onReset);
  p1Submit.addEventListener("click", onP1Submit);
  p1Input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onP1Submit();
  });
  winNextBtn.addEventListener("click", () => {
    onReset();
  });

  // Physical keyboard support (handy on iPad with keyboard, or desktop)
  document.addEventListener("keydown", (e) => {
    if (state.mode === "two" && state.twoPhase === "input") return; // let the input field handle it
    if (winOverlay.classList.contains("hidden") === false) {
      if (e.key === "Enter") { onReset(); }
      return;
    }
    const k = e.key.toUpperCase();
    if (/^[A-Z]$/.test(k)) handleLetter(k);
  });

  // ---------- Boot ----------
  startRandomGame();
})();
