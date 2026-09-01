/**
 * Extracts the initials from a full name: the initial of the first word
 * plus the initial of the last word, both uppercased. A single-word name
 * yields a single initial. Tolerant of extra whitespace between words.
 */
export const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return '';
  }

  const firstInitial = words[0].charAt(0).toUpperCase();

  if (words.length === 1) {
    return firstInitial;
  }

  const lastInitial = words[words.length - 1].charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}`;
};
