// ============================================================
// Logic/Middleware layer: game loop, physics, input, state machine
// Data layer: LEVELS array (mock level configs) + localStorage persistence
// ============================================================

// ---------- Canvas setup ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const WIDTH = canvas.width;   // 960
const HEIGHT = canvas.height; // 540

// ---------- Data layer: level + entity hooks (populated by data.js) ----------
const LEVELS = window.GAME_LEVELS;
const ENTITY_TYPES = window.ENTITY_TYPES;

// ---------- Theme palettes ----------
const THEMES = {
  green: { darkest: '#0F380F', dark: '#306230', light: '#8BAC0F', lightest: '#9BBC0F', name: 'CLASSIC GREEN' },
  pocket: { darkest: '#000000', dark: '#525252', light: '#A3A3A3', lightest: '#FFFFFF', name: 'POCKET GREY' },
};

// ---------- Attract mode (START_MENU) content ----------
const BESTIARY = [
  { type: 'CFO', text: 'THE CFO: SLOWS VELOCITY (BUDGET DRAIN)' },
  { type: 'VP_SALES', text: 'VP SALES: TURBO SLINGSHOT (QUOTA BOOST)' },
  { type: 'BLOCKER', text: 'SALESFORCE: CRASH HAZARD (SYNC ERROR)' },
];
const TICKER_TEXT = 'IN THE SHADOWED DEPTHS OF UNMAPPED WORKFLOWS, ONLY ONE LEAD CAN SURVIVE...   ';
const TITLE_TEXT = 'DEAL SLINGER';
const TITLE_JAGGED_OFFSETS = [0, 4, -3, 5, 0, -4, 2, 0, -5, 3, -2, 4];
const CARD_CYCLE_SECONDS = 3.5;
const CTA_BLINK_SECONDS = 0.5;
const LIGHTNING_FRAME_SECONDS = 0.25;
const TICKER_SPEED_PX_PER_SEC = 90;

let attract = {
  time: 0,
  flicker: true,
  cardIndex: 0,
  cardTimer: 0,
  ctaVisible: true,
  ctaTimer: 0,
  tickerX: WIDTH,
};

function resetAttractMode() {
  attract = {
    time: 0,
    flicker: true,
    cardIndex: 0,
    cardTimer: 0,
    ctaVisible: true,
    ctaTimer: 0,
    tickerX: WIDTH,
  };
}

let COLORS = THEMES.green;

// ---------- Physics constants ----------
const G = 6000;              // gravitational constant (tuned for pixel scale)
const PROJECTILE_RADIUS = 6;
const PROJECTILE_MASS = 1;
const FIXED_DT = 1 / 60;     // physics substep, always 60fps-equivalent
const MAX_LAUNCH_SPEED = 620;
const MIN_LAUNCH_SPEED = 40;
const TRAJECTORY_STEPS = 15;
const TRAJECTORY_STEP_DT = 1 / 30;
const RELOAD_DELAY_MS = 90; // instant reload, < 100ms
const WIN_BANNER_MS = 1400;

const STORAGE_KEY = 'dealSlinger.highestLevel';
const SETTINGS_KEY = 'dealSlinger.settings';

// ---------- State machine ----------
const STATE = {
  START_MENU: 'START_MENU',
  IDLE_AIM: 'IDLE_AIM',
  IN_FLIGHT: 'IN_FLIGHT',
  WIN: 'WIN',
  FAIL: 'FAIL',
};

// ---------- Settings (persisted) ----------
const Settings = {
  theme: 'green',        // 'green' | 'pocket'
  trajectory: 'standard', // 'standard' | 'expert'

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (saved && THEMES[saved.theme]) this.theme = saved.theme;
      if (saved && (saved.trajectory === 'standard' || saved.trajectory === 'expert')) {
        this.trajectory = saved.trajectory;
      }
    } catch (e) {
      // no saved settings yet
    }
  },

  save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      theme: this.theme,
      trajectory: this.trajectory,
    }));
  },
};

