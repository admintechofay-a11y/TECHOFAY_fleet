# UI-Only Redesign Prompt — TECHOFAY Fleet

## Project
- Live application: https://techofay-fleet.vercel.app/
- Repository: https://github.com/admintechofay-a11y/TECHOFAY_fleet
- Reference: the transport analytics dashboard image supplied by the user.

## Objective
Restyle the existing application so its visual language closely matches the supplied reference image. This is a **UI/theme-only task**. Preserve the existing application in terms of functionality, pages, fields, forms, validation, data, API behavior, routing, permissions, and workflows.

The repository currently has a React 19 + TypeScript + Vite frontend under `apps/web` and a modular API under `apps/api`. Inspect the real project before editing; do not assume another stack.

## Non-negotiable constraints
1. Do not remove, rename, reorder, add, or change any existing form field, input name, label, placeholder, default value, option, required flag, validation, conditional field, or submit behavior.
2. Do not change form schemas, TypeScript interfaces, API payloads/responses, database models/schemas, endpoints, HTTP methods, authentication, authorization, RBAC, tenant logic, state/data fetching, error handling, data transformations, calculations, or business rules.
3. Do not remove, rename, combine, or change existing routes, pages, navigation destinations, permissions, tabs, actions, buttons, menus, table columns, row actions, modals, or workflows.
4. Never replace live data with mock/static data. Do not add fake KPI numbers, chart data, vehicles, loads, maps, alerts, or records.
5. Preserve all existing loading, empty, error, success, disabled, hover, focus, permission, and responsive states.
6. Avoid broad refactors and logic changes. Prefer styling through existing CSS variables, theme tokens, style-only files, and carefully scoped CSS selectors.
7. Do not install a new UI framework or replace current chart, map, or component libraries. Do not change dependencies unless strictly necessary for styling; default to no dependency changes.
8. Do not rewrite entire pages/components for visual preference. Preserve hooks, props, handlers, state, conditional rendering, event wiring, and data bindings.
9. Do not claim the site was deployed or that tests passed unless the deployment/tests actually happened.
10. If a design improvement requires a logic, data-flow, or field-structure change, do not make it. Use a visual-only alternative.

## Target visual design
Create a polished, clean, light-mode transport operations dashboard inspired by the reference:
- App canvas: very light cool grey or pale blue-grey.
- Main surfaces: white/off-white cards with fine borders and restrained, soft shadows.
- Sidebar: pale blue-grey, dark slate text, subtle separators, clear active navigation highlight.
- Typography: modern sans-serif with clear hierarchy. Preserve all existing wording; only style text through weight, size, color, and spacing.
- Cards: moderate rounded corners, consistent spacing, subtle borders/shadows. Avoid heavy dark backgrounds, excessive glassmorphism, neon, and oversized gradients.
- Accent colors: professional blue for primary actions, restrained green/amber/red/cyan for statuses and KPI accents; ensure readable contrast.
- KPI cards: keep the exact existing metrics and values; style icons/accent areas and number hierarchy only.
- Charts: keep existing chart types, values, axes, legends, tooltips, filters, and interactions. Change only presentation, including colors, gridlines, typography, legend spacing, and panel style.
- Maps/tracking: preserve provider, markers, routes, location data, controls, and interactions; style the surrounding panel only.
- Tables: readable header row, light separators, subtle row hover, balanced density, clear status badges. Preserve every column, filter, sorting behavior, pagination, selection, and row action.
- Forms: preserve the exact field count, order, labels, names, options, defaults, conditional fields, validation, and submit flow. Style inputs, selects, textareas, labels, helper/error text, focus rings, buttons, and spacing only. Never hide, merge, or remove fields.
- Buttons: consistent primary/secondary/danger/disabled styling without changing labels, click handlers, or behavior.
- Modals, drawers, and dropdowns: light surfaces, clear borders, soft shadow and readable content; preserve interactions and avoid risky structural/layout changes.
- Login/register pages: use the same light design while preserving all existing auth flows.
- Responsive behavior: all current viewports must keep working, with no clipped content, horizontal overflow, or unusable controls.

