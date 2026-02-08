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
const world = { w: 3840, h: 3840, block: 160 };
const camera = { x: 1000, y: 1000, z: 0 };

const player = {
  x: 900,
  y: 900,
  z: 0,
  angle: 0,
  speed: 0,
  radius: 20,
  max: 8.6,
  accel: 0.24,
  drag: 0.955,
  turn: 0.042,
  boostCooldown: 0,
};

const state = {
  money: 0,
  wanted: 0,
  task: null,
  cops: [],
  traffic: [],
  peds: [],
  particles: [],
  pulse: 0,
  time: 0,
};

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

function isRoadTile(gx, gy) {
  return gx % 3 === 0 || gy % 3 === 0;
}

function isRoad(x, y) {
  const gx = Math.floor(x / world.block);
  const gy = Math.floor(y / world.block);
  return isRoadTile(gx, gy);
}

function worldToScreen(x, y, z = 0) {
  const dx = x - camera.x;
  const dy = y - camera.y;
  const isoX = (dx - dy) * 0.9;
  const isoY = (dx + dy) * 0.45 - z;
  return { x: canvas.width / 2 + isoX, y: canvas.height / 2 + isoY };
}

function getSidewalkPointNearRoad(gx, gy) {
  const x = gx * world.block;
  const y = gy * world.block;
  const inset = 20;
  const side = (gx * 17 + gy * 23) % 4;

  if (side === 0) return { x: x + inset, y: y + world.block / 2 };
  if (side === 1) return { x: x + world.block - inset, y: y + world.block / 2 };
  if (side === 2) return { x: x + world.block / 2, y: y + inset };
  return { x: x + world.block / 2, y: y + world.block - inset };
}

function randomRoadPoint() {
  const gx = Math.floor(Math.random() * (world.w / world.block - 2)) + 1;
  const gy = Math.floor(Math.random() * (world.h / world.block - 2)) + 1;
  if (Math.random() > 0.5) return { x: gx * world.block + world.block / 2, y: Math.floor(gy / 3) * 3 * world.block + world.block / 2 };
  return { x: Math.floor(gx / 3) * 3 * world.block + world.block / 2, y: gy * world.block + world.block / 2 };
}

function randomSidewalkPoint() {
  let gx = 1;
  let gy = 1;
  for (let i = 0; i < 100; i++) {
    gx = Math.floor(Math.random() * (world.w / world.block));
    gy = Math.floor(Math.random() * (world.h / world.block));
    if (!isRoadTile(gx, gy)) break;
  }
  return getSidewalkPointNearRoad(gx, gy);
}

function resetTask() {
  state.task = { pickup: randomRoadPoint(), drop: randomRoadPoint(), phase: 'pickup' };
}

function seedTraffic() {
  state.traffic = Array.from({ length: 40 }, (_, i) => {
    const p = randomRoadPoint();
    return {
      x: p.x,
      y: p.y,
      z: 0,
      angle: Math.random() * Math.PI * 2,
      speed: 1.0 + Math.random() * 1.1,
      radius: 15,
      type: i % 7 === 0 ? 'van' : 'npc',
      timer: 20 + Math.random() * 180,
    };
  });
}

function seedPedestrians() {
  state.peds = Array.from({ length: 60 }, () => {
    const p = randomSidewalkPoint();
    return {
      x: p.x,
      y: p.y,
      z: 0,
      angle: Math.random() * Math.PI * 2,
      speed: 0.45 + Math.random() * 0.35,
      radius: 7,
      target: randomSidewalkPoint(),
      wait: Math.random() * 60,
      tint: Math.floor(Math.random() * 360),
    };
  });
}

function resetGame() {
  player.x = 900;
  player.y = 900;
  player.angle = 0;
  player.speed = 0;
  player.boostCooldown = 0;

  state.money = 0;
  state.wanted = 0;
  state.cops = [];
  state.particles = [];
  state.time = 0;

  seedTraffic();
  seedPedestrians();
  resetTask();
}

resetGame();

function resolveWorldCollision(entity) {
  entity.x = Math.max(entity.radius, Math.min(world.w - entity.radius, entity.x));
  entity.y = Math.max(entity.radius, Math.min(world.h - entity.radius, entity.y));

  const gx = Math.floor(entity.x / world.block);
  const gy = Math.floor(entity.y / world.block);
  if (isRoadTile(gx, gy)) return;

  const tileX = gx * world.block;
  const tileY = gy * world.block;
  const localX = entity.x - tileX;
  const localY = entity.y - tileY;

  const left = localX;
  const right = world.block - localX;
  const top = localY;
  const bottom = world.block - localY;

  const minDist = Math.min(left, right, top, bottom);

  if (minDist === left) entity.x = tileX - entity.radius;
  else if (minDist === right) entity.x = tileX + world.block + entity.radius;
  else if (minDist === top) entity.y = tileY - entity.radius;
  else entity.y = tileY + world.block + entity.radius;
}

