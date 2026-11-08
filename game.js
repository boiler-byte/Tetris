(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;
  const W = COLS * CELL;
  const H = ROWS * CELL;
  const LOCK_DELAY = 500;
  const CLEAR_DURATION = 260;
  const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  const COLORS = {
    I: '#4be4f0', O: '#ffdc67', T: '#b990ff', S: '#64e6aa',
    Z: '#ff6c98', J: '#6e96ff', L: '#ffad65'
  };
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]]
  };
  // Super Rotation System wall kicks; screen coordinates increase downward.
  const KICKS = {
    '0>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '1>0': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '1>2': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '2>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '2>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '3>2': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '3>0': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '0>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]]
  };
  const I_KICKS = {
    '0>1': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '1>0': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '1>2': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
    '2>1': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '2>3': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '3>2': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '3>0': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '0>3': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
  };

  const $ = (id) => document.getElementById(id);
  const canvas = $('game-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const previews = [ $('hold-canvas'), $('next-canvas'), $('next-canvas-2'), $('next-canvas-3') ];
  const overlay = $('board-overlay');
  const soundButton = $('sound-button');
  const pauseButton = $('pause-button');
  const holdButton = $('hold-action');
  const actionButtons = Array.from(document.querySelectorAll('[data-control]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const safeRead = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value === null ? fallback : value; }
    catch (_) { return fallback; }
  };
  const safeWrite = (key, value) => {
    try { localStorage.setItem(key, String(value)); } catch (_) { /* storage is optional */ }
  };

  class SoundEngine {
    constructor() {
      this.enabled = safeRead('neon-stack-sound', 'on') !== 'off';
      this.context = null;
      this.lastMove = 0;
    }
    unlock() {
      if (!this.enabled) return;
      try {
        if (!this.context) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          this.context = new AudioCtx();
        }
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      } catch (_) { this.context = null; }
    }
    tone(frequency, duration, options = {}) {
      if (!this.enabled || !this.context) return;
      const ac = this.context;
      try {
        const when = ac.currentTime + (options.delay || 0);
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = options.type || 'sine';
        osc.frequency.setValueAtTime(frequency, when);
        if (options.end) osc.frequency.exponentialRampToValueAtTime(options.end, when + duration);
        const volume = options.volume || .035;
        gain.gain.setValueAtTime(.0001, when);
        gain.gain.exponentialRampToValueAtTime(volume, when + Math.min(.014, duration / 4));
        gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(when);
        osc.stop(when + duration + .012);
      } catch (_) { /* audio effects should never interrupt play */ }
    }
    play(name) {
      if (!this.enabled || !this.context) return;
      if (name === 'move') {
        const now = performance.now();
        if (now - this.lastMove < 60) return;
        this.lastMove = now;
        this.tone(270, .055, { type: 'triangle', end: 320, volume: .011 });
      } else if (name === 'rotate') {
        this.tone(510, .10, { type: 'sine', end: 670, volume: .024 });
      } else if (name === 'soft') {
        this.tone(185, .045, { type: 'triangle', volume: .008 });
      } else if (name === 'drop') {
        this.tone(240, .19, { type: 'sawtooth', end: 65, volume: .047 });
        this.tone(100, .11, { type: 'sine', end: 55, volume: .065 });
      } else if (name === 'lock') {
        this.tone(165, .09, { type: 'triangle', end: 112, volume: .020 });
      } else if (name === 'hold') {
        this.tone(260, .10, { type: 'sine', end: 440, volume: .026 });
      } else if (name === 'clear') {
        [390, 520, 660].forEach((hz, i) => this.tone(hz, .22, { delay: i * .065, type: 'triangle', volume: .034 }));
      } else if (name === 'tetris') {
        [330, 440, 554, 880].forEach((hz, i) => this.tone(hz, .24, { delay: i * .075, type: 'triangle', volume: .039 }));
      } else if (name === 'over') {
        [360, 290, 210, 135].forEach((hz, i) => this.tone(hz, .26, { delay: i * .16, type: 'triangle', volume: .032 }));
      } else if (name === 'start') {
        this.tone(440, .11, { type: 'triangle', volume: .030 });
        this.tone(660, .16, { delay: .10, type: 'triangle', volume: .036 });
      }
    }
  }
  const sound = new SoundEngine();

  const game = {
    board: emptyBoard(), state: 'ready', player: null, bag: [], next: [],
    hold: null, canHold: true, score: 0, lines: 0, level: 1,
    best: Math.max(0, Number(safeRead('neon-stack-best', '0')) || 0),
    combo: -1, gravityElapsed: 0, lockElapsed: 0, groundedAt: null, pausedAt: null,
    clearRows: [], clearElapsed: 0, pausedFrom: 'playing',
    particles: [], streaks: [], feedback: null, shake: 0, lastFrame: 0
  };
  const sprites = new Map();
  const PREVIEW_W = 120;
  const PREVIEW_H = 70;

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }
  function cloneMatrix(matrix) { return matrix.map((row) => row.slice()); }
  function rotated(matrix, dir) {
    const n = matrix.length;
    const result = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        result[y][x] = dir === 1 ? matrix[n - 1 - x][y] : matrix[x][n - 1 - y];
      }
    }
    return result;
  }
  function fillBag() {
    if (!game.bag.length) {
      game.bag = TYPES.slice();
      for (let i = game.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [game.bag[i], game.bag[j]] = [game.bag[j], game.bag[i]];
      }
    }
    return game.bag.pop();
  }
  function refillQueue() {
    while (game.next.length < 5) game.next.push(fillBag());
  }
  function forCells(matrix, callback) {
    matrix.forEach((row, y) => row.forEach((value, x) => { if (value) callback(x, y); }));
  }
  function fits(matrix, px, py) {
    let valid = true;
    forCells(matrix, (dx, dy) => {
      const x = px + dx;
      const y = py + dy;
      if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && game.board[y][x] !== null)) valid = false;
    });
    return valid;
  }
  function isGrounded() {
    return !!game.player && !fits(game.player.matrix, game.player.x, game.player.y + 1);
  }
  function spawn(type) {
    const matrix = cloneMatrix(SHAPES[type]);
    game.player = {
      type, matrix, rotation: 0,
      x: Math.floor((COLS - matrix.length) / 2),
      y: type === 'O' ? 0 : -1
    };
    game.gravityElapsed = 0;
    game.lockElapsed = 0;
    game.groundedAt = null;
    updatePreviews();
    if (!fits(matrix, game.player.x, game.player.y)) {
      endGame();
      return false;
    }
    return true;
  }
  function spawnNext() {
    refillQueue();
    const type = game.next.shift();
    refillQueue();
    return spawn(type);
  }
  function startGame() {
    game.board = emptyBoard();
    game.bag = [];
    game.next = [];
    game.player = null;
    game.hold = null;
    game.canHold = true;
    game.score = 0;
    game.lines = 0;
    game.level = 1;
    game.combo = -1;
    game.gravityElapsed = 0;
    game.lockElapsed = 0;
    game.groundedAt = null;
    game.clearRows = [];
    game.clearElapsed = 0;
    game.pausedAt = null;
    game.particles = [];
    game.streaks = [];
    game.feedback = null;
    game.shake = 0;
    game.state = 'playing';
    spawnNext();
    sound.unlock();
    sound.play('start');
    updateHUD();
    refreshUI();
    game.lastFrame = performance.now();
    canvas.focus({ preventScroll: true });
  }
  function pauseGame() {
    const now = performance.now();
    if (game.state === 'playing' || game.state === 'clearing') {
      game.pausedFrom = game.state;
      game.pausedAt = now;
      game.state = 'paused';
    } else if (game.state === 'paused') {
      // Pause time must not consume the remaining 500 ms lock window.
      if (game.groundedAt !== null && game.pausedAt !== null) {
        game.groundedAt += now - game.pausedAt;
      }
      game.pausedAt = null;
      game.state = game.pausedFrom;
      game.lastFrame = now;
    } else return;
    refreshUI();
  }
  function endGame() {
    game.state = 'over';
    if (game.score > game.best) {
      game.best = game.score;
      safeWrite('neon-stack-best', game.best);
    }
    sound.play('over');
    updateHUD();
    refreshUI();
    $('announcement').textContent = `Spiel beendet. ${game.score} Punkte.`;
  }
  function refreshUI() {
    const { state } = game;
    // During play, touch drags must not be intercepted as page scrolling.
    document.documentElement.classList.toggle('gesture-active', state === 'playing' || state === 'clearing');
    const showOverlay = state === 'ready' || state === 'paused' || state === 'over';
    overlay.classList.toggle('is-hidden', !showOverlay);
    if (state === 'ready') {
      $('overlay-kicker').textContent = 'BEREIT ZUM SPIELEN?';
      $('overlay-title').textContent = "LET'S STACK.";
      $('overlay-message').textContent = 'Blöcke stapeln. Reihen füllen. Punkte sammeln.';
      $('overlay-button').innerHTML = 'SPIEL STARTEN <span aria-hidden="true">↗</span>';
    } else if (state === 'paused') {
      $('overlay-kicker').textContent = 'KURZE PAUSE';
      $('overlay-title').textContent = 'PAUSIERT.';
      $('overlay-message').textContent = 'Du kannst jederzeit weiterspielen.';
      $('overlay-button').innerHTML = 'WEITERSPIELEN <span aria-hidden="true">↗</span>';
    } else if (state === 'over') {
      $('overlay-kicker').textContent = 'RUN ABGESCHLOSSEN';
      $('overlay-title').textContent = 'GAME OVER.';
      $('overlay-message').textContent = `${game.score.toLocaleString('de-DE')} Punkte · ${game.lines} Linien. Noch eine Runde?`;
      $('overlay-button').innerHTML = 'NOCHMAL SPIELEN <span aria-hidden="true">↗</span>';
    }
    const playing = state === 'playing';
    actionButtons.forEach((button) => { button.disabled = !playing; });
    holdButton.disabled = !playing || !game.canHold;
    pauseButton.disabled = !(playing || state === 'clearing' || state === 'paused');
    pauseButton.setAttribute('aria-label', state === 'paused' ? 'Spiel fortsetzen' : 'Spiel pausieren');
    $('board-shell').classList.toggle('is-paused', state === 'paused');
    updateSoundButton();
  }
  function updateSoundButton() {
    soundButton.classList.toggle('is-muted', !sound.enabled);
    soundButton.setAttribute('aria-pressed', String(sound.enabled));
    soundButton.setAttribute('aria-label', sound.enabled ? 'Ton ausschalten' : 'Ton einschalten');
  }
  function updateHUD() {
    $('score-value').textContent = game.score.toLocaleString('de-DE');
    $('level-value').textContent = String(game.level).padStart(2, '0');
    $('lines-value').textContent = String(game.lines).padStart(2, '0');
    $('best-value').textContent = 'BESTE ' + Math.max(game.best, game.score).toLocaleString('de-DE');
  }
  function gravityInterval() {
    return Math.max(68, 900 * Math.pow(.82, game.level - 1));
  }
  // A piece has one 500 ms lock window per continuous ground contact.
  // Lateral movement, rotation and soft dropping never restart that window.
  // Only leaving the supporting surface resets it, so falling into a gap is safe.
  function syncGroundContact(now = performance.now()) {
    if (!game.player || !isGrounded()) {
      game.groundedAt = null;
      game.lockElapsed = 0;
      return;
    }
    if (game.groundedAt === null) game.groundedAt = now;
    game.lockElapsed = Math.max(0, now - game.groundedAt);
  }
  function move(dx) {
    if (game.state !== 'playing' || !game.player) return false;
    const p = game.player;
    if (!fits(p.matrix, p.x + dx, p.y)) return false;
    p.x += dx;
    syncGroundContact();
    sound.play('move');
    return true;
  }
  function rotate(dir = 1) {
    if (game.state !== 'playing' || !game.player) return false;
    const p = game.player;
    if (p.type === 'O') { sound.play('rotate'); return true; }
    const nextRotation = (p.rotation + (dir === 1 ? 1 : 3)) % 4;
    const candidate = rotated(p.matrix, dir);
    const kicks = (p.type === 'I' ? I_KICKS : KICKS)[`${p.rotation}>${nextRotation}`] || [[0,0]];
    for (const [dx, dy] of kicks) {
      if (fits(candidate, p.x + dx, p.y + dy)) {
        p.matrix = candidate;
        p.rotation = nextRotation;
        p.x += dx;
        p.y += dy;
        syncGroundContact();
        sound.play('rotate');
        return true;
      }
    }
    return false;
  }
  function softDrop(steps = 1) {
    if (game.state !== 'playing' || !game.player) return 0;
    let moved = 0;
    for (let i = 0; i < Math.min(steps, ROWS); i++) {
      if (!fits(game.player.matrix, game.player.x, game.player.y + 1)) break;
      game.player.y++;
      game.gravityElapsed = 0;
      moved++;
    }
    // Start the lock window as soon as the drag actually reaches solid ground.
    syncGroundContact();
    if (moved) {
      game.score += moved;
      sound.play('soft');
      updateHUD();
    }
    return moved;
  }
  function hardDrop() {
    if (game.state !== 'playing' || !game.player) return;
    const p = game.player;
    const startY = p.y;
    let traveled = 0;
    while (fits(p.matrix, p.x, p.y + 1)) { p.y++; traveled++; }
    game.score += traveled * 2;
    if (!reducedMotion.matches) {
      forCells(p.matrix, (dx, dy) => {
        const px = (p.x + dx) * CELL + CELL / 2;
        const py = (p.y + dy) * CELL + CELL / 2;
        if (startY + dy < p.y + dy) {
          game.streaks.push({ x: px, y1: Math.max(0, (startY + dy) * CELL), y2: py, color: COLORS[p.type], life: 190, maxLife: 190 });
        }
        emitParticles(px, py, COLORS[p.type], 2, 145);
      });
      game.shake = Math.min(6, 2 + traveled * .21);
    }
    sound.play('drop');
    lockPiece(true);
    updateHUD();
    try { if (navigator.vibrate && !reducedMotion.matches) navigator.vibrate(11); } catch (_) {}
  }
  function holdPiece() {
    if (game.state !== 'playing' || !game.canHold || !game.player) return;
    const currentType = game.player.type;
    const saved = game.hold;
    game.hold = currentType;
    game.canHold = false;
    if (saved) spawn(saved);
    else spawnNext();
    sound.play('hold');
    refreshUI();
    updatePreviews();
  }
  function lockPiece(wasHardDrop = false) {
    if (!game.player || game.state !== 'playing') return;
    const p = game.player;
    let aboveTop = false;
    forCells(p.matrix, (dx, dy) => {
      const x = p.x + dx;
      const y = p.y + dy;
      if (y < 0) aboveTop = true;
      else game.board[y][x] = p.type;
    });
    game.player = null;
    game.gravityElapsed = 0;
    game.lockElapsed = 0;
    game.groundedAt = null;
    if (!wasHardDrop) sound.play('lock');
    if (aboveTop) { endGame(); return; }
    game.clearRows = [];
    for (let y = 0; y < ROWS; y++) {
      if (game.board[y].every((cell) => cell !== null)) game.clearRows.push(y);
    }
    if (game.clearRows.length) {
      game.state = 'clearing';
      game.clearElapsed = 0;
      if (!reducedMotion.matches) {
        game.clearRows.forEach((y) => {
          for (let x = 0; x < COLS; x++) emitParticles(x * CELL + CELL / 2, y * CELL + CELL / 2, COLORS[game.board[y][x]], 2, 310);
        });
      }
      sound.play(game.clearRows.length === 4 ? 'tetris' : 'clear');
    } else {
      game.combo = -1;
      game.canHold = true;
      spawnNext();
    }
    refreshUI();
  }
  function finishClear() {
    const count = game.clearRows.length;
    const levelAtClear = game.level;
    game.clearRows.slice().sort((a, b) => b - a).forEach((row) => {
      game.board.splice(row, 1);
    });
    for (let i = 0; i < count; i++) game.board.unshift(Array(COLS).fill(null));
    game.clearRows = [];
    game.lines += count;
    game.combo++;
    const bonus = (game.combo > 0 ? game.combo * 50 * levelAtClear : 0);
    const points = ([0, 100, 300, 500, 800][count] || 0) * levelAtClear + bonus;
    game.score += points;
    game.level = Math.floor(game.lines / 10) + 1;
    if (!reducedMotion.matches) game.feedback = { text: count === 4 ? 'TETRIS!' : count === 3 ? 'TRIPLE!' : count === 2 ? 'DOUBLE!' : 'LINE CLEAR!', points, life: 1050, maxLife: 1050 };
    $('announcement').textContent = `${count} ${count === 1 ? 'Linie' : 'Linien'} gelöscht. ${points} Punkte.`;
    game.state = 'playing';
    game.canHold = true;
    spawnNext();
    updateHUD();
    refreshUI();
  }
  function tick(dt, now = performance.now()) {
    if (game.state === 'clearing') {
      game.clearElapsed += dt;
      if (game.clearElapsed >= CLEAR_DURATION) finishClear();
      return;
    }
    if (game.state !== 'playing' || !game.player) return;
    game.gravityElapsed += dt;
    const interval = gravityInterval();
    // Clamp accumulated gravity to avoid excessive skips after slow frames.
    let steps = 0;
    while (game.gravityElapsed >= interval && steps < 4 && game.player) {
      game.gravityElapsed -= interval;
      if (fits(game.player.matrix, game.player.x, game.player.y + 1)) game.player.y++;
      else { game.gravityElapsed = 0; break; }
      steps++;
    }
    syncGroundContact(now);
    if (game.groundedAt !== null && game.lockElapsed >= LOCK_DELAY) lockPiece();
  }

  function rgb(hex) {
    return [1,3,5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  }
  function mix(hex, target, amount) {
    const a = rgb(hex);
    const b = rgb(target);
    return `rgb(${a.map((v, i) => Math.round(v * (1 - amount) + b[i] * amount)).join(',')})`;
  }
  function roundedRect(c, x, y, w, h, r) {
    c.beginPath();
    if (typeof c.roundRect === 'function') { c.roundRect(x, y, w, h, r); return; }
    const radius = Math.min(r, w / 2, h / 2);
    c.moveTo(x + radius, y);
    c.lineTo(x + w - radius, y); c.quadraticCurveTo(x + w, y, x + w, y + radius);
    c.lineTo(x + w, y + h - radius); c.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    c.lineTo(x + radius, y + h); c.quadraticCurveTo(x, y + h, x, y + h - radius);
    c.lineTo(x, y + radius); c.quadraticCurveTo(x, y, x + radius, y);
    c.closePath();
  }
  function initSprites() {
    TYPES.forEach((type) => {
      const sprite = document.createElement('canvas');
      sprite.width = CELL * 2;
      sprite.height = CELL * 2;
      const c = sprite.getContext('2d');
      c.scale(2, 2);
      const gradient = c.createLinearGradient(2, 2, 27, 28);
      gradient.addColorStop(0, mix(COLORS[type], '#ffffff', .30));
      gradient.addColorStop(.45, COLORS[type]);
      gradient.addColorStop(1, mix(COLORS[type], '#060d1d', .24));
      c.fillStyle = gradient;
      roundedRect(c, 1.7, 1.7, 26.6, 26.6, 5.2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,.25)';
      c.lineWidth = .8;
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,.25)';
      roundedRect(c, 5, 4.4, 19.5, 2.8, 2);
      c.fill();
      c.strokeStyle = 'rgba(5,12,27,.14)';
      c.lineWidth = 1.0;
      c.beginPath();
      c.moveTo(5.5, 25);
      c.lineTo(24.4, 25);
      c.stroke();
      sprites.set(type, sprite);
    });
  }
  function drawTile(type, x, y, active = false) {
    if (y <= -CELL || y >= H) return;
    if (active && !reducedMotion.matches) {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = COLORS[type];
      ctx.drawImage(sprites.get(type), x, y, CELL, CELL);
      ctx.restore();
    } else ctx.drawImage(sprites.get(type), x, y, CELL, CELL);
  }
  function ghostY(p) {
    let y = p.y;
    while (fits(p.matrix, p.x, y + 1)) y++;
    return y;
  }
  function drawBoard(time) {
    ctx.save();
    const backdrop = ctx.createLinearGradient(0, 0, W, H);
    backdrop.addColorStop(0, '#0d182b');
    backdrop.addColorStop(.6, '#08111f');
    backdrop.addColorStop(1, '#0b1428');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(65,114,157,.030)';
    for (let y = 0; y < ROWS; y += 2) ctx.fillRect(0, y * CELL, W, CELL);
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) { ctx.moveTo(x * CELL + .5, 0); ctx.lineTo(x * CELL + .5, H); }
    for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * CELL + .5); ctx.lineTo(W, y * CELL + .5); }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(129,165,209,.068)';
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    if (game.shake > .1 && !reducedMotion.matches) {
      const amt = game.shake;
      ctx.translate((Math.random() - .5) * amt, (Math.random() - .5) * amt);
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const type = game.board[y][x];
        if (type) drawTile(type, x * CELL, y * CELL);
      }
    }
    if (game.player && game.state === 'playing') {
      const p = game.player;
      const destY = ghostY(p);
      if (destY > p.y) {
        const pulse = reducedMotion.matches ? .46 : .42 + .10 * Math.sin(time / 370);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = COLORS[p.type];
        ctx.lineWidth = 1.4;
        forCells(p.matrix, (dx, dy) => {
          const gx = (p.x + dx) * CELL + 3.5;
          const gy = (destY + dy) * CELL + 3.5;
          roundedRect(ctx, gx, gy, CELL - 7, CELL - 7, 4.5);
          ctx.stroke();
        });
        ctx.restore();
      }
      forCells(p.matrix, (dx, dy) => drawTile(p.type, (p.x + dx) * CELL, (p.y + dy) * CELL, true));
    }
    if (game.streaks.length) {
      game.streaks.forEach((s) => {
        ctx.save();
        ctx.globalAlpha = .4 * s.life / s.maxLife;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y1);
        ctx.lineTo(s.x, s.y2);
        ctx.stroke();
        ctx.restore();
      });
    }
    if (game.state === 'clearing' || (game.state === 'paused' && game.pausedFrom === 'clearing')) {
      const k = Math.min(1, game.clearElapsed / CLEAR_DURATION);
      game.clearRows.forEach((row) => {
        const y = row * CELL;
        ctx.fillStyle = `rgba(235,252,255,${.18 + .68 * Math.sin(k * Math.PI)})`;
        ctx.fillRect(0, y, W, CELL);
        ctx.fillStyle = `rgba(85,239,248,${.5 * (1 - k)})`;
        ctx.fillRect((1 - k) * W / 2, y, k * W, CELL);
      });
    }
    game.particles.forEach((p) => {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      roundedRect(ctx, p.x, p.y, p.size, p.size, p.size * .26);
      ctx.fill();
      ctx.restore();
    });
    if (game.feedback) {
      const f = game.feedback;
      const a = Math.min(1, f.life / 240, (f.maxLife - f.life) / 140);
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ecffff';
      ctx.shadowColor = '#4fe9f2';
      ctx.shadowBlur = 17;
      ctx.font = '900 27px system-ui, sans-serif';
      ctx.fillText(f.text, W / 2, H * .32 - (1 - f.life / f.maxLife) * 36);
      ctx.shadowBlur = 0;
      ctx.font = '800 14px system-ui, sans-serif';
      ctx.fillStyle = '#80f5f1';
      ctx.fillText('+' + f.points, W / 2, H * .32 + 23 - (1 - f.life / f.maxLife) * 36);
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  }
  function emitParticles(x, y, color, count, maxLife) {
    if (reducedMotion.matches) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 155;
      game.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 25,
        color, life: maxLife * (.60 + Math.random() * .45), maxLife,
        size: 2 + Math.random() * 4
      });
    }
    if (game.particles.length > 180) game.particles.splice(0, game.particles.length - 180);
  }
  function updateEffects(dt) {
    if (game.state === 'paused') return;
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.vy += 180 * dt / 1000;
      p.life -= dt;
      if (p.life <= 0) game.particles.splice(i, 1);
    }
    for (let i = game.streaks.length - 1; i >= 0; i--) {
      game.streaks[i].life -= dt;
      if (game.streaks[i].life <= 0) game.streaks.splice(i, 1);
    }
    if (game.feedback) {
      game.feedback.life -= dt;
      if (game.feedback.life <= 0) game.feedback = null;
    }
    game.shake = Math.max(0, game.shake - dt * .027);
  }
  function drawPreview(canvasEl, type, small = false) {
    const c = canvasEl.getContext('2d');
    c.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    if (!type) {
      c.strokeStyle = 'rgba(113,149,195,.18)';
      c.lineWidth = 1.1;
      c.setLineDash([3, 4]);
      roundedRect(c, 44, 20, 32, 30, 5);
      c.stroke();
      c.setLineDash([]);
      return;
    }
    const shape = SHAPES[type];
    let minX = 5, maxX = 0, minY = 5, maxY = 0;
    forCells(shape, (x, y) => { minX = Math.min(x, minX); maxX = Math.max(x, maxX); minY = Math.min(y, minY); maxY = Math.max(y, maxY); });
    const unit = small ? 18 : 23;
    const shapeWidth = (maxX - minX + 1) * unit;
    const shapeHeight = (maxY - minY + 1) * unit;
    const startX = (PREVIEW_W - shapeWidth) / 2;
    const startY = (PREVIEW_H - shapeHeight) / 2;
    forCells(shape, (x, y) => {
      c.drawImage(sprites.get(type), startX + (x - minX) * unit, startY + (y - minY) * unit, unit, unit);
    });
  }
  function updatePreviews() {
    drawPreview(previews[0], game.hold);
    drawPreview(previews[1], game.next[0]);
    drawPreview(previews[2], game.next[1], true);
    drawPreview(previews[3], game.next[2], true);
  }
  function resizeCanvases() {
    const ratio = Math.min(2.5, window.devicePixelRatio || 1);
    [canvas, ...previews].forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) return;
      const pw = Math.round(rect.width * ratio);
      const ph = Math.round(rect.height * ratio);
      if (element.width !== pw || element.height !== ph) {
        element.width = pw;
        element.height = ph;
      }
      const context = index === 0 ? ctx : element.getContext('2d');
      const logicalW = index === 0 ? W : PREVIEW_W;
      const logicalH = index === 0 ? H : PREVIEW_H;
      context.setTransform(element.width / logicalW, 0, 0, element.height / logicalH, 0, 0);
    });
    updatePreviews();
  }
  function frame(time) {
    const dt = game.lastFrame ? Math.min(50, Math.max(0, time - game.lastFrame)) : 0;
    game.lastFrame = time;
    tick(dt, time);
    updateEffects(dt);
    drawBoard(time);
    requestAnimationFrame(frame);
  }

  // Any non-interactive surface supports taps to rotate and drags to move.
  // The same drag can change from vertical to horizontal after a piece lands.
  const gestureRoot = document.documentElement;
  const interactiveSelector = [
    'button', 'a[href]', 'input', 'select', 'textarea', 'summary', 'label',
    '[contenteditable]:not([contenteditable="false"])',
    '[role="button"]', '[role="link"]', '[role="slider"]',
    '[data-gesture-ignore]'
  ].join(', ');
  let gesture = null;

  document.addEventListener('pointerdown', (event) => {
    if (game.state !== 'playing' || !event.isPrimary || gesture) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest(interactiveSelector)) return;
    event.preventDefault();
    sound.unlock();
    gesture = {
      id: event.pointerId, piece: game.player,
      x: event.clientX, y: event.clientY,
      start: performance.now(), moved: false, initialAxis: null,
      appliedX: 0, appliedY: 0
    };
    // Keep following the finger when it crosses between cards and the board.
    try { gestureRoot.setPointerCapture(event.pointerId); } catch (_) {}
  });
  document.addEventListener('pointermove', (event) => {
    if (!gesture || gesture.id !== event.pointerId || game.state !== 'playing') return;
    event.preventDefault();
    // Never transfer an unfinished touch to a newly spawned/held piece.
    if (gesture.piece !== game.player) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 13) {
      gesture.moved = true;
      if (!gesture.initialAxis) gesture.initialAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }
    const step = Math.max(15, canvas.getBoundingClientRect().width / COLS * .85);
    // Process axes independently, so a continued vertical drag can start
    // shifting sideways on the ground (and vice versa) before the 500 ms expire.
    const desiredX = Math.trunc(dx / step);
    const difference = Math.max(-12, Math.min(12, desiredX - gesture.appliedX));
    for (let i = 0; i < Math.abs(difference); i++) move(Math.sign(difference));
    gesture.appliedX = desiredX;

    const desiredY = Math.floor(Math.max(0, dy) / (step * 1.15));
    if (desiredY > gesture.appliedY) softDrop(desiredY - gesture.appliedY);
    gesture.appliedY = Math.max(gesture.appliedY, desiredY);
  });
  document.addEventListener('pointerup', (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const swipe = gesture;
    gesture = null;
    if (game.state !== 'playing' || swipe.piece !== game.player) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    const elapsed = performance.now() - swipe.start;
    if (!swipe.moved && Math.abs(dx) < 13 && Math.abs(dy) < 13 && elapsed < 420) {
      // Tap-to-rotate works on the board, previews, scoreboard and blank page.
      rotate(1);
    } else if (swipe.initialAxis === 'y' && dy < -25) {
      rotate(1);
    } else if (swipe.initialAxis === 'y' && dy > Math.max(65, canvas.getBoundingClientRect().width * .27) && elapsed < 420 && Math.abs(dy) > Math.abs(dx)) {
      // An intentional quick downward flick remains an immediate hard drop.
      hardDrop();
    }
  });
  document.addEventListener('pointercancel', (event) => {
    if (gesture && gesture.id === event.pointerId) gesture = null;
  });
  gestureRoot.addEventListener('lostpointercapture', (event) => {
    if (gesture && gesture.id === event.pointerId) gesture = null;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function performAction(name) {
    switch (name) {
      case 'left': move(-1); break;
      case 'right': move(1); break;
      case 'rotate': rotate(1); break;
      case 'down': softDrop(1); break;
      case 'drop': hardDrop(); break;
    }
  }
  const repeating = new Map();
  function stopRepeat(button) {
    const old = repeating.get(button);
    if (old) { clearTimeout(old.timeout); clearInterval(old.interval); repeating.delete(button); }
    button.classList.remove('is-pressed');
  }
  actionButtons.forEach((button) => {
    const name = button.dataset.control;
    if (['left', 'right', 'down'].includes(name)) {
      button.addEventListener('pointerdown', (event) => {
        if (game.state !== 'playing' || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        sound.unlock();
        stopRepeat(button);
        performAction(name);
        button.classList.add('is-pressed');
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
        const entry = { timeout: null, interval: null };
        entry.timeout = setTimeout(() => {
          if (game.state !== 'playing') { stopRepeat(button); return; }
          entry.interval = setInterval(() => {
            if (game.state !== 'playing') { stopRepeat(button); return; }
            performAction(name);
          }, name === 'down' ? 48 : 68);
        }, 190);
        repeating.set(button, entry);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => button.addEventListener(type, () => stopRepeat(button)));
      // Keyboard activation of buttons fires click without pointerdown.
      button.addEventListener('click', (event) => { if (event.detail === 0) { sound.unlock(); performAction(name); } });
    } else {
      button.addEventListener('click', () => { sound.unlock(); performAction(name); });
    }
  });
  holdButton.addEventListener('click', () => { sound.unlock(); holdPiece(); });
  $('overlay-button').addEventListener('click', () => {
    sound.unlock();
    if (game.state === 'paused') pauseGame();
    else startGame();
  });
  pauseButton.addEventListener('click', pauseGame);
  soundButton.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    safeWrite('neon-stack-sound', sound.enabled ? 'on' : 'off');
    if (sound.enabled) { sound.unlock(); sound.play('rotate'); }
    updateSoundButton();
  });
  document.addEventListener('keydown', (event) => {
    const key = event.key;
    const lower = key.toLowerCase();
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    if (lower === 'm') {
      event.preventDefault();
      soundButton.click();
      return;
    }
    if (lower === 'p' || key === 'Escape') {
      event.preventDefault();
      pauseGame();
      return;
    }
    // Keep native keyboard activation for focused controls.
    if ((key === ' ' || key === 'Enter') && event.target instanceof HTMLButtonElement) return;
    if (game.state === 'ready' || game.state === 'over') {
      if (key === 'Enter' || key === ' ') { event.preventDefault(); startGame(); }
      return;
    }
    if (game.state === 'paused') {
      if (key === 'Enter' || key === ' ') { event.preventDefault(); pauseGame(); }
      return;
    }
    if (game.state !== 'playing') return;
    let handled = true;
    sound.unlock();
    switch (key) {
      case 'ArrowLeft': move(-1); break;
      case 'ArrowRight': move(1); break;
      case 'ArrowDown': softDrop(1); break;
      case 'ArrowUp': rotate(1); break;
      case ' ': if (!event.repeat) hardDrop(); break;
      default:
        switch (lower) {
          case 'x': rotate(1); break;
          case 'z': rotate(-1); break;
          case 'c': if (!event.repeat) holdPiece(); break;
          default: handled = false;
        }
    }
    if (handled) event.preventDefault();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (game.state === 'playing' || game.state === 'clearing')) pauseGame();
  });
  window.addEventListener('blur', () => {
    if (game.state === 'playing' || game.state === 'clearing') pauseGame();
  });

  function updatePwaStatus() {
    const status = $('connection-status');
    if (location.protocol === 'file:') status.textContent = 'PWA: HTTPS NÖTIG';
    else if (!navigator.onLine) status.textContent = 'OFFLINE / SPIELBEREIT';
    else if (navigator.serviceWorker && navigator.serviceWorker.controller) status.textContent = 'OFFLINE READY';
    else status.textContent = 'PWA / BEREIT';
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).then(() => {
        updatePwaStatus();
      }).catch(() => updatePwaStatus());
    });
    navigator.serviceWorker.addEventListener('controllerchange', updatePwaStatus);
  }
  window.addEventListener('online', updatePwaStatus);
  window.addEventListener('offline', updatePwaStatus);

  // Test hooks only when explicitly requested. Not needed for gameplay.
  if (new URLSearchParams(location.search).has('debug')) {
    window.__neonDebug = {
      snapshot: () => ({
        state: game.state, board: game.board.map((row) => row.slice()),
        player: game.player ? { ...game.player, matrix: cloneMatrix(game.player.matrix) } : null,
        score: game.score, lines: game.lines, level: game.level, hold: game.hold,
        next: game.next.slice(), canHold: game.canHold, clearRows: game.clearRows.slice(),
        grounded: isGrounded(), lockElapsed: game.lockElapsed,
        lockRemaining: game.groundedAt === null ? null : Math.max(0, LOCK_DELAY - game.lockElapsed)
      }),
      setBoard: (board) => { if (board.length === ROWS && board.every((row) => row.length === COLS)) game.board = board.map((row) => row.slice()); },
      setPiece: (type, x, y) => { spawn(type); game.player.x = x; game.player.y = y; },
      action: (name) => { if (name === 'hold') holdPiece(); else performAction(name); },
      rotate: (dir) => rotate(dir),
      pause: pauseGame,
      finishClear
    };
  }

  initSprites();
  updateHUD();
  updateSoundButton();
  refreshUI();
  updatePwaStatus();
  resizeCanvases();
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(resizeCanvases);
    [canvas, ...previews].forEach((element) => ro.observe(element));
  } else window.addEventListener('resize', resizeCanvases);
  requestAnimationFrame(frame);
})();
