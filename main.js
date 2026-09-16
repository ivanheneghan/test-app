// ============================================================
// Logic/Middleware layer: game loop, physics, input, state machine
// Data layer: window.GAME_LEVELS (levels.js) + localStorage persistence
// ============================================================

// ---------- Canvas setup ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// All provided art (portraits, backgrounds, splash, icons) is
// photographic/illustrated rather than deliberately chunky pixel-art,
// so smooth scaling looks better than nearest-neighbor here.
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

const WIDTH = canvas.width;   // 1600
const HEIGHT = canvas.height; // 900

// ---------- Data layer: level + entity hooks (populated by levels.js / data.js) ----------
const LEVELS = window.GAME_LEVELS;
const ENTITY_TYPES = window.ENTITY_TYPES || {};

// ---------- Theme palettes ----------
const THEMES = {
  green: { darkest: '#0F380F', dark: '#306230', light: '#8BAC0F', lightest: '#9BBC0F', name: 'CLASSIC GREEN' },
  pocket: { darkest: '#000000', dark: '#525252', light: '#A3A3A3', lightest: '#FFFFFF', name: 'POCKET GREY' },
};

// ---------- Attract mode (START_MENU) content ----------
// Laid out against a fixed 960x540 virtual canvas, then scaled up to the
// real canvas resolution in renderStartMenu() so it stays proportional
// regardless of the game's actual internal resolution.
const ATTRACT_VW = 960;
const ATTRACT_VH = 540;

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
  tickerX: ATTRACT_VW,
};

function resetAttractMode() {
  attract = {
    time: 0,
    flicker: true,
    cardIndex: 0,
    cardTimer: 0,
    ctaVisible: true,
    ctaTimer: 0,
    tickerX: ATTRACT_VW,
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
  VICTORY: 'VICTORY', // persistent - all levels cleared, waits for player input
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

const hud = document.getElementById('hud');
const hudLevel = document.getElementById('hud-level');
const hudBest = document.getElementById('hud-best');
const banner = document.getElementById('banner');
const bannerText = document.getElementById('banner-text');
const bannerSub = document.getElementById('banner-sub');
const failBanner = document.getElementById('fail-banner');
const startScreen = document.getElementById('start-screen');
const configOverlay = document.getElementById('config-overlay');
const themeToggle = document.getElementById('theme-toggle');
const trajectoryToggle = document.getElementById('trajectory-toggle');
let configOpen = false;

function updateHud() {
  const level = LevelManager.current;
  hudLevel.textContent = level.title ? `LEVEL ${level.id}: ${level.title}` : `LEVEL ${level.id}`;
  hudBest.textContent = `HIGH SCORE: ${LevelManager.getBest()}`;
}

function startLevel(index) {
  LevelManager.load(index);
  projectile = null;
  state = STATE.IDLE_AIM;
  hud.classList.remove('hidden');
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
  hud.classList.add('hidden');
  banner.classList.add('hidden');
  failBanner.classList.add('hidden');
  startScreen.classList.remove('hidden');
}

function toggleConfig() {
  configOpen = !configOpen;
  configOverlay.classList.toggle('hidden', !configOpen);
}

function beginGame() {
  if (state !== STATE.START_MENU || configOpen) return;
  startScreen.classList.add('hidden');
  startLevel(0); // always start a fresh run from Level 1; best level persists separately
}

function returnToHome() {
  if (state === STATE.START_MENU) return;
  clearTimeout(reloadTimer);
  projectile = null;
  aim.dragging = false;
  enterStartMenu();
}

startScreen.addEventListener('click', beginGame);
canvas.addEventListener('click', resetAfterVictory);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    e.preventDefault();
    returnToHome();
    return;
  }
  if (state === STATE.VICTORY && e.code === 'Space') {
    e.preventDefault();
    resetAfterVictory();
    return;
  }
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  aim.curX = clamp(x, 0, WIDTH);
  aim.curY = clamp(y, 0, HEIGHT);
}

