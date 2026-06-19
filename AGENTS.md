# ClassPilot Agent Guide

## Project Goal

ClassPilot is a Korean-first classroom control tower for teachers. The MVP is a local, single-device demo: teachers operate the session from the main screen and can open a projector-friendly display screen.

## Current Scope

- Build with Next.js App Router and TypeScript.
- Keep state local to the browser with `localStorage`.
- Do not add server APIs, databases, authentication, QR codes, student join codes, or real-time networking in the 1차 MVP.
- Keep the app usable as the first screen. Do not add a marketing landing page.

## Product Principles

- The teacher screen should be dense, predictable, and fast to operate during class.
- The display screen should hide teacher-only controls and show only classroom-safe output.
- UI copy should stay Korean-first and concise.
- Prefer clear controls: icon buttons for timer actions, numeric inputs for counts/minutes, text areas for lists, and bars for poll results.

## Code Organization

- `app/page.tsx`: teacher control route.
- `app/display/page.tsx`: projector display route.
- `src/components`: React UI components.
- `src/lib/classpilot.ts`: pure session utilities and local constants.
- `src/types/classpilot.ts`: shared domain types.
- `src/lib/*.test.ts`: unit tests for pure utilities.

## Testing Standard

Before handing off a change, run:

```bash
npm run test
npm run typecheck
npm run build
```

For UI changes, manually verify:

- 20 students can be split into 4 balanced teams.
- 4 topics can be assigned to teams without duplicates.
- Presentation order includes every team once.
- Timer start, pause, and reset behave correctly.
- Random student selection only picks from the current student list.
- Poll votes update the result bars.
- `/display` shows the selected stage without teacher controls.

## Future Boundaries

- 2차 can add student join code, QR access, team progress, help requests, announcements, presentation evaluation, and reports.
- 3차 can add iOS remote control, real-time screen control, push notifications, class templates, class history, and teacher accounts.