## Safe theme-token direction
Start with `apps/web/src/index.css` and existing theme variables. Keep token names that are already referenced by components; change values rather than renaming variables. Use this palette as guidance, not as a reason to change behavior:

```css
:root {
  --bg-app: #f3f6fa;
  --bg-sidebar: #eaf0f7;
  --bg-surface: #ffffff;
  --bg-surface-elevated: #ffffff;
  --bg-surface-hover: #f5f8fc;
  --border-subtle: #e2e8f0;
  --border-medium: #cbd5e1;
  --text-primary: #172033;
  --text-secondary: #526176;
  --text-muted: #77859a;
  --accent-cyan: #2563eb;
  --accent-cyan-hover: #1d4ed8;
  --accent-cyan-subtle: #e8f0ff;
  --status-success: #16a36a;
  --status-warning: #d97706;
  --status-error: #dc2626;
  --status-info: #2563eb;
}
```

Use soft, low-opacity neutral shadows instead of heavy black shadows. Preserve existing token names for compatibility, even if the old names no longer match their new colors. Audit hardcoded inline colors in components and make the smallest possible presentation-only changes where CSS variables alone are insufficient.

## Required workflow

### Step 1 — Audit before editing
Inspect `apps/web/src/index.css`, `apps/web/src/App.tsx`, `apps/web/src/components/Sidebar.tsx`, `apps/web/src/components/Navbar.tsx`, the dashboard, and all current page/component styles. Search for hardcoded dark-theme colors and inline style objects. Record:
- All existing routes, pages, and shared components.
- All current form controls, their names, labels, and order.
- Logic-bearing files that should not be touched.
- Existing build/test commands and the baseline result.

Do not start the redesign until this audit is complete.

### Step 2 — Implement styling only
Prioritize global CSS variables and style-only files. Update background, surface, border, text, accent, shadow, radius, and focus styles consistently. If inline styles prevent styling through CSS, change only presentation properties. Do not change component structure, form fields, labels, data bindings, props, event handlers, hooks, state, or conditions. Keep existing functionality intact on every page, not just the dashboard.

### Step 3 — Compare against the reference
The result should share the reference's design language: cool light-grey canvas, white cards, restrained colorful KPI accents, clean navigation, thin separators, rounded panels, balanced whitespace, and data-forward analytics. The screenshot is a styling reference only. Do not copy its labels, sample data, metrics, charts, fields, or layout modules into the product unless they already exist.

### Step 4 — Regression checks
Verify:
- All existing routes open and navigation remains unchanged.
- Login, registration, logout, session handling, and permission-restricted navigation still work.
- Every form retains exactly the same fields, order, options, defaults, conditional visibility, validation, and submission behavior.
- Existing create/read/update/delete behavior still works wherever present.
- Search, filters, sort, pagination, import/export, PDF, WhatsApp, maps, charts, uploads/downloads, and modal actions still work.
- No mock data has been introduced and API endpoints/payloads have not changed.
- Text contrast and keyboard focus remain visible.
- Desktop, tablet, and mobile layouts work without overflow.
- There are no new console, TypeScript, or runtime errors.

Run the existing frontend build and available tests. Fix only regressions caused by your visual changes. Report commands and actual results honestly.

### Step 5 — Final report
Provide:
1. Files changed and the exact styling-only changes made.
2. Confirmation that form fields, routes, API, backend, schemas, validation, permissions, and business logic were unchanged—or clearly disclose any deviation.
3. Build/test commands and their actual results.
4. Remaining visual inconsistencies or risks.
5. A concise comparison to the reference image.

## Stop condition
If a visual change conflicts with these constraints, preserve the application and explain the trade-off. Never silently change functionality.

**Priority order:** functional parity and existing fields > backend/data flow > existing page content and actions > visual redesign.

Start with Step 1 and keep the scope strictly limited to visual styling.
