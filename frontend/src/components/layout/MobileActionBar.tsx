import type { ReactNode } from 'react';

export interface MobileActionBarProps {
  children: ReactNode;
}

/**
 * Reusable fixed action bar for mobile detail/checkout-like screens (e.g.
 * book detail's "Añadir al carrito", cart's "Tramitar pedido"). It sits
 * right above the `MobileTabBar` (`bottom-16` = 64px) so the two fixed bars
 * never overlap — see design system section 10 ("Versión móvil").
 *
 * No consumers yet: this is scaffolding for future Detalle de libro /
 * Carrito pages. Pages that render this bar must add enough
 * `padding-bottom` (~154px: 64px tab bar + 70px action bar + spacing) to
 * their scrollable content so it isn't hidden behind it.
 */
export const MobileActionBar = ({ children }: MobileActionBarProps) => (
  <div className="md:hidden fixed inset-x-0 bottom-16 z-30 flex h-[70px] items-center gap-3 border-t border-border bg-surface px-[18px] shadow-float">
    {children}
  </div>
);