function updatePlayer() {
  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  const up = keys.has('w') || keys.has('arrowup');
  const down = keys.has('s') || keys.has('arrowdown');
  const handbrake = keys.has(' ');

  const roadGrip = isRoad(player.x, player.y) ? 1 : 0.58;
  const steerFactor = 1 + Math.min(0.9, Math.abs(player.speed) / 5.8);

  if (left) player.angle -= player.turn * steerFactor;
  if (right) player.angle += player.turn * steerFactor;
  if (up) player.speed += player.accel * roadGrip;
  if (down) player.speed -= player.accel * 0.72;

  if (handbrake) {
    player.speed *= 0.905;
    if (Math.abs(player.speed) > 2.2 && (left || right)) {
      state.wanted = Math.min(5, state.wanted + 0.003);
      spawnParticles(player.x, player.y, '#9bdcff', 2);
    }
  }

  if ((keys.has('shift') || keys.has('shiftleft')) && player.boostCooldown <= 0 && Math.abs(player.speed) > 1.6) {
    player.speed += 2.7;
    player.boostCooldown = 220;
    spawnParticles(player.x, player.y, '#ffd67f', 20);
  }

  player.boostCooldown = Math.max(0, player.boostCooldown - 1);
  player.speed *= player.drag;

  const maxSpeed = player.max * roadGrip;
  player.speed = Math.max(-maxSpeed * 0.52, Math.min(maxSpeed, player.speed));

  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;
  resolveWorldCollision(player);

  if (!isRoad(player.x, player.y) && Math.abs(player.speed) > 2.8) {
    state.wanted = Math.min(5, state.wanted + 0.007);
  }
}

function updateTraffic() {
  for (const car of state.traffic) {
    car.timer -= 1;
    if (car.timer <= 0 || !isRoad(car.x, car.y)) {
      car.angle += (Math.random() - 0.5) * 1.7;
      car.timer = 40 + Math.random() * 180;
    }

    const aheadX = car.x + Math.cos(car.angle) * 28;
    const aheadY = car.y + Math.sin(car.angle) * 28;
    if (!isRoad(aheadX, aheadY)) {
      car.angle += (Math.random() - 0.5) * 2.4;
    }

    car.x += Math.cos(car.angle) * car.speed;
    car.y += Math.sin(car.angle) * car.speed;
    resolveWorldCollision(car);

    const dx = car.x - player.x;
    const dy = car.y - player.y;
    const minR = car.radius + player.radius;
    if (dx * dx + dy * dy < minR * minR) {
      const dist = Math.hypot(dx, dy) || 1;
      const push = (minR - dist) * 0.6;
      car.x += (dx / dist) * push;
      car.y += (dy / dist) * push;
      player.x -= (dx / dist) * push;
      player.y -= (dy / dist) * push;
      player.speed *= 0.75;
      state.wanted = Math.min(5, state.wanted + 0.1);
      spawnParticles(player.x, player.y, '#ff8f8f', 11);
    }
  }
}

function updatePedestrians() {
  for (const ped of state.peds) {
    if (ped.wait > 0) {
      ped.wait -= 1;
      continue;
    }

    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 10) {
      ped.target = randomSidewalkPoint();
      ped.wait = 20 + Math.random() * 70;
      continue;
    }

    const avoidX = ped.x - player.x;
    const avoidY = ped.y - player.y;
    const avoidDist = Math.hypot(avoidX, avoidY) || 1;
    const fear = avoidDist < 120 ? (120 - avoidDist) / 120 : 0;

    const dirX = dx / dist + (avoidX / avoidDist) * fear * 1.9;
    const dirY = dy / dist + (avoidY / avoidDist) * fear * 1.9;
    const dirLen = Math.hypot(dirX, dirY) || 1;

    ped.angle = Math.atan2(dirY, dirX);
    ped.x += (dirX / dirLen) * ped.speed;
    ped.y += (dirY / dirLen) * ped.speed;

    const gx = Math.floor(ped.x / world.block);
    const gy = Math.floor(ped.y / world.block);
    if (isRoadTile(gx, gy)) {
      const backX = -Math.cos(ped.angle) * 2;
      const backY = -Math.sin(ped.angle) * 2;
      ped.x += backX;
      ped.y += backY;
      ped.target = randomSidewalkPoint();
    }

    ped.x = Math.max(6, Math.min(world.w - 6, ped.x));
    ped.y = Math.max(6, Math.min(world.h - 6, ped.y));

    const pdx = ped.x - player.x;
    const pdy = ped.y - player.y;
    if (pdx * pdx + pdy * pdy < (ped.radius + player.radius) ** 2) {
      state.wanted = Math.min(5, state.wanted + 0.16);
      player.speed *= 0.7;
      ped.wait = 40;
      ped.target = randomSidewalkPoint();
      spawnParticles(ped.x, ped.y, '#ff6262', 10);
    }
  }
}

