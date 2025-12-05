# Documentation Home and Onboarding Upgrade

## Objective
Provide a single, authoritative entry point for contributors with accurate setup, environment, and navigation guidance to reduce fragmentation.

## Scope
- README overhaul and a dedicated Docs Home index that links to architecture, specs, reviews, and walkthroughs.

## Requirements
- README includes prerequisites, install/run steps, environment variables (including Airtable proxy expectations), and known limitations.
- Docs Home page enumerates all major documents with ownership and last-validated dates; marks authoritative vs. draft content.
- Cross-links from existing specs/reviews back to Docs Home for discoverability, including the MVP scope/prioritization doc.
- Walkthrough updated to reference real test/build commands or clearly mark pending steps.
- Operational/Safety guidance (Airtable exposure, secrets handling, testing expectations) linked from onboarding.

## Implementation Notes
- Use concise tables for docs index (title, purpose, owner, last reviewed, authoritative/draft).
- Add consistent front-matter or headings for date/owner fields to support future automation.
- Keep README lean and point to Docs Home for deeper topics (architecture, flows, specs).

## Acceptance Criteria
- README no longer mirrors the Vite template and contains project-specific setup/run info.
- A Docs Home page exists with links to all key documents and clearly labeled authority status.
- Docs Home links to the MVP scope/prioritization document so contributors know which specs block launch.
- Walkthrough includes actual commands (or TODO placeholders with owners) and references CI status location once available.
- Security/operations notes are visible from the onboarding path.