// ---------- Level Manager ----------
const LevelManager = {
  index: 0,
  current: null,

  load(index) {
    this.index = ((index % LEVELS.length) + LEVELS.length) % LEVELS.length;
    this.current = LEVELS[this.index];
    return this.current;
  },

  next() {
    this.load(this.index + 1);
    return this.current;
  },

  reset() {
    return this.load(this.index);
  },

  saveProgress() {
    const levelReached = this.current.id;
    const best = parseInt(localStorage.getItem(STORAGE_KEY) || '1', 10);
    if (levelReached > best) {
      localStorage.setItem(STORAGE_KEY, String(levelReached));
    }
  },

  getBest() {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '1', 10);
  },
};

// ---------- Game state ----------
let state = STATE.START_MENU;
let projectile = null; // { x, y, vx, vy }
let aim = { dragging: false, startX: 0, startY: 0, curX: 0, curY: 0 };
let reloadTimer = null;

const hudLevel = document.getElementById('hud-level');
const hudBest = document.getElementById('hud-best');
const banner = document.getElementById('banner');
const failBanner = document.getElementById('fail-banner');
const startScreen = document.getElementById('start-screen');
const configOverlay = document.getElementById('config-overlay');
const themeToggle = document.getElementById('theme-toggle');
const trajectoryToggle = document.getElementById('trajectory-toggle');
let configOpen = false;

function updateHud() {
  hudLevel.textContent = `LEVEL ${LevelManager.current.id}`;
  hudBest.textContent = `BEST: ${LevelManager.getBest()}`;
}

function startLevel(index) {
  LevelManager.load(index);
  projectile = null;
  state = STATE.IDLE_AIM;
  banner.classList.add('hidden');
  failBanner.classList.add('hidden');
  updateHud();
}

// ---------- Theme / settings application ----------
function applyTheme(themeName) {
  Settings.theme = themeName;
  COLORS = THEMES[themeName];
  const root = document.documentElement;
  root.style.setProperty('--gb-darkest', COLORS.darkest);
  root.style.setProperty('--gb-dark', COLORS.dark);
  root.style.setProperty('--gb-light', COLORS.light);
  root.style.setProperty('--gb-lightest', COLORS.lightest);
  themeToggle.textContent = COLORS.name;
}

function applyTrajectoryMode(mode) {
  Settings.trajectory = mode;
  trajectoryToggle.textContent = mode === 'standard' ? 'STANDARD' : 'HARDCORE';
}

themeToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  applyTheme(Settings.theme === 'green' ? 'pocket' : 'green');
  Settings.save();
});

trajectoryToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  applyTrajectoryMode(Settings.trajectory === 'standard' ? 'expert' : 'standard');
  Settings.save();
});

// ---------- Start Menu (attract mode) transitions ----------
function enterStartMenu() {
  state = STATE.START_MENU;
  resetAttractMode();
  startScreen.classList.remove('hidden');
}

function toggleConfig() {
  configOpen = !configOpen;
  configOverlay.classList.toggle('hidden', !configOpen);
}

function beginGame() {
  if (state !== STATE.START_MENU || configOpen) return;
  startScreen.classList.add('hidden');
  startLevel(0);
}

startScreen.addEventListener('click', beginGame);
window.addEventListener('keydown', (e) => {
  if (state !== STATE.START_MENU) return;
  if (e.code === 'Space') {
    e.preventDefault();
    beginGame();
  } else if (e.code === 'KeyS') {
    e.preventDefault();
    toggleConfig();
  }
});

// ---------- Input handling (mouse + touch drag-and-release) ----------
function getCanvasPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = WIDTH / rect.width;
  const scaleY = HEIGHT / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function pointerDown(x, y) {
  if (state !== STATE.IDLE_AIM) return;
  const level = LevelManager.current;
  const dx = x - level.launcher.x;
  const dy = y - level.launcher.y;
  if (Math.sqrt(dx * dx + dy * dy) > 60) return; // must grab near launcher
  aim.dragging = true;
  aim.startX = level.launcher.x;
  aim.startY = level.launcher.y;
  aim.curX = x;
  aim.curY = y;
}

function pointerMove(x, y) {
  if (!aim.dragging) return;
  aim.curX = x;
  aim.curY = y;
}

function pointerUp() {
  if (!aim.dragging) return;
  aim.dragging = false;

  const level = LevelManager.current;
  let vx = (aim.startX - aim.curX) * 3.2;
  let vy = (aim.startY - aim.curY) * 3.2;
  const speed = Math.sqrt(vx * vx + vy * vy);

  if (speed < MIN_LAUNCH_SPEED) return; // too weak, stay in aim mode

  const clamped = Math.min(speed, MAX_LAUNCH_SPEED);
  const scale = clamped / speed;
  vx *= scale;
  vy *= scale;

  projectile = { x: level.launcher.x, y: level.launcher.y, vx, vy };
  state = STATE.IN_FLIGHT;
}

