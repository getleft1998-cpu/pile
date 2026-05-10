/**
 * Flormar.tn Browser Scraper
 *
 * Paste this entire script into the browser console while on https://flormar.tn
 * It will scrape all categories, products, variants, and images, then send
 * them to the admin import endpoint.
 *
 * USAGE:
 *   1. Open https://flormar.tn in your browser
 *   2. Open DevTools (F12) → Console
 *   3. Paste this entire script and press Enter
 *   4. Wait for "DONE" message (may take 5-15 minutes)
 */

(async () => {
  const ENDPOINT = "https://pile-theta.vercel.app/api/admin/import-catalog?token=flormar2024";
  const ADMIN_PASSWORD = "flormar2024";

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function parsePrice(raw) {
    if (raw == null) return null;
    const m = String(raw).replace(/\s/g, "").match(/[\d.,]+/);
    return m ? parseFloat(m[0].replace(",", ".")) : null;
  }

  // Upgrade converty CDN images to _lg size
  function upgradeToCdnLg(url) {
    if (!url) return url;
    return url.replace(/_(sm|md|xs|thumb)\.(webp|jpg|png|jpeg)$/i, "_lg.$2");
  }

  // Collect all image URLs from a JS object
  function collectImages(obj, out = new Set()) {
    if (!obj || typeof obj !== "object") return out;
    if (Array.isArray(obj)) { obj.forEach((v) => collectImages(v, out)); return out; }
    for (const [, v] of Object.entries(obj)) {
      if (typeof v === "string" && v.startsWith("http") && /\.(jpe?g|png|webp|avif)/i.test(v)) {
        if (!/logo|placeholder|pixel|sprite|favicon/i.test(v)) out.add(upgradeToCdnLg(v));
      } else if (v && typeof v === "object") {
        collectImages(v, out);
      }
    }
    return out;
  }

  // ── Intercept Fetch to capture API responses ──────────────────────────────────

  const capturedData = [];
  const _originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _originalFetch(...args);
    try {
      const clone = response.clone();
      const ct = response.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        clone.json().then((data) => capturedData.push({ url: typeof args[0] === "string" ? args[0] : args[0].url, data })).catch(() => {});
      }
    } catch {}
    return response;
  };

  // ── Navigate to a URL and wait for content ────────────────────────────────────

  async function navigate(url) {
    return new Promise((resolve) => {
      const start = capturedData.length;
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
      // Wait for Vue/React router to load content
      setTimeout(() => {
        const newData = capturedData.slice(start);
        resolve(newData);
      }, 3000);
    });
  }

  // ── Get categories from the nav ───────────────────────────────────────────────

  async function getCategories() {
    // Reload homepage to get nav
    const data = await navigate("/");
    await sleep(2000);

    // Try to find categories from captured API data
    const categories = [];
    const catSeen = new Set();

    for (const { data: d } of capturedData) {
      const tryExtract = (node) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) { node.forEach(tryExtract); return; }
        const name = node.name || node.title || node.label;
        const slug = node.slug || node.handle || node.id;
        if (name && slug && typeof name === "string" && typeof slug === "string") {
          if (!catSeen.has(slug) && name.length > 1 && name.length < 60) {
            // Check if it looks like a category
            if (node.products !== undefined || node.type === "category" || node.parent_id !== undefined || node.children !== undefined) {
              catSeen.add(slug);
              categories.push({ name, slug, url: `/${slug}` });
            }
          }
        }
        Object.values(node).forEach((v) => { if (v && typeof v === "object") tryExtract(v); });
      };
      tryExtract(d);
    }

    // DOM fallback: get from nav links
    if (categories.length === 0) {
      const navAnchors = document.querySelectorAll("nav a, .main-menu a, header a, [class*='menu'] a, [class*='category'] a");
      navAnchors.forEach((el) => {
        const href = el.getAttribute("href") ?? "";
        const text = el.textContent?.trim() ?? "";
        if (!href || !text || text.length < 2 || text.length > 60) return;
        if (/cart|account|wishlist|contact|about|blog|search/i.test(href)) return;
        const slug = href.split("/").filter(Boolean).pop() ?? slugify(text);
        if (catSeen.has(slug)) return;
        catSeen.add(slug);
        categories.push({ name: text, slug, url: href.startsWith("http") ? href : `https://flormar.tn${href}` });
      });
    }

    return categories;
  }

  // ── Parse a product from API data ─────────────────────────────────────────────

  function parseProduct(raw, catSlug) {
    const name = raw.name || raw.title || raw.product_name;
    if (!name || typeof name !== "string" || name.length < 2) return null;

    const slug = raw.slug || raw.handle || slugify(name);
    const price = parsePrice(raw.price ?? raw.regular_price ?? raw.original_price);
    const salePrice = parsePrice(raw.sale_price ?? raw.promo_price ?? raw.discounted_price);
    const description = (raw.description || raw.short_description || raw.body_html || "")
      .replace(/<[^>]+>/g, "")
      .trim()
      .slice(0, 500);

    const imgSet = collectImages(raw);
    const images = [...imgSet].slice(0, 5);

    const rawVariants = raw.variants || raw.options || raw.shades || raw.colors || raw.attributes || [];
    const variants = [];
    for (const v of rawVariants) {
      if (!v || typeof v !== "object") continue;
      const shadeName = v.name || v.shade_name || v.title || v.value || v.label;
      if (!shadeName || typeof shadeName !== "string" || shadeName.length > 100) continue;
      const colorHex = v.color || v.color_hex || v.hex || null;
      const swatchSet = collectImages(v);
      const swatchImg = [...swatchSet][0] ?? null;
      const sku = v.sku || v.barcode || (v.id != null ? String(v.id) : null);
      variants.push({ shade_name: shadeName, color_hex: colorHex, swatch_image_url: swatchImg, sku });
    }
    if (variants.length === 0) {
      variants.push({ shade_name: "Standard", color_hex: null, swatch_image_url: null, sku: raw.id != null ? String(raw.id) : null });
    }

    return { name, slug, category_slug: catSlug, description: description || null, price, sale_price: salePrice, source_url: `https://flormar.tn/product/${slug}`, images, variants };
  }

  // ── Extract products from all captured API data ────────────────────────────────

  function extractFromCaptured(catSlug) {
    const products = [];
    const seen = new Set();
    const tryList = (list, cs) => {
      for (const item of list) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const p = parseProduct(item, cs);
        if (p && !seen.has(p.slug)) { seen.add(p.slug); products.push(p); }
      }
    };
    const walk = (node, cs) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { tryList(node, cs); node.forEach((v) => walk(v, cs)); return; }
      if (Array.isArray(node.data)) tryList(node.data, cs);
      if (Array.isArray(node.products)) tryList(node.products, cs);
      if (Array.isArray(node.items)) tryList(node.items, cs);
      if (Array.isArray(node.results)) tryList(node.results, cs);
      Object.values(node).forEach((v) => { if (v && typeof v === "object") walk(v, cs); });
    };
    for (const { data } of capturedData) walk(data, catSlug);
    return products;
  }

  // ── Scrape category page by DOM ────────────────────────────────────────────────

  async function scrapeCategoryDom(catSlug) {
    const productLinks = [];
    document.querySelectorAll("a[href]").forEach((el) => {
      const href = el.getAttribute("href") ?? "";
      if (href.includes("/product/") || href.includes("/products/") || href.includes("/p/")) {
        productLinks.push(href.startsWith("http") ? href : `https://flormar.tn${href}`);
      }
    });
    return [...new Set(productLinks)];
  }

  // ── Scrape a single product page by DOM ───────────────────────────────────────

  async function scrapeProductDom(url, catSlug) {
    capturedData.length = 0;
    await navigate(url.replace("https://flormar.tn", ""));
    await sleep(2500);

    // Check captured API data first
    const apiProducts = extractFromCaptured(catSlug);
    if (apiProducts.length > 0) return apiProducts[0];

    // DOM fallback
    const h1 = document.querySelector("h1")?.textContent?.trim();
    if (!h1) return null;

    const priceEls = [...document.querySelectorAll("[class*='price']")].map((e) => e.textContent?.trim()).filter(Boolean);
    const imgEls = [...document.querySelectorAll("img")].filter((img) => img.src && img.src.includes("converty") && !/logo|placeholder|pixel/i.test(img.src));
    const images = [...new Set(imgEls.map((img) => upgradeToCdnLg(img.src)))].slice(0, 5);

    const swatchEls = [...document.querySelectorAll("[class*='swatch'], [class*='shade'], [class*='variant'], [class*='option'], [data-shade], [data-variant]")];
    const variants = swatchEls
      .map((el) => ({
        shade_name: el.getAttribute("title") || el.getAttribute("aria-label") || el.getAttribute("data-name") || el.textContent?.trim(),
        color_hex: el.style?.backgroundColor || el.getAttribute("data-color") || null,
        swatch_image_url: el.querySelector("img")?.src ? upgradeToCdnLg(el.querySelector("img").src) : null,
        sku: el.getAttribute("data-sku") || el.getAttribute("data-id") || null,
      }))
      .filter((v) => v.shade_name && v.shade_name.length < 100);

    if (variants.length === 0) variants.push({ shade_name: "Standard", color_hex: null, swatch_image_url: null, sku: null });

    const price = priceEls.length ? parsePrice(priceEls[priceEls.length - 1]) : null;
    const desc = document.querySelector(".product-description, .description, [class*='description']")?.textContent?.trim()?.slice(0, 500) || null;

    return {
      name: h1,
      slug: slugify(h1),
      category_slug: catSlug,
      description: desc,
      price,
      sale_price: priceEls.length > 1 ? parsePrice(priceEls[0]) : null,
      source_url: url,
      images,
      variants,
    };
  }

  // ── Main ──────────────────────────────────────────────────────────────────────

  console.log("🌸 Flormar.tn Scraper starting...");

  // Reload homepage to capture initial API calls
  capturedData.length = 0;
  await navigate("/");
  await sleep(4000);

  console.log(`Captured ${capturedData.length} API responses from homepage`);

  // Get categories
  const categories = await getCategories();
  console.log(`Found ${categories.length} categories:`, categories.map((c) => c.name).join(", "));

  const allProducts = new Map();
  const slugsSeen = new Set();

  const addProduct = (p) => {
    if (!p || slugsSeen.has(p.slug)) return;
    slugsSeen.add(p.slug);
    allProducts.set(p.slug, p);
  };

  // Extract products from homepage API data
  const homeProducts = extractFromCaptured("home");
  homeProducts.forEach(addProduct);
  console.log(`Got ${homeProducts.length} products from homepage`);

  // Navigate each category
  for (const cat of categories) {
    console.log(`\nCategory: ${cat.name}`);
    capturedData.length = 0;
    await navigate(cat.url.replace("https://flormar.tn", "") || `/${cat.slug}`);
    await sleep(3500);

    const fromApi = extractFromCaptured(cat.slug);
    fromApi.forEach((p) => { p.category_slug = cat.slug; addProduct(p); });
    console.log(`  ${fromApi.length} from API`);

    if (fromApi.length === 0) {
      // DOM fallback: get product links and scrape each
      const links = await scrapeCategoryDom(cat.slug);
      console.log(`  ${links.length} product links found in DOM`);
      for (const link of links.slice(0, 50)) {
        const slug = link.split("/").filter(Boolean).pop() ?? "";
        if (slugsSeen.has(slugify(slug))) continue;
        const p = await scrapeProductDom(link, cat.slug);
        if (p) { addProduct(p); console.log(`  ✓ ${p.name}`); }
        await sleep(500);
      }
    }
  }

  const products = [...allProducts.values()];
  console.log(`\nTotal products scraped: ${products.length}`);

  if (products.length === 0) {
    console.error("❌ No products found. Check if the site has loaded properly.");
    return;
  }

  // Send to import endpoint in batches of 20
  console.log(`\nSending to ${ENDPOINT}...`);
  const BATCH = 20;
  let totalInserted = 0;

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    try {
      const res = await _originalFetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": ADMIN_PASSWORD,
        },
        body: JSON.stringify({ products: batch, categories, overwrite: true }),
      });
      const result = await res.json();
      console.log(`Batch ${Math.floor(i / BATCH) + 1}: inserted ${result.productsInserted}, variants ${result.variantsInserted}, images ${result.imagesInserted}`);
      if (result.errors?.length) console.warn("  Errors:", result.errors);
      totalInserted += result.productsInserted ?? 0;
    } catch (err) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} failed:`, err);
    }
    await sleep(1000);
  }

  console.log(`\n✅ DONE — ${totalInserted} products imported to pile-theta.vercel.app`);

  // Restore original fetch
  window.fetch = _originalFetch;
})();
