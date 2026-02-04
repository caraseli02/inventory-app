---
status: complete
priority: p1
issue_id: "006"
tags: [performance, code-review, critical, user-experience, progress-tracking]
dependencies: []
---

# Problem Statement

Progress reporting is fake/jumps from 40% → 70%, with no actual feedback during the network upload phase (the longest part of operation).

**Critical Impact:** Users see progress freeze for 1-3 minutes, can't distinguish between upload vs server processing delays, leading to poor UX and confusion.

## Findings

### Root Cause Analysis

**Location:** `src/lib/invoiceOCR.ts:83, 113, 129, 155, 177, 281, 300`

```typescript
// Progress reporting throughout function
safeProgress(10);  // ← File validation start
safeProgress(20);  // ← Validation complete
safeProgress(30);  // ← Size check done

safeProgress(40);  // ← Before API call (THIS IS LAST UPDATE FOR 2-3 MINUTES!)

// API call happens here (lines 160-164)
// No progress updates during:
//   - FormData construction
//   - Network upload (10MB on slow connection: 120-180 seconds)
//   - Server processing time
//   - Response parsing

safeProgress(70);  // ← AFTER API call completes (JUMPS FROM 40% TO 70%!)

safeProgress(90);  // ← Transformation done
safeProgress(100); // ← Complete
```

**Why it's fake:**
- Progress 40%: "Ready to call API"
- Progress 70%: "Response received"
- **Gap of 30% covers:** The entire network request + server processing (longest phase)
- No feedback during: FormData creation, upload, server processing
- User sees: 40% → Freeze → 70% → Freeze → 90% → Complete

### Failure Scenarios

**Scenario 1: Slow 3G Network**
```
File: 10MB PDF
Network: 3G (actual throughput: 1 Mbps)
Upload time: 120-180 seconds
Server processing: 30-60 seconds
Total gap: 150-240 seconds (2.5-4 minutes)

User experience:
- t=0s: Progress at 40%
- t=30s: Still at 40% (uploading...)
- t=60s: Still at 40% (uploading...)
- t=120s: Still at 40% (uploading...)
- t=180s: Still at 40% (processing...)
- t=240s: Still at 40% (server processing...)
- t=240s: Suddenly 70%! (response received)
- User reaction: "Did it freeze? Was it working? Is there a bug?"
```

**Impact:**
- User confusion
- Perception of broken app
- Support ticket: "Upload seems stuck at 40%"
- No way to tell if still uploading or failed

**Scenario 2: Unresponsive Server**
```
Server: FastAPI service frozen/crashed
Expected timeout: Should error after 120 seconds

User experience:
- t=0s: Progress at 40%
- t=30s: Still at 40% (uploading...)
- t=60s: Still at 40% (waiting...)
- t=120s: Still at 40% (still waiting...)
- t=180s: Still at 40% (why no response?)
- t=240s: Still at 40% (this is taking forever)
- User action: Refreshes page (loses progress)
- User reaction: "This is broken, I'll try later"
```

**Impact:**
- User abandonment
- Lost productivity
- Negative user feedback

**Scenario 3: Network Interruption**
```
Event: WiFi disconnects at 50% upload
Expected: Progress bar shows stuck
Expected error: Clear error message after timeout

User experience:
- t=0s: Progress at 40%
- t=30s: Still at 40% (uploading...)
- WiFi disconnects
- t=31s: Still at 40% (upload still shows progress)
- t=60s: Still at 40% (stuck)
- t=120s: Still at 40% (why no error?)
- User reaction: Confused, maybe it's still working
- User action: Tries to upload again (gets another 40% stall)
- User reaction: "This doesn't work properly"
```

**Impact:**
- User confusion
- Multiple failed uploads
- Loss of trust in app reliability

### Comparison with Real Progress Implementation

**Before (Phase 1 - Direct APIs):**
```typescript
// No progress tracking at all
const result = await googleVision.ocr(file);
const parsed = await gpt4o.parse(result.text);
// User sees spinner for entire operation
```

