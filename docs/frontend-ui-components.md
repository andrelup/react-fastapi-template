# Frontend UI Components and Design Rules

Every new screen is built out of the primitives that already exist in
`frontend/src/components/ui/` and the layout shell in `frontend/src/components/layout/`.
**Do not hand-roll UI that the catalogue already provides.**

The live catalogue is the internal styleguide page at the route **`/componentes-ui`**
(`app/pages/UiComponentsPage.tsx`, reachable from the "Desarrollo" group in the sidebar). Open it
before designing a screen: it renders every primitive in its real states.

Companion documents: [architecture](./frontend-architecture.md),
[code style](./frontend-code-style.md), [testing](./frontend-testing.md).

---

## 1. Design tokens

All tokens are declared as CSS custom properties in `frontend/src/app/index.css` and exposed as
Tailwind classes in `frontend/tailwind.config.ts`. **Use the Tailwind token classes. Never write a
hex value in a component**, so a future re-theme only touches `index.css`.

### Colour

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `--color-primary` | `#2C6E49` | `bg-primary`, `text-primary` | Brand, buttons, links, active state |
| `--color-primary-hover` | `#245C3D` | `bg-primary-hover` | Primary button hover |
| `--color-primary-dark` | `#1B4332` | `text-primary-dark` | Text/accents on tinted surfaces, figures |
| `--color-primary-100` | `#CFE3D6` | `border-primary-100` | Soft borders, cover placeholders |
| `--color-primary-50` | `#EAF2EC` | `bg-primary-50` | Active backgrounds, badges, focus rings |
| `--color-ink` | `#1B211D` | `text-ink` | Main text, headings |
| `--color-body` | `#4A544D` | `text-body` | Secondary text |
| `--color-muted` | `#8A938C` | `text-muted` | Metadata, placeholders, footer |
| `--color-border` | `#E4E8E4` | `border-border` | Borders and separators |
| `--color-bg` | `#F6F7F4` | `bg-bg` | Content area background |
| `--color-surface` | `#FFFFFF` | `bg-surface` | Cards, navbar, sidebar, inputs |
| `--color-danger` | `#B23A2E` | `text-danger`, `border-danger` | Destructive only |
| `--color-danger-border` | `#EBD3CF` | `border-danger-border` | Destructive button border |
| `--color-danger-bg` | `#FBEEEC` | `bg-danger-bg` | Destructive button hover |

**Colour policy — this is a hard rule.** Forest green is the only interactive/brand colour. **Red is
reserved for destructive actions**: logout and delete confirmations. It is not an "error/warning"
colour for general UI. The single sanctioned exception is the retry button inside
`ServerErrorState`; do not treat it as a precedent.

There are no blue tokens. If you find yourself reaching for one, you are off-palette.

### Typography

Two families, loaded from Google Fonts in `frontend/index.html`:

| Token | Stack | Tailwind | Use |
|---|---|---|---|
| `--font-serif` | Lora, Georgia, serif | `font-serif` | Wordmark, headings, highlighted figures |
| `--font-sans` | Public Sans, system-ui, sans-serif | `font-sans` | Body copy, forms, all UI chrome |

`body` already defaults to `font-sans` and `text-ink`, so plain text needs no class. **Headings must
opt into `font-serif` explicitly.**

### Radii and shadows

| Token | Value | Tailwind |
|---|---|---|
| `--radius-sm` | 4px | `rounded-sm` |
| `--radius` | 9px | `rounded` |
| `--radius-md` | 12px | `rounded-md` |
| `--radius-lg` | 14px | `rounded-lg` |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,.05)` | `shadow-card` |
| `--shadow-float` | `0 8px 30px rgba(20,52,42,.08)` | `shadow-float` |

---

## 2. UI primitives — `components/ui/`

### `Button`

```ts
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}
```

- `primary` (default): solid green. `secondary`: outlined, light green hover. `danger`: **ghost**
  red — text and border only, never a solid red fill.
- One size only (`px-5 py-3`). There is no `size` prop; do not add one ad hoc.
- `isLoading` disables the button and replaces its children with a loading label.
- Native button attributes pass through (`type`, `onClick`, `disabled`, `className`).

```tsx
<Button type="submit" isLoading={isLoading} className="w-full">
  Entrar