canvas.addEventListener('mousedown', (e) => {
  const p = getCanvasPos(e.clientX, e.clientY);
  pointerDown(p.x, p.y);
});
window.addEventListener('mousemove', (e) => {
  const p = getCanvasPos(e.clientX, e.clientY);
  pointerMove(p.x, p.y);
});
window.addEventListener('mouseup', pointerUp);

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  const p = getCanvasPos(t.clientX, t.clientY);
  pointerDown(p.x, p.y);
}, { passive: false });
window.addEventListener('touchmove', (e) => {
  if (!aim.dragging) return;
  e.preventDefault();
  const t = e.touches[0];
  const p = getCanvasPos(t.clientX, t.clientY);
  pointerMove(p.x, p.y);
}, { passive: false });
window.addEventListener('touchend', (e) => {
  e.preventDefault();
  pointerUp();
}, { passive: false });

// ---------- Physics helpers ----------
function applyGravityAndExecNodes(p, dt) {
  const level = LevelManager.current;
  for (const node of level.nodes) {
    const dx = node.x - p.x;
    const dy = node.y - p.y;
    const distSq = Math.max(dx * dx + dy * dy, 100); // avoid singularity
    const dist = Math.sqrt(distSq);

    // F = G * (m1 * m2) / r^2, applied toward node
    const force = (G * node.mass * node.multiplier * PROJECTILE_MASS) / distSq;
    const ax = (dx / dist) * force;
    const ay = (dy / dist) * force;
    p.vx += ax * dt;
    p.vy += ay * dt;

    // Executive logic: within pull radius, apply the entity's velocity factor
    if (dist <= node.radius) {
      const entity = ENTITY_TYPES[node.type];
      if (entity) {
        const frames = dt * 60;
        const factor = Math.pow(entity.velocityFactor, frames);
        p.vx *= factor;
        p.vy *= factor;
      }
    }
  }
}

function circleRectCollision(cx, cy, r, rect) {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) < (r * r);
}

function triggerFail() {
  state = STATE.FAIL;
  failBanner.classList.remove('hidden');
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    failBanner.classList.add('hidden');
    projectile = null;
    state = STATE.IDLE_AIM;
  }, RELOAD_DELAY_MS);
}

function triggerWin() {
  state = STATE.WIN;
  LevelManager.saveProgress();
  banner.classList.remove('hidden');
  updateHud();
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    banner.classList.add('hidden');
    startLevel(LevelManager.index + 1);
  }, WIN_BANNER_MS);
}

// ---------- Update ----------
function update(dt) {
  if (state !== STATE.IN_FLIGHT || !projectile) return;

  applyGravityAndExecNodes(projectile, dt);
  projectile.x += projectile.vx * dt;
  projectile.y += projectile.vy * dt;

  const level = LevelManager.current;

  // Goal check
  const gdx = projectile.x - level.goal.x;
  const gdy = projectile.y - level.goal.y;
  if (Math.sqrt(gdx * gdx + gdy * gdy) <= level.goal.radius + PROJECTILE_RADIUS) {
    triggerWin();
    return;
  }

  // Blocker collision
  for (const b of level.blockers) {
    if (circleRectCollision(projectile.x, projectile.y, PROJECTILE_RADIUS, b)) {
      triggerFail();
      return;
    }
  }

  // Boundary collision
  if (
    projectile.x < -20 || projectile.x > WIDTH + 20 ||
    projectile.y < -20 || projectile.y > HEIGHT + 20
  ) {
    triggerFail();
    return;
  }
}

// ---------- Trajectory prediction (15-step dotted line) ----------
function computeTrajectory(startX, startY, vx, vy) {
  const points = [];
  const sim = { x: startX, y: startY, vx, vy };
  for (let i = 0; i < TRAJECTORY_STEPS; i++) {
    applyGravityAndExecNodes(sim, TRAJECTORY_STEP_DT);
    sim.x += sim.vx * TRAJECTORY_STEP_DT;
    sim.y += sim.vy * TRAJECTORY_STEP_DT;
    points.push({ x: sim.x, y: sim.y });
  }
  return points;
}

