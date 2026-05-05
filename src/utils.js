/**
 * utils.js — replaces Base44's virtual @/utils module
 * createPageUrl converts a page name to a URL path
 */

export function createPageUrl(pageName) {
  if (!pageName) return '/';
  return `/${pageName}`;
}
