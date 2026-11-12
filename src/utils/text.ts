/** "MUHAMMAD FIKRI" menjadi "Muhammad Fikri". */
export const toTitleCase = (text: string): string =>
  text
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
