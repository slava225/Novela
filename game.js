const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  money: document.getElementById('money'),
  wanted: document.getElementById('wanted'),
  mission: document.getElementById('mission'),
  speed: document.getElementById('speed'),
};

const TILE_W = 64;
const TILE_H = 32;
const MAP_W = 24;
const MAP_H = 24;

const keys = new Set();
const state = {
  money: 0,
  wanted: 0,
  cameraX: 0,
  cameraY: 0,
  mission: null,
  particles: [],
};

const music = new Howl({
  src: ['https://cdn.jsdelivr.net/gh/jakesgordon/javascript-racer@master/v1/street.mp3'],
  loop: true,
  volume: 0.18,
});
music.play();

const car = {
  x: 4,
  y: 4,
  angle: 0,
  speed: 0,
  maxSpeed: 0.15,
  accel: 0.004,
  friction: 0.96,
};

const npcs = Array.from({ length: 14 }, (_, i) => ({
  x: 2 + (i * 1.4) % 20,
  y: 3 + (i * 2.1) % 20,
  vx: Math.random() * 0.03 - 0.015,
  vy: Math.random() * 0.03 - 0.015,
}));

const road = new Set();
for (let y = 0; y < MAP_H; y++) {
  for (let x = 0; x < MAP_W; x++) {
    if (x % 5 === 0 || y % 5 === 0 || (x > 10 && x < 14)) road.add(`${x},${y}`);
  }
}

function worldToIso(x, y) {
  return {
    x: (x - y) * TILE_W * 0.5,
    y: (x + y) * TILE_H * 0.5,
  };
}

function resetMission() {
  state.mission = {
    pickup: { x: 2 + Math.random() * 20, y: 2 + Math.random() * 20 },
    dropoff: { x: 2 + Math.random() * 20, y: 2 + Math.random() * 20 },
    phase: 'pickup',
  };
}
resetMission();

window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'r') {
    state.money = 0;
    state.wanted = 0;
    car.x = 4;
    car.y = 4;
    car.speed = 0;
    resetMission();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function isRoad(x, y) {
  return road.has(`${Math.floor(x)},${Math.floor(y)}`);
}

function update(dt) {
  const turn = (keys.has('a') || keys.has('arrowleft') ? -1 : 0) + (keys.has('d') || keys.has('arrowright') ? 1 : 0);
  const throttle = (keys.has('w') || keys.has('arrowup') ? 1 : 0) + (keys.has('s') || keys.has('arrowdown') ? -1 : 0);

  car.angle += turn * 0.05 * dt;
  car.speed += throttle * car.accel * dt;
  if (keys.has(' ')) car.speed *= 0.92;
  car.speed *= car.friction;

  const onRoad = isRoad(car.x, car.y);
  const speedCap = onRoad ? car.maxSpeed : car.maxSpeed * 0.55;
  car.speed = Math.max(-speedCap, Math.min(speedCap, car.speed));

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(0.5, Math.min(MAP_W - 0.5, car.x));
  car.y = Math.max(0.5, Math.min(MAP_H - 0.5, car.y));

  if (!onRoad && Math.abs(car.speed) > 0.08) state.wanted = Math.min(5, state.wanted + 0.002 * dt);
  else state.wanted = Math.max(0, state.wanted - 0.0015 * dt);

  for (const n of npcs) {
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    if (n.x < 1 || n.x > MAP_W - 1) n.vx *= -1;
    if (n.y < 1 || n.y > MAP_H - 1) n.vy *= -1;

    const dx = n.x - car.x;
    const dy = n.y - car.y;
    if (dx * dx + dy * dy < 0.45) {
      state.wanted = Math.min(5, state.wanted + 0.05);
      n.vx += (Math.random() - 0.5) * 0.08;
      n.vy += (Math.random() - 0.5) * 0.08;
      spawnParticle(car.x, car.y, '#ff5f57');
    }
  }

  const target = state.mission.phase === 'pickup' ? state.mission.pickup : state.mission.dropoff;
  const tx = target.x - car.x;
  const ty = target.y - car.y;
  if (tx * tx + ty * ty < 0.7) {
    if (state.mission.phase === 'pickup') {
      state.mission.phase = 'dropoff';
      flash('📦 Груз подобран! Вези к точке выгрузки.');
    } else {
      const reward = 180 + Math.floor((5 - state.wanted) * 30);
      state.money += reward;
      flash(`✅ Доставка выполнена: +$${reward}`);
      state.wanted = Math.max(0, state.wanted - 0.6);
      resetMission();
    }
  }

  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  const c = worldToIso(car.x, car.y);
  state.cameraX = c.x;
  state.cameraY = c.y;
  ui.money.textContent = `$${state.money}`;
  ui.wanted.textContent = `${state.wanted.toFixed(1)}`;
  ui.mission.textContent = state.mission.phase === 'pickup' ? 'Забрать груз' : 'Доставить груз';
  ui.speed.textContent = `${Math.abs(car.speed * 1000).toFixed(0)} km/h`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2 - state.cameraX, 150 - state.cameraY);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const p = worldToIso(x, y);
      const r = isRoad(x, y);
      drawTile(p.x, p.y, r ? '#2b324a' : '#1f3c2a');
      if (!r && (x + y) % 3 === 0) drawBuilding(p.x, p.y, 24 + ((x * y) % 28));
      if (r && (x + y) % 8 === 0) drawLamp(p.x, p.y);
    }
  }

  const missionPoint = state.mission.phase === 'pickup' ? state.mission.pickup : state.mission.dropoff;
  const mp = worldToIso(missionPoint.x, missionPoint.y);
  drawMarker(mp.x, mp.y, state.mission.phase === 'pickup' ? '#ffd166' : '#50e3c2');

  for (const n of npcs) {
    const p = worldToIso(n.x, n.y);
    ctx.fillStyle = '#c6a0ff';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 12, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of state.particles) {
    const iso = worldToIso(p.x, p.y);
    ctx.globalAlpha = p.life / 600;
    ctx.fillStyle = p.color;
    ctx.fillRect(iso.x, iso.y - 8, 4, 4);
    ctx.globalAlpha = 1;
  }

  drawCar();
  ctx.restore();
}

