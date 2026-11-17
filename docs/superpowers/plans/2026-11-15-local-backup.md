# Local Backup Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Follow checkbox tasks below.

**Goal:** Automatically save recoverable local files and launch the board at Windows login.

**Architecture:** Loopback Node API validates and atomically stores snapshots with revision checks. A browser coordinator saves both copies, restores missing browser data, and handles conflicts without silent replacement. Windows scripts install a per-user startup shortcut.

**Tech Stack:** Node.js 20 ES modules, browser IndexedDB/fetch, PowerShell; no added dependencies.

**Spec:** `docs/superpowers/specs/2026-11-15-local-backup-design.md`

## Global Constraints

- Local-only; bind 127.0.0.1:4173. Preserve current user data.
- Backups outside dist, existing 90 MB validation limit, 30 historical changed snapshots.
- No browser policy workarounds. Use temp data for integration tests.

## Review Focus

- Clearing browser storage must recover disk data before seeding.
- Interrupted or invalid writes must leave a last good recoverable copy.
- Stale tabs must not overwrite newer disk copies.
- Startup must handle Unicode paths, duplicate starts and occupied ports safely.
- File save errors must be visible even if IndexedDB succeeds.

## Tasks

- [x] Server agent: write failing temp-file/HTTP tests, implement backup store and API, verify restart/recovery/conflicts/security.
- [x] Root: write coordinator tests for restoration, failures and conflicts; implement browser integration and status display.
- [x] Startup agent: implement hidden idempotent launcher plus current-user install/disable scripts, parse and validate dry runs.
- [x] Root/reviewer: inspect integration, run full suite and syntax checks, test recovery with a disposable real server directory. Three client findings reproduced RED then GREEN; full suite 95/95.
- [x] Root: identify/restart only the project's old server, install autorun, verify actual Unicode shortcut paths and health without opening a blocked browser surface. Fixed ANSI path corruption with IShellLinkW. Additional execution of stored shortcut command was policy-blocked; no bypass attempted.
- [x] Update user guide and verification with actual results, first-reload requirement, backup folder and disable command.

The user's original tab still needs a manual reload for the first production backup, because saved browser access is blocked. No claim that existing quests have already been copied to disk is made.
