// Draws the full-page backdrop into <svg id="art">: pale rays radiating from a giant
// profile head whose inside is filled with wobbling topographic contour rings.
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
  // Closed wobbly loop; harm = [[frequency, amplitude (fraction of r), phase], ...]
  const loop = (cx, cy, r, harm, n = 120) => {
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      let rr = r;
      for (const [k, amp, ph] of harm) rr += r * amp * Math.sin(k * a + ph);
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1) + ' ';
    }
    return d + 'Z';
  };

  // Colours washed toward a faded white; the black outlines stay full strength.
  const fade = (hex, t = .52) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t) + [0xF2, 0xEF, 0xE6][(i - 1) / 2] * t).toString(16).padStart(2, '0')).join('');

  // Rays from behind the head
  const cx = 560, cy = 640, len = 2200, n = 72;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    E(svg, 'path', { d: `M${cx} ${cy} L${cx + Math.cos(a0) * len} ${cy + Math.sin(a0) * len} L${cx + Math.cos(a1) * len} ${cy + Math.sin(a1) * len} Z`, fill: fade(i % 2 ? '#E9F7EE' : '#BFE8D6', .1) });
  }

  // Profile head, facing right, filled with contour rings
  const head = 'M300 1420 L300 1150 C300 1080 260 1050 250 980 C220 900 200 820 210 720 C220 520 380 380 560 380 C720 380 820 470 840 600 C850 650 845 690 860 720 L900 790 C910 805 900 815 885 818 L860 822 C865 845 860 860 850 870 C862 880 862 895 850 905 C858 930 850 960 820 965 C780 970 740 965 720 990 C700 1020 705 1080 710 1150 L710 1420 Z';
  const clip = E(E(svg, 'defs', {}), 'clipPath', { id: 'head' });
  E(clip, 'path', { d: head });
  const g = E(svg, 'g', { 'clip-path': 'url(#head)' });
  const rings = ['#062A3A', '#1A6F8F', '#4FC3A8', '#C9F29B', '#2E9E5A', '#0B4A5E'].map((c) => fade(c));
  E(g, 'rect', { width: 1000, height: 1420, fill: rings[0] });
  for (let k = 40; k >= 0; k--) E(g, 'path', { d: loop(560, 660, 14 + k * 18, [[3, .08, k * .3], [5, .05, k * .2]]), fill: rings[k % 6], stroke: '#03141D', 'stroke-width': 2 });
  E(svg, 'path', { d: head, fill: 'none', stroke: '#062033', 'stroke-width': 8 });
})();
