# Environment Variables Documentation

## Required Keys (Optional Feature: Contact Form)

The only environment variables used in this package belong to the contact form on the **About Us** page (`app/about-us/page.tsx`).

### Variables:

1. `NEXT_PUBLIC_EMAILJS_SERVICE_ID`
   - **Used By**: `app/about-us/page.tsx`
   - **Description**: EmailJS Service ID to receive contact form submissions.

2. `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`
   - **Used By**: `app/about-us/page.tsx`
   - **Description**: EmailJS Template ID for formatting submitted emails.

3. `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`
   - **Used By**: `app/about-us/page.tsx`
   - **Description**: EmailJS account public key.

---

### Fallback Behavior:
If these variables are omitted or kept as placeholders, the contact form handles missing keys gracefully by displaying an informative error message without crashing the application. All other features on **Intelligence** and **About Us** function normally without any environment configuration.