</Button>
```

### `Input`

```ts
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}
```

- The `label` is mandatory and always rendered — this is what keeps the forms testable by
  `getByLabelText` and accessible. The `id` is derived from the label when not supplied.
- `type="password"` automatically gets a show/hide toggle with proper `aria-label` /`aria-pressed`.
- `error` switches the border to `border-danger` and renders a message wired through `aria-invalid`
  and `aria-describedby`.

```tsx
<Input
  id="email"
  label="Correo electronico"
  type="email"
  value={email}
  onChange={(event) => setEmail(event.target.value)}
  error={emailError}
  required
/>
```

### `Card`

```ts
interface CardProps {
  children: ReactNode;
  className?: string;
}
```

A single surface style: `rounded-md border border-border bg-surface p-5 shadow-card`. No variants —
compose with `className` for layout, not for restyling the surface.

### `Avatar`

```ts
interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

Renders the initials from `name` (via `@/utils/get-initials`) in a green circle, with
`role="img"` and `aria-label={name}`.

### `Badge`

```ts
interface BadgeProps {
  children: ReactNode;
  className?: string;
}
```

A light-green pill. Used for counters in navigation and status labels.

### `Spinner`

```ts
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}
```

`role="status"`. Used as the Suspense fallback in `Layout` and as an inline loading placeholder.

### `Modal`

```ts
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}
```

Unmounts entirely when closed. `role="dialog"`, `aria-modal`, `aria-labelledby`.

Known gap: it has **no focus trap, no Escape handler and no click-outside-to-close**. If you build
the first real feature dialog, fix the component rather than working around it in your screen.

### `SystemStateCard`

The shared shell for the state screens below. **Never import it directly from feature code** — its
own source says so. Use one of the four wrappers.

---

## 3. State screens — always use these

| Component | Use when | Action |
|---|---|---|
| `EmptyState` | A collection genuinely has zero items (empty cart, empty wishlist). Title and description are required — you supply the copy. | Primary button when `actionLabel` + `onAction` given |
| `NoResultsState` | A search or filter returned nothing. Not a 404. | Secondary "Limpiar busqueda" when `onClearSearch` given |
| `NotFoundState` | A route or resource does not exist. Also reused by `RoleRoute` for a forbidden role. | Secondary "Volver al inicio" when `onGoHome` given |
| `ServerErrorState` | The request failed with a server-side (5xx) error. | "Reintentar" when `onRetry` given |

Each has sensible default Spanish copy except `EmptyState`. Never build a bespoke "no data" block.

```tsx
<EmptyState
  title="Tu carrito esta vacio"
  description="Todavia no has anadido ningun libro a tu carrito."
  actionLabel="Explorar catalogo"
  onAction={goToCatalog}
/>
<NoResultsState onClearSearch={clearSearch} />
```

---

## 4. The layout shell — `components/layout/`

You normally do **not** touch these; you render inside them.

| Component | Responsibility |
|---|---|
| `Layout` | Root route element. Composes Header, Sidebar (desktop, authenticated), `PageContainer` with the Suspense boundary, Footer and `MobileTabBar`. Decides the authenticated vs. anonymous shell from the token. |
| `Header` | Fixed top bar: wordmark, desktop search, role-specific action (seller "+ Vender libro", customer cart). |
| `Sidebar` | Desktop navigation, 248px, grouped links, profile block, logout pinned at the bottom. Hidden below `md`. |
| `PageContainer` | The `<main>` wrapper: max width, padding, and the bottom padding that clears the mobile tab bar. |
| `Footer` | Slim legal bar. Hidden on mobile when authenticated. |
| `MobileTabBar` | Mobile-only bottom navigation, role-aware (seller: Inicio + FAB + Cuenta; customer: Inicio, Carrito, Cuenta). Hidden from `md` up. |
| `MobileAccountDrawer` | Mobile-only slide-over account menu opened from the tab bar. |
| `MobileActionBar` | Mobile-only sticky action bar that stacks above the tab bar. Scaffolding for detail/cart screens; no consumers yet. |

