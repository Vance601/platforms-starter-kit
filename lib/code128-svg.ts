// Code 128 patterns (values 0-106). Each is 11 modules; Stop (106) is 13
// (11 + 2-module terminator). Used for battery labels (SVG) and for sizing ZPL.
const PATTERNS = [
  "11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000",
  "11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100",
  "11001001110","11011100100","11001110100","11101101110","11101001100","11100101100","11100100110","11101100100","11100110100","11100110010",
  "11011011000","11011000110","11000110110","10100011000","10001011000","10001000110","10110001000","10001101000","10001100010","11010001000",
  "11000101000","11000100010","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101110110","11010001110",
  "11000101110","11011101000","11011100010","11011101110","11101011000","11101000110","11100010110","11101101000","11101100010","11100011010",
  "11101111010","11001000010","11110001010","10100110000","10100001100","10010110000","10010000110","10000101100","10000100110","10110010000",
  "10110000100","10011010000","10011000010","10000110100","10000110010","11000010010","11001010000","11110111010","11000010100","10001111010",
  "10100111100","10010111100","10010011110","10111100100","10011110100","10011110010","11110100100","11110010100","11110010010","11011011110",
  "11011110110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110",
  "10111101110","11101011110","11110101110","11010000100","11010010000","11010011100","11000111010",
];

function isDigit(s: string) {
  return /^\d+$/.test(s);
}

function valuesFor(text: string): number[] {
  // Prefer Code C pairs of digits; otherwise Code B.
  const out: number[] = [];
  let i = 0;
  let set: "B" | "C" = "B";
  if (text.length >= 4 && isDigit(text.slice(0, 4))) {
    set = "C";
    out.push(105);
  } else {
    out.push(104);
  }
  while (i < text.length) {
    if (set === "C") {
      if (i + 1 < text.length && isDigit(text[i]) && isDigit(text[i + 1])) {
        out.push(Number(text.slice(i, i + 2)));
        i += 2;
        continue;
      }
      set = "B";
      out.push(100); // switch to B
    }
    // Lookahead: 4+ remaining digits → switch to C
    if (i + 3 < text.length && isDigit(text.slice(i, i + 4))) {
      set = "C";
      out.push(99);
      continue;
    }
    const ch = text.charCodeAt(i);
    if (ch < 32 || ch > 126) {
      throw new Error("Code 128 only supports ASCII 32-126");
    }
    out.push(ch - 32);
    i += 1;
  }
  return out;
}

export function code128Modules(text: string): string {
  const values = valuesFor(text);
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) checksum += values[i] * i;
  checksum %= 103;
  const all = [...values, checksum, 106];
  // Stop is 11 modules plus the 2-module terminator.
  return all.map((v) => (v === 106 ? PATTERNS[v] + "11" : PATTERNS[v])).join("");
}

/** SVG barcode, quiet zone of 10 modules on each side. */
export function code128Svg(
  text: string,
  opts: { width?: number; height?: number; className?: string } = {},
): string {
  const bits = code128Modules(text);
  const quiet = 10;
  const modules = quiet * 2 + bits.length;
  const w = opts.width ?? 200;
  const h = opts.height ?? 50;
  const moduleW = w / modules;
  const bars: string[] = [];
  let x = quiet * moduleW;
  let run = 0;
  for (let i = 0; i <= bits.length; i++) {
    if (bits[i] === "1") {
      run++;
    } else if (run) {
      bars.push(`<rect x="${(x - run * moduleW).toFixed(3)}" y="0" width="${(run * moduleW).toFixed(3)}" height="${h}" />`);
      run = 0;
    }
    x += moduleW;
  }
  const cls = opts.className ? ` class="${opts.className}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg"${cls} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${escapeXml(text)}">${bars.join("")}</svg>`;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
