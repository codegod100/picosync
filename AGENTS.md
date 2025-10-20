# Agent Guidelines

## Commands
- **Build**: `pnpm build`
- **Dev server**: `pnpm dev`
- **Preview**: `pnpm preview`
- **Type check**: `pnpm svelte-check`
- **No test framework configured**

## Code Style
- **Language**: TypeScript with strict mode
- **Framework**: Svelte 5 (modern runes: $state, $derived, $effect)
- **Imports**: Relative paths with .ts extensions, single quotes
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Formatting**: 2 spaces, no semicolons, single quotes
- **Error handling**: try/catch with console.error logging
- **Async**: Use async/await pattern
- **Types**: Explicit typing required, no any types except SQLite worker

## Task Management
- **Issue Tracking**: Use Beads (`bd`) for all task management instead of Markdown todos
- **Creating Issues**: `bd create "Task description" --type feature|bug|task --assignee username --labels tag1,tag2`
- **Viewing Work**: `bd ready` to see unblocked tasks, `bd list` for all issues
- **Updating Status**: `bd update ISSUE_ID --status in_progress` when starting work
- **Completing Tasks**: `bd close ISSUE_ID --reason "Completion details"` when done
- **Dependencies**: Use `bd dep FROM_ID TO_ID --dep-type blocks` for task dependencies
- **Workflow**: Create Beads issue first, then implement, then close issue

Everytime we create a task in the agent, manage a corresponding task in Beads.
We track work in Beads instead of Markdown. Run `bd quickstart` to see how.
