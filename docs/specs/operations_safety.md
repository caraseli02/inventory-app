# Operations and Safety Guidance

**Version**: 0.1.0 (draft)
**Status**: NOT_STARTED
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: [backend_proxy.md](./backend_proxy.md), [validation_guardrails.md](./validation_guardrails.md), [observability.md](./observability.md), [mvp_scope.md](./mvp_scope.md)

## Objective
Document operational safeguards to prevent accidental data exposure, clarify secret handling, and align testing/monitoring expectations.

## Scope
- Deployment, secrets management, and runtime safety practices for the inventory app and its Airtable backend proxy.

## Changelog

### 0.1.0 (2025-12-05)
- Initial draft covering operational safety scope and dependencies.

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

## Deployment Checklist
- Verify `.env` exists locally and in hosting secrets with `VITE_AIRTABLE_API_KEY`, `VITE_AIRTABLE_BASE_ID`, and proxy URL/token values populated.
- Confirm Airtable base tables and field names match `src/lib/api.ts` expectations or updated backend proxy contract.
- Ensure the backend proxy enforces authentication (shared secret token or per-user auth) and rate limiting before enabling client writes.
- Run `pnpm lint`, `pnpm test` (once added), and `pnpm build` in CI; block release on failures.
- Capture deployment metadata (commit SHA, deployed proxy URL) in release notes or CI artifacts.

## Testing & Release Verification
- **Unit/Component**: Inputs that touch Airtable calls have validation unit tests and React component tests covering unhappy paths.
- **Integration**: Smoke tests against the proxy endpoints validate 200/400/401 responses and include a trace ID in headers/body for log correlation.
- **Manual QA**: Before releases, validate scanner flow with invalid barcodes to ensure guardrails prevent Airtable queries.
- **Monitoring hooks**: Ensure client logging utility is wired to surface proxy errors and scanner failures (see [observability.md](./observability.md)).

## Runbook (Key Rotation & Emergency Disable)
- **Rotate Airtable key**: revoke the old key in Airtable, create a new one, update proxy hosting secrets and `.env` locally, then redeploy proxy and front-end builds.
- **Rotate proxy auth token**: generate a new token, update client env vars and proxy config, invalidate the old token server-side, and redeploy.
- **Emergency disable**: set a maintenance flag in the proxy to return 503 for write routes; if unavailable, temporarily remove the API key from hosting secrets to halt requests.
- **Access review**: quarterly audit who can read Airtable bases and proxy logs; tighten permissions where possible.

## Acceptance Criteria
- Documented checklist exists for deploying with secrets properly configured and verified.
- Onboarding docs link to this safety guidance and highlight Airtable exposure risk if proxy is bypassed.
- Release/test expectations are recorded and discoverable from README/Docs Home.
- Runbook includes key rotation and emergency-disable steps.
