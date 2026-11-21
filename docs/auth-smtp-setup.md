# GrowXQ auth emails: Supabase custom SMTP via Resend

Last updated: 2026-11-15

Auth emails (sign-up confirmation, invite, magic link, email change, password reset, reauthentication) are sent from `GrowXQ <insiders@growxq.com>` through Resend SMTP, using GrowXQ-branded templates stored in Supabase.

## 1. Architecture

```
Supabase Auth  ->  custom SMTP (smtp.resend.com:465)  ->  Resend  ->  recipient
     ^
     |  template HTML + subject live in Supabase (Authentication -> Emails -> Templates)
```

- Resend is only the delivery pipe. **Supabase does not read Resend templates.** Do not build auth templates in Resend.
- The email HTML and subject for each auth email are edited in the Supabase dashboard.
- The Resend templates (Founding seat held, Application received, etc.) are product emails sent by the application, unrelated to Supabase auth.

## 2. Project

| Item | Value |
|---|---|
| Supabase project | Expertly-website-dev (org: Expertly network, branch `main`, labelled Production) |
| Project ref | `lwfnwqghsvtuelmpfvxb` |
| Confirm-link host | `lwfnwqghsvtuelmpfvxb.supabase.co` |
| Redirect seen in confirm links | `dev.expertly.network` |

Note: a different project ref, `qwaellymsszricvyhlhg` (GrowXQ), had custom SMTP **off** when checked on 2026-11-15. Templates were applied only to `lwfnwqghsvtuelmpfvxb`. If GrowXQ production runs on another project, repeat sections 3 and 4 there.

## 3. Resend

- Domain `growxq.com`: **Verified** (added 2026-11-08, provider Hostinger, region us-east-1). SPF/DKIM records are in place.
- API keys: a full-access admin key and a **sending-only** key ("Onboarding").
- Use a **sending-only key scoped to `growxq.com`** as the SMTP password. Resend shows a key's full value only once at creation, so store it in a password manager or secrets store. Never commit it to the repo.
- Tracking (click/open) is not configured.

## 4. Supabase SMTP settings

Dashboard: Authentication -> Emails -> SMTP Settings -> Enable custom SMTP.

| Field | Value |
|---|---|
| Sender email | `insiders@growxq.com` |
| Sender name | `GrowXQ` (must not be "From GrowXQ") |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API key (starts with `re_`), sending access |

Notes:
- Custom SMTP must be enabled before Supabase allows editing templates.
- Supabase applies a low hourly email rate limit to new custom SMTP setups. Raise it under Authentication -> Rate Limits if needed.

## 5. Templates

All six share one design: dark header with the GrowXQ logo, green accent (`#00a682`), serif headline (Cormorant Garamond, falling back to Georgia), a black button, a "Click here" fallback link, and a dark footer with `ask@growxq.com`. The long confirmation URL is never printed; it sits behind the button and the "Click here" link.

| Supabase template | Slug | Subject | Variables used |
|---|---|---|---|
| Confirm sign up | `confirm-sign-up` | Confirm your GrowXQ email | `{{ .ConfirmationURL }}` |
| Invite user | `invite-user` | You've been invited to GrowXQ | `{{ .ConfirmationURL }}` |
| Magic link or OTP | `magic-link-or-otp` | Your GrowXQ sign-in link | `{{ .ConfirmationURL }}`, `{{ .Token }}` |
| Change email address | `change-email-address` | Confirm your new GrowXQ email | `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` |
| Reset password | `reset-password` | Reset your GrowXQ password | `{{ .ConfirmationURL }}` |
| Reauthentication | `reauthentication` | Your GrowXQ verification code | `{{ .Token }}` only (no link) |

Not changed: the security notification templates (password changed, email changed, phone changed, sign-in method linked/removed, MFA added/removed).

Template URL pattern in the dashboard:
`https://supabase.com/dashboard/project/<ref>/auth/templates/<slug>`

### Logo