function pointerMove(x, y) {
  if (!aim.dragging) return;
  aim.curX = clamp(x, 0, WIDTH);
  aim.curY = clamp(y, 0, HEIGHT);
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
function applyGravityAndExecPlanets(p, dt) {
  const level = LevelManager.current;
  for (const planet of level.planets) {
    const dx = planet.x - p.x;
    const dy = planet.y - p.y;
    const distSq = Math.max(dx * dx + dy * dy, 100); // avoid singularity
    const dist = Math.sqrt(distSq);

    // F = G * (m1 * m2) / r^2, using planet.mass and planet.radius directly
    const force = (G * planet.mass * PROJECTILE_MASS) / distSq;
    const ax = (dx / dist) * force;
    const ay = (dy / dist) * force;
    p.vx += ax * dt;
    p.vy += ay * dt;

    // Executive logic: within pull radius, apply the entity's velocity factor
    if (dist <= planet.radius) {
      const entity = ENTITY_TYPES[planet.type];
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
  LevelManager.saveProgress();
  updateHud();

  const isFinalLevel = LevelManager.index === LEVELS.length - 1;

  if (isFinalLevel) {
    // Persistent victory screen: stays up until the player acts, then
    // resets the run back to Level 1 (see the VICTORY handling in the
    // click/keydown listeners below).
    state = STATE.VICTORY;
    bannerText.textContent = 'VICTORY!';
    bannerSub.textContent = 'ALL DEALS CLOSED! [ PRESS SPACE OR CLICK TO PLAY AGAIN ]';
    banner.classList.remove('hidden');
    return;
  }

  state = STATE.WIN;
  bannerText.textContent = 'DEAL CLOSED!';
  bannerSub.textContent = 'Loading next lead...';
  banner.classList.remove('hidden');

  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    banner.classList.add('hidden');
    startLevel(LevelManager.index + 1);
  }, WIN_BANNER_MS);
}

function resetAfterVictory() {
  if (state !== STATE.VICTORY) return;
  banner.classList.add('hidden');
  enterStartMenu();
}

// ---------- Update ----------
function update(dt) {
  if (state !== STATE.IN_FLIGHT || !projectile) return;

  applyGravityAndExecPlanets(projectile, dt);
  projectile.x += projectile.vx * dt;
  projectile.y += projectile.vy * dt;

  const level = LevelManager.current;

  // Portal (goal) check
  const gdx = projectile.x - level.portal.x;
  const gdy = projectile.y - level.portal.y;
  if (Math.sqrt(gdx * gdx + gdy * gdy) <= level.portal.radius + PROJECTILE_RADIUS) {
    triggerWin();
    return;
  }

  // Obstacle AABB collision
  for (const obstacle of level.obstacles) {
    if (circleRectCollision(projectile.x, projectile.y, PROJECTILE_RADIUS, obstacle)) {
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
    applyGravityAndExecPlanets(sim, TRAJECTORY_STEP_DT);
    sim.x += sim.vx * TRAJECTORY_STEP_DT;
    sim.y += sim.vy * TRAJECTORY_STEP_DT;
    points.push({ x: sim.x, y: sim.y });
  }
  return points;
}

// ---------- Image loading (provided assets, with procedural fallback) ----------
const ImageCache = {};

function getImage(src) {
  if (!ImageCache[src]) {
    const img = new Image();
    img.src = src;
    ImageCache[src] = img;
  }
  return ImageCache[src];
}

function isImageReady(img) {
  return img && img.complete && img.naturalWidth > 0;
}

// Some provided sprites (e.g. the launcher) are flat opaque PNGs with a
// solid-ish background baked in rather than real alpha transparency. This
// chroma-keys out pixels close to the image's own corner/background color
// so they blend with the game background instead of showing as a box.
const ChromaKeyCache = {};

// Finds the dominant color along the image's outer border (as a coarse
// histogram mode) instead of trusting a single corner pixel - robust
// against a textured/gridded background where one pixel might land on
// a grid line instead of the fill color.
function findBorderModeColor(d, w, h) {
  const borderPx = Math.max(4, Math.round(Math.min(w, h) * 0.06));
  const counts = new Map();

  const bucket = (x, y) => {
    const i = (y * w + x) * 4;
    const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    counts.set(key, (counts.get(key) || 0) + 1);
  };

  for (let y = 0; y < borderPx; y++) for (let x = 0; x < w; x++) bucket(x, y);
  for (let y = h - borderPx; y < h; y++) for (let x = 0; x < w; x++) bucket(x, y);
  for (let x = 0; x < borderPx; x++) for (let y = 0; y < h; y++) bucket(x, y);
  for (let x = w - borderPx; x < w; x++) for (let y = 0; y < h; y++) bucket(x, y);

  let bestKey = 0, bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) { bestCount = count; bestKey = key; }
  }
  return [((bestKey >> 10) & 31) << 3, ((bestKey >> 5) & 31) << 3, (bestKey & 31) << 3];
}

