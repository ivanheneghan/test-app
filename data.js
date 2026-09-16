// ============================================================
// Data layer: entity type definitions.
// Exposed on window so teammates can merge new entities in
// parallel without touching game logic in main.js.
// Level configs live in levels.js (window.GAME_LEVELS).
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
  SALES_REP: {
    label: 'SALES REP',
    colorKey: 'dark',
    velocityFactor: 1.0,   // neutral gravity well, no damp/boost
  },
  TEAM_LEAD: {
    label: 'TEAM LEAD',
    colorKey: 'dark',
    velocityFactor: 1.0,
  },
  OPS_DIRECTOR: {
    label: 'OPS DIRECTOR',
    colorKey: 'darkest',
    velocityFactor: 1.0,
  },
  CRO: {
    label: 'CRO',
    colorKey: 'darkest',
    velocityFactor: 1.0,
  },
  CEO: {
    label: 'CEO',
    colorKey: 'darkest',
    velocityFactor: 1.0,
  },
};
