# Frontend UI Components and Design Rules

Every new screen is built out of the primitives that already exist in
`frontend/src/components/ui/` and the layout shell in `frontend/src/components/layout/`.
**Do not hand-roll UI that the catalogue already provides.**

The live catalogue is the internal styleguide page at the route **`/components-ui`**
(`app/pages/UiComponentsPage.tsx`, reachable from the "Desarrollo" group in the sidebar). Open it
before designing a screen: it renders every primitive in its real states. It is also **binding** —
see §6.

The primitives come from **shadcn/ui**, which is not a dependency but a source of code: the
component is copied into the repository and edited. Every copy has been rewritten onto the tokens
in §1, so the library brought no second palette with it.

Companion documents: [architecture](./frontend-architecture.md),
[code style](./frontend-code-style.md), [testing](./frontend-testing.md).

---

## 1. Design tokens

### The single point of configuration

**Re-theming the whole application is editing hexadecimals in one block: the `:root` of
`frontend/src/app/index.css`.** Nothing else. That is the most valuable property this template has,
and it is the first thing anyone using it will want to touch.

It holds together because of two rules, and both are load-bearing:

1. **`frontend/tailwind.config.ts` contains no values.** Every entry there is a `var(--…)` pointing
   back at `index.css` — colours, fonts, radii and shadows alike. Writing a literal in the Tailwind
   config (a hex, a px size, a font stack) silently creates a second place to edit. If you need a
   new token, declare it in `index.css` and map it here.
2. **No component writes a colour.** No hexadecimal, no `rgb()`, no default Tailwind palette class
   (`slate-*`, `zinc-*`, `neutral-*`, `gray-*`, `blue-*`…), no arbitrary colour between brackets
   (`bg-[#123456]`). Only the token classes below.

The check is mechanical, and it is worth running after any batch of UI work: change the five
`--color-primary*` hexadecimals to some obviously different colour, `npm --prefix frontend run
build`, and grep `frontend/dist/` for the old ones. Zero hits means the property still holds; any
hit is a component that went around the tokens.

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
| `--color-overlay` | derived from `--color-ink` | `bg-overlay` | Dialog scrim. Not a colour of its own — a `color-mix` of ink |
| `--color-danger` | `#B23A2E` | `text-danger`, `border-danger` | Destructive only |
| `--color-danger-border` | `#EBD3CF` | `border-danger-border` | Destructive button border |
| `--color-danger-bg` | `#FBEEEC` | `bg-danger-bg` | Destructive button hover |

**Colour policy — this is a hard rule.** Forest green is the only interactive/brand colour. **Red is
reserved for destructive actions**: logout and delete confirmations. It is not an "error/warning"
colour for general UI. The single sanctioned exception is the retry button inside
`ServerErrorState`; do not treat it as a precedent.

There are no blue tokens. If you find yourself reaching for one, you are off-palette.

### shadcn/ui aliases

shadcn/ui components are written against a fixed set of variable names. Rather than maintaining two
palettes in parallel, those names are declared in the **same** `:root` block as pointers to the
tokens above. **They contain no value of their own — never edit them to change a colour, edit the
token they point at.**

| shadcn name | Points at | Tailwind |
|---|---|---|
| `--background` | `--color-bg` | `bg-background` |
| `--foreground` | `--color-ink` | `text-foreground` |
| `--card` / `--card-foreground` | `--color-surface` / `--color-ink` | `bg-card`, `text-card-foreground` |
| `--popover` / `--popover-foreground` | `--color-surface` / `--color-ink` | `bg-popover`, `text-popover-foreground` |
| `--primary-foreground` | `--color-surface` | `text-primary-foreground` |
| `--secondary` / `--secondary-foreground` | `--color-primary-50` / `--color-primary-dark` | `bg-secondary`, `text-secondary-foreground` |
| `--muted-foreground` | `--color-muted` | `text-muted-foreground` |
| `--accent` / `--accent-foreground` | `--color-primary-50` / `--color-primary-dark` | `bg-accent`, `text-accent-foreground` |
| `--destructive` / `--destructive-foreground` | `--color-danger` / `--color-surface` | `text-destructive`, `border-destructive` |
| `--input` | `--color-border` | `border-input` |
| `--ring` | `--color-primary-50` | `ring-ring` |

Three names shadcn expects need **no** alias, because Tailwind already exposes the project tokens
under exactly those names: `primary`, `border`, and the `radius` scale.

One collision is worth knowing about, because it bites: **`--muted` here is a TEXT colour and in
shadcn it is a SURFACE.** That is why there is no `--muted` alias, only `--muted-foreground`. If a
component you copy in uses `bg-muted`, rewrite it to `bg-bg`; **never `bg-muted`**.

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