// Eats thin leftover opaque specks (e.g. a grid line whose anti-aliased
// edge fell just outside the color-distance tolerance): any still-opaque
// pixel whose neighborhood is mostly already-transparent gets cleared
// too. Solid interior regions (actual portrait/icon content) are
// unaffected since their neighbors stay opaque.
function despeckleAlpha(d, w, h, passes = 2) {
  const count = w * h;
  for (let p = 0; p < passes; p++) {
    const alphaBefore = new Uint8ClampedArray(count);
    for (let i = 0; i < count; i++) alphaBefore[i] = d[i * 4 + 3];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (alphaBefore[idx] === 0) continue;

        let total = 0;
        let transparentNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            total++;
            if (alphaBefore[ny * w + nx] === 0) transparentNeighbors++;
          }
        }
        if (total > 0 && transparentNeighbors / total >= 0.6) {
          d[idx * 4 + 3] = 0;
        }
      }
    }
  }
}

function getChromaKeyedImage(src, tolerance = 65) {
  if (ChromaKeyCache[src] !== undefined) return ChromaKeyCache[src];

  const img = getImage(src);
  if (!isImageReady(img)) return null;

  try {
    const off = document.createElement('canvas');
    off.width = img.naturalWidth;
    off.height = img.naturalHeight;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0);

    const frame = octx.getImageData(0, 0, off.width, off.height);
    const d = frame.data;
    const bg = findBorderModeColor(d, off.width, off.height);

    for (let i = 0; i < d.length; i += 4) {
      const dr = d[i] - bg[0];
      const dg = d[i + 1] - bg[1];
      const db = d[i + 2] - bg[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) < tolerance) {
        d[i + 3] = 0;
      }
    }

    despeckleAlpha(d, off.width, off.height);

    octx.putImageData(frame, 0, 0);
    ChromaKeyCache[src] = off;
    return off;
  } catch (e) {
    // Pixel access can be blocked (e.g. opening the game via a plain
    // file:// URL taints the canvas) - fall back to the plain image.
    ChromaKeyCache[src] = img;
    return img;
  }
}

// Dynamic asset preloader: walk every level's portal/planets/obstacles and
// kick off loading for each referenced image up front, so most assets are
// already decoded by the time a level using them is reached.
function preloadLevelImages() {
  getImage(BACKGROUND_IMAGE);
  getImage(PROJECTILE_IMAGE);
  getImage(TITLE_IMAGE);
  for (const level of LEVELS) {
    if (level.launcher.image) getImage(level.launcher.image);
    if (level.portal.image) getImage(level.portal.image);
    for (const planet of level.planets) {
      if (planet.image) getImage(planet.image);
    }
    for (const obstacle of level.obstacles) {
      if (obstacle.image) getImage(obstacle.image);
    }
  }
}

// ---------- Render ----------
// Draws `img` covering a w x h box (like CSS object-fit: cover): scales
// uniformly so the box is fully filled, cropping any overflow, instead of
// stretching the image to the box's aspect ratio. `zoom` > 1 crops in a
// little further, useful for cropping away a provided image's own padding
// right at the edge of a circular clip (e.g. a faint background ring).
function drawImageCover(img, x, y, w, h, zoom = 1) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