**After (Phase 2 - Supabase Edge Functions):**
```typescript
// Two-step process with progress between steps
onProgress(20); // Calling invoice-ocr
const ocrResult = await supabase.functions.invoke('invoice-ocr');
onProgress(60); // Calling invoice-parse
const parsedResult = await supabase.functions.invoke('invoice-parse');
onProgress(100); // Complete

// Still fake (20% → 60% → 100%), but shorter gaps
```

**Current (Phase 3 - PR #91):**
```typescript
onProgress(40); // Start upload
// 150-240 second gap with no updates!
onProgress(70); // Response received
onProgress(100); // Complete

// Fake AND misleading (gap is longest phase)
```

**Verdict:** Worst of all three phases for user experience.

### UI Impact Analysis

**Location:** `src/components/invoice/InvoiceUploadDialog.tsx:318-327`

```typescript
// Progress bar display
<div className="w-full bg-blue-200 rounded-full h-2">
  <div
    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
    style={{ width: `${ocrProgress}%` }}
  />
</div>

// Status text
<p className="text-sm text-blue-600">
  {(() => {
    if (ocrProgress < 50) return t('invoiceUpload.progress.preparing');
    if (ocrProgress < 80) return t('invoiceUpload.progress.extracting');
    return t('invoiceUpload.progress.finalizing');
  })()}
</p>
```

**Why it's misleading:**
- 40% → "Preparing invoice..."
- 70% → "Extracting data..."
- But 40-70% gap is "uploading and server processing"!
- User thinks: "It's stuck at preparing, why isn't it extracting?"

## Proposed Solutions

### Solution 1: XMLHttpRequest with Real Upload Progress ✅ RECOMMENDED

**Approach:** Replace `fetch` with `XMLHttpRequest` to track actual upload progress.

**Implementation:**
```typescript
export async function extractInvoiceData(
  file: File,
  onProgress?: (progress: number) => void
): Promise<InvoiceOCRResult> {
  // ... validation code ...

  safeProgress(40); // Ready to upload

  // ✅ NEW: XMLHttpRequest for upload progress
  const result = await uploadWithProgress(extractUrl, file, headers, onProgress);

  safeProgress(90); // Transformation

  // ... rest of function ...
}

// ✅ NEW: Upload function with progress tracking
async function uploadWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (progress: number) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    // ✅ NEW: Track actual upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        // Upload progress: 40% → 70% based on actual bytes
        const uploadProgress = 40 + (e.loaded / e.total) * 30;
        onProgress?.(Math.round(uploadProgress));
      }
    });

    xhr.onload = () => {
      // Upload complete, server processing: 70% → 90%
      onProgress?.(90);

      const response = new Response(xhr.responseText, {
        status: xhr.status,
        statusText: xhr.statusText,
      });
      resolve(response);
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed'));
    };

    xhr.timeout = 120000; // 2 minutes (see todo #002)
    xhr.open('POST', url);

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.send(formData);
  });
}
```

**Progress Breakdown:**
```
0-10%:   File validation
10-20%:  Size check
20-30%:  FormData construction
30-40%:  Ready to upload
40-70%:  ✅ ACTUAL UPLOAD (40% + (loaded/total)*30)
70-90%:  Server processing + transformation
90-100%:  Finalization
```

**UI Updates:**
```typescript
// Status text matches actual operation
const getStatusText = (progress: number, t: TranslationFunction) => {
  if (progress < 10) return t('invoiceUpload.progress.validating');
  if (progress < 30) return t('invoiceUpload.progress.checkingSize');
  if (progress < 40) return t('invoiceUpload.progress.preparing');
  if (progress < 70) return t('invoiceUpload.progress.uploading');  // ✅ NEW: Accurate
  if (progress < 90) return t('invoiceUpload.progress.processing');
  return t('invoiceUpload.progress.finalizing');
};
```

**Pros:**
- ✅ Real upload progress (gradual 40% → 70% updates)
- ✅ User sees actual progress during longest phase
- ✅ Better UX (can tell if upload is working)
- ✅ Distinguishes upload vs server processing
- ✅ Upload percentage accurate to bytes transferred
- ✅ Cancelable (see todo #002 for AbortController)

**Cons:**
- ⚠️ More complex than `fetch` (XMLHttpRequest API is older)
- ⚠️ ~40 additional lines of code
- ⚠️ Requires learning XMLHttpRequest API

**Effort:** 60-90 minutes
**Risk:** Low (well-documented pattern, industry standard for uploads)

---

### Solution 2: Chunked Upload with Progress

**Approach:** Split large file into chunks and upload sequentially.

**Implementation:**
```typescript
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

async function uploadWithChunks(
  url: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<Response> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let uploadedBytes = 0;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('totalChunks', String(totalChunks));

    const response = await fetch(`${url}/chunk`, {
      method: 'POST',
      body: formData,
    });

    uploadedBytes += CHUNK_SIZE;

    // ✅ NEW: Update progress after each chunk
    const progress = 40 + (uploadedBytes / file.size) * 30;
    onProgress?.(Math.round(progress));
  }

  // Signal server to combine chunks
  const finalResponse = await fetch(`${url}/combine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalChunks }),
  });

  onProgress?.(90);
  return finalResponse;
}
```

**Pros:**
- ✅ Very granular progress (updates after each chunk)
- ✅ Resumable on network failure
- ✅ Better for slow/unstable connections
- ✅ Shows actual progress clearly

**Cons:**
- ❌ Requires FastAPI server changes (chunk handling)
- ❌ Much more complex (200-300 lines)
- ❌ Server must store chunks temporarily
- ❌ Additional failure modes (chunk loss, combine failures)
- ❌ Overkill for 10MB file size

**Effort:** 4-6 hours (client + server)
**Risk:** High (complex, requires external service coordination)

**Recommendation:** Use Solution 1 first, consider Solution 2 only if resumable uploads are needed for very large files (>50MB).

---

### Solution 3: Fake Progress with Timer-Based Estimation

**Approach:** Add timer-based progress estimation during the gap.

**Implementation:**
```typescript
export async function extractInvoiceData(
  file: File,
  onProgress?: (progress: number) => void
): Promise<InvoiceOCRResult> {
  // ... validation code ...

  const startTime = Date.now();
  const uploadStartProgress = 40;
  const uploadEndProgress = 70;

  safeProgress(uploadStartProgress);

  // ✅ NEW: Timer-based progress estimation
  const updateProgress = () => {
    const elapsedMs = Date.now() - startTime;
    const expectedDurationMs = (file.size / (1024 * 1024)) * 15000; // 15s per MB
    const progress = uploadStartProgress + Math.min(
      (elapsedMs / expectedDurationMs) * (uploadEndProgress - uploadStartProgress),
      uploadEndProgress - uploadStartProgress
    );
    onProgress?.(Math.round(progress));

    if (progress < uploadEndProgress) {
      // Continue updating until 70% or API completes
      setTimeout(updateProgress, 200); // Update every 200ms
    }
  };

  const timerId = setTimeout(updateProgress, 200);

  let response: Response;
  try {
    response = await fetch(extractUrl, {
      method: 'POST',
      headers,
      body: formData,
    });
    clearTimeout(timerId); // ✅ NEW: Stop timer on completion
  } catch (error) {
    clearTimeout(timerId);
    // ... error handling
  }

  // ... rest of function ...
}
```

**Pros:**
- ✅ Shows progress during upload gap
- ✅ Easy to implement (20-30 lines)
- ✅ Timer stops when API completes
- ✅ No server changes needed

**Cons:**
- ⚠️ Estimated, not actual (may be faster/slower than expected)
- ⚠️ Doesn't show actual bytes uploaded
- ⚠️ Timer drift if network speed varies wildly
- ⚠️ No progress if server is unresponsive (timer keeps running)

**Effort:** 30-45 minutes
**Risk:** Low (approximation is acceptable UX improvement)

**Recommendation:** Good interim solution if Solution 1 is too much work, but Solution 1 is preferred for accuracy.

## Recommended Action

**Implement Solution 1 (XMLHttpRequest Upload Progress) as P0 fix**

**Phase 1: Replace Fetch with XMLHttpRequest (45 minutes)**
1. Create `uploadWithProgress()` helper function
2. Add `xhr.upload.addEventListener('progress', ...)`
3. Add progress calculation (40% + (loaded/total)*30)
4. Add `xhr.onload` → `onProgress(90)` transition
5. Bind AbortController for cancellation (see todo #002)

**Phase 2: Update Progress Text (15 minutes)**
1. Add "uploading" status text for 40-70% range
2. Update status text function to handle upload phase
3. Add localized strings for upload status

**Phase 3: Test Progress Tracking (15 minutes)**
1. Test with slow network (Chrome DevTools throttling)
2. Verify progress updates during upload
3. Verify progress pauses correctly after upload completes
4. Test with 1MB, 5MB, 10MB files
5. Verify no regression in happy path

**Total Effort:** 60-90 minutes

**Future Enhancement:** Consider Solution 3 (timer-based) if XMLHttpRequest is too complex.

## Acceptance Criteria

- [ ] `uploadWithProgress()` function created with `XMLHttpRequest`
- [ ] Upload progress calculated as `40% + (loaded/total)*30`
- [ ] Progress updates continuously during upload (not just at start/end)
- [ ] Progress callback receives values from 40-70% range during upload
- [ ] Progress transitions to 90% after upload completes (before transformation)
- [ ] Status text updated to show "uploading" during 40-70% range
- [ ] Test: Slow network (3G) shows gradual progress updates
- [ ] Test: Fast network (WiFi) shows progress completes quickly
- [ ] Test: Network failure shows clear error (not stuck at 40%)
- [ ] Test: Server unresponsive times out correctly (see todo #002)
- [ ] No regression: Successful uploads still work (progress still shows correctly)
- [ ] Progress bar updates smoothly (CSS transition duration-300)
- [ ] Localization added for new "uploading" status text

## Work Log

### 2026-02-04 - Initial Finding

**By:** Performance Oracle Agent

**Actions:**
- Reviewed `src/lib/invoiceOCR.ts:83,113,129,155,177,281,300` for progress reporting
- Identified fake progress gap (40% → 70% with no updates)
- Calculated realistic upload times for 10MB PDF on various network speeds
- Analyzed failure scenarios (slow network, unresponsive server, network interruption)
- Compared with Phase 1 (no progress) and Phase 2 (shorter gaps)
- Proposed 3 solutions with effort/risk assessment
- Recommended Solution 1 (XMLHttpRequest) as immediate fix

**Learnings:**
- Fetch API doesn't support upload progress (use XMLHttpRequest)
- Progress freeze is major UX issue for operations >30 seconds
- XMLHttpRequest is industry standard for upload progress tracking
- Fake progress is better than no progress, but real progress is best
- User perception of "stuck" equals broken app
- Progress calculation: 40-70% = 30% range, map to loaded/total ratio

**Next Steps:**
- Awaiting triage decision
- If approved, implement Solution 1 (60-90 minutes)
- Test with Chrome DevTools network throttling
- Verify progress updates smoothly and accurately

---

## Technical Details

**Affected Files:**
- `src/lib/invoiceOCR.ts:60-327` - Progress reporting logic (replace fetch with XMLHttpRequest)
- `src/components/invoice/InvoiceUploadDialog.tsx:318-334` - Progress display (update status text)

**Database Changes:**
- None

**API Changes:**
- None (FastAPI `/extract` endpoint unchanged)

**Performance Impact:**
- No bundle size change (XMLHttpRequest is native API)
- Positive UX improvement (real progress)
- Minimal CPU overhead (progress callback every 200ms)

## Resources

**Documentation:**
- MDN: XMLHttpRequest - https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
- MDN: XMLHttpRequest.upload - https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload_event
- MDN: XMLHttpRequest Progress Events - https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#monitoring_progress

**Related Code:**
- Project patterns: Search for other `fetch()` usage to apply same pattern
- Previous progress handling (Phase 2): Check Supabase Edge Functions implementation

**Test Scenarios:**
```
Chrome DevTools: Network → Throttling settings
- Slow 3G: 1 Mbps downlink, 200ms RTT
- Fast 3G: 1.5 Mbps downlink, 150ms RTT
- 4G: 2 Mbps downlink, 100ms RTT
- WiFi: 10 Mbps downlink, 20ms RTT

Test file sizes:
- 1MB.pdf (invoice-1 page)
- 5MB.pdf (invoice-2-3 pages)
- 10MB.pdf (invoice-5+ pages)
```
