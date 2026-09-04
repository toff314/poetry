const PALETTES = [
  ['#0a0a0b', '#1a1410', '#3d2818', '#5c3a1e', '#8b5a2b'], // golden palace
  ['#1c2420', '#3a4a42', '#5a7062', '#7a9080', '#2a332e'], // misty mountains
  ['#1a1a2e', '#3d3d5c', '#6b6b8a', '#9a9ab8', '#2a2a3e'], // dawn sky
  ['#1a2216', '#3a4a2e', '#5a6a46', '#8a9a6e', '#2a3222'], // overgrown cottage
  ['#2a1a10', '#5c3a1e', '#8b5a2b', '#b0803c', '#3a2618'], // wine/crab
  ['#0d0d12', '#1f1f2e', '#3a3a4a', '#5a5a6a', '#15151c'], // night/moon
];

function svgGradient(colors: string[]) {
  const stops = colors.map((c, i) => `<stop offset="${(i / (colors.length - 1)) * 100}%" stop-color="${c}"/>`).join('');
  return `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><rect width="1600" height="900" fill="rgba(10,10,11,0.3)"/></svg>`)}`;
}

export function generateAtmosphericImages(count: number): string[] {
  return Array.from({ length: count }, (_, i) => svgGradient(PALETTES[i % PALETTES.length]));
}
