# Documentation State Review and Improvement Spec

## Objective
Create a clear picture of the current documentation set, flag accuracy risks, and define actions to make the docs trustworthy and navigable.

## Current Documentation Inventory
- **README.md** – Still the default Vite template, no project-specific setup or environment guidance.【F:README.md†L1-L73】
- **Project review** – High-level assessment with risks and recommendations, including Airtable credential exposure concerns.【F:docs/project_review.md†L3-L32】
- **Architecture & structure** – Prescriptive folder layout and practices for a production-ready app, plus starter file lists for the MVP.【F:docs/project_architecture_structure.md†L1-L93】【F:docs/project_file_list.md†L1-L74】
- **MVP walkthrough** – Describes features and claims verification (tsc/vite build, lint) without recorded commands or outputs.【F:docs/walkthrough.md†L1-L39】
- **Planning specs** – Multiple scope-specific specs (scanner, product management, stock management) in `docs/specs/` detailing feature behaviors.

## Findings & Gaps
1) **Inaccurate landing doc** – README is generic Vite boilerplate; newcomers lack install, run, or environment setup steps.【F:README.md†L1-L73】
2) **Unverified validation claims** – Walkthrough asserts successful build/lint with no traceable commands or CI status, risking drift from reality.【F:docs/walkthrough.md†L22-L25】
3) **Fragmented planning** – Architecture, file lists, MVP plans, and walkthroughs live in separate docs without a canonical entry point or cross-links, making it hard to know which guidance to follow.【F:docs/project_architecture_structure.md†L1-L93】【F:docs/project_file_list.md†L1-L74】
4) **Security guidance is isolated** – Airtable credential exposure and other risks are only captured in the project review; they are not surfaced in onboarding docs or operational checklists.【F:docs/project_review.md†L3-L32】

## Recommendations
- Replace the README with project-specific onboarding: prerequisites, install/run commands, environment variables, and a pointer to deeper docs.
- Update the walkthrough to cite real test/build commands (or mark them pending) and link to where CI status will live.
- Establish a single "Docs home" page that links to architecture, specs, review, and walkthrough; mark which documents are authoritative vs. experimental.
- Create a lightweight "Operations & Safety" doc that brings forward Airtable/security warnings, environment variable handling, and testing expectations.
- Version and review docs regularly (e.g., owner + last validated date) to keep guidance synchronized with the codebase.