The radius scale is fixed px, not the `calc()` off a single `--radius` that shadcn assumes. Copied
components get their radius classes rewritten to this scale; `rounded-xl` and friends do not exist
here.

---

## 2. UI primitives — `components/ui/`

Every entry below is a shadcn/ui component with its classes rewritten onto the tokens, except
`Spinner`, `SystemStateCard` and the four state screens, which are the project's own.

### `Button`

```ts
interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children: ReactNode;
  asChild?: boolean;
  isLoading?: boolean;
}
```

- `variant`: `default` (solid green, the default) · `secondary` (soft green fill) · `outline`
  (bordered, light green hover) · `ghost` (no chrome until hover) · `link` (text plus underline) ·
  `destructive` (**ghost** red — text and border only, never a solid red fill).
- `size`: `default` (`px-5 py-3`) · `sm` · `lg` · `icon` (square, for an icon-only button — give it
  an `aria-label`).
- `isLoading` disables the button and replaces its children with `Cargando…`.
- `asChild` renders the single child element with the button styles instead of a `<button>`. Use it
  for a link that must look like a button, and for a `DialogTrigger` / `DialogClose`.
- Native button attributes pass through (`type`, `onClick`, `disabled`, `className`), and the ref is
  forwarded.

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
- It is a composition of `Label` + `InputControl`, not a bare input. **This contract is frozen**:
  `e2e/page-objects/LoginPage.ts` depends on the label and on the derived `id`.

```tsx
<Input
  id="email"
  label="Correo electrónico"
  type="email"
  value={email}
  onChange={(event) => setEmail(event.target.value)}
  error={emailError}
  required
/>
```

### `InputControl` and `Label`

The two pieces `Input` is made of. `InputControl` is the bare, unlabelled `<input>` with the
project's field styling; `Label` is the Radix label with the project typography.

**Do not use `InputControl` directly from a screen** — use `Input`. Reach for `Label` only when you
build a field that `Input` does not cover (a checkbox, a select), and then add that field to
`/components-ui`.

### `Card`

```ts
<Card>            // the surface: rounded-md, token border, bg-card, shadow-card
  <CardHeader>    // padding + vertical rhythm
    <CardTitle>       // an <h3> in font-serif
    <CardDescription> // secondary line
  <CardContent>
  <CardFooter>    // actions row
```

One surface style, no variants — compose with `className` for layout, never to restyle the surface.
The parts are optional: a card that is only `CardContent` is fine.

### `Dialog`

```ts
<Dialog>
  <DialogTrigger asChild><Button>…</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>…</DialogTitle>
      <DialogDescription>…</DialogDescription>
    </DialogHeader>
    …
    <DialogFooter>
      <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Built on Radix, and it replaces the old hand-rolled `Modal`, whose gaps it closes: **the focus is
trapped, `Escape` closes, a pointer down outside closes, and the panel announces `aria-modal`**. It
is uncontrolled by default; pass `open` / `onOpenChange` to `Dialog` when a screen needs to drive it.

Always give it a `DialogTitle` — it is what names the dialog for a screen reader — and a
`DialogDescription` when there is body copy. `DialogContent` renders its own close button, labelled
"Cerrar".

### `Avatar`

```ts
interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  src?: string;
  className?: string;
}
```

Renders the initials from `name` (via `@/utils/get-initials`) in a green circle, with `role="img"`
and `aria-label={name}`. With `src`, shows the picture and falls back to the initials while it loads
or if it fails.

### `Badge`

```ts
interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  children: ReactNode;
}
```

A pill. `default` is the light-green one used for counters in navigation; `secondary`, `outline` and
`destructive` are also available.

### `Spinner`

```ts
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

`role="status"`, accessible name "Cargando". shadcn/ui has no spinner, so this one stays the
project's own. Used as the Suspense fallback in `Layout` and as an inline loading placeholder.

### `SystemStateCard`

The shared shell for the state screens below. **Never import it directly from feature code** — its
own source says so. Use one of the four wrappers.

---

## 3. State screens — always use these

| Component | Use when | Action |
|---|---|---|
| `EmptyState` | A collection genuinely has zero items (empty cart, empty wishlist). Title and description are required — you supply the copy. | `default` button when `actionLabel` + `onAction` given |
| `NoResultsState` | A search or filter returned nothing. Not a 404. | `outline` "Limpiar búsqueda" when `onClearSearch` given |
| `NotFoundState` | A route or resource does not exist. Also reused by `RoleRoute` for a forbidden role. | `outline` "Volver al inicio" when `onGoHome` given |
| `ServerErrorState` | The request failed with a server-side (5xx) error. | `destructive` "Reintentar" when `onRetry` given |

Each has sensible default Spanish copy except `EmptyState`. Never build a bespoke "no data" block.

