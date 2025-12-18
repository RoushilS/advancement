export function hslToRgb(h, s, l) {
  // Convert HSL (0-360, 0-100, 0-100) to RGB 0-255 for contrast checks
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ];
}

export function colorForPct(pct) {
  const capped = Math.max(0, Math.min(100, pct));
  const hue = capped * 1.2; // 0% = red (0deg), 100% = green (120deg)
  const saturation = 85;
  const lightness = 55;
  const [R, G, B] = hslToRgb(hue, saturation, lightness);
  const brightness = (R * 299 + G * 587 + B * 114) / 1000;
  const text = brightness > 140 ? "#000" : "#fff";
  return {
    bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    fg: text,
  };
}

