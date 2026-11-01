/**
 * Poster / cover tints from the Figma bundle. Used as the placeholder colour
 * when a movie or promotion has no image URL, picked deterministically from its
 * id so a given record keeps the same tint across renders and pages.
 */
const POSTER_TINTS = [
  '#f2c9b8',
  '#d9ccf0',
  '#c8d8ea',
  '#ead9b0',
  '#c4e3d2',
  '#f0c4c0',
  '#c6dcec',
  '#cfcfda',
];

export function posterTint(seed: number | string | null | undefined): string {
  if (seed === null || seed === undefined) return POSTER_TINTS[0];
  const numeric =
    typeof seed === 'number'
      ? seed
      : [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return POSTER_TINTS[Math.abs(Math.trunc(numeric)) % POSTER_TINTS.length];
}

/** Avatar colours for comment authors. */
const AVATAR_TINTS = ['#2f7fd6', '#d9481c', '#d4507f', '#1f9d5c', '#c99a2e', '#5b4a80'];

export function avatarTint(seed: number | string | null | undefined): string {
  if (seed === null || seed === undefined) return AVATAR_TINTS[0];
  const numeric =
    typeof seed === 'number' ? seed : [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TINTS[Math.abs(Math.trunc(numeric)) % AVATAR_TINTS.length];
}
