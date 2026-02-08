const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  money: document.getElementById('money'),
  wanted: document.getElementById('wanted'),
  speed: document.getElementById('speed'),
  task: document.getElementById('task'),
  cops: document.getElementById('cops'),
  boost: document.getElementById('boost'),
};

const keys = new Set();
const world = { w: 3200, h: 3200, block: 160 };
const camera = { x: 1000, y: 1000, z: 0 };

const player = {
  x: 1000,
  y: 1000,
  z: 0,
  angle: 0,
  speed: 0,
  max: 7.8,
  accel: 0.24,
  drag: 0.952,
  turn: 0.045,
  boostCooldown: 0,
};

const state = {
  money: 0,
  wanted: 0,
  task: null,
  cops: [],
  npcs: [],
  particles: [],
  pulse: 0,
};

function seedNPCs() {
  state.npcs = Array.from({ length: 48 }, (_, i) => ({
    x: 120 + ((i * 113) % (world.w - 240)),
    y: 120 + ((i * 167) % (world.h - 240)),
    z: 0,
    angle: Math.random() * Math.PI * 2,
    speed: 0.8 + Math.random() * 0.8,
    dirTimer: 40 + Math.random() * 180,
  }));
}
seedNPCs();

function randomRoadPoint() {
  const gx = Math.floor(Math.random() * (world.w / world.block - 2)) + 1;
  const gy = Math.floor(Math.random() * (world.h / world.block - 2)) + 1;
  if (Math.random() > 0.5) return { x: gx * world.block + world.block / 2, y: Math.floor(gy / 3) * 3 * world.block + world.block / 2 };
  return { x: Math.floor(gx / 3) * 3 * world.block + world.block / 2, y: gy * world.block + world.block / 2 };
}

function resetTask() {
  state.task = { pickup: randomRoadPoint(), drop: randomRoadPoint(), phase: 'pickup' };
}
resetTask();

function resetGame() {
  player.x = 1000;
  player.y = 1000;
  player.angle = 0;
  player.speed = 0;
  player.boostCooldown = 0;
  state.money = 0;
  state.wanted = 0;
  state.cops = [];
  state.particles = [];
  resetTask();
}

window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'r') resetGame();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('resize', fitCanvas);
fitCanvas();

function fitCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}

function isRoad(x, y) {
  const gx = Math.floor(x / world.block);
  const gy = Math.floor(y / world.block);
  return gx % 3 === 0 || gy % 3 === 0;
}

function worldToScreen(x, y, z = 0) {
  const dx = x - camera.x;
  const dy = y - camera.y;
  const isoX = (dx - dy) * 0.9;
  const isoY = (dx + dy) * 0.45 - z;
  return { x: canvas.width / 2 + isoX, y: canvas.height / 2 + isoY };
}

function update() {
  state.pulse += 0.03;

  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  const up = keys.has('w') || keys.has('arrowup');
  const down = keys.has('s') || keys.has('arrowdown');
  const handbrake = keys.has(' ');

  const roadGrip = isRoad(player.x, player.y) ? 1 : 0.66;
  const steerFactor = 1 + Math.min(0.9, Math.abs(player.speed) / 6);

  if (left) player.angle -= player.turn * steerFactor;
  if (right) player.angle += player.turn * steerFactor;
  if (up) player.speed += player.accel * roadGrip;
  if (down) player.speed -= player.accel * 0.7;

  if (handbrake) {
    player.speed *= 0.9;
    if (Math.abs(player.speed) > 2.4 && (left || right)) {
      spawnParticles(player.x, player.y, '#9bdcff', 2);
      state.wanted = Math.min(5, state.wanted + 0.003);
    }
  }

  if ((keys.has('shift') || keys.has('shiftleft')) && player.boostCooldown <= 0 && Math.abs(player.speed) > 1.8) {
    player.speed += 2.6;
    player.boostCooldown = 240;
    spawnParticles(player.x, player.y, '#ffd67f', 22);
  }

  player.boostCooldown = Math.max(0, player.boostCooldown - 1);

  player.speed *= player.drag;
  const maxSpeed = player.max * roadGrip;
  player.speed = Math.max(-maxSpeed * 0.6, Math.min(maxSpeed, player.speed));

  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;

  player.x = Math.max(20, Math.min(world.w - 20, player.x));
  player.y = Math.max(20, Math.min(world.h - 20, player.y));

  if (!isRoad(player.x, player.y) && Math.abs(player.speed) > 3.1) {
    state.wanted = Math.min(5, state.wanted + 0.006);
  }
  state.wanted = Math.max(0, state.wanted - 0.0014);

  updateNPCs();
  updateTask();
  syncCops();
  updateCops();

  state.particles.forEach((p) => {
    p.life -= 1;
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    p.vz -= 0.03;
  });
  state.particles = state.particles.filter((p) => p.life > 0);

  camera.x += (player.x - camera.x) * 0.1;
  camera.y += (player.y - camera.y) * 0.1;

  ui.money.textContent = `$${state.money}`;
  ui.wanted.textContent = state.wanted.toFixed(1);
  ui.speed.textContent = `${Math.abs(player.speed * 28).toFixed(0)} km/h`;
  ui.task.textContent = state.task.phase === 'pickup' ? 'Pick up package' : 'Deliver package';
  ui.cops.textContent = `${state.cops.length}`;
  ui.boost.textContent = player.boostCooldown > 0 ? `${(player.boostCooldown / 60).toFixed(1)}s` : 'READY';
}

