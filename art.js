// Draws the full-page backdrop into <svg id="art">: a pastel sky, a green hill with a
// 70s futurist spire, glass-dome pods, a monorail and lollipop trees.
(function () {
  const svg = document.getElementById('art');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const E = (parent, tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.append(n);
    return n;
  };
  let seed = 1977;
  const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const defs = E(svg, 'defs', {});
  const sky = E(defs, 'linearGradient', { id: 'sky', x1: 0, y1: 0, x2: 0, y2: 1 });
  [[0, '#BFD3DC'], [.45, '#E7E2CF'], [1, '#EFE6D2']].forEach(([o, c]) => E(sky, 'stop', { offset: o, 'stop-color': c }));
  const soft = E(defs, 'filter', { id: 'soft', x: '-50%', y: '-50%', width: '200%', height: '200%' });
  E(soft, 'feGaussianBlur', { stdDeviation: 10 });

  E(svg, 'rect', { width: 1000, height: 1400, fill: 'url(#sky)' });
  const clouds = E(svg, 'g', { filter: 'url(#soft)' });
  for (let i = 0; i < 9; i++) E(clouds, 'ellipse', { cx: R() * 1000, cy: 100 + R() * 400, rx: 120 + R() * 160, ry: 30 + R() * 30, fill: '#FBF7EE', opacity: .8 });
  E(svg, 'path', { d: 'M-10 1400 L-10 1050 Q 200 960 380 860 Q 520 760 620 780 Q 760 820 860 980 Q 940 1080 1010 1100 L1010 1400 Z', fill: '#9BB86A' });
  E(svg, 'path', { d: 'M-10 1400 L-10 1150 Q 300 1080 600 1120 Q 820 1150 1010 1120 L1010 1400 Z', fill: '#B7C98A' });
  for (let i = 0; i < 18; i++) E(svg, 'path', { d: `M${100 + R() * 800} ${1100 + R() * 260} q 30 -10 70 0`, stroke: '#7E9A4E', 'stroke-width': 3, fill: 'none', opacity: .6 });

  // Hilltop spire with a saucer deck
  const line = '#6A5E52', bone = '#F3EEE3', glass = '#9FC3D6', rust = '#B9663C';
  E(svg, 'path', { d: 'M560 860 L572 560 L588 560 L600 860 Z', fill: bone, stroke: line, 'stroke-width': 1.5 });
  E(svg, 'ellipse', { cx: 580, cy: 540, rx: 92, ry: 20, fill: bone, stroke: line, 'stroke-width': 1.5 });
  E(svg, 'path', { d: 'M520 536 Q 580 470 640 536 Z', fill: glass, stroke: line, 'stroke-width': 1.5 });
  for (let k = -3; k <= 3; k++) E(svg, 'circle', { cx: 580 + k * 22, cy: 545, r: 3, fill: rust });
  E(svg, 'line', { x1: 580, y1: 478, x2: 580, y2: 420, stroke: line, 'stroke-width': 2 });
  E(svg, 'circle', { cx: 580, cy: 418, r: 5, fill: rust });

  // A pod: glass dome on a base, optionally standing on stilts
  const pod = (x, y, w, stilts, tint) => {
    const g = E(svg, 'g', {});
    if (stilts) {
      E(g, 'line', { x1: x - w * .3, y1: y, x2: x - w * .45, y2: y + stilts, stroke: line, 'stroke-width': 2 });
      E(g, 'line', { x1: x + w * .3, y1: y, x2: x + w * .45, y2: y + stilts, stroke: line, 'stroke-width': 2 });
    }
    E(g, 'rect', { x: x - w / 2, y: y - w * .18, width: w, height: w * .22, rx: w * .11, fill: bone, stroke: line, 'stroke-width': 1.3 });
    E(g, 'path', { d: `M${x - w * .42} ${y - w * .16} A ${w * .42} ${w * .42} 0 0 1 ${x + w * .42} ${y - w * .16} Z`, fill: tint, stroke: line, 'stroke-width': 1.3 });
    E(g, 'path', { d: `M${x - w * .22} ${y - w * .34} Q ${x - w * .1} ${y - w * .5} ${x + w * .05} ${y - w * .52}`, stroke: '#FFFFFF', 'stroke-width': 2, fill: 'none', opacity: .8 });
    E(g, 'circle', { cx: x + w * .3, cy: y - w * .07, r: w * .04, fill: rust });
  };
  [[470, 860, 70, 0], [700, 870, 64, 0], [400, 930, 50, 26], [770, 950, 54, 30]].forEach(([x, y, w, s]) => pod(x, y, w, s, glass));

  // Valley: monorail, capsule car, scattered pods
  E(svg, 'path', { d: 'M-10 1180 Q 300 1120 520 1160 T 1010 1150', stroke: line, 'stroke-width': 3, fill: 'none' });
  for (let x = 40; x < 1000; x += 90) E(svg, 'line', { x1: x, y1: 1160 + Math.sin(x / 120) * 18, x2: x, y2: 1240, stroke: line, 'stroke-width': 2, opacity: .7 });
  E(svg, 'rect', { x: 600, y: 1138, width: 120, height: 22, rx: 11, fill: bone, stroke: line, 'stroke-width': 1.3 });
  for (let k = 0; k < 5; k++) E(svg, 'rect', { x: 612 + k * 20, y: 1144, width: 12, height: 8, rx: 4, fill: glass });
  const tints = [glass, '#E9C7B4', '#C9DDB4', glass];
  for (let i = 0; i < 22; i++) pod(60 + R() * 880, 1080 + R() * 260, 24 + R() * 22, R() < .3 ? 10 + R() * 12 : 0, tints[Math.floor(R() * 4)]);

  // Lollipop trees
  for (let i = 0; i < 12; i++) {
    const x = R() * 1000, y = 1270 + R() * 110;
    E(svg, 'rect', { x: x - 1.5, y, width: 3, height: 26, fill: line });
    E(svg, 'circle', { cx: x, cy: y, r: 13 + R() * 8, fill: R() < .5 ? '#D9A441' : '#9FBF6A' });
  }
})();
