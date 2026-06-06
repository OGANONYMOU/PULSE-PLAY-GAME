# Google OAuth Setup Guide for PulsePlay

Your app is now ready to accept Google logins! Follow these steps to get Google OAuth working.

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **Create a new project** or select an existing one
3. Go to **APIs & Services → Credentials**
4. Click **+ Create Credentials → OAuth 2.0 Client ID**
5. If prompted, configure the OAuth consent screen first:
   - User Type: **External**
   - Add your app name, support email, etc.
   - Add scopes: `userinfo.email`, `userinfo.profile` (default)
6. Then create the OAuth Client ID:
   - Application type: **Web application**
   - Name: "PulsePlay Web"
   - Authorized redirect URIs:
     - **Local (development)**: `http://localhost:5173/auth/callback`
     - **Production**: `https://yourpulseplaydomain.com/auth/callback`
   - Click **Create**
7. **Copy your Client ID** (you'll need this next)

## Step 2: Configure Google in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your **PulsePlay project**
3. Navigate to **Authentication → Providers**
4. Find **Google** and click to expand it
5. Paste your **Google Client ID** into the field
6. Toggle **Enable** to turn it ON
7. Verify the redirect URL is set to your callback URL (should match what you configured in Google Console)
8. **Save**

## Step 3: Verify Environment Variables

Your `.env.local` already has:

```
VITE_SUPABASE_URL=https://vtvxbqxvbfbsnccraewq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These are correctly configured. ✅

## Step 4: Test Locally

1. Start your dev server:
   ```bash
   npm run dev
   ```
2. Go to `http://localhost:5173`
3. Click **"Sign in with Google"** or **"Sign up with Google"** button
4. You should be redirected to Google's login
5. After signing in, you'll be redirected to `/auth/callback`
6. Then automatically redirected to the homepage
7. The login sections will now be **hidden** (because you're authenticated!)

## Step 5: Deploy to Production

When deploying to Vercel:

1. Add environment variables to Vercel:
   - Go to your Vercel project → **Settings → Environment Variables**
   - Add:
     ```
     VITE_SUPABASE_URL=https://vtvxbqxvbfbsnccraewq.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```
   - Click **Save**

2. Update Google Console:
   - Go back to Google Cloud Console → OAuth 2.0 Client ID settings
   - Add your production redirect URI:
     ```
     https://yourvercelapp.vercel.app/auth/callback
     ```
   - Save changes

3. Update Supabase:
   - Go to your Supabase project → Authentication → Providers → Google
   - Verify the Google Client ID is still correct
   - Providers automatically handle multiple redirect URIs

## What We've Implemented

✅ **Homepage Dynamic Content**

- Sign in/Sign up sections are **hidden** when user is logged in
- Shown when user is **not logged in**
- Conditional CTAs:
  - **Not logged in**: "Sign in with Google", "Create Account", "Sign up with Google"
  - **Logged in**: "Browse Tournaments", "View Profile"

✅ **Session Persistence**

- Uses Supabase PKCE flow with `detectSessionInUrl: true`
- Session automatically restored on page refresh
- User stays logged in until they sign out

✅ **OAuth Redirect Flow**

- User clicks "Sign in/Sign up with Google"
- Redirected to Google login
- Returned to `/auth/callback?code=xxx`
- Code exchanged for session automatically
- Redirected to homepage (`/`)
- Auth context updates and homepage re-renders

## Common Issues & Solutions

### Issue: "Authorization Error" or "Invalid Client"

**Solution**:

- Make sure you've enabled Google provider in Supabase
- Verify the Client ID is pasted correctly (no extra spaces)
- Check that you're using the correct environment (local vs production)

### Issue: Redirect loop or stays on callback page

**Solution**:

- Check that redirect URI in Google Console matches your app's callback URL exactly
- Make sure `detectSessionInUrl: true` is set in supabase.ts (it is ✅)
- Check browser console for error messages

### Issue: Session not persisting after refresh

**Solution**:

- Verify localStorage is enabled in browser
- Check that `persistSession: true` in supabase.ts (it is ✅)
- Clear localStorage and try again: `localStorage.clear()`

### Issue: Can't see the Google button

**Solution**:

- Make sure you're **not logged in** yet
- The buttons only appear when `isAuthenticated === false`
- Check that AuthProvider is wrapping your app (it is ✅)

## Files Modified

- **src/pages/Home.tsx**:
  - Added Google login button
  - Added conditional rendering for auth/non-auth states
  - Added login/signup sections that hide when logged in

- **src/lib/supabase.ts**:
  - Already configured with PKCE flow
  - Already has `detectSessionInUrl: true`

- **src/contexts/AuthContext.tsx**:
  - Already has `signInWithOAuth` method
  - Already has session persistence

- **src/pages/AuthCallback.tsx**:
  - Already handles OAuth redirect
  - Already exchanges code for session
  - Already redirects to homepage

## Next Steps

1. ✅ Get Google Client ID (Step 1 above)
2. ✅ Configure in Supabase (Step 2 above)
3. ✅ Test locally (Step 4 above)
4. ✅ Deploy and add to Vercel (Step 5 above)

That's it! Your Google OAuth is ready to go. 🚀
