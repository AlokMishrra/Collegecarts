/**
 * useSEO — dynamically updates <title>, meta description, og tags per page.
 * Call this at the top of any page component.
 */
export function useSEO({ title, description, url, image, type = "website" } = {}) {
  const siteName = "CollegeCart";
  const defaultDesc = "10-minute grocery & essentials delivery to your hostel room. Student-friendly prices. Live at Shivalik College & Quantum University.";
  const defaultImage = "https://collegecarts.in/og-image.png";
  const baseUrl = "https://collegecarts.in";

  const fullTitle = title ? `${title} | ${siteName}` : `${siteName} – 10-Min Grocery & Essentials Delivery to Your Hostel`;
  const metaDesc = description || defaultDesc;
  const metaUrl = url ? `${baseUrl}${url}` : baseUrl;
  const metaImage = image || defaultImage;

  // Update document title
  document.title = fullTitle;

  // Helper to set/create a meta tag
  const setMeta = (selector, attr, value) => {
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      const [attrName, attrVal] = selector.replace("meta[", "").replace("]", "").split("=");
      el.setAttribute(attrName.trim(), attrVal.replace(/"/g, "").trim());
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  };

  setMeta('meta[name="description"]', "content", metaDesc);
  setMeta('meta[name="title"]', "content", fullTitle);

  setMeta('meta[property="og:title"]', "content", fullTitle);
  setMeta('meta[property="og:description"]', "content", metaDesc);
  setMeta('meta[property="og:url"]', "content", metaUrl);
  setMeta('meta[property="og:image"]', "content", metaImage);
  setMeta('meta[property="og:type"]', "content", type);

  setMeta('meta[name="twitter:title"]', "content", fullTitle);
  setMeta('meta[name="twitter:description"]', "content", metaDesc);
  setMeta('meta[name="twitter:url"]', "content", metaUrl);
  setMeta('meta[name="twitter:image"]', "content", metaImage);

  // Canonical
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", metaUrl);
}
