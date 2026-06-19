# ClassPilot Agent Guide

## Project Goal

ClassPilot is a Korean-first classroom control tower for teachers. The MVP is a local, single-device demo with a step-by-step start flow, a draggable classroom board, action routes, team scores, and a projector-friendly display screen.

## Current Scope

- Build with Next.js App Router and TypeScript.
- Keep state local to the browser with `localStorage`.
- Do not add server APIs, databases, authentication, QR codes, student join codes, or real-time networking in the 1차 MVP.
- Keep the first user path as `start -> class name -> students -> main`.
- Use `/actions/[actionId]` for action-specific experiences instead of putting every control on one screen.

## Product Principles

- The teacher screen should be big, predictable, and fast to operate during class.
- Keep home, actions, and teams visually distinct; use the floating nav without covering content.
- The display screen should hide teacher-only controls and show only classroom-safe output.
- UI copy should stay Korean-first and concise.
- Prefer clear controls: icon buttons for timer actions, numeric inputs for counts/minutes, one-at-a-time student input, direct team topic inputs, and bars for poll results.

## Code Organization

- `app/page.tsx`: teacher control route.
- `app/actions/[actionId]/page.tsx`: action-specific route.
- `app/display/page.tsx`: projector display route.
- `src/hooks/useClassSession.ts`: localStorage-backed session hook.
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
- Students can be added with Enter and removed from badges.
- Student positions can be changed by drag and persist after reload.
- Team topics can be assigned directly.
- Presentation order includes every team or student once.
- Timer start, pause, and reset behave correctly.
- Random student selection only picks from the current student list.
- Poll votes update the result bars.
- Team score actions update scores and score history.
- Finale shows final rankings, score history, reward, and winner.
- `/display` shows the selected stage without teacher controls.

## Future Boundaries

- 2차 can add student join code, QR access, team progress, help requests, announcements, presentation evaluation, and reports.
- 3차 can add iOS remote control, real-time screen control, push notifications, class templates, class history, and teacher accounts.