// Draws `img` fully visible within a w x h box (like CSS object-fit:
// contain): scales uniformly so nothing is cropped or stretched, letting
// the image's own shape show cleanly instead of forcing it into the box.
function drawImageContain(img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

// Visual-only enlargement for portraits - planet.radius (gravity pull
// trigger) and mass/gravity math are untouched, only how big the
// portrait is drawn on screen.
const PEOPLE_VISUAL_SCALE = 1.5;

function drawPlanet(planet) {
  const entity = ENTITY_TYPES[planet.type];
  const label = planet.label || (entity && entity.label) || planet.type;
  const img = planet.image ? getChromaKeyedImage(planet.image) : null;
  const visualRadius = planet.radius * PEOPLE_VISUAL_SCALE;
  const size = visualRadius * 2;

  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, visualRadius, 0, Math.PI * 2);
    ctx.clip();
    drawImageCover(img, planet.x - visualRadius, planet.y - visualRadius, size, size, 1.15);
    ctx.restore();
  } else {
    ctx.fillStyle = planet.color || (entity && COLORS[entity.colorKey]) || COLORS.dark;
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, visualRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = COLORS.darkest;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, planet.x, planet.y - visualRadius - 6);
}

// Visual-only enlargement for obstacle art - the real AABB hitbox used
// for collision (obstacle.x/y/w/h) is untouched, so difficulty/level
// layout doesn't change, only how big the icon is drawn on screen.
const BLOCKER_VISUAL_SCALE = 3;

function drawObstacle(obstacle) {
  const img = obstacle.image ? getChromaKeyedImage(obstacle.image) : null;

  if (img) {
    // The provided obstacle art already bakes in its own label text.
    const visualW = obstacle.w * BLOCKER_VISUAL_SCALE;
    const visualH = obstacle.h * BLOCKER_VISUAL_SCALE;
    const cx = obstacle.x + obstacle.w / 2;
    const cy = obstacle.y + obstacle.h / 2;
    drawImageContain(img, cx - visualW / 2, cy - visualH / 2, visualW, visualH);
  } else {
    // No image yet - draw at the true hitbox size so the fallback
    // doesn't misrepresent where the actual hazard boundary is.
    ctx.fillStyle = obstacle.color || COLORS.darkest;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

    ctx.fillStyle = COLORS.darkest;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(obstacle.label, obstacle.x + obstacle.w / 2, obstacle.y - 4);
  }
}

// Visual-only enlargement - portal.radius (used for the win-condition
// distance check in update()) is untouched, only how big it's drawn.
const PORTAL_VISUAL_SCALE = 3;

function drawPortal(portal) {
  const img = portal.image ? getChromaKeyedImage(portal.image) : null;
  const visualRadius = portal.radius * PORTAL_VISUAL_SCALE;
  const size = visualRadius * 2;

  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, visualRadius, 0, Math.PI * 2);
    ctx.clip();
    drawImageCover(img, portal.x - visualRadius, portal.y - visualRadius, size, size, 1.15);
    ctx.restore();
  } else {
    ctx.fillStyle = portal.color || COLORS.dark;
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, visualRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.darkest;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DEAL', portal.x, portal.y + 3);
  }
}

// Visual-only nudge for the launcher sprite - the actual launcher.x/y
// (aim pivot, projectile spawn point) is untouched so physics/hitboxes
// don't shift, only where the sprite is drawn relative to it. Offset
// scales with size to preserve the same relative nudge.
const LAUNCHER_VISUAL_SIZE = 288;
const LAUNCHER_SPRITE_OFFSET_X = 48;
const LAUNCHER_SPRITE_OFFSET_Y = -48;

function drawLauncher(launcher) {
  const img = launcher.image ? getChromaKeyedImage(launcher.image) : null;
  const size = LAUNCHER_VISUAL_SIZE;
  const drawX = launcher.x + LAUNCHER_SPRITE_OFFSET_X;
  const drawY = launcher.y + LAUNCHER_SPRITE_OFFSET_Y;

  if (img) {
    ctx.drawImage(img, drawX - size / 2, drawY - size / 2, size, size);
  } else {
    ctx.fillStyle = COLORS.darkest;
    ctx.fillRect(drawX - 10, drawY - 10, 20, 20);
  }
}

