/** Formats a numeric price (in the store's currency) as a localized string. */
export const formatPrice = (price: number, currency = 'EUR', locale = 'en-US'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(price);
