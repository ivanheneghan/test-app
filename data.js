// ============================================================
// Data layer: level configs + entity type definitions.
// Exposed on window so teammates can merge new levels/entities
// in parallel without touching game logic in main.js.
// ============================================================

window.ENTITY_TYPES = {
  CFO: {
    label: 'CFO',
    colorKey: 'darkest',   // key into the active theme palette
    velocityFactor: 0.95,  // dampens velocity within pull radius
  },
  VP_SALES: {
    label: 'VP SALES',
    colorKey: 'dark',
    velocityFactor: 1.3,   // boosts velocity within pull radius
  },
};

window.GAME_LEVELS = [
  {
    id: 1,
    launcher: { x: 100, y: 470 },
    goal: { x: 840, y: 100, radius: 26 },
    nodes: [
      { type: 'VP_SALES', x: 470, y: 300, radius: 70, mass: 900, multiplier: 1.0 },
    ],
    blockers: [
      { x: 560, y: 380, w: 30, h: 140, label: 'Legal Review' },
    ],
  },
  {
    id: 2,
    launcher: { x: 80, y: 90 },
    goal: { x: 860, y: 460, radius: 24 },
    nodes: [
      { type: 'CFO', x: 400, y: 260, radius: 90, mass: 1400, multiplier: 1.0 },
      { type: 'VP_SALES', x: 680, y: 380, radius: 60, mass: 700, multiplier: 1.0 },
    ],
    blockers: [
      { x: 260, y: 340, w: 160, h: 24, label: 'Procurement' },
      { x: 620, y: 120, w: 24, h: 160, label: 'Budget Freeze' },
    ],
  },
];
