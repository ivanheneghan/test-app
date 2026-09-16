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
 * section 8: no employee names/PII in committed code) — assets in
 * /assets/images/ have been renamed to match (e.g. BDR.jpeg, CRO.jpeg).
 * If an `image` fails to load (missing, or the still-placeholder
 * CEO.png), main.js falls back to the `color` hex value below for
 * procedural rendering.
 */

window.GAME_LEVELS = [
  {
    id: 1,
    title: 'Onboarding & First Pull',
    launcher: { x: 150, y: 800, image: 'assets/images/Sales Person.png' },
    portal: {
      x: 1450,
      y: 150,
      radius: 40,
      color: '#2ECC71',
      image: 'assets/images/Portal.png',
    },
    planets: [
      {
        label: 'BDR',
        x: 450,
        y: 650,
        radius: 40,
        mass: 710,
        color: '#4A90E2',
        image: 'assets/images/BDR.jpeg',
      },
      {
        label: 'CSM',
        x: 1050,
        y: 300,
        radius: 40,
        mass: 710,
        color: '#4A90E2',
        image: 'assets/images/CSM.jpeg',
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
        image: 'assets/images/No Data.png',
      },
    ],
  },
  {
    id: 2,
    title: 'Cross-Functional S-Curve',
    launcher: { x: 150, y: 800, image: 'assets/images/Sales Person.png' },
    portal: {
      x: 1450,
      y: 150,
      radius: 40,
      color: '#2ECC71',
      image: 'assets/images/Portal.png',
    },
    planets: [
      {
        label: 'Sales MM',
        x: 600,
        y: 600,
        radius: 45,
        mass: 900,
        color: '#4A90E2',
        image: 'assets/images/SalesMM.jpeg',
      },
      {
        label: 'Sales SMB',
        x: 1100,
        y: 250,
        radius: 45,
        mass: 900,
        color: '#4A90E2',
        image: 'assets/images/SalesSMB.jpeg',
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
        image: 'assets/images/Broken Process.png',
      },
    ],
  },
  {
    id: 3,
    title: 'RevOps Alignment',
    launcher: { x: 150, y: 800, image: 'assets/images/Sales Person.png' },
    portal: {
      x: 1450,
      y: 150,
      radius: 40,
      color: '#2ECC71',
      image: 'assets/images/Portal.png',
    },
    planets: [
      {
        label: 'RevOps',
        x: 800,
        y: 450,
        radius: 55,
        mass: 1340,
        color: '#9B59B6',
        image: 'assets/images/RevOps.jpeg',
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
        image: 'assets/images/Roadmaps.png',
      },
      {
        label: 'Misaligned KPIs',
        x: 1100,
        y: 250,
        w: 25,
        h: 300,
        color: '#E74C3C',
        image: 'assets/images/Misaligned KPIs.png',
      },
    ],
  },
  {
    id: 4,
    title: 'CRO Approval',
    launcher: { x: 150, y: 800, image: 'assets/images/Sales Person.png' },
    portal: {
      x: 1450,
      y: 150,
      radius: 40,
      color: '#2ECC71',
      image: 'assets/images/Portal.png',
    },
    planets: [
      {
        label: 'CRO',
        x: 700,
        y: 500,
        radius: 65,
        mass: 1875,
        color: '#E67E22',
        image: 'assets/images/CRO.jpeg',
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
        image: 'assets/images/Systems Priorities.png',
      },
    ],
  },
  {
    id: 5,
    title: 'CEO Directives',
    launcher: { x: 150, y: 800, image: 'assets/images/Sales Person.png' },
    portal: {
      x: 1450,
      y: 150,
      radius: 40,
      color: '#2ECC71',
      image: 'assets/images/Portal.png',
    },
    planets: [
      {
        label: 'CEO',
        x: 800,
        y: 450,
        radius: 85,
        mass: 3200,
        color: '#F1C40F',
        image: 'assets/images/CEO.png',
      },
    ],
    obstacles: [
      {
        label: 'Enablement Gap',
        x: 1000,
        y: 120,
        w: 400,
        h: 25,
        color: '#E74C3C',
        image: 'assets/images/Enablement Gap.png',
      },
    ],
  },
];
