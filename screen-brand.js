// An original condensed Cyrillic wordmark, shared by the HTML and the physical TV.
const letters = [
  { x: 0, scale: 1.02, d: 'M0 0H8V27L23 0H32L15 31L33 64H23L8 36V64H0Z' },
  { x: 37, scale: .98, d: 'M1 1C5 0 8 0 13 0C26 0 32 10 32 32S26 65 13 65C8 65 5 64 1 63V53C5 55 8 56 12 56C19 56 22 50 23 36H7V27H23C22 14 19 9 12 9C8 9 5 10 1 12Z' },
  { x: 70, scale: .94, d: 'M0 0H33V9H21V64H12V9H0Z' },
  { x: 111, scale: .90, d: 'M14 0H22V11C31 12 36 19 36 32S31 52 22 53V64H14V53C5 52 0 45 0 32S5 12 14 11ZM14 20C10 21 8 25 8 32S10 43 14 44ZM22 20V44C26 43 28 39 28 32S26 21 22 20Z' },
  { x: 154, scale: .90, d: 'M0 64L9 0H23L32 64H23L16 10L9 64Z' },
  { x: 193, scale: .94, d: 'M0 0H8V42L24 0H32V64H24V22L8 64H0Z' },
  { x: 232, scale: .98, d: 'M0 0H8V27L23 0H32L15 31L33 64H23L8 36V64H0Z' },
  { x: 272, scale: 1.02, d: 'M30 1V11C26 9 23 8 19 8C11 8 8 15 8 32S11 56 19 56C23 56 26 55 30 53V63C26 64 23 65 18 65C5 65 0 55 0 32S5 0 18 0C23 0 26 0 30 1Z' }
];
let paths;
export const TV_SERVICE_NAME = 'КЭТФЛИКС';

export function tvServiceLogo() {
  return `<svg class="tv-service-mark" viewBox="0 0 302 68" role="img" aria-label="${TV_SERVICE_NAME}" xmlns="http://www.w3.org/2000/svg"><g fill="currentColor" fill-rule="evenodd">${letters.map(letter => `<path transform="translate(${letter.x} 0) scale(1 ${letter.scale})" d="${letter.d}"/>`).join('')}</g></svg>`;
}

export function drawTVServiceLogo(context, x, y, width, color = '#e50914') {
  context.save();
  context.translate(x, y); context.scale(width / 302, width / 302);
  context.fillStyle = color;
  if (typeof Path2D === 'function') {
    paths ||= letters.map(letter => new Path2D(letter.d));
    letters.forEach((letter, index) => {
      context.save(); context.translate(letter.x, 0); context.scale(1, letter.scale);
      context.fill(paths[index], 'evenodd'); context.restore();
    });
  } else {
    context.font = '900 53px Arial, sans-serif';
    context.textBaseline = 'top'; context.fillText(TV_SERVICE_NAME, 0, 0, 302);
  }
  context.restore();
}