### Responsive rules

Mobile-first Tailwind; **`md:` (768px) means desktop**.

- Desktop-only: `Sidebar`, the header search, the header role actions, the footer text tail.
- Mobile-only: `MobileTabBar`, `MobileAccountDrawer`, `MobileActionBar`.
- `PageContainer` already reserves 84px of bottom padding on mobile for the tab bar. If your screen
  also uses `MobileActionBar`, reserve roughly 154px instead.

### Placeholders for unbuilt routes

Navigation entries whose route does not exist yet are rendered as **visual-only** items
(`InactiveNavItem` in `Sidebar`, `DrawerItem` in `MobileAccountDrawer`), never as links that would
404. Follow that convention, and convert the item into a real `NavLink` in the same PR that adds
the route.

---

## 5. Styling rules

1. **Tailwind classes only.** The only stylesheet is `app/index.css`. No CSS modules, no
   styled-components, no `style={{ ... }}`.
2. **No `hex` values in components.** Use the token classes from §1.
3. **Variants are composed with a lookup record plus a template literal**, the pattern every
   primitive already uses. There is no `cn`/`clsx` helper and **no new dependency should be added**
   for it:

   ```tsx
   const variantClasses: Record<Variant, string> = {
     primary: 'bg-primary text-white hover:bg-primary-hover',
     secondary: 'border border-primary-100 bg-surface text-primary hover:bg-primary-50',
   };

   const className = `${baseClasses} ${variantClasses[variant]}`;
   ```

4. **No icon library.** Every icon is a small local inline SVG component declared at the top of the
   file that uses it: 24×24 viewBox, stroke width 1.5–2, round caps and joins, `aria-hidden="true"`.
   Keep it that way; do not add `lucide-react`, `react-icons` or similar.
5. **Accessibility is part of the component contract**, and the existing components set the bar:
   `role="img"` + `aria-label` on `Avatar`, `role="status"` on `Spinner`, `role="dialog"` +
   `aria-modal` on dialogs, `aria-invalid`/`aria-describedby` on invalid inputs, `role="alert"` on
   form error messages, `aria-hidden` on every decorative icon, and a visible focus ring
   (`focus:ring-[3px] focus:ring-primary-50`) on every focusable control.
6. **UI copy is in Spanish.** (`Button`'s loading text and `Modal`'s close `aria-label` are still in
   English — fix them when you touch those files rather than copying the pattern.)
7. **Layout components may call `useAuth()` directly.** That is the documented cross-cutting
   exception described in [frontend-architecture.md](./frontend-architecture.md) §2. Follow it for a
   new layout component; do not thread `user`/`logout` through props instead.

---

## 6. Checklist for a new screen

- [ ] Opened `/componentes-ui` and reused what already exists.
- [ ] Buttons, inputs, cards, avatars, badges, spinners and dialogs come from `components/ui`.
- [ ] Empty / no-results / 404 / server-error states use the four state components.
- [ ] Only token classes; no hex values, no `style` attribute, no new `.css` file.
- [ ] Green for interaction, red only for destructive actions.
- [ ] Headings use `font-serif`; everything else inherits `font-sans`.
- [ ] Mobile layout checked below `md`, with bottom padding clearing the tab bar.
- [ ] Every control reachable by role/label, decorative icons `aria-hidden`, focus ring visible.
- [ ] Copy in Spanish.