function updateNPCs() {
  for (const n of state.npcs) {
    n.dirTimer -= 1;
    if (n.dirTimer <= 0 || !isRoad(n.x, n.y)) {
      n.angle += (Math.random() - 0.5) * 2.4;
      n.dirTimer = 60 + Math.random() * 180;
    }

    n.x += Math.cos(n.angle) * n.speed;
    n.y += Math.sin(n.angle) * n.speed;
    n.x = Math.max(20, Math.min(world.w - 20, n.x));
    n.y = Math.max(20, Math.min(world.h - 20, n.y));

    const dx = n.x - player.x;
    const dy = n.y - player.y;
    if (dx * dx + dy * dy < 700) {
      state.wanted = Math.min(5, state.wanted + 0.08);
      n.angle += Math.PI * (0.6 + Math.random() * 0.6);
      spawnParticles(player.x, player.y, '#ff7f7f', 10);
    }
  }
}

function updateTask() {
  const target = state.task.phase === 'pickup' ? state.task.pickup : state.task.drop;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  if (dx * dx + dy * dy < 2600) {
    if (state.task.phase === 'pickup') {
      state.task.phase = 'drop';
      state.money += 120;
      state.wanted = Math.min(5, state.wanted + 0.2);
    } else {
      state.money += 260;
      state.wanted = Math.max(0, state.wanted - 1.1);
      resetTask();
    }
    spawnParticles(player.x, player.y, '#59ffb5', 18);
  }
}

function syncCops() {
  const target = Math.floor(state.wanted * 1.7);
  while (state.cops.length < target) {
    state.cops.push({
      x: player.x + (Math.random() * 620 - 310),
      y: player.y + (Math.random() * 620 - 310),
      speed: 1.2 + Math.random() * 1.2,
      angle: 0,
    });
  }
  while (state.cops.length > target) state.cops.pop();
}

function updateCops() {
  for (const c of state.cops) {
    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    c.angle = Math.atan2(dy, dx);
    c.x += (dx / dist) * c.speed;
    c.y += (dy / dist) * c.speed;

    if (dist < 42) {
      player.speed *= 0.88;
      state.wanted = Math.max(0, state.wanted - 0.02);
      spawnParticles(player.x, player.y, '#87a4ff', 6);
    }
  }
}

function draw() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#151b35');
  sky.addColorStop(1, '#090d19');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCity();
  drawTask(state.task.pickup, '#ffe066');
  drawTask(state.task.drop, '#58ffc8');

  const allCars = [
    ...state.npcs.map((n) => ({ ...n, type: 'npc' })),
    ...state.cops.map((n) => ({ ...n, type: 'cop' })),
    { ...player, type: 'player' },
  ].sort((a, b) => (a.x + a.y) - (b.x + b.y));

  allCars.forEach(drawCar);
  drawParticles();
}

function drawCity() {
  const size = world.block;
  const margin = 3;
  const cx = Math.floor(camera.x / size);
  const cy = Math.floor(camera.y / size);

  for (let gy = cy - 9; gy < cy + 10; gy++) {
    for (let gx = cx - 9; gx < cx + 10; gx++) {
      if (gx < 0 || gy < 0 || gx >= world.w / size || gy >= world.h / size) continue;
      const x = gx * size;
      const y = gy * size;
      const road = gx % 3 === 0 || gy % 3 === 0;
      drawIsoTile(x, y, size, road ? '#384157' : (gx + gy) % 2 === 0 ? '#1f2a41' : '#1f3a2f');

      if (road) {
        drawRoadMarkings(x, y, gx, gy, size);
      } else {
        const h = 36 + ((gx * 13 + gy * 7) % 42);
        drawBuilding(x + 12, y + 12, size - 24, size - 24, h);
      }
    }
  }

  for (let i = 0; i < margin; i++) {
    const glow = 0.03 + i * 0.015;
    ctx.strokeStyle = `rgba(95,164,255,${glow})`;
    ctx.strokeRect(i, i, canvas.width - i * 2, canvas.height - i * 2);
  }
}