```tsx
<EmptyState
  title="Tu carrito está vacío"
  description="Todavía no has añadido nada a tu carrito."
  actionLabel="Explorar catálogo"
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
2. **No colour values in components.** No hexadecimal, no `rgb()`, no default Tailwind palette class
   (`slate-*`, `zinc-*`, `neutral-*`, `gray-*`, `blue-*`…), no arbitrary colour between brackets.
   Only the token classes from §1. Non-colour brackets are allowed where the scale has no step for
   the design (`text-[15px]`, `py-[11px]`, the `focus:ring-[3px]` focus ring).
3. **Classes are composed with `cn`, variants are declared with `cva`.** `cn`
   (`src/lib/utils.ts` — `clsx` + `tailwind-merge`) is the only sanctioned way to build a class
   string: it resolves conditionals and makes the caller's `className` win over the component's own
   default, which a template literal cannot do. Variants live in a `cva()` factory next to the
   component and are exported alongside it:

   ```tsx
   export const buttonVariants = cva('inline-flex items-center …', {
     variants: {
       variant: {
         default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
         outline: 'border border-primary-100 bg-surface text-primary hover:bg-primary-50',
       },
     },
     defaultVariants: { variant: 'default' },
   });

   className={cn(buttonVariants({ variant, size }), className)}
   ```

4. **Icons come from `lucide-react`.** Do not hand-write an inline SVG, and do not add a second icon
   library. Size them with `h-* w-*`, give decorative ones `aria-hidden="true"`, and match the
   project's line weight with `strokeWidth={1.5}` for large display icons.
5. **What you may and may not edit in a copied component.** A shadcn/ui component enters the
   repository as *your* code, so it is meant to be edited — but only in two directions: its **class
   strings**, rewritten onto the tokens in §1, and its **copy**, translated to Spanish. Everything
   else (the Radix primitive underneath, the accessibility wiring, the `data-state` hooks) is why
   the component was taken from the library in the first place; changing it means owning the bugs.
   **Introducing a second palette is never allowed**: if a copied component wants a colour the
   project does not have, the answer is to map it onto an existing token, not to add the colour.
6. **Accessibility is part of the component contract**, and the existing components set the bar:
   `role="img"` + `aria-label` on `Avatar`, `role="status"` on `Spinner`, `role="dialog"` +
   `aria-modal` on dialogs, `aria-invalid`/`aria-describedby` on invalid inputs, `role="alert"` on
   form error messages, `aria-hidden` on every decorative icon, and a visible focus ring
   (`focus:ring-[3px] focus:ring-ring`) on every focusable control.
7. **UI copy is in Spanish.** Including anything a copied component brings in English — a `sr-only`
   label, a close button, a loading state.
8. **Layout components may call `useAuth()` directly.** That is the documented cross-cutting
   exception described in [frontend-architecture.md](./frontend-architecture.md) §2. Follow it for a
   new layout component; do not thread `user`/`logout` through props instead.

---

## 6. `/components-ui` is the binding catalogue

**No screen uses a component that is not in `/components-ui`.** The page is not a gallery, it is the
contract: what it shows is what this template knows how to draw, and a screen that reaches outside it
is a screen nobody has reviewed the look of.

When you need a component that is not there:

1. Take it from the shadcn/ui documentation (`npx shadcn@latest add <component>` fetches the source;
   check afterwards that it did not touch `index.css` or `tailwind.config.ts`, and revert those two
   files if it did — **never run `shadcn init`**, it rewrites both with its own token block).
2. Adapt it to the project: rename the file to `PascalCase.tsx`, props with `interface`, classes
   rewritten onto the tokens in §1, copy in Spanish, following rule 5 above.
3. Add it to `/components-ui` **with its real states** — disabled, loading, with an error, empty —
   and to §2 of this document.
4. Write its test.
5. Only then use it in a screen.

Doing it in the other order — using it first, cataloguing it later — is how the catalogue stops being
true, which is the only thing that makes it useful.

### Checklist for a new screen

- [ ] Opened `/components-ui` and reused what already exists.
- [ ] Every component used is in `/components-ui`; anything missing went through the procedure above.
- [ ] Buttons, inputs, cards, avatars, badges, spinners and dialogs come from `components/ui`.
- [ ] Empty / no-results / 404 / server-error states use the four state components.
- [ ] Only token classes; no colour values, no `style` attribute, no new `.css` file.
- [ ] Classes composed with `cn`; variants declared with `cva`.
- [ ] Icons from `lucide-react`, decorative ones `aria-hidden`.
- [ ] Green for interaction, red only for destructive actions.
- [ ] Headings use `font-serif`; everything else inherits `font-sans`.
- [ ] Mobile layout checked below `md`, with bottom padding clearing the tab bar.
- [ ] Every control reachable by role/label, focus ring visible.
- [ ] Copy in Spanish.
