/**
 * Deal Slinger - Official Level Configurations
 * Canvas Space: 1600x900 (16:9 Widescreen)
 * Launcher Position: Bottom-Left (150, 800)
 * Goal Portal Position: Top-Right (1450, 150)
 *
 * Physics Rule: Executive mass is proportional to visual size
 * (m = r^2 * 0.444), used directly by main.js's gravity equation.
 *
 * Executive entities are represented by generic role aliases rather
 * than real names/photos, per data-protection guardrails (CLAUDE.md
 * section 8: no employee names/PII in committed code). `image` paths
 * point into /assets/images/ per CLAUDE.md's asset path rule; until
 * those files are provided, main.js falls back to the `color` hex
 * value below for procedural rendering.
 */

window.GAME_LEVELS = [
  {
    id: 1,
    title: 'Onboarding & First Pull',
    launcher: { x: 150, y: 800 },
    portal: {
      x: 1450,
      y: 150,
      radius: 40,
      color: '#2ECC71',
      image: 'assets/images/portal.png',
    },
    planets: [
      {
        label: 'SALES REP A',
        x: 450,
        y: 650,
        radius: 40,
        mass: 710,
        color: '#4A90E2',
        image: 'assets/images/rep_a.png',
      },
      {
        label: 'SALES REP B',
        x: 1050,
        y: 300,
        radius: 40,
        mass: 710,
        color: '#4A90E2',
        image: 'assets/images/rep_b.png',
      },
    ],
    obstacles: [
      {
        label: 'No Data',
        x: 700,
        y: 400,
        w: 250,
        h: 25,
        color: '#E74C3C',
        image: 'assets/images/obstacle_nodata.png',
      },
    ],
  },
  {
    id: 2,
    title: 'Cross-Functional S-Curve',
    launcher: { x: 150, y: 800 },
    portal: {
      x: 1450,
      y: 150,
      radius: 40,
      color: '#2ECC71',
      image: 'assets/images/portal.png',
    },
    planets: [
      {
        label: 'TEAM LEAD A',
        x: 600,
        y: 600,
        radius: 45,
        mass: 900,
        color: '#4A90E2',
        image: 'assets/images/lead_a.png',
      },
      {
        label: 'TEAM LEAD B',
        x: 1100,
        y: 250,
        radius: 45,
        mass: 900,
        color: '#4A90E2',
        image: 'assets/images/lead_b.png',
      },
    ],
    obstacles: [
      {
        label: 'Broken Processes',
        x: 750,
        y: 340,
        w: 40,
        h: 220,
        color: '#E74C3C',
        image: 'assets/images/obstacle_brokenprocesses.png',
      },
    ],
  },
  {
    id: 3,
    title: 'RevOps Alignment',
    launcher: { x: 150, y: 800 },
    portal: {
      x: 1450,
      y: 150,
      radius: 40,
      color: '#2ECC71',
      image: 'assets/images/portal.png',
    },
    planets: [
      {
        label: 'OPS DIRECTOR',
        x: 800,
        y: 450,
        radius: 55,
        mass: 1340,
        color: '#9B59B6',
        image: 'assets/images/ops_director.png',
      },
    ],
    obstacles: [
      {
        label: 'Roadmaps',
        x: 500,
        y: 550,
        w: 300,
        h: 25,
        color: '#E74C3C',
        image: 'assets/images/obstacle_roadmaps.png',
      },
      {
        label: 'Misaligned KPIs',
        x: 1100,
        y: 250,
        w: 25,
        h: 300,
        color: '#E74C3C',
        image: 'assets/images/obstacle_kpis.png',
      },
    ],
  },
  {
    id: 4,
    title: 'CRO Approval',
    launcher: { x: 150, y: 800 },
    portal: {
      x: 1450,
      y: 150,
      radius: 40,
      color: '#2ECC71',
      image: 'assets/images/portal.png',
    },
    planets: [
      {
        label: 'THE CRO',
        x: 700,
        y: 500,
        radius: 65,
        mass: 1875,
        color: '#E67E22',
        image: 'assets/images/cro.png',
      },
    ],
    obstacles: [
      {
        label: 'System Priorities',
        x: 950,
        y: 300,
        w: 300,
        h: 25,
        color: '#E74C3C',
        image: 'assets/images/obstacle_systempriorities.png',
      },
    ],
  },
  {
    id: 5,
    title: 'CEO Directives',
    launcher: { x: 150, y: 800 },
    portal: {
      x: 1450,
      y: 150,
      radius: 40,
      color: '#2ECC71',
      image: 'assets/images/portal.png',
    },
    planets: [
      {
        label: 'THE CEO',
        x: 800,
        y: 450,
        radius: 85,
        mass: 3200,
        color: '#F1C40F',
        image: 'assets/images/ceo.png',
      },
    ],
    obstacles: [
      {
        label: 'Changing Priorities',
        x: 1000,
        y: 120,
        w: 400,
        h: 25,
        color: '#E74C3C',
        image: 'assets/images/obstacle_changingpriorities.png',
      },
    ],
  },
];