function drawCar() {
  const p = worldToIso(car.x, car.y);
  ctx.save();
  ctx.translate(p.x, p.y - 10);
  ctx.rotate(car.angle + Math.PI / 4);
  ctx.fillStyle = '#4fd2ff';
  ctx.fillRect(-10, -16, 20, 30);
  ctx.fillStyle = '#9ee6ff';
  ctx.fillRect(-6, -10, 12, 10);
  ctx.restore();
}

function drawTile(x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + TILE_W / 2, y + TILE_H / 2);
  ctx.lineTo(x, y + TILE_H);
  ctx.lineTo(x - TILE_W / 2, y + TILE_H / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.stroke();
}

function drawBuilding(x, y, h) {
  ctx.fillStyle = '#263047';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + TILE_W / 2, y + TILE_H / 2);
  ctx.lineTo(x + TILE_W / 2, y + TILE_H / 2 - h);
  ctx.lineTo(x, y - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1d2436';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - TILE_W / 2, y + TILE_H / 2);
  ctx.lineTo(x - TILE_W / 2, y + TILE_H / 2 - h);
  ctx.lineTo(x, y - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#34415e';
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + TILE_W / 2, y + TILE_H / 2 - h);
  ctx.lineTo(x, y + TILE_H - h);
  ctx.lineTo(x - TILE_W / 2, y + TILE_H / 2 - h);
  ctx.closePath();
  ctx.fill();
}

function drawLamp(x, y) {
  ctx.strokeStyle = '#8db1ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y - 10);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(x, y - 12, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawMarker(x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 20, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(x, y - 20, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function spawnParticle(x, y, color) {
  state.particles.push({
    x,
    y,
    vx: Math.random() * 0.1 - 0.05,
    vy: Math.random() * 0.1 - 0.05,
    life: 600,
    color,
  });
}

function flash(text) {
  ui.mission.textContent = text;
  gsap.fromTo('.hud', { boxShadow: '0 0 0px #50e3c2' }, { boxShadow: '0 0 28px #50e3c2', yoyo: true, repeat: 1, duration: 0.22 });
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(32, now - last);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