function updateTask() {
  const target = state.task.phase === 'pickup' ? state.task.pickup : state.task.drop;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  if (dx * dx + dy * dy < 2800) {
    if (state.task.phase === 'pickup') {
      state.task.phase = 'drop';
      state.money += 130;
      state.wanted = Math.min(5, state.wanted + 0.22);
    } else {
      state.money += 320;
      state.wanted = Math.max(0, state.wanted - 1.3);
      resetTask();
    }
    spawnParticles(player.x, player.y, '#63ffbb', 20);
  }
}

function syncCops() {
  const target = Math.floor(state.wanted * 1.9);
  while (state.cops.length < target) {
    state.cops.push({
      x: player.x + (Math.random() * 620 - 310),
      y: player.y + (Math.random() * 620 - 310),
      z: 0,
      angle: 0,
      speed: 1.4 + Math.random() * 1.2,
      radius: 17,
      type: 'cop',
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

    const slowNearBuilding = isRoad(c.x, c.y) ? 1 : 0.75;
    c.x += (dx / dist) * c.speed * slowNearBuilding;
    c.y += (dy / dist) * c.speed * slowNearBuilding;
    resolveWorldCollision(c);

    if (dist < c.radius + player.radius + 2) {
      player.speed *= 0.85;
      state.wanted = Math.max(0, state.wanted - 0.02);
      spawnParticles(player.x, player.y, '#87a4ff', 7);
    }
  }
}

function update() {
  state.time += 1;
  state.pulse += 0.03;

  updatePlayer();
  updateTraffic();
  updatePedestrians();
  updateTask();
  syncCops();
  updateCops();

  state.wanted = Math.max(0, state.wanted - 0.0012);

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
  ui.speed.textContent = `${Math.abs(player.speed * 29).toFixed(0)} km/h`;
  ui.task.textContent = state.task.phase === 'pickup' ? 'Pick up package' : 'Deliver package';
  ui.cops.textContent = `${state.cops.length}`;
  ui.boost.textContent = player.boostCooldown > 0 ? `${(player.boostCooldown / 60).toFixed(1)}s` : 'READY';
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

function drawBuilding(x, y, w, h, z) {
  const p2 = worldToScreen(x + w, y, 0);
  const p3 = worldToScreen(x + w, y + h, 0);
  const p4 = worldToScreen(x, y + h, 0);

  const t1 = worldToScreen(x, y, z);
  const t2 = worldToScreen(x + w, y, z);
  const t3 = worldToScreen(x + w, y + h, z);
  const t4 = worldToScreen(x, y + h, z);

  ctx.fillStyle = '#1a2239';
  ctx.beginPath();
  ctx.moveTo(p4.x, p4.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2a355b';
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.closePath();
  ctx.fill();

  const roof = ctx.createLinearGradient(t1.x, t1.y, t3.x, t3.y);
  roof.addColorStop(0, '#33447a');
  roof.addColorStop(1, '#25335c');
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#9bd8ff66';
  const ww = Math.max(2, Math.floor(w / 22));
  const hh = Math.max(2, Math.floor(h / 22));
  for (let ix = 1; ix < ww; ix++) {
    for (let iy = 1; iy < hh; iy++) {
      const wx = x + (ix / ww) * w;
      const wy = y + (iy / hh) * h;
      const wp = worldToScreen(wx, wy, z - 3);
      if ((ix + iy) % 2 === 0) ctx.fillRect(wp.x - 1.5, wp.y - 1.5, 3, 3);
    }
  }
}

function drawRoadMarkings(x, y, gx, gy, size) {
  ctx.strokeStyle = '#afbad999';
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

function drawStreetLamp(x, y) {
  const p = worldToScreen(x, y, 0);
  const top = worldToScreen(x, y, 26);
  const glow = 9 + Math.sin(state.time * 0.03 + x * 0.01) * 3;

  ctx.strokeStyle = '#6f7da3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();

  ctx.fillStyle = '#ffd996';
  ctx.beginPath();
  ctx.arc(top.x, top.y, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffdd8a';
  ctx.beginPath();
  ctx.arc(top.x, top.y, glow, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCity() {
  const size = world.block;
  const cx = Math.floor(camera.x / size);
  const cy = Math.floor(camera.y / size);

  for (let gy = cy - 9; gy < cy + 10; gy++) {
    for (let gx = cx - 9; gx < cx + 10; gx++) {
      if (gx < 0 || gy < 0 || gx >= world.w / size || gy >= world.h / size) continue;

      const x = gx * size;
      const y = gy * size;
      const road = isRoadTile(gx, gy);

      if (road) {
        drawIsoTile(x, y, size, (gx + gy) % 2 ? '#3b455f' : '#353f57');
        drawRoadMarkings(x, y, gx, gy, size);

        if ((gx + gy) % 4 === 0) {
          drawStreetLamp(x + size * 0.2, y + size * 0.18);
          drawStreetLamp(x + size * 0.8, y + size * 0.82);
        }
      } else {
        drawIsoTile(x, y, size, (gx + gy) % 2 ? '#24324f' : '#223a34');

        const sidewalk = 13;
        drawIsoTile(x + sidewalk, y + sidewalk, size - sidewalk * 2, (gx + gy) % 2 ? '#5d6078' : '#59606c');

        const h = 34 + ((gx * 11 + gy * 17) % 64);
        drawBuilding(x + 24, y + 24, size - 48, size - 48, h);
      }
    }
  }
}

function drawTask(target, color) {
  const p = worldToScreen(target.x, target.y, 0);
  const pulse = 15 + Math.sin(state.pulse * 2.3) * 3;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 9, 5.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.24;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 9, pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCar(entity) {
  const p = worldToScreen(entity.x, entity.y, entity.z || 0);
  const angle = entity.angle ?? 0;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle + Math.PI / 4);

  ctx.fillStyle = '#0000004a';
  ctx.beginPath();
  ctx.ellipse(0, 12, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = entity.type === 'player' ? '#55e9ff' : entity.type === 'cop' ? '#5f87ff' : entity.type === 'van' ? '#ffa96e' : '#ff77de';
  const roof = entity.type === 'player' ? '#c8f8ff' : entity.type === 'cop' ? '#ecf0ff' : entity.type === 'van' ? '#ffe5d2' : '#ffe7ff';

  ctx.fillStyle = body;
  ctx.fillRect(-14, -10, 28, 18);
  ctx.fillStyle = roof;
  ctx.fillRect(-8, -7, 16, 11);
  ctx.fillStyle = '#0d1428';
  ctx.fillRect(-12, -9, 5, 16);
  ctx.fillRect(7, -9, 5, 16);

  if (entity.type === 'cop') {
    ctx.fillStyle = '#ff4f6f';
    ctx.fillRect(-4, -13, 8, 3);
  }

  if (entity.type === 'player' && Math.abs(player.speed) > 0.8) {
    const flameLen = Math.min(14, Math.abs(player.speed) * 1.5);
    ctx.fillStyle = '#ffbd5a';
    ctx.fillRect(-2, 8, 4, flameLen);
  }

  ctx.restore();
}

function drawPedestrian(ped) {
  const p = worldToScreen(ped.x, ped.y, 0);
  ctx.save();
  ctx.translate(p.x, p.y - 1);

  ctx.fillStyle = '#00000040';
  ctx.beginPath();
  ctx.ellipse(0, 5, 5, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(ped.angle + Math.PI / 2);
  ctx.fillStyle = `hsl(${ped.tint}, 72%, 70%)`;
  ctx.fillRect(-2.5, -6, 5, 10);
  ctx.fillStyle = '#ffd9b6';
  ctx.beginPath();
  ctx.arc(0, -8, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    const sp = worldToScreen(p.x, p.y, p.z);
    ctx.globalAlpha = p.life / 34;
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
      life: 16 + Math.random() * 18,
      color,
    });
  }
}

function draw() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#19244a');
  bg.addColorStop(1, '#0a0e1f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCity();
  drawTask(state.task.pickup, '#ffe069');
  drawTask(state.task.drop, '#66ffd0');

  const entities = [
    ...state.peds.map((e) => ({ ...e, kind: 'ped', key: e.x + e.y })),
    ...state.traffic.map((e) => ({ ...e, kind: 'car', key: e.x + e.y })),
    ...state.cops.map((e) => ({ ...e, kind: 'car', key: e.x + e.y })),
    { ...player, type: 'player', kind: 'car', key: player.x + player.y + 1 },
  ];

  entities.sort((a, b) => a.key - b.key);
  for (const entity of entities) {
    if (entity.kind === 'ped') drawPedestrian(entity);
    else drawCar(entity);
  }

  drawParticles();
}

function frame() {
  update();
  draw();
  requestAnimationFrame(frame);
}

frame();
