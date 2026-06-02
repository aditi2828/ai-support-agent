# Troology Cloud Platform — User Manual

## 1. Getting Started

To create an account, visit https://www.troology.com/ and click "Sign Up".
You will need a valid work email address. After signing up, you must verify
your email by clicking the link sent to your inbox. Verification links expire
after 24 hours. If your link expires, click "Resend verification" on the login
page.

## 2. Billing and Plans

Troology Cloud offers three plans: Free, Pro, and Enterprise.

- The Free plan includes 1 project, 500 MB of storage, and community support.
- The Pro plan costs $29 per user per month and includes unlimited projects,
  50 GB of storage, and email support with a 24-hour response time.
- The Enterprise plan is custom-priced and includes a dedicated account
  manager, SSO/SAML, and a 99.99% uptime SLA.

You can change your plan at any time from Settings > Billing. Downgrades take
effect at the end of the current billing cycle. Upgrades take effect
immediately and are prorated.

## 3. Resetting Your Password

If you forgot your password, click "Forgot password?" on the login page and
enter your email. You will receive a reset link valid for 1 hour. For security,
passwords must be at least 12 characters and contain one uppercase letter, one
number, and one special character.

## 4. API Keys and Rate Limits

You can generate API keys from Settings > Developer. Each account may have up to
10 active API keys. Free plan keys are limited to 60 requests per minute. Pro
plan keys allow 600 requests per minute. If you exceed your rate limit, the API
returns HTTP 429 with a Retry-After header indicating how many seconds to wait.

## 5. Data Export and Deletion

To export your data, go to Settings > Data and click "Request Export". Exports
are generated within 12 hours and delivered as a ZIP file via email. The
download link remains valid for 7 days.

To permanently delete your account, go to Settings > Data > Delete Account.
Deletion is irreversible and removes all projects and data after a 30-day grace
period, during which you may contact support to cancel the deletion.

## 6. Support Contact

Free plan users receive community support via the public forum. Pro and
Enterprise users can open tickets at support@acme.example. Enterprise customers
also have a 24/7 emergency phone line provided in their onboarding packet.
