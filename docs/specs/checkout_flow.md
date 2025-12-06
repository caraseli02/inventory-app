# Checkout Flow

## Status
- [x] Implemented

## Notes
- Cart mutations and scan resets now occur within a post-fetch effect keyed to lookup results to avoid render-time state updates and repeated sound/vibration triggers.
- Successful lookups immediately add or increment items, while lookup errors trigger a brief reset window for rescanning, ensuring only the active scan triggers feedback.
