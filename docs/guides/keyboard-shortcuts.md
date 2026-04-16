# Keyboard Shortcuts

Global keyboard shortcuts handled by `KeyboardService` (`src/app/core/keyboard/keyboard.service.ts`).

| Shortcut | Action |
|---|---|
| `Ctrl+K` / `Cmd+K` | Open global search |
| `?` | Show shortcuts help |
| `G` then `D` | Go to Dashboard |
| `G` then `C` | Go to Customers |
| `G` then `T` | Go to Diagnostic |
| `G` then `S` | Go to Settings |
| `G` then `A` | Go to Activity |
| `R` | Refresh current page (dispatches `app:refresh` custom event) |
| `D` | Toggle dark/light mode |
| `Escape` | Close modal / search |

## Rules

- Shortcuts are disabled when focus is inside `input`, `textarea`, or `select` elements.
- The `G` key starts a 500ms sequence window — press the second key within that window to trigger the navigation.
- Unknown second keys after `G` are ignored (and the window closes).