`https://growxq.com/brand/email/logo-dark.png` (296x60 PNG, the same asset the Resend templates use as `{{{SITE_URL}}}/brand/email/logo-dark.png` with `SITE_URL=https://growxq.com`).

- The URL is hardcoded rather than built from `{{ .SiteURL }}`, because this project's Site URL points at the Expertly dev domain, not growxq.com.
- To change the logo later, replace the file at that same path on growxq.com. No template edits are needed. Mail clients may cache images briefly.
- The Supabase dashboard preview blocks external images, so the logo looks broken there. It renders in real emails.

## 6. Supabase template variables

Built-in only; Supabase has no custom or shared variables across templates.

`{{ .ConfirmationURL }}`, `{{ .Token }}` (6-digit code), `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .RedirectTo }}`, `{{ .Data }}` (user metadata, e.g. `{{ .Data.name }}`). Go template conditionals such as `{{ if .Data.name }}...{{ end }}` work.

Because there is no shared layout, changing the footer, colours, or copy means editing each template. To keep them in sync, generate all six from one source and push them with the Supabase Management API (`PATCH /v1/projects/<ref>/config/auth`, fields `mailer_subjects_*` and `mailer_templates_*_content`). That needs an access token (`sbp_...`); keep it in an environment variable.

## 7. Layout of each template (shared skeleton)

```html
<body style="margin:0;padding:24px 12px;background:#f4f4f1">
  <table width="100%" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e0e1d7;border-radius:14px;overflow:hidden">
    <tr><td style="background:#0b0b0c; ...green radial gradients...; padding:28px">
      <img src="https://growxq.com/brand/email/logo-dark.png" alt="GrowXQ" height="30">
    </td></tr>
    <tr><td style="padding:36px 28px 32px">
      EYEBROW (12px, uppercase, #00a682)
      HEADLINE (serif 40px, second line #00a682)
      INTRO paragraph
      BUTTON  -> href="{{ .ConfirmationURL }}"  (black, white text)
      [optional] CODE BOX -> {{ .Token }}
      "Button not working? <a href="{{ .ConfirmationURL }}">Click here</a> ..."
      divider + ignore-this-email note
    </td></tr>
    <tr><td style="background:#0b0b0c;color:#fff;padding:22px 28px;text-align:center">
      Questions? ... <a href="mailto:ask@growxq.com">ask@growxq.com</a>
    </td></tr>
  </table>
</body>
```

The per-template wording used:

| Template | Eyebrow | Headline | Button |
|---|---|---|---|
| Confirm sign up | Confirm your email | Welcome to GrowXQ. / One step left. | Confirm email |
| Invite user | You're invited | You're invited to GrowXQ. / Join the network. | Accept invite |
| Magic link or OTP | Sign in | Welcome back. / Your sign-in link. | Sign in (plus code box) |
| Change email address | Change email | Confirm your new email. / One quick step. | Confirm new email |
| Reset password | Reset password | Forgot your password? / Let's reset it. | Reset password |
| Reauthentication | Verify it's you | Confirm it's you. / Here's your code. | none (code box only) |

## 8. Verification checklist

1. Resend -> Domains: `growxq.com` shows Verified.
2. Supabase -> Authentication -> Emails -> SMTP Settings: toggle on, values as in section 4, sender name `GrowXQ`.
3. Sign up with a throwaway address. Check:
   - From line reads `GrowXQ <insiders@growxq.com>`
   - Subject is "Confirm your GrowXQ email"
   - Logo shows (allow images in the mail client)
   - Button and "Click here" both confirm the account
4. Trigger password reset and magic link for the same test user and check the other templates.
5. Delete the test user afterwards (production data).

## 9. Known issues and follow-ups

- The Expertly network org showed a Supabase banner: quota exceeded, projects restricted from 2026-12-13 unless resolved. This is separate from email delivery.
- Production safety: all dashboard changes in this setup were made on the live project. Back up template HTML in the repo before future edits.
- Secrets (Resend key, Supabase access token) must stay out of the repo.