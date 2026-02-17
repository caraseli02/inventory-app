---
status: pending
priority: p1
issue_id: "035"
tags: [authentication, critical, blocking, feature-complete]
dependencies: []
---

# Add Supabase sign-in/authentication flow - REQUIRED FOR INVOICE FEATURE

## Problem Statement

The invoice feature requires Supabase JWT authentication (`Authorization: Bearer {token}`), but **the app has no sign-in/login functionality at all**. Users cannot authenticate, making the entire invoice feature **completely non-functional**.

**CRITICAL:** Invoice upload feature is blocked - there's no way for users to obtain Supabase access tokens.

## Findings

### Root Cause Analysis

**Current App Architecture:**
```
App.tsx (no auth)
  └─> AppShell (no auth)
      └─> Outlet
           ├─> HomePage (inventory scan)
           ├─> InventoryListPage (product list)
           ├─> ScanPage (barcode scanner)
           ├─> CheckoutPage (checkout - assumes authenticated?)
           └─> InvoiceUploadDialog (NEEDS AUTH - NO WAY TO GET IT!)
```

**What's Missing:**
- ❌ No sign-in/login page
- ❌ No auth context/provider
- ❌ No auth state management
- ❌ No sign-out functionality
- ❌ No auth guards on protected routes
- ❌ No session persistence/loading states

**What Exists:**
- ✅ Supabase client initialized (`src/lib/supabase.ts`)
- ✅ Supabase env vars configured (`.env.example`)
- ❌ **No UI for sign-in**
- ❌ **No way to authenticate users**

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| Invoice feature non-functional | 🔴 Critical | Certain (100%) | 10/10 |
| Cannot test invoice OCR | 🔴 Critical | Certain (100%) | 10/10 |
| Cannot test preview pricing | 🔴 Critical | Certain (100%) | 10/10 |
| App has no auth system | 🔴 Critical | Certain (100%) | 10/10 |

**Overall Risk Score: 40/40** - **COMPLETE FEATURE BLOCKED**

### Exploit Scenario

**User trying to use invoice feature:**
1. User opens app at `http://localhost:5173` or `https://lavio.vercel.app`
2. User navigates to "Invoice" tab
3. User clicks "Upload Invoice" button
4. InvoiceUploadDialog component calls `supabase.auth.getSession()`
5. Supabase returns: `{ session: null, user: null }`
6. Component shows error: "No Supabase session - authentication required. Please sign in to process invoices."
7. **User has NO WAY to sign in** - no sign-in button/page exists!
8. User is **completely blocked** from using invoice feature
9. **Feature is non-functional**

### Why This Wasn't Caught

**Plan Document Review:**
- `docs/plans/2026-02-16-refactor-invoice-auth-remove-proxy-plan.md`:
  - Focuses on: removing proxy, implementing JWT validation
  - **Does NOT mention** need for sign-in flow
  - **Assumes** users can already sign in

**Code Review Missed:**
- All agents focused on: JWT validation, rate limiting, code quality
- **None checked**: Does the app actually have authentication UI?
- **Assumption**: "Of course the app has sign-in, it's a React app"
- **Reality**: App has ZERO authentication system

### Related Issues Blocked

- **Issue #028** (FastAPI JWT validation): Depends on auth flow existing
- **Issue #029** (Token refresh): Depends on auth flow existing
- **Invoice Feature**: Completely non-functional

## Proposed Solutions

### Solution 1: Add Supabase Sign-In Page ✅ RECOMMENDED

**Approach:** Create full Supabase authentication flow with sign-in/sign-up pages.

**Implementation:**

**New Pages:**
- `src/pages/SignInPage.tsx` - Sign-in form
- `src/pages/SignUpPage.tsx` - Sign-up form

**New Auth Components:**
- `src/components/auth/SignInForm.tsx` - Sign-in form component
- `src/components/auth/SignUpForm.tsx` - Sign-up form component
- `src/components/auth/AuthProvider.tsx` - Auth context provider (optional)

**SignInPage.tsx:**
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

