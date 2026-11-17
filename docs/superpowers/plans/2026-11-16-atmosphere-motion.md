# Fine Dust and Animated Atmosphere Implementation Plan

> **For agentic workers:** Apply executing-plans for the owned task; root coordinates parallel work and verification.

**Goal:** Make dust finer and give each existing time phase subtle ambient movement.

**Architecture:** Existing decorative phase pseudo-elements animate beneath paper canvas. Controller keeps all timers/preferences/DOM contracts; only its generated particle size changes.

**Tech Stack:** Native ES modules and CSS keyframes, no dependencies.

**Spec:** docs/superpowers/specs/2026-11-16-atmosphere-motion-design.md

## Global Constraints

Local-only; no real user data, backups, audio or schema edits. No Git repository/worktree. No browser/UI fallback around existing managed access denial. Do not add tests that mirror CSS for this reversible visual adjustment.

## Review Focus

Pause every pseudo-element and particle when hidden; pause inactive phase animations. Reduced-motion must stop all new movement and retain static lighting. Transform only decorative children. Avoid exposed pseudo-element edges during movement. Preserve all input, density, timer and audio behavior.

## Task 1: Fine dust and CSS motion

- [x] Root: adjust generated dust size to0.70–1.60px in dist/atmosphere.mjs; leave particle count, settings and identity unchanged. Existing finite/identity test now permits fine0.5–2px grains; observed RED on former coarse generation, then GREEN. Combined controller/audio/bootstrap49/49 passed.
- [x] CSS owner: edit only dist/atmosphere.css. Smaller grains/no large halo; shifting morning/evening rays; broad daylight cloud shadows; independent warm flicker at night. Preserve controls and phase transitions. Cover hidden, inactive and reduced-motion conditions with CSS.
- [x] Run existing atmosphere/ambience/bootstrap tests and module syntax checks. Focused49/49; full npm test435/435; npm run check26 modules passed. No installed tinycss2 parser found; use structural source review instead, no dependencies installed.
- [x] Independent scoped source review, resolve any concrete important findings, update README/verification. Reviewer found no important issue and independently passed23/23 atmosphere tests. Final combined sources: npm test435/435; npm run check26 modules. Native visual appearance is still unverified; user can preview manual phases after Ctrl+F5.

CSS result: rays42/44s with opposite±3% translation and negative phases; clouds64/79/83s with22% overscan; night pools17/23s, irregular.68–1/.73–1 opacity with gentle translation/scale. Dust peak opacity.34/.48/.58, CSS size clamp.6–1.65px. Structural source check76 balanced brace pairs. No browser/native UI validation performed; no changes to audio, real quest data, backup schema or dependencies.