// ---------- Render ----------
function drawNode(node) {
  const entity = ENTITY_TYPES[node.type] || { colorKey: 'dark', label: node.type };

  ctx.fillStyle = COLORS[entity.colorKey];
  ctx.beginPath();
  ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COLORS.dark;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = COLORS.darkest;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(entity.label, node.x, node.y - node.radius - 6);
}

function drawBlocker(b) {
  ctx.fillStyle = COLORS.darkest;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = COLORS.lightest;
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(b.label, b.x + b.w / 2, b.y - 4);
}

function drawGoal(goal) {
  ctx.fillStyle = COLORS.dark;
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, goal.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.darkest;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DEAL', goal.x, goal.y + 3);
}

function drawLauncher(launcher) {
  ctx.fillStyle = COLORS.darkest;
  ctx.fillRect(launcher.x - 10, launcher.y - 10, 20, 20);
}

function drawProjectile(p) {
  ctx.fillStyle = COLORS.darkest;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrajectory(points) {
  ctx.fillStyle = COLORS.dark;
  for (const pt of points) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- Attract mode: update ----------
function updateAttractMode(dt) {
  if (state !== STATE.START_MENU) return;
  attract.time += dt;

  attract.flicker = Math.floor(attract.time / LIGHTNING_FRAME_SECONDS) % 2 === 0;

  attract.cardTimer += dt;
  if (attract.cardTimer >= CARD_CYCLE_SECONDS) {
    attract.cardTimer = 0;
    attract.cardIndex = (attract.cardIndex + 1) % BESTIARY.length;
  }

  attract.ctaTimer += dt;
  if (attract.ctaTimer >= CTA_BLINK_SECONDS) {
    attract.ctaTimer = 0;
    attract.ctaVisible = !attract.ctaVisible;
  }

  attract.tickerX -= TICKER_SPEED_PX_PER_SEC * dt;
  ctx.font = '12px monospace';
  const tickerWidth = ctx.measureText(TICKER_TEXT).width;
  if (attract.tickerX < -tickerWidth) attract.tickerX = WIDTH;
}

// ---------- Attract mode: pixel bestiary icons ----------
function drawCfoIcon(x, y) {
  ctx.fillStyle = COLORS.darkest;
  ctx.fillRect(x, y, 24, 24);
  ctx.fillStyle = COLORS.lightest;
  ctx.fillRect(x + 4, y + 4, 4, 4);
  ctx.fillRect(x + 16, y + 4, 4, 4);
  ctx.fillRect(x + 6, y + 16, 12, 3);
  ctx.fillStyle = COLORS.dark;
  ctx.fillRect(x + 2, y - 4, 20, 4); // briefcase-style crown
}

function drawVpIcon(x, y) {
  ctx.fillStyle = COLORS.dark;
  ctx.fillRect(x, y, 24, 24);
  ctx.fillStyle = COLORS.lightest;
  ctx.beginPath();
  ctx.moveTo(x + 12, y - 4);
  ctx.lineTo(x + 20, y + 8);
  ctx.lineTo(x + 4, y + 8);
  ctx.closePath();
  ctx.fill(); // rocket/turbo chevron
  ctx.fillRect(x + 6, y + 14, 4, 4);
  ctx.fillRect(x + 14, y + 14, 4, 4);
}

function drawBlockerIcon(x, y) {
  ctx.fillStyle = COLORS.darkest;
  ctx.fillRect(x, y, 24, 24);
  ctx.strokeStyle = COLORS.lightest;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 4);
  ctx.lineTo(x + 20, y + 20);
  ctx.moveTo(x + 20, y + 4);
  ctx.lineTo(x + 4, y + 20);
  ctx.stroke(); // crash-error X
}

const BESTIARY_ICONS = {
  CFO: drawCfoIcon,
  VP_SALES: drawVpIcon,
  BLOCKER: drawBlockerIcon,
};

// ---------- Attract mode: render ----------
function drawPipelineMap() {
  ctx.strokeStyle = COLORS.dark;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(50, HEIGHT - 60);
  ctx.quadraticCurveTo(300, HEIGHT - 200, 480, 260);
  ctx.quadraticCurveTo(660, 120, WIDTH - 60, 90);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = COLORS.light;
  const waypoints = [[50, HEIGHT - 60], [230, HEIGHT - 160], [400, 300], [560, 180], [740, 110], [WIDTH - 60, 90]];
  for (const [wx, wy] of waypoints) {
    ctx.beginPath();
    ctx.arc(wx, wy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTitleBanner() {
  ctx.font = 'bold 46px "Courier New", monospace';
  ctx.textAlign = 'left';
  const totalWidth = ctx.measureText(TITLE_TEXT.replace(/ /g, 'X')).width;
  let x = WIDTH / 2 - totalWidth / 2;
  const y = 78;
  const amplitude = attract.flicker ? 1 : 0.4;

  for (let i = 0; i < TITLE_TEXT.length; i++) {
    const ch = TITLE_TEXT[i];
    const offset = TITLE_JAGGED_OFFSETS[i % TITLE_JAGGED_OFFSETS.length] * amplitude;

    ctx.fillStyle = attract.flicker ? COLORS.darkest : COLORS.dark;
    ctx.fillText(ch, x + 3, y + offset + 3);

    ctx.fillStyle = attract.flicker ? COLORS.lightest : COLORS.light;
    ctx.fillText(ch, x, y + offset);

    x += ctx.measureText(ch === ' ' ? 'X' : ch).width;
  }
}

function drawHighScoreMarquee() {
  const score = String(LevelManager.getBest()).padStart(4, '0');
  ctx.fillStyle = COLORS.darkest;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`HIGH SCORE: ${score}`, WIDTH / 2, 26);
}

function drawBestiaryCard() {
  const card = BESTIARY[attract.cardIndex];
  const boxX = WIDTH / 2 - 260;
  const boxY = 370;
  const boxW = 520;
  const boxH = 46;

  ctx.fillStyle = COLORS.light;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = COLORS.darkest;
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  BESTIARY_ICONS[card.type](boxX + 14, boxY + 11);

  ctx.fillStyle = COLORS.darkest;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(card.text, boxX + 52, boxY + 27);
}

function drawTicker() {
  ctx.fillStyle = COLORS.darkest;
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(TICKER_TEXT, attract.tickerX, 448);
}

function drawCallToAction() {
  if (!attract.ctaVisible) return;
  ctx.fillStyle = COLORS.darkest;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('[ INSERT COIN / PRESS SPACE TO ENTER THE GAUNTLET ]', WIDTH / 2, 490);

  ctx.font = '10px monospace';
  ctx.fillText('[ PRESS S FOR CONFIG ]', WIDTH / 2, 512);
}

function renderStartMenu() {
  ctx.fillStyle = COLORS.darkest;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawPipelineMap();
  drawHighScoreMarquee();
  drawTitleBanner();
  drawBestiaryCard();
  drawTicker();
  drawCallToAction();
}

function render() {
  if (state === STATE.START_MENU) {
    renderStartMenu();
    return;
  }

  ctx.fillStyle = COLORS.lightest;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const level = LevelManager.current;

  for (const b of level.blockers) drawBlocker(b);
  for (const n of level.nodes) drawNode(n);
  drawGoal(level.goal);
  drawLauncher(level.launcher);

  if (state === STATE.IDLE_AIM && aim.dragging) {
    const vx = (aim.startX - aim.curX) * 3.2;
    const vy = (aim.startY - aim.curY) * 3.2;

    if (Settings.trajectory === 'standard') {
      const points = computeTrajectory(level.launcher.x, level.launcher.y, vx, vy);
      drawTrajectory(points);

      ctx.strokeStyle = COLORS.darkest;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(level.launcher.x, level.launcher.y);
      ctx.lineTo(aim.curX, aim.curY);
      ctx.stroke();
    }
  }

  if (state === STATE.IN_FLIGHT && projectile) {
    drawProjectile(projectile);
  }
}

// ---------- Main loop ----------
let lastTime = performance.now();

function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.05); // avoid spiral of death on tab switch

  update(dt);
  updateAttractMode(dt);
  render();

  requestAnimationFrame(loop);
}

// ---------- Boot ----------
Settings.load();
applyTheme(Settings.theme);
applyTrajectoryMode(Settings.trajectory);
enterStartMenu();
requestAnimationFrame(loop);
