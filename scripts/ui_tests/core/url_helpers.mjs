/**
 * Resolve a route path relative to a base workbench URL.
 * Strips the last pathname segment from baseUrl and appends routePath.
 *
 * resolveRoute("http://host/xpedit/workbench", "/wizard") → "http://host/xpedit/wizard"
 * resolveRoute("http://host/workbench", "/wizard")        → "http://host/wizard"
 */
export function resolveRoute(baseUrl, routePath) {
  const u = new URL(String(baseUrl));
  const prefix = u.pathname.replace(/\/[^/]*$/, '');
  u.pathname = prefix + routePath;
  u.search = '';
  return u.toString();
}
