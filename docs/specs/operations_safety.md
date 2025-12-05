# Operations and Safety Guidance

## Objective
Document operational safeguards to prevent accidental data exposure, clarify secret handling, and align testing/monitoring expectations.

## Scope
- Deployment, secrets management, and runtime safety practices for the inventory app and its Airtable backend proxy.

## Requirements
- Secrets (Airtable, proxy tokens) are injected via environment variables and never committed or exposed to clients.
- Clear deployment checklist: env var names, required tables/bases, and minimum auth controls before shipping.
- Security notes surfaced to onboarding (link from README/Docs Home) with known risks and mitigations.
- Testing expectations for releases: lint/build/tests to run and how to record results/CI status.
- Incident/rollback guidance: how to disable client access or revoke keys if compromise is suspected.

## Implementation Notes
- Maintain a short runbook section covering rotate-key steps and Airtable permission adjustments.
- Define logging expectations (structured logs with trace IDs) and retention location for backend proxy.
- Provide example `.env.example` with placeholders and no secrets.

## Acceptance Criteria
- Documented checklist exists for deploying with secrets properly configured and verified.
- Onboarding docs link to this safety guidance and highlight Airtable exposure risk if proxy is bypassed.
- Release/test expectations are recorded and discoverable from README/Docs Home.
- Runbook includes key rotation and emergency-disable steps.
