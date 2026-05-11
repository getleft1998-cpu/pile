// Extract a shade code from an image URL / filename, falling back to a position-based label.
// Examples:
//   puffy-blush-001.jpg            → "001"   (real)
//   flormar-shade-15.jpg           → "015"   (real)
//   product_n5.jpg                 → "005"   (real)
//   1733331845-0.webp              → "Couleur N" (fallback — timestamp filename)

const FALLBACK_RE = /^Couleur (\d+)$/;

export interface ImageShade {
  imageUrl: string;
  index: number;     // original position in the product image list
  code: string;      // displayed label, e.g. "001" or "Couleur 1"
  isReal: boolean;   // true if extracted from the filename, false if positional fallback
}

function extractShadeCode(
  url: string,
  index: number
): { code: string; isReal: boolean } {
  try {
    const raw = url.split("/").pop() ?? "";
    const decoded = decodeURIComponent(raw);
    // Strip extension
    const filename = decoded.replace(/\.[a-z0-9]+$/i, "");

    // Reject filenames that are dominated by a timestamp (10+ digits at the start).
    // These come from our own import pipeline ("{timestamp}-{idx}.jpg") and the
    // trailing number is a position counter, not a shade.
    const looksLikeTimestamp = /^\d{10,}/.test(filename);

    // Strategy 1: explicit 3-digit code anywhere, not bordered by other digits.
    //   "puffy-001", "001-suntan", "stay-perfect-foundation-007-beige"
    if (!looksLikeTimestamp) {
      const m = filename.match(/(?<![0-9])(\d{3})(?![0-9])/);
      if (m) return { code: m[1], isReal: true };
    }

    // Strategy 2: explicit keyword prefix followed by 1-3 digits.
    //   "shade-15", "couleur_5", "n°12", "color12"
    const m2 = filename.match(
      /(?:shade|color|colour|couleur|teinte|nuance|n[°o]?)[\-_\.\s]?(\d{1,3})\b/i
    );
    if (m2) {
      const n = parseInt(m2[1], 10);
      if (n >= 1 && n <= 999) {
        return { code: String(n).padStart(3, "0"), isReal: true };
      }
    }

    // Strategy 3: 1-2 digit number that's NOT a position counter.
    //   Skip if filename starts with timestamp digits.
    //   Skip if the only number is a "-N" suffix (looks like an index).
    if (!looksLikeTimestamp) {
      const looksLikeIndexSuffix = /[\-_](\d{1,2})$/.test(filename);
      if (!looksLikeIndexSuffix) {
        const m3 = filename.match(/(?<![0-9])(\d{1,2})(?![0-9a-z])/i);
        if (m3) {
          const n = parseInt(m3[1], 10);
          if (n >= 1 && n <= 99) {
            return { code: String(n).padStart(3, "0"), isReal: true };
          }
        }
      }
    }

    return { code: `Couleur ${index + 1}`, isReal: false };
  } catch {
    return { code: `Couleur ${index + 1}`, isReal: false };
  }
}

// Build a list of image-based shades for a product, deduplicating real codes
// (if two images extract to the same number, only the first keeps it; others fall back).
export function buildImageShades(
  images: Array<{ url: string }>
): ImageShade[] {
  const seen = new Set<string>();
  return images.map((img, i) => {
    const { code, isReal } = extractShadeCode(img.url, i);
    if (isReal && !seen.has(code)) {
      seen.add(code);
      return { imageUrl: img.url, index: i, code, isReal: true };
    }
    const fallback = `Couleur ${i + 1}`;
    seen.add(fallback);
    return { imageUrl: img.url, index: i, code: fallback, isReal: false };
  });
}

// True if a label is one of our positional fallback labels (e.g., "Couleur 3").
export function isFallbackShadeLabel(label: string): boolean {
  return FALLBACK_RE.test(label ?? "");
}