const PROJECTILE_IMAGE = 'assets/images/Rocket.png';
const PROJECTILE_SPRITE_SIZE = 120; // visual size only - collision still uses PROJECTILE_RADIUS

function drawProjectile(p) {
  const img = getChromaKeyedImage(PROJECTILE_IMAGE);

  if (img) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2); // sprite's nose points up by default
    ctx.drawImage(img, -PROJECTILE_SPRITE_SIZE / 2, -PROJECTILE_SPRITE_SIZE / 2, PROJECTILE_SPRITE_SIZE, PROJECTILE_SPRITE_SIZE);
    ctx.restore();
  } else {
    ctx.fillStyle = COLORS.darkest;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
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
  if (attract.tickerX < -tickerWidth) attract.tickerX = ATTRACT_VW;
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
function drawTitleBanner() {
  ctx.font = 'bold 46px "Courier New", monospace';
  ctx.textAlign = 'left';
  const totalWidth = ctx.measureText(TITLE_TEXT.replace(/ /g, 'X')).width;
  let x = ATTRACT_VW / 2 - totalWidth / 2;
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
  ctx.fillStyle = COLORS.lightest;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`HIGH SCORE: ${score}`, ATTRACT_VW / 2, 26);
}

function drawBestiaryCard() {
  const card = BESTIARY[attract.cardIndex];
  const boxX = ATTRACT_VW / 2 - 260;
  const boxY = 452;
  const boxW = 520;
  const boxH = 32;

  ctx.fillStyle = COLORS.light;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = COLORS.darkest;
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  BESTIARY_ICONS[card.type](boxX + 14, boxY + 4);

  ctx.fillStyle = COLORS.darkest;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(card.text, boxX + 52, boxY + 20);
}

function drawTicker() {
  ctx.fillStyle = COLORS.lightest;
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(TICKER_TEXT, attract.tickerX, 496);
}

function drawCallToAction() {
  if (!attract.ctaVisible) return;
  ctx.fillStyle = COLORS.lightest;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('[ INSERT COIN / PRESS SPACE TO ENTER THE GAUNTLET ]', ATTRACT_VW / 2, 514);

  ctx.font = '10px monospace';
  ctx.fillText('[ PRESS S FOR CONFIG ]', ATTRACT_VW / 2, 530);
}

const TITLE_IMAGE = 'assets/images/Title Page.jpeg';

function renderStartMenu() {
  const titleImg = getImage(TITLE_IMAGE);
  if (isImageReady(titleImg)) {
    drawImageCover(titleImg, 0, 0, WIDTH, HEIGHT);
  } else {
    ctx.fillStyle = COLORS.darkest;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.save();
  ctx.scale(WIDTH / ATTRACT_VW, HEIGHT / ATTRACT_VH);
  drawHighScoreMarquee();
  drawTitleBanner();
  drawBestiaryCard();
  drawTicker();
  drawCallToAction();
  ctx.restore();
}

const BACKGROUND_IMAGE = 'assets/images/background.jpeg';
const BACKGROUND_ALPHA = 0.75;

function drawGameBackground() {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const bg = getImage(BACKGROUND_IMAGE);
  if (isImageReady(bg)) {
    ctx.save();
    ctx.globalAlpha = BACKGROUND_ALPHA;
    drawImageCover(bg, 0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }
}

function render() {
  if (state === STATE.START_MENU) {
    renderStartMenu();
    return;
  }

  drawGameBackground();

  const level = LevelManager.current;

  for (const obstacle of level.obstacles) drawObstacle(obstacle);
  for (const planet of level.planets) drawPlanet(planet);
  drawPortal(level.portal);
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
preloadLevelImages();
enterStartMenu();
requestAnimationFrame(loop);
