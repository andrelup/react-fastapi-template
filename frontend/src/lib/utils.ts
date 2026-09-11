import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Composes Tailwind class names. `clsx` flattens conditionals and falsy
 * values, `twMerge` drops the classes that a later one overrides, so the
 * `className` a caller passes always wins over the component's own defaults
 * (`cn('px-5', 'px-3')` yields `'px-3'`, not both).
 *
 * This is the single sanctioned way to build a class string in this project.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
