const clean = (isbn: string): string => isbn.replace(/[-\s]/g, '');

const isValidIsbn10 = (isbn: string): boolean => {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += (i + 1) * Number(isbn[i]);
  }
  const lastChar = isbn[9];
  const checksum = lastChar === 'X' ? 10 : Number(lastChar);
  sum += 10 * checksum;
  return sum % 11 === 0;
};

const isValidIsbn13 = (isbn: string): boolean => {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
};

/** Validates an ISBN-10 or ISBN-13 string (accepts dashes and spaces). */
export const validateIsbn = (isbn: string): boolean => {
  const cleaned = clean(isbn).toUpperCase();
  return isValidIsbn10(cleaned) || isValidIsbn13(cleaned);
};
