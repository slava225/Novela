const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  money: document.getElementById('money'),
  wanted: document.getElementById('wanted'),
  speed: document.getElementById('speed'),
  task: document.getElementById('task'),
  cops: document.getElementById('cops'),
};

const keys = new Set();
const world = { w: 3600, h: 3600, block: 200 };
const camera = { x: 0, y: 0 };

const player = { x: 900, y: 900, rot: 0, speed: 0, max: 6.5, accel: 0.24, friction: 0.93 };
const state = { money: 0, wanted: 0, particles: [], cops: [], task: null };

const npcs = Array.from({ length: 36 }, (_, i) => ({
  x: 200 + ((i * 79) % 3000),
  y: 260 + ((i * 123) % 3000),
  vx: Math.random() * 1.4 - 0.7,
  vy: Math.random() * 1.4 - 0.7,
}));

function resetTask() {
  state.task = {
    pickup: randomRoadPoint(),
    drop: randomRoadPoint(),
    phase: 'pickup',
  };
}
resetTask();

window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'r') {
    player.x = 900; player.y = 900; player.speed = 0; player.rot = 0;
    state.money = 0; state.wanted = 0; state.cops = [];
    resetTask();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('resize', fitCanvas);
fitCanvas();

function fitCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}

function randomRoadPoint() {
  const bx = Math.floor(Math.random() * (world.w / world.block - 2)) + 1;
  const by = Math.floor(Math.random() * (world.h / world.block - 2)) + 1;
  return { x: bx * world.block + 100, y: by * world.block + 100 };
}

function isRoad(x, y) {
  const gx = Math.floor(x / world.block);
  const gy = Math.floor(y / world.block);
  return gx % 3 === 0 || gy % 3 === 0;
}

function update() {
  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  const up = keys.has('w') || keys.has('arrowup');
  const down = keys.has('s') || keys.has('arrowdown');

  if (left) player.rot -= 0.058;
  if (right) player.rot += 0.058;
  if (up) player.speed += player.accel;
  if (down) player.speed -= player.accel * 0.7;
  if (keys.has(' ')) player.speed *= 0.88;

  player.speed *= player.friction;
  const max = isRoad(player.x, player.y) ? player.max : player.max * 0.6;
  player.speed = Math.max(-max, Math.min(max, player.speed));

  player.x += Math.cos(player.rot) * player.speed;
  player.y += Math.sin(player.rot) * player.speed;
  player.x = Math.max(0, Math.min(world.w, player.x));
  player.y = Math.max(0, Math.min(world.h, player.y));

  if (!isRoad(player.x, player.y) && Math.abs(player.speed) > 3.6) state.wanted = Math.min(5, state.wanted + 0.008);
  state.wanted = Math.max(0, state.wanted - 0.0015);

  for (const p of npcs) {
    p.x += p.vx;
    p.y += p.vy;
    if (!isRoad(p.x, p.y) || p.x < 80 || p.x > world.w - 80) p.vx *= -1;
    if (!isRoad(p.x, p.y) || p.y < 80 || p.y > world.h - 80) p.vy *= -1;

    const dx = p.x - player.x;
    const dy = p.y - player.y;
    if (dx * dx + dy * dy < 500) {
      state.wanted = Math.min(5, state.wanted + 0.12);
      spawnParticle(player.x, player.y, '#ff6767');
      p.vx = (Math.random() - 0.5) * 2;
      p.vy = (Math.random() - 0.5) * 2;
    }
  }

  const target = state.task.phase === 'pickup' ? state.task.pickup : state.task.drop;
  const tx = target.x - player.x;
  const ty = target.y - player.y;
  if (tx * tx + ty * ty < 1600) {
    if (state.task.phase === 'pickup') {
      state.task.phase = 'drop';
      ui.task.textContent = 'Deliver package';
    } else {
      const reward = 200 + Math.floor((5 - state.wanted) * 40);
      state.money += reward;
      state.wanted = Math.max(0, state.wanted - 1.2);
      resetTask();
    }
  }

  syncCops();
  for (const c of state.cops) {
    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    c.x += (dx / dist) * c.speed;
    c.y += (dy / dist) * c.speed;

    if (dist < 36) {
      state.wanted = Math.max(0, state.wanted - 0.03);
      player.speed *= 0.92;
      spawnParticle(player.x, player.y, '#4da3ff');
    }
  }

  state.particles.forEach((p) => { p.life -= 1; p.x += p.vx; p.y += p.vy; });
  state.particles = state.particles.filter((p) => p.life > 0);

  camera.x += (player.x - camera.x) * 0.1;
  camera.y += (player.y - camera.y) * 0.1;

  ui.money.textContent = `$${state.money}`;
  ui.wanted.textContent = state.wanted.toFixed(1);
  ui.speed.textContent = `${Math.abs(player.speed * 32).toFixed(0)} km/h`;
  ui.task.textContent = state.task.phase === 'pickup' ? 'Pick up package' : 'Deliver package';
  ui.cops.textContent = `${state.cops.length}`;
}