function drawIsoTile(x, y, size, color) {
  const a = worldToScreen(x, y, 0);
  const b = worldToScreen(x + size, y, 0);
  const c = worldToScreen(x + size, y + size, 0);
  const d = worldToScreen(x, y + size, 0);

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawRoadMarkings(x, y, gx, gy, size) {
  ctx.strokeStyle = '#9ca5bf88';
  ctx.lineWidth = 2;
  if (gx % 3 === 0) {
    for (let i = 0; i < 4; i++) {
      const p1 = worldToScreen(x + size * 0.5, y + i * size * 0.25 + 10, 0);
      const p2 = worldToScreen(x + size * 0.5, y + i * size * 0.25 + 28, 0);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }
  if (gy % 3 === 0) {
    for (let i = 0; i < 4; i++) {
      const p1 = worldToScreen(x + i * size * 0.25 + 10, y + size * 0.5, 0);
      const p2 = worldToScreen(x + i * size * 0.25 + 28, y + size * 0.5, 0);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }
}

function drawBuilding(x, y, w, h, z) {
  const p1 = worldToScreen(x, y, 0);
  const p2 = worldToScreen(x + w, y, 0);
  const p3 = worldToScreen(x + w, y + h, 0);
  const p4 = worldToScreen(x, y + h, 0);

  const t1 = worldToScreen(x, y, z);
  const t2 = worldToScreen(x + w, y, z);
  const t3 = worldToScreen(x + w, y + h, z);
  const t4 = worldToScreen(x, y + h, z);

  ctx.fillStyle = '#1a2238';
  ctx.beginPath();
  ctx.moveTo(p4.x, p4.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#273155';
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2f3b66';
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#98d6ff66';
  const ww = Math.max(2, Math.floor(w / 24));
  const hh = Math.max(2, Math.floor(h / 26));
  for (let ix = 1; ix < ww; ix++) {
    for (let iy = 1; iy < hh; iy++) {
      const wx = x + (ix / ww) * w;
      const wy = y + (iy / hh) * h;
      const wp = worldToScreen(wx, wy, z - 3);
      ctx.fillRect(wp.x - 1.4, wp.y - 1.4, 2.8, 2.8);
    }
  }
}

function drawTask(target, color) {
  const p = worldToScreen(target.x, target.y, 0);
  const pulse = 14 + Math.sin(state.pulse * 2.4) * 3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 10, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.24;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 10, pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCar(entity) {
  const p = worldToScreen(entity.x, entity.y, entity.z || 0);
  const angle = entity.angle ?? 0;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle + Math.PI / 4);

  // shadow
  ctx.fillStyle = '#0000004d';
  ctx.beginPath();
  ctx.ellipse(0, 12, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = entity.type === 'player' ? '#53e8ff' : entity.type === 'cop' ? '#4f7dff' : '#ff77de';
  const roof = entity.type === 'player' ? '#c9f8ff' : entity.type === 'cop' ? '#dde5ff' : '#ffe3ff';

  ctx.fillStyle = body;
  ctx.fillRect(-14, -10, 28, 18);
  ctx.fillStyle = roof;
  ctx.fillRect(-8, -7, 16, 11);
  ctx.fillStyle = '#101a30';
  ctx.fillRect(-12, -9, 5, 16);
  ctx.fillRect(7, -9, 5, 16);

  if (entity.type === 'cop') {
    ctx.fillStyle = '#ff4f6f';
    ctx.fillRect(-4, -13, 8, 3);
  }

  if (entity.type === 'player' && Math.abs(player.speed) > 0.8) {
    const flameLen = Math.min(14, Math.abs(player.speed) * 1.6);
    ctx.fillStyle = '#ffb44d';
    ctx.fillRect(-2, 8, 4, flameLen);
  }

  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    const sp = worldToScreen(p.x, p.y, p.z);
    ctx.globalAlpha = p.life / 36;
    ctx.fillStyle = p.color;
    ctx.fillRect(sp.x, sp.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      z: 0,
      vx: Math.random() * 2 - 1,
      vy: Math.random() * 2 - 1,
      vz: Math.random() * 1.7,
      life: 18 + Math.random() * 18,
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
