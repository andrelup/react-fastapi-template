export interface FooterProps {
  className?: string;
}

/**
 * Bottom footer. On mobile it is slimmer (44px / 11px) and shows a shortened
 * copyright; the `Layout` hides it entirely on mobile for logged-in users,
 * where the fixed `MobileTabBar` occupies the bottom instead (design system
 * section 10). On desktop it is 50px and shows the full text.
 */
export const Footer = ({ className = '' }: FooterProps) => (
  <footer
    className={`flex h-11 items-center justify-center border-t border-border bg-surface text-[11px] text-muted md:h-[50px] md:text-[13px] ${className}`}
  >
    <p>
      © 2026 BookShelf.
      <span className="hidden md:inline"> Todos los derechos reservados.</span>
    </p>
  </footer>
);
