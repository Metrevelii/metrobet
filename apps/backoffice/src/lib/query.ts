/** Builds `path?…` from non-empty values (filters live in the URL so links are shareable). */
export function withQuery(path: string, params: Record<string, unknown>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    if (value !== '' && !(key === 'page' && value === 1)) query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/** First value of a search param. */
export const param = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** A positive page number from a search param (1 when missing or invalid). */
export function pageParam(value: string | string[] | undefined) {
  const page = Number(param(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}
