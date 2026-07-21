# Sign in with Apple setup

LiberGent uses Supabase's web OAuth flow. The frontend calls `signInWithOAuth({ provider: "apple" })`; Apple credentials stay in Apple Developer and Supabase and must never be added to `NEXT_PUBLIC_*` variables or committed to this repository.

## Values you need

| Value | Where it comes from | Where it goes |
| --- | --- | --- |
| Team ID | Apple Developer membership details | Apple client-secret generator |
| App ID | Apple Developer → Identifiers → App IDs | Primary identifier with Sign in with Apple enabled |
| Services ID | Apple Developer → Identifiers → Services IDs | Supabase Apple **Client IDs**; this is the web Client ID |
| Key ID | Apple Developer → Keys | Apple client-secret generator |
| `.p8` private key | Downloaded once when the Apple key is created | Apple client-secret generator; store securely, never commit |
| Generated client secret | JWT generated from the values above | Supabase Apple **Secret Key** |

## 1. Create or configure the primary App ID

In Apple Developer → Certificates, Identifiers & Profiles:

1. Open **Identifiers** and create or select an App ID.
2. Enable the **Sign in with Apple** capability.
3. Configure it as the primary App ID for LiberGent.

Apple requires the web Services ID to be associated with a primary App ID.

## 2. Create the web Services ID

1. Create a new **Services ID**. A suitable identifier is `com.libergent.web` if it is available in the Apple account.
2. Enable **Sign in with Apple** for it.
3. Associate it with the primary App ID.
4. Configure the website using the Supabase Auth domain—not `libergent.com`—because Apple returns the OAuth response to Supabase first.

For a Supabase project at `https://<project-ref>.supabase.co`, enter:

```text
Domain: <project-ref>.supabase.co
Return URL: https://<project-ref>.supabase.co/auth/v1/callback
```

The Services ID value is the Client ID entered in Supabase.

## 3. Create the Apple signing key and secret

1. In Apple Developer → **Keys**, create a key with Sign in with Apple enabled.
2. Associate the key with the same primary App ID.
3. Record the Key ID and download the `.p8` file. Apple only allows the file to be downloaded once.
4. In Supabase Dashboard → Authentication → Providers → Apple, use the client-secret generator with:
   - Services ID / Client ID
   - Team ID
   - Key ID
   - `.p8` private key
5. Put the generated secret into the Apple provider's **Secret Key** field and enable the provider.

The OAuth client secret expires. Rotate it before six months have elapsed and keep a recurring operational reminder.

## 4. Configure Supabase redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

```text
Site URL: https://libergent.com
Additional redirect URL: https://libergent.com/confirm
Additional local redirect URL: http://localhost:3000/confirm
```

The application preserves a validated relative `next` path through `/confirm` and redirects the signed-in user back to the page that initiated authentication.

## 5. Frontend environment

The frontend needs only the normal public Supabase connection values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Do not expose the Apple `.p8`, Team ID, Key ID, or generated client secret through frontend environment variables.

For automated production deploys, add both public values as GitHub Actions repository secrets named exactly `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The deployment workflow passes them into the Next.js build. They are currently required even if the corresponding Worker-side Supabase secrets already exist, because `NEXT_PUBLIC_*` values are embedded at frontend build time.

## 6. Test checklist

1. Open `/auth` in a private browser window.
2. Select **Continuă cu Apple**.
3. Confirm that Apple returns to the Supabase `/auth/v1/callback` URL and Supabase returns to `https://libergent.com/confirm`.
4. Confirm that `/confirm` redirects to the original safe `next` path.
5. Open `/account` and verify the email/provider.
6. Sign out and verify that private favorites/contact/conversation controls disappear.
7. Test both **Share My Email** and **Hide My Email**. Hidden addresses use Apple's private relay domain.

Apple's OAuth flow does not provide a reusable full name to Supabase. LiberGent therefore treats the name as optional and falls back to the account email/context when it is unavailable.

## References

- [Supabase: Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Supabase: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Apple: Configure Sign in with Apple for the web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)