function syncCops() {
  const needed = Math.floor(state.wanted * 1.6);
  while (state.cops.length < needed) {
    state.cops.push({ x: player.x + Math.random() * 500 - 250, y: player.y + Math.random() * 500 - 250, speed: 1.6 + Math.random() });
  }
  while (state.cops.length > needed) state.cops.pop();
}

function draw() {
  ctx.fillStyle = '#0f1524';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2 - camera.x, canvas.height / 2 - camera.y);

  drawCity();
  drawTaskPoint(state.task.pickup, '#ffd74d');
  drawTaskPoint(state.task.drop, '#53f4c2');
  drawNPCs();
  drawCops();
  drawPlayer();
  drawParticles();

  ctx.restore();
}

function drawCity() {
  const size = world.block;
  const startX = Math.floor((camera.x - canvas.width / 2) / size) - 1;
  const endX = Math.floor((camera.x + canvas.width / 2) / size) + 2;
  const startY = Math.floor((camera.y - canvas.height / 2) / size) - 1;
  const endY = Math.floor((camera.y + canvas.height / 2) / size) + 2;

  for (let gy = startY; gy <= endY; gy++) {
    for (let gx = startX; gx <= endX; gx++) {
      const x = gx * size;
      const y = gy * size;
      const road = gx % 3 === 0 || gy % 3 === 0;

      if (road) {
        ctx.fillStyle = '#31384a';
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = '#8d94ab66';
        if (gx % 3 === 0) {
          for (let i = 0; i < 4; i++) ctx.strokeRect(x + size / 2 - 4, y + i * 52 + 8, 8, 30);
        }
        if (gy % 3 === 0) {
          for (let i = 0; i < 4; i++) ctx.strokeRect(x + i * 52 + 8, y + size / 2 - 4, 30, 8);
        }
      } else {
        ctx.fillStyle = (gx + gy) % 2 === 0 ? '#1a2336' : '#1a3f2d';
        ctx.fillRect(x, y, size, size);
        if ((gx * 7 + gy * 11) % 5) {
          ctx.fillStyle = '#2d3b59';
          ctx.fillRect(x + 26, y + 22, 148, 156);
          ctx.fillStyle = '#455782';
          for (let wy = 36; wy < 160; wy += 20) {
            for (let wx = 40; wx < 150; wx += 18) ctx.fillRect(x + wx, y + wy, 8, 10);
          }
        }
      }
    }
  }
}

function drawTaskPoint(p, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.rot);
  ctx.fillStyle = '#4de3ff';
  ctx.fillRect(-18, -10, 36, 20);
  ctx.fillStyle = '#b5f5ff';
  ctx.fillRect(2, -8, 12, 16);
  ctx.fillStyle = '#111';
  ctx.fillRect(-14, -9, 7, 18);
  ctx.restore();
}

function drawNPCs() {
  ctx.fillStyle = '#f6a0ff';
  for (const n of npcs) {
    ctx.fillRect(n.x - 4, n.y - 4, 8, 8);
  }
}

function drawCops() {
  for (const c of state.cops) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = '#4d7dff';
    ctx.fillRect(-14, -9, 28, 18);
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(-4, -11, 8, 4);
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = p.life / 40;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
    ctx.globalAlpha = 1;
  }
}

function spawnParticle(x, y, color) {
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      x,
      y,
      vx: Math.random() * 3 - 1.5,
      vy: Math.random() * 3 - 1.5,
      life: 40,
      color,
    });
  }
}

function frame() {
  update();
  draw();
  requestAnimationFrame(frame);
}
frame();
