/** Utilidades de cor (sRGB) e contraste WCAG 2.x. */
export type RGB = [number, number, number];

export function parseHex(hex: string): RGB | null {
  const m = hex.trim().replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

export function isHex(s: string) {
  return parseHex(s) !== null;
}

export function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

const rgb = (hex: string): RGB => parseHex(hex) ?? [128, 128, 128];

export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const isDarkColor = (hex: string) => luminance(hex) < 0.18;

/**
 * Ajusta `color` (escurecendo ou clareando, preservando o matiz o quanto
 * possível) até atingir o contraste mínimo contra TODOS os fundos dados.
 */
export function ensureContrast(color: string, backgrounds: string[], min: number): string {
  const ok = (c: string) => backgrounds.every((bg) => contrast(c, bg) >= min);
  if (ok(color)) return color;
  const darkBg = backgrounds.every((bg) => isDarkColor(bg));
  const target = darkBg ? '#ffffff' : '#000000';
  for (let t = 0.04; t <= 1.0001; t += 0.04) {
    const c = mix(color, target, t);
    if (ok(c)) return c;
  }
  // Tenta a direção oposta (fundos médios).
  const other = darkBg ? '#000000' : '#ffffff';
  for (let t = 0.04; t <= 1.0001; t += 0.04) {
    const c = mix(color, other, t);
    if (ok(c)) return c;
  }
  return target;
}

/** Preto ou branco (levemente tingidos) — o que tiver maior contraste. */
export function bestOn(bg: string, tint?: string): string {
  const dark = tint ? mix(tint, '#000000', 0.85) : '#1a1a1a';
  const light = tint ? mix(tint, '#ffffff', 0.94) : '#ffffff';
  return contrast(dark, bg) >= contrast(light, bg) ? dark : light;
}
