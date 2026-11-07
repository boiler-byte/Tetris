(function () {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 28;
  const NEXT_BLOCK = 22;

  const COLORS = {
    I: '#3ec9e8',
    J: '#5a6bff',
    L: '#ff9f43',
    O: '#ffd93d',
    S: '#4ade80',
    T: '#c56bff',
    Z: '#ff5a7a'
  };

  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]]
  };

  const TYPES = Object.keys(SHAPES);

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('nextCanvas');
  const nctx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const linesEl = document.getElementById('lines');
  const overlay = document.getElementById('overlay');
  const overlayText = document.getElementById('overlayText');
  const startBtn = document.getElementById('startBtn');

  function setupCanvas() {
    const maxH = window.innerHeight - 40;
    const maxW = window.innerWidth - 220;
    let block = BLOCK;
    if (window.innerWidth < 620) {
      block = Math.min(
        Math.floor((window.innerWidth * 0.62) / COLS),
        Math.floor((window.innerHeight - 30) / ROWS)
      );
    } else {
      block = Math.min(
        Math.floor(maxW / COLS),
        Math.floor(maxH / ROWS),
        BLOCK
      );
    }
    block = Math.max(10, block);
    canvas.width = COLS * block;
    canvas.height = ROWS * block;
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    return block;
  }

  let blockSize = setupCanvas();

  let grid, current, nextPiece, score, level, lines, dropCounter, dropInterval, lastTime, paused, gameOver, started, rafId;

  function createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function randomPiece() {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const shape = SHAPES[type].map(row => row.slice());
    return { type, shape, x: 0, y: 0 };
  }

  function spawnPiece() {
    current = nextPiece || randomPiece();
    nextPiece = randomPiece();
    current.x = Math.floor((COLS - current.shape[0].length) / 2);
    current.y = current.type === 'I' ? -1 : 0;
    if (collides(current.shape, current.x, current.y)) {
      endGame();
    }
    drawNext();
  }

  function collides(shape, ox, oy) {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const gx = ox + x;
        const gy = oy + y;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
    }
    return false;
  }

  function mergePiece() {
    current.shape.forEach((row, y) => {
      row.forEach((val, x) => {
        if (!val) return;
        const gy = current.y + y;
        const gx = current.x + x;
        if (gy >= 0) grid[gy][gx] = current.type;
      });
    });
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(cell => cell)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      lines += cleared;
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel > level) {
        level = newLevel;
        dropInterval = Math.max(80, 800 - (level - 1) * 70);
      }
      updateHUD();
    }
  }

  function rotateShape(shape, dir) {
    const n = shape.length;
    const result = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (dir > 0) result[x][n - 1 - y] = shape[y][x];
        else result[n - 1 - x][y] = shape[y][x];
      }
    }
    return result;
  }

  function rotate(dir) {
    if (!current || paused || gameOver) return;
    const rotated = rotateShape(current.shape, dir);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collides(rotated, current.x + k, current.y)) {
        current.shape = rotated;
        current.x += k;
        return;
      }
    }
  }

  function move(dx) {
    if (!current || paused || gameOver) return;
    if (!collides(current.shape, current.x + dx, current.y)) {
      current.x += dx;
    }
  }

  function softDrop() {
    if (!current || paused || gameOver) return;
    if (!collides(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      updateHUD();
    } else {
      lockPiece();
    }
    dropCounter = 0;
  }

  function hardDrop() {
    if (!current || paused || gameOver) return;
    let dist = 0;
    while (!collides(current.shape, current.x, current.y + 1)) {
      current.y++;
      dist++;
    }
    score += dist * 2;
    updateHUD();
    lockPiece();
  }

  function lockPiece() {
    mergePiece();
    clearLines();
    spawnPiece();
    dropCounter = 0;
  }

  function drawCell(context, x, y, size, type) {
    const color = COLORS[type];
    if (!color) return;
    const px = x * size;
    const py = y * size;
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(px + 1, py + 1, size - 2, Math.max(2, size * 0.14));
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(px + 1, py + size - 1 - Math.max(2, size * 0.14), size - 2, Math.max(2, size * 0.14));
    context.strokeStyle = 'rgba(0,0,0,0.45)';
    context.lineWidth = 1;
    context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
  }

  function drawGridLines() {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * blockSize, 0);
      ctx.lineTo(x * blockSize, ROWS * blockSize);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * blockSize);
      ctx.lineTo(COLS * blockSize, y * blockSize);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGridLines();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) drawCell(ctx, x, y, blockSize, grid[y][x]);
      }
    }

    if (current && !gameOver) {
      let gy = current.y;
      while (!collides(current.shape, current.x, gy + 1)) gy++;
      current.shape.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val && gy + y >= 0) {
            ctx.globalAlpha = 0.18;
            drawCell(ctx, current.x + x, gy + y, blockSize, current.type);
            ctx.globalAlpha = 1;
          }
        });
      });

      current.shape.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val && current.y + y >= 0) {
            drawCell(ctx, current.x + x, current.y + y, blockSize, current.type);
          }
        });
      });
    }
  }

  function drawNext() {
    nctx.fillStyle = '#0a0a12';
    nctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPiece) return;
    const shape = nextPiece.shape;
    const type = nextPiece.type;
    let minX = 99, maxX = -1, minY = 99, maxY = -1;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const size = Math.floor(Math.min(nextCanvas.width / w, nextCanvas.height / h, NEXT_BLOCK));
    const offX = Math.floor((nextCanvas.width - w * size) / 2);
    const offY = Math.floor((nextCanvas.height - h * size) / 2);
    nctx.save();
    nctx.translate(offX - minX * size, offY - minY * size);
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) drawCell(nctx, x, y, size, type);
      }
    }
    nctx.restore();
  }

  function updateHUD() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  function endGame() {
    gameOver = true;
    cancelAnimationFrame(rafId);
    overlayText.innerHTML = 'GAME OVER<br>Punkte: <b>' + score + '</b>';
    startBtn.textContent = 'NOCHMAL';
    overlay.classList.remove('hidden');
  }

  function togglePause() {
    if (gameOver || !started) return;
    paused = !paused;
    if (paused) {
      overlayText.innerHTML = 'PAUSE';
      startBtn.textContent = 'WEITER';
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  }

  function loop(time) {
    if (paused || gameOver) return;
    if (!lastTime) lastTime = time;
    const delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      if (!collides(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
      dropCounter = 0;
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function startGame() {
    grid = createGrid();
    score = 0;
    level = 1;
    lines = 0;
    dropCounter = 0;
    dropInterval = 800;
    paused = false;
    gameOver = false;
    started = true;
    lastTime = 0;
    nextPiece = randomPiece();
    updateHUD();
    spawnPiece();
    overlay.classList.add('hidden');
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') {
      togglePause();
      return;
    }
    if (!started || paused || gameOver) return;
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); move(-1); break;
      case 'ArrowRight': e.preventDefault(); move(1); break;
      case 'ArrowDown': e.preventDefault(); softDrop(); break;
      case 'ArrowUp': case 'x': case 'X': e.preventDefault(); rotate(1); break;
      case 'z': case 'Z': e.preventDefault(); rotate(-1); break;
      case ' ': e.preventDefault(); hardDrop(); break;
    }
  });

  // Touch / Swipe
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0, touchMoved = false, touchLastX = 0;
  const SWIPE_THRESHOLD = 24;

  canvas.addEventListener('touchstart', (e) => {
    if (!started || paused || gameOver) return;
    const t = e.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchLastX = t.clientX;
    touchStartTime = Date.now();
    touchMoved = false;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!started || paused || gameOver) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchLastX;
    if (Math.abs(t.clientX - touchStartX) > SWIPE_THRESHOLD && Math.abs(t.clientX - touchStartX) > Math.abs(t.clientY - touchStartY)) {
      if (dx > SWIPE_THRESHOLD * 0.6) { move(1); touchLastX = t.clientX; touchMoved = true; }
      else if (dx < -SWIPE_THRESHOLD * 0.6) { move(-1); touchLastX = t.clientX; touchMoved = true; }
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (!started || paused || gameOver) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;

    if (!touchMoved) {
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
        if (dt < 250) rotate(1);
      } else if (dy > 80 && Math.abs(dy) > Math.abs(dx) && dt < 400) {
        hardDrop();
      } else if (dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        softDrop(); softDrop();
      }
    } else if (dy < -SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) && dt < 300) {
      rotate(1);
    }
    e.preventDefault();
  }, { passive: false });

  startBtn.addEventListener('click', () => {
    if (paused && started && !gameOver) {
      togglePause();
    } else {
      startGame();
    }
  });

  window.addEventListener('resize', () => {
    blockSize = setupCanvas();
    if (grid) draw();
  });

  // Init display
  grid = createGrid();
  score = 0; level = 1; lines = 0; gameOver = false; paused = false; started = false;
  draw();
})();
