/** Paragraphs are separated by blank lines, list items (terms) by single newlines. */
export const paragraphs = (text: string) => split(text, /\n{2,}/);
export const lines = (text: string) => split(text, /\n/);

function split(text: string, separator: RegExp) {
  return text
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}
