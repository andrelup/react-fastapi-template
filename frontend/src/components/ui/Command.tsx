import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '@/lib/utils';

/**
 * Adapted from shadcn/ui `command` (cmdk). Only the class strings changed:
 * shadcn's `bg-muted` is a SURFACE, but `--color-muted` in this palette is a
 * TEXT colour, so the highlighted/selected item uses `bg-accent
 * text-accent-foreground` instead (the same soft-green pair `Select`'s item
 * uses); borders and separators use the token `border-border` instead of the
 * bare `border`/`bg-muted` shadcn ships; there is no `rounded-xl` or
 * `shadow-md` in this scale, so the surface stays `rounded-md`. `CommandInput`
 * additionally loses its built-in leading search icon and bottom border for
 * this project — `Combobox`, the only consumer, composes its own field
 * instead of nesting cmdk's search-bar look inside a chip row, so those two
 * pieces would never be visible here. `CommandDialog` (a Next.js-flavoured
 * wrapper that opens a `Command` inside a `Dialog`) and `CommandShortcut`,
 * `CommandGroup` and `CommandSeparator` are dropped for the same reason: no
 * screen in this project uses them, and keeping untested dead exports in a
 * shared primitive is worse than re-adding them from the registry the day a
 * consumer actually needs one.
 */
export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Input
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-md bg-transparent py-3 text-sm text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', className)}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm text-muted" {...props} />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;
