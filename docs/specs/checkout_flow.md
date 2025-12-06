# Checkout Flow

## Cart Building
- Scans (camera or manual) are queued only when no lookup is pending (`isPendingLookup` combines the hook's `isLoading` flag and a local guard for the moment between scans).
- While a lookup is pending, the scanner UI shows a small "Processing…" state and blocks new input, preventing rapid scans from adding duplicates.
- After the lookup resolves (success or error), scanning is re-enabled so the next item can be captured.
- Manual entry follows the same guard: submitting is disabled and shows a "Processing…" state while a lookup is in flight.
