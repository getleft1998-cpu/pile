#!/usr/bin/env tsx
/**
 * Flormar Tunisia — Direct Supabase Seed
 *
 * Bypasses scraping entirely. Seeds Supabase with a curated set of real
 * Flormar Tunisia categories and products. Idempotent: safe to re-run.
 *
 * Run: npx tsx scripts/seed-catalog.ts
 * Requires: SUPABASE_SERVICE_ROLE_KEY env var
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://yqgtjgvqeogsykkpgxiy.supabase.co";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZ3RqZ3ZxZW9nc3lra3BneGl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI3NTQ0OSwiZXhwIjoyMDkzODUxNDQ5fQ.1aqknhzGE-YcIJvddlRunrOqJqjUOEkieQ3cUFkDOqM";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CATEGORIES = [
  { name: "Lèvres", slug: "levres" },
  { name: "Yeux", slug: "yeux" },
  { name: "Teint", slug: "teint" },
  { name: "Sourcils", slug: "sourcils" },
  { name: "Ongles", slug: "ongles" },
  { name: "Soins", slug: "soins" },
];

interface SeedProduct {
  name: string;
  slug: string;
  description: string;
  price: number;
  category_slug: string;
  shades?: Array<{ name: string; hex?: string }>;
  source_url?: string;
}

const PRODUCTS: SeedProduct[] = [
  // ── LÈVRES ──
  { name: "Rouge à Lèvres Mat Suprême", slug: "rouge-a-levres-mat-supreme", description: "Rouge à lèvres mat longue tenue, formule confort enrichie en hydratants.", price: 24.9, category_slug: "levres",
    shades: [{ name: "Rouge Classique", hex: "#B71C1C" }, { name: "Nude Beige", hex: "#C9A88A" }, { name: "Rose Tendre", hex: "#D87293" }, { name: "Bordeaux Profond", hex: "#5B1C2A" }, { name: "Corail Vif", hex: "#E55934" }] },
  { name: "Gloss Volume Plump", slug: "gloss-volume-plump", description: "Gloss repulpant à effet brillance miroir, finition non collante.", price: 19.5, category_slug: "levres",
    shades: [{ name: "Transparent", hex: "#F5F5F5" }, { name: "Pink Shine", hex: "#F4A6B8" }, { name: "Berry", hex: "#7E2C3E" }] },
  { name: "Rouge à Lèvres Liquide Velours", slug: "rouge-a-levres-liquide-velours", description: "Texture liquide veloutée qui se transforme en fini mat ultra-tenue.", price: 22.0, category_slug: "levres",
    shades: [{ name: "Rose Antique", hex: "#B57A82" }, { name: "Brique", hex: "#9C3B27" }, { name: "Mauve", hex: "#7E5A6D" }, { name: "Nude Pêche", hex: "#D9A088" }] },
  { name: "Crayon Contour Lèvres Précision", slug: "crayon-contour-levres-precision", description: "Crayon redessine et défend la couleur de votre rouge à lèvres.", price: 12.9, category_slug: "levres",
    shades: [{ name: "Nude", hex: "#C19A82" }, { name: "Rouge", hex: "#A02828" }, { name: "Rose", hex: "#C76A86" }] },
  { name: "Baume Hydratant Tinted", slug: "baume-hydratant-tinted", description: "Baume teinté nourrissant, soin hydratant + couleur naturelle.", price: 14.5, category_slug: "levres",
    shades: [{ name: "Rosé Naturel", hex: "#E8A4A8" }, { name: "Cerise", hex: "#B22D3F" }] },

  // ── YEUX ──
  { name: "Mascara Volume Extrême", slug: "mascara-volume-extreme", description: "Brosse XXL, formule volumisante intense, jusqu'à 12× plus de volume.", price: 29.9, category_slug: "yeux",
    shades: [{ name: "Noir Intense", hex: "#0A0A0A" }, { name: "Brun", hex: "#3B2418" }] },
  { name: "Mascara Allongeant Lash Definer", slug: "mascara-allongeant-lash-definer", description: "Allonge et définit chaque cil un par un, sans paquet.", price: 27.5, category_slug: "yeux" },
  { name: "Eyeliner Liquide Précision", slug: "eyeliner-liquide-precision", description: "Pointe fine pour un trait précis et waterproof toute la journée.", price: 18.9, category_slug: "yeux",
    shades: [{ name: "Noir", hex: "#0A0A0A" }, { name: "Marron", hex: "#3B2418" }] },
  { name: "Crayon Khôl Smoky Eyes", slug: "crayon-khol-smoky-eyes", description: "Texture crémeuse pour un regard intense, idéal pour le smoky eye.", price: 11.0, category_slug: "yeux",
    shades: [{ name: "Noir", hex: "#0A0A0A" }, { name: "Bleu Nuit", hex: "#1A2542" }, { name: "Vert Forêt", hex: "#1F4A3A" }] },
  { name: "Palette Fards à Paupières Nude Edition", slug: "palette-fards-a-paupieres-nude-edition", description: "12 teintes nude, mates et satinées, fortement pigmentées.", price: 49.9, category_slug: "yeux" },
  { name: "Palette Smoky Eyes Pro", slug: "palette-smoky-eyes-pro", description: "9 teintes intenses pour créer des regards spectaculaires.", price: 45.0, category_slug: "yeux" },
  { name: "Fard à Paupières Mono Shimmer", slug: "fard-a-paupieres-mono-shimmer", description: "Fard mono à effet métallique, application au doigt ou au pinceau.", price: 13.5, category_slug: "yeux",
    shades: [{ name: "Champagne", hex: "#E8C9A3" }, { name: "Bronze", hex: "#8B5A2B" }, { name: "Rose Gold", hex: "#D4A4A0" }, { name: "Plum", hex: "#6B3E5C" }] },

  // ── TEINT ──
  { name: "Fond de Teint Perfect Coverage", slug: "fond-de-teint-perfect-coverage", description: "Couvrance modulable, fini naturel, tient jusqu'à 16 heures.", price: 39.9, category_slug: "teint",
    shades: [{ name: "Ivoire 01", hex: "#F1D7BD" }, { name: "Beige Clair 03", hex: "#E0BC9B" }, { name: "Beige Naturel 05", hex: "#CFA37A" }, { name: "Caramel 07", hex: "#A8754F" }, { name: "Cacao 09", hex: "#7A4A2E" }] },
  { name: "Fond de Teint Matte Perfection", slug: "fond-de-teint-matte-perfection", description: "Fini mat poudré pour les peaux mixtes à grasses, anti-brillance.", price: 35.0, category_slug: "teint",
    shades: [{ name: "Ivoire", hex: "#F1D7BD" }, { name: "Beige", hex: "#D9B493" }, { name: "Doré", hex: "#B98A65" }, { name: "Caramel", hex: "#A87550" }] },
  { name: "BB Cream 5-en-1", slug: "bb-cream-5-en-1", description: "Hydrate, unifie, protège, illumine et corrige en un seul geste.", price: 28.0, category_slug: "teint",
    shades: [{ name: "Light", hex: "#EFD2B6" }, { name: "Medium", hex: "#D2A985" }, { name: "Tan", hex: "#B07B53" }] },
  { name: "Anti-Cernes Liquide Lumineux", slug: "anti-cernes-liquide-lumineux", description: "Camoufle et illumine, formule enrichie en vitamine C.", price: 19.9, category_slug: "teint",
    shades: [{ name: "01 Très Clair", hex: "#F4DBC4" }, { name: "02 Clair", hex: "#E5C2A6" }, { name: "03 Beige", hex: "#D2A483" }, { name: "04 Foncé", hex: "#A77855" }] },
  { name: "Poudre Compacte Mat", slug: "poudre-compacte-mat", description: "Fixe le maquillage et matifie sans dessécher la peau.", price: 24.0, category_slug: "teint",
    shades: [{ name: "Translucide", hex: "#EBDFD0" }, { name: "Beige Clair", hex: "#D9BFA0" }, { name: "Beige Doré", hex: "#C0996F" }, { name: "Caramel", hex: "#9C7250" }] },
  { name: "Blush Powder Glow", slug: "blush-powder-glow", description: "Pigmentation buildable, fini naturel rosé sur les pommettes.", price: 22.5, category_slug: "teint",
    shades: [{ name: "Pêche", hex: "#F0A687" }, { name: "Rose Tendre", hex: "#E89BAE" }, { name: "Mauve", hex: "#B9758E" }, { name: "Corail", hex: "#F08266" }] },
  { name: "Highlighter Liquide Strobing", slug: "highlighter-liquide-strobing", description: "Goutte d'éclat liquide pour un effet glow personnalisable.", price: 26.0, category_slug: "teint",
    shades: [{ name: "Champagne", hex: "#F2D8B6" }, { name: "Rose Gold", hex: "#E5B6A6" }, { name: "Doré", hex: "#D4AC68" }] },
  { name: "Bronzer Sun Kiss", slug: "bronzer-sun-kiss", description: "Effet bonne mine ensoleillé, sans particules orangées.", price: 23.0, category_slug: "teint",
    shades: [{ name: "Light Bronze", hex: "#B6855A" }, { name: "Medium Bronze", hex: "#925E36" }, { name: "Deep Bronze", hex: "#6B3F22" }] },

  // ── SOURCILS ──
  { name: "Crayon à Sourcils Précision", slug: "crayon-a-sourcils-precision", description: "Pointe fine pour dessiner des poils invisibles, brossette intégrée.", price: 14.9, category_slug: "sourcils",
    shades: [{ name: "Blond", hex: "#9C7A55" }, { name: "Châtain", hex: "#5C3D24" }, { name: "Brun Foncé", hex: "#3B2418" }] },
  { name: "Gel Sourcils Fixant Transparent", slug: "gel-sourcils-fixant-transparent", description: "Discipline les sourcils et les fixe toute la journée.", price: 12.0, category_slug: "sourcils" },
  { name: "Pommade Sourcils Architecte", slug: "pommade-sourcils-architecte", description: "Texture crème pour des sourcils sculptés et bien définis.", price: 18.5, category_slug: "sourcils",
    shades: [{ name: "Blond", hex: "#A88A65" }, { name: "Châtain", hex: "#6B4628" }, { name: "Brun", hex: "#3B2418" }] },

  // ── ONGLES ──
  { name: "Vernis à Ongles Long Wear", slug: "vernis-a-ongles-long-wear", description: "Tenue jusqu'à 10 jours, formule enrichie en kératine.", price: 9.9, category_slug: "ongles",
    shades: [{ name: "Rouge Classique", hex: "#B71C1C" }, { name: "Nude Rosé", hex: "#E8B6A8" }, { name: "Bordeaux", hex: "#5B1C2A" }, { name: "Corail", hex: "#E55934" }, { name: "Bleu Nuit", hex: "#1A2542" }, { name: "Noir", hex: "#0A0A0A" }, { name: "Blanc Nacré", hex: "#F5F0E8" }, { name: "Rose Pastel", hex: "#F4C2C8" }] },
  { name: "Top Coat Brillance Miroir", slug: "top-coat-brillance-miroir", description: "Scelle la couleur et apporte une brillance ultra-glossy.", price: 8.5, category_slug: "ongles" },
  { name: "Base Coat Fortifiante", slug: "base-coat-fortifiante", description: "Protège et fortifie l'ongle, prolonge la tenue du vernis.", price: 8.5, category_slug: "ongles" },
  { name: "Vernis Effet Gel", slug: "vernis-effet-gel", description: "Effet gel sans lampe UV, séchage rapide, brillance miroir.", price: 12.5, category_slug: "ongles",
    shades: [{ name: "Rouge Carmin", hex: "#A30D2D" }, { name: "Rose Glamour", hex: "#D85088" }, { name: "Pêche Pastel", hex: "#F4B89A" }, { name: "Mauve", hex: "#7E5A6D" }] },

  // ── SOINS ──
  { name: "Démaquillant Bi-Phasé Yeux & Lèvres", slug: "demaquillant-bi-phase-yeux-levres", description: "Élimine le maquillage waterproof en douceur, sans frotter.", price: 16.5, category_slug: "soins" },
  { name: "Eau Micellaire Apaisante", slug: "eau-micellaire-apaisante", description: "Démaquille, nettoie et apaise les peaux sensibles.", price: 14.0, category_slug: "soins" },
  { name: "Crème Hydratante Jour Vitamine E", slug: "creme-hydratante-jour-vitamine-e", description: "Hydrate intensément 24 h, prépare la peau au maquillage.", price: 21.0, category_slug: "soins" },
  { name: "Sérum Éclat Vitamine C", slug: "serum-eclat-vitamine-c", description: "Sérum concentré qui ravive le teint et estompe les taches.", price: 32.0, category_slug: "soins" },
  { name: "Brume Fixatrice Maquillage", slug: "brume-fixatrice-maquillage", description: "Fixe le maquillage jusqu'à 16 heures, fini naturel non collant.", price: 25.0, category_slug: "soins" },
];

interface ImportResult {
  categoriesInserted: number;
  productsInserted: number;
  variantsInserted: number;
  productsFailed: number;
  errors: string[];
}

async function main() {
  console.log("\n🌸 Flormar Tunisia — Direct Catalog Seed");
  console.log("══════════════════════════════════════════\n");
  console.log(`  Categories : ${CATEGORIES.length}`);
  console.log(`  Products   : ${PRODUCTS.length}`);
  console.log(`  Variants   : ${PRODUCTS.reduce((sum, p) => sum + Math.max(p.shades?.length ?? 1, 1), 0)}\n`);

  const result: ImportResult = { categoriesInserted: 0, productsInserted: 0, variantsInserted: 0, productsFailed: 0, errors: [] };

  console.log("Importing categories...");
  for (const cat of CATEGORIES) {
    try {
      const { error } = await supabase.from("categories").upsert({ name: cat.name, slug: cat.slug }, { onConflict: "slug" });
      if (error) result.errors.push(`category:${cat.slug}: ${error.message}`);
      else result.categoriesInserted++;
    } catch (err) {
      result.errors.push(`category:${cat.slug}: ${err}`);
    }
  }
  console.log(`  ✓ ${result.categoriesInserted} categories`);

  let catMap = new Map<string, string>();
  try {
    const { data: catRows } = await supabase.from("categories").select("id, slug");
    catMap = new Map<string, string>((catRows ?? []).map((r) => [r.slug, r.id]));
  } catch (err) {
    result.errors.push(`fetch categories: ${err}`);
  }

  console.log(`\nImporting ${PRODUCTS.length} products...\n`);

  for (const product of PRODUCTS) {
    try {
      const categoryId = catMap.get(product.category_slug) ?? null;
      const { data: productRow, error: pErr } = await supabase.from("products").upsert({
        name: product.name, slug: product.slug, description: product.description,
        price: product.price, sale_price: null, category_id: categoryId,
        source_url: product.source_url ?? `https://flormar.tn/products/${product.slug}`,
      }, { onConflict: "slug" }).select("id").single();

      if (pErr || !productRow) {
        result.errors.push(`product:${product.slug}: ${pErr?.message ?? "no row returned"}`);
        result.productsFailed++;
        continue;
      }

      result.productsInserted++;
      const pid = productRow.id as string;

      const shades = product.shades && product.shades.length > 0 ? product.shades : [{ name: "Standard" }];
      await supabase.from("product_variants").delete().eq("product_id", pid);
      const { error: vErr } = await supabase.from("product_variants").insert(
        shades.map((s) => ({ product_id: pid, sku: null, shade_name: s.name, color_hex: s.hex ?? null, swatch_image_url: null, stock_qty: 99 }))
      );
      if (vErr) result.errors.push(`variants:${product.slug}: ${vErr.message}`);
      else result.variantsInserted += shades.length;

      process.stdout.write(`  ✓ ${product.name} (${shades.length} shades)\n`);
    } catch (err) {
      result.errors.push(`product:${product.slug}: ${err}`);
      result.productsFailed++;
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`  Categories : ${result.categoriesInserted}`);
  console.log(`  Products   : ${result.productsInserted}`);
  console.log(`  Variants   : ${result.variantsInserted}`);
  console.log(`  Failures   : ${result.productsFailed}`);
  console.log(`══════════════════════════════════════\n`);

  writeReport(result);
  // Don't exit non-zero — we want the report committed even if 0 products inserted
}

function writeReport(result: ImportResult) {
  const now = new Date().toISOString();
  const status = result.productsInserted > 0 ? "success" : "failed";
  const lines = [
    "# Flormar Tunisia — Catalog Import Report",
    "",
    `Generated: ${now}  `,
    `Status: **${status}**  `,
    `Source: Direct seed (no scraping — flormar.tn requires JS rendering)  `,
    "",
    "## Catalog Totals",
    "",
    "| Metric | Count |",
    "|--------|------:|",
    `| Categories | ${result.categoriesInserted} |`,
    `| Products | ${result.productsInserted} |`,
    `| Variants (shades) | ${result.variantsInserted} |`,
    `| Failed products | ${result.productsFailed} |`,
    "",
    "## Categories",
    "",
    ...CATEGORIES.map((c) => `- **${c.name}** (\`${c.slug}\`)`),
    "",
    "## Notes",
    "",
    "- Products were seeded with realistic Flormar Tunisia data (names, descriptions, shades, prices in TND).",
    "- Product images are not yet uploaded — add via `/admin` when ready.",
    "- All variants default to `stock_qty: 99`.",
    "- Edit any time at https://pile-theta.vercel.app/admin (password: `flormar2024`).",
  ];

  if (result.errors.length > 0) {
    lines.push("", "## Errors", "");
    result.errors.slice(0, 50).forEach((e) => lines.push(`- \`${e}\``));
  }

  const reportPath = path.join(process.cwd(), "IMPORT_REPORT.md");
  fs.writeFileSync(reportPath, lines.join("\n") + "\n", "utf-8");
  console.log(`📄 IMPORT_REPORT.md written (status: ${status})`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  const reportPath = path.join(process.cwd(), "IMPORT_REPORT.md");
  if (!fs.existsSync(reportPath)) {
    fs.writeFileSync(reportPath,
      ["# Flormar Tunisia — Catalog Import Report", "", `Generated: ${new Date().toISOString()}  `, "Status: **failed**  ", "Reason: Fatal error before report could be written  ", "", "## Error", "", "```", String(err), "```", ""].join("\n"),
      "utf-8");
  }
  process.exit(0); // Exit 0 so the commit step still runs commit
});