export default function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        logger.error('Sign-in failed', { error: error.message });
        return;
      }

      if (!data.session) {
        setError('No session returned from sign-in');
        return;
      }

      // Redirect to home page
      logger.info('User signed in successfully', { email: data.user.email });
      navigate('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      logger.error('Unexpected sign-in error', { error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl border-2 border-stone-200 shadow-lg">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-stone-900">
            {t('auth.signIn.title', 'Sign In')}
          </h1>
          <p className="text-stone-600">
            {t('auth.signIn.subtitle', 'Access your inventory system')}
          </p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-6">
          {error && (
            <div className="p-4 bg-terracotta-light/20 border border-2 border-terracotta rounded-lg text-terracotta-dark">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <div>
              <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder={t('auth.email.placeholder', 'you@example.com')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-2 border-stone-300"
              />
            </div>

            <div>
              <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
              <Input
                id="password"
                type="password"
                required
                placeholder={t('auth.password.placeholder', '••••••••')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-2 border-stone-300"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            style={{
              background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))',
            }}
          >
            {loading ? t('auth.signIn.loading', 'Signing in...') : t('auth.signIn.button', 'Sign In')}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-stone-600">
            {t('auth.signIn.noAccount', "Don't have an account?")}{' '}
            <a
              href="/signup"
              className="font-medium text-forest hover:underline"
            >
              {t('auth.signUp.link', 'Sign up')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**SignUpPage.tsx:**
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

export default function SignUpPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        logger.error('Sign-up failed', { error: error.message });
        return;
      }

      if (!data.session) {
        // Auto sign-in after sign-up
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError('Account created but sign-in failed: ' + signInError.message);
          return;
        }

        logger.info('User signed up and signed in successfully', { email: data.user.email });
        navigate('/');
        return;
      }

      logger.info('User signed up successfully', { email: data.user.email });
      navigate('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      logger.error('Unexpected sign-up error', { error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl border-2 border-stone-200 shadow-lg">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-stone-900">
            {t('auth.signUp.title', 'Create Account')}
          </h1>
          <p className="text-stone-600">
            {t('auth.signUp.subtitle', 'Start managing your inventory')}
          </p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-6">
          {error && (
            <div className="p-4 bg-terracotta-light/20 border border-2 border-terracotta rounded-lg text-terracotta-dark">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <div>
              <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder={t('auth.email.placeholder', 'you@example.com')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-2 border-stone-300"
              />
            </div>

            <div>
              <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
              <Input
                id="password"
                type="password"
                required
                placeholder={t('auth.password.placeholder', '•••••••••')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-2 border-stone-300"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            style={{
              background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))',
            }}
          >
            {loading ? t('auth.signUp.loading', 'Creating account...') : t('auth.signUp.button', 'Create Account')}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-stone-600">
            {t('auth.signUp.hasAccount', 'Already have an account?')}{' '}
            <a
              href="/signin"
              className="font-medium text-forest hover:underline"
            >
              {t('auth.signIn.link', 'Sign in')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Add routes to App.tsx:**
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import HomePage from '@/pages/HomePage';
import InventoryListPage from '@/pages/InventoryListPage';
import ScanPage from '@/pages/ScanPage';
import SignInPage from '@/pages/SignInPage';
import SignUpPage from '@/pages/SignUpPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/inventory" element={<InventoryListPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
```

**Add sign-in button to InvoiceUploadDialog:**
```typescript
// src/components/invoice/InvoiceUploadDialog.tsx
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export function InvoiceUploadDialog(...) {
  const navigate = useNavigate();
  const { data: authData } = await supabase.auth.getSession();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {authData.session ? (
          // User is signed in, show upload UI
          <Button onClick={handleUpload}>Upload Invoice</Button>
        ) : (
          // User is NOT signed in, show sign-in prompt
          <div className="text-center space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-terracotta" />
            <h3 className="text-lg font-semibold text-stone-900">
              {t('auth.signInRequired.title', 'Sign In Required')}
            </h3>
            <p className="text-stone-600">
              {t('auth.signInRequired.message', 'You must sign in to upload invoices.')}
            </p>
            <Button
              onClick={() => navigate('/signin')}
              className="w-full"
              style={{
                background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))',
              }}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {t('auth.signIn.button', 'Sign In')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Add i18n translations:**
```json
// public/locales/en.json
{
  "auth": {
    "signIn": {
      "title": "Sign In",
      "subtitle": "Access your inventory system",
      "button": "Sign In",
      "loading": "Signing in...",
      "noAccount": "Don't have an account?",
      "invalidCredentials": "Invalid email or password"
    },
    "signUp": {
      "title": "Create Account",
      "subtitle": "Start managing your inventory",
      "button": "Create Account",
      "loading": "Creating account...",
      "hasAccount": "Already have an account?"
    },
    "signInRequired": {
      "title": "Sign In Required",
      "message": "You must sign in to upload invoices."
    }
  }
}
```

**Pros:**
- ✅ Complete authentication flow (sign-in, sign-up)
- ✅ Uses shadcn components (Button, Input, Label)
- ✅ Matches "Fresh Precision" design system
- ✅ Clear error messages and loading states
- ✅ i18n support (react-i18next)
- ✅ Redirects to home after successful auth
- ✅ Sign-in prompt in InvoiceUploadDialog when not authenticated
- ✅ Simple, minimal implementation
- ✅ Follows existing app patterns

**Cons:**
- ❌ Requires creating 2 new pages
- ❌ Requires i18n translation updates
- ❌ No password reset (future enhancement)

**Effort:** 4-6 hours (pages + routing + i18n + integration)
**Risk:** Low (well-understood Supabase auth pattern)

---

### Solution 2: Add Auth Provider with Protected Routes ✅ MORE ROBUST

**Approach:** Create an auth context/provider with protected route wrapper.

**Implementation:**

**New AuthProvider:**
```typescript
// src/components/auth/AuthProvider.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface AuthContextType {
  user: any | null;
  session: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.user);
        logger.info('Session restored', { hasSession: !!data.session });
      } catch (error) {
        logger.error('Failed to check session', { error });
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        logger.info('Auth state changed', { hasSession: !!session });
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.session) throw new Error('No session returned');
      if (!data.user) throw new Error('No user returned');

      setSession(data.session);
      setUser(data.user);
      logger.info('User signed in', { email: data.user.email });
    } catch (error) {
      logger.error('Sign-in failed', { error });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('No user returned');

      // Auto sign-in after sign-up
      await signIn(email, password);
      logger.info('User signed up', { email: data.user.email });
    } catch (error) {
      logger.error('Sign-up failed', { error });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setSession(null);
      setUser(null);
      logger.info('User signed out');
    } catch (error) {
      logger.error('Sign-out failed', { error });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Protected Route Wrapper:**
```typescript
// src/components/auth/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-forest" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}
```

**Wrap protected routes:**
```typescript
// src/App.tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import HomePage from '@/pages/HomePage';
import InventoryListPage from '@/pages/InventoryListPage';
import ScanPage from '@/pages/ScanPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><InventoryListPage /></ProtectedRoute>} />
            <Route path="/scan" element={<ProtectedRoute><ScanPage /></ProtectedRoute>} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/signup" element={<SignUpPage />} />
          </Routes>
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

**Pros:**
- ✅ Global auth state management
- ✅ Automatic session persistence and restoration
- ✅ Protected routes require auth
- ✅ Sign-out functionality
- ✅ Loading states handled globally
- ✅ More maintainable (single auth source)
- ✅ Future-proof (easy to add more auth features)

**Cons:**
- ❌ More complex implementation
- ❌ Requires creating auth context/provider
- ❌ More code to maintain

**Effort:** 6-8 hours (provider + protected routes + integration)
**Risk:** Medium (more complexity, but better architecture)

---

### Solution 3: Add Sign-In Button to HomePage (Minimal) ⚠️ QUICK FIX

**Approach:** Add a simple sign-in button to the homepage that opens a modal or navigates to sign-in page.

**Implementation:**

**Update HomePage.tsx:**
```typescript
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const navigate = useNavigate();

  const { data } = await supabase.auth.getSession();

  return (
    <div>
      {/* Existing content */}
      <h1>Inventory Management</h1>

      {/* Add sign-in button */}
      {!data.session && (
        <div className="fixed top-4 right-4">
          <Button
            onClick={() => navigate('/signin')}
            variant="outline"
            className="bg-white"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Pros:**
- ✅ Quick to implement (15 minutes)
- ✅ Allows users to access sign-in
- ✅ Minimal code changes

**Cons:**
- ❌ No actual sign-in page (just navigation placeholder)
- ❌ No protected routes (users can browse without signing in)
- ❌ No auth state management
- ❌ Users still can't actually sign in (sign-in page doesn't exist)
- ❌ Doesn't solve the root problem

**Effort:** 15 minutes (quick fix)
**Risk:** High (incomplete solution, doesn't actually work)

## Recommended Action

**Choose Solution 1: Add Supabase Sign-In Page**

**Rationale:**
- Complete authentication flow (sign-in + sign-up)
- Minimal, focused implementation
- Uses existing shadcn components
- Matches "Fresh Precision" design system
- Sign-in prompt in InvoiceUploadDialog for better UX
- Proven Supabase auth pattern
- Clear, maintainable code
- No external dependencies

**Alternative:** If you want more robust auth management, choose Solution 2 (AuthProvider) but it takes longer.

**Execution Plan:**
1. Create `src/pages/SignInPage.tsx` with sign-in form
2. Create `src/pages/SignUpPage.tsx` with sign-up form
3. Add routes `/signin` and `/signup` to App.tsx
4. Update `InvoiceUploadDialog.tsx` to check auth state and show sign-in prompt
5. Add i18n translations for auth UI (`public/locales/en.json`, `public/locales/ro.json`)
6. Test sign-in flow:
   - Create new account
   - Sign in with new account
   - Verify session is established
   - Navigate to invoice upload
   - Verify upload works
7. Test sign-out flow (if implemented)
8. Deploy to staging
9. Deploy to production
10. Update `.env.example` with auth notes (optional)

**DO NOT CHOOSE** Solution 3 - It's incomplete and doesn't actually solve the problem.

## Acceptance Criteria

- [ ] `src/pages/SignInPage.tsx` created with sign-in form
- [ ] `src/pages/SignUpPage.tsx` created with sign-up form
- [ ] Routes `/signin` and `/signup` added to App.tsx
- [ ] Sign-in form uses shadcn components (Button, Input, Label)
- [ ] Sign-up form uses shadcn components (Button, Input, Label)
- [ ] Form validates email and password (required fields)
- [ ] Sign-in uses Supabase `signInWithPassword()`
- [ ] Sign-up uses Supabase `signUp()` with auto sign-in
- [ ] Error messages displayed on auth failures
- [ ] Loading states shown during auth operations
- [ ] Successful auth redirects to home page
- [ ] `InvoiceUploadDialog` checks auth state before showing upload UI
- [ ] `InvoiceUploadDialog` shows sign-in prompt when not authenticated
- [ ] Sign-in prompt navigates to `/signin` page
- [ ] i18n translations added for auth UI (en, ro)
- [ ] Sign-in flow tested (new account creation + sign-in)
- [ ] Invoice upload tested after successful sign-in
- [ ] Session persistence tested (page refresh keeps user signed in)
- [ ] Design matches "Fresh Precision" aesthetic (gradients, rounded corners, colors)
- [ ] Supabase env vars configured in `.env`
- [ ] Deployed to staging and tested
- [ ] Deployed to production and verified

## Work Log

### 2026-02-17 - Discovery

**By:** User Report + Claude Code Review

**Actions:**
- User reported: "No Supabase session - authentication required" error
- Investigated app for auth functionality
- Searched for sign-in/login pages (none found)
- Searched for auth context/provider (none found)
- Reviewed plan document (doesn't mention sign-in requirement)
- Identified critical gap: App has zero authentication system

**Learnings:**
- Invoice feature requires Supabase JWT tokens
- App has no way for users to get authenticated
- Entire invoice feature is non-functional
- Plan document assumed auth system exists (critical oversight)
- All code review agents missed this issue

**Root Cause:**
- Original invoice feature design didn't consider authentication requirements
- Refactor to add JWT validation assumed auth flow exists
- No one checked: "Can users actually sign in?"

**Next Steps:**
- Implement complete sign-in/sign-up flow
- Add auth state management
- Update invoice upload dialog to check auth
- Test end-to-end auth flow
- Unblock all pending auth-related issues (#028, #029)

## Technical Details

**Affected Files:**
- `src/App.tsx` - Add routes for sign-in/sign-up
- `src/pages/SignInPage.tsx` - NEW (sign-in page)
- `src/pages/SignUpPage.tsx` - NEW (sign-up page)
- `src/components/invoice/InvoiceUploadDialog.tsx` - Add auth check + sign-in prompt
- `public/locales/en.json` - Add auth translations (NEW)
- `public/locales/ro.json` - Add auth translations (NEW)

**Related Components:**
- Supabase SDK (`@supabase/supabase-js`) - Auth operations
- shadcn components - Button, Input, Label (existing)

**Database Changes:**
- None (Supabase handles users/sessions)

**API Changes:**
- None (client-side auth only)

## Resources

**Supabase Documentation:**
- Auth Guide: https://supabase.com/docs/guides/auth
- Sign In: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- Sign Up: https://supabase.com/docs/reference/javascript/auth-signup

**React Router Documentation:**
- Routes: https://reactrouter.com/en/main/components/routes
- Navigate: https://reactrouter.com/en/main/hooks/use-navigate

**Related Issues:**
- **BLOCKS**: Issue #028 (FastAPI JWT validation) - Cannot test without auth
- **BLOCKS**: Issue #029 (Token refresh) - Cannot test without auth
- **BLOCKS**: All invoice functionality - Completely non-functional

---

## Notes

- **CRITICAL PRIORITY**: This blocks the entire invoice feature
- **Estimated Effort**: 4-6 hours for Solution 1
- **Testing Required**: Must test full auth flow (sign-in → session established → upload works)
- **Alternative**: Solution 2 (AuthProvider) is more robust but takes 6-8 hours
- **Don't Choose**: Solution 3 is incomplete and doesn't actually work
