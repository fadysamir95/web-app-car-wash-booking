# VAYAX

Mobile-first web app for VAYAX car care bookings in New October City, Giza.

Slogan: `Your car, our care`

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Local JSON data store for development
- Signed cookie admin session
- CSRF-protected admin mutations
- Built-in Node test runner for booking-rule tests

The local JSON store is intentionally isolated in `src/lib/store.ts`, so it can later be replaced with Supabase, Firebase, PostgreSQL, or another production database without rewriting the booking UI.

## Features

- Arabic and English language selection on first visit
- Saved language preference with RTL/LTR switching
- Header language switcher across customer and admin pages
- Customer booking form with client and server validation
- Four-step booking wizard: customer, car location, car information, booking date
- OTP phone verification before booking with per-phone/IP rate limits and translated limit messages
- Final confirmation modal before booking submission
- Returning customer shortcut to reuse previous booking data
- Multiple previous car selection for repeat customers
- Maximum 3 saved cars per customer phone number
- Rebook previous service from the My Bookings page
- Loyalty rewards: every completed wash earns 10 points, and 100 points can be redeemed for a free wash
- Supported service scope only: Giza, New October City, Degla Palms, 800 Feddan, Sakan Misr, Ebni Betak
- Browser geolocation helper with Google Maps link fallback
- Building number required, street name and GPS/Maps location optional
- Tomorrow-first booking date rule
- 12:00 AM to 5:00 AM booking window shown beside dates
- Required customer acknowledgement of the wash time window
- Maximum 20 active bookings per day
- Duplicate plate prevention for the same booking date
- Confirmation page payment flow with Instapay helper, copy number, and WhatsApp transfer proof message
- Free bookings skip payment buttons and move directly to confirmed bookings
- My Bookings page with latest device booking shortcut, booking tracking, status badges, and payment countdown
- My Bookings shows loyalty points only when searching by phone number; reference search shows a hint to search by phone for points
- Worker and service rating after completed bookings, with optional feedback
- Complaint form appears after low service ratings
- Protected admin dashboard
- Customers, bookings, revenue, smart offers, complaints, settings, workers, and next-day operations admin views
- Admin filters by date, area, and search with reset
- Search by phone, name, or plate number
- Booking status updates with confirmation prompts for important actions
- Delete single booking/customer and delete all bookings/customers with confirmation
- Bulk delete all bookings/customers requires the current admin password
- Daily booking counters
- Admin notification history with unread badge, show all, and clear all
- Worker dashboard with proof photo upload before marking a wash completed
- Worker GPS location updates from the worker dashboard when browser location permission is granted
- Admin worker location visibility and ETA estimates for next-dawn bookings when GPS coordinates are available
- Car photo upload and admin preview
- Wash proof image shown to the customer after completion
- Built-in AI-style customer support widget for booking, pricing, payment, rewards, complaints, and booking-status questions
- Assistant replies in Arabic or English based on the customer message and can send customers to the relevant page
- Branded VAYAX homepage with FAQ section for search visibility
- Consistent VAYAX visual system, polished status badges, and burnout-style loaders for larger loading states
- PWA manifest and SEO basics including metadata, sitemap, and robots config
- Dark mode support
- Server-side validation, honeypot spam field, CSRF protection for admin actions, and in-memory rate limiting by IP/phone

## Booking Flow

1. Customer enters phone number and verifies it using OTP.
2. Returning customers can reuse previous details or choose a saved car.
3. Customer chooses area, building number, optional street/GPS location, car details, and booking date.
4. Promo code and loyalty rewards are validated before final price is shown.
5. The final submit button opens a confirmation modal before the booking is created.
6. After booking, the customer is redirected to the confirmation page with the booking reference and payment instructions when payment is required.

Booking rules:

- Booking dates must be allowed by the current operating cutoff.
- Booking closes for a wash date when that wash day starts at `12:00 AM`.
- Each day has a configurable maximum capacity.
- Plate numbers cannot be duplicated on the same booking date.
- The same phone number cannot save more than 3 cars.
- Pending paid bookings expire automatically after 3 hours if payment is not confirmed.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open:

- Customer app: `http://localhost:3000`
- Admin dashboard: `http://localhost:3000/admin`
- Worker dashboard: `http://localhost:3000/worker`
- My Bookings: `http://localhost:3000/my-booking`

Run checks:

```bash
npm run lint
npm test
npm run build
```

## Admin Credentials

Local development credentials are stored in `.env.local`:

```env
ADMIN_PASSWORD=change-this
ADMIN_SESSION_SECRET=change-this-to-a-long-random-value
WORKER_PASSWORD=worker-dev-password
```

Change these values before any real deployment. `WORKER_PASSWORD` is used as the default worker password/fallback when the local worker data file is first created. After adding real workers from the admin dashboard, each worker can have a separate password.

The admin session expires after idle time for security. Worker sessions are longer because workers may keep the route page open during operations.

## Data Storage

Bookings are stored locally in:

```text
data/bookings.json
```

This file is ignored by git because it contains customer data.

Stored booking fields include customer name, phone number, car brand, model, color, manufacture year, plate number, optional car photo data, area, address, building number, car location, booking date, time window, promo code, loyalty reward fields, payment status, booking status, worker rating, service rating, completed worker name, and created date.

The current development model also stores marketing-ready fields such as marketing consent, loyalty points, customer ID, language source, governorate, city, and area assignment.

Other local development files:

```text
data/promos.json
data/settings.json
data/workers.json
data/otp.json
data/admin-security.json
```

These are for local development only. Move them to a real database/storage layer before production.

## Admin Dashboard

The admin dashboard includes:

- Customers with edit/delete and export tools
- All bookings, pending bookings, confirmed bookings, cancelled bookings, and completed washes
- Revenue view with hidden/revealable values
- Promo code management with amount or percentage discounts and expiry dates
- General settings for service price fallback, payment number, capacity, areas, area prices, and wash window
- Smart campaign segments for marketing
- Complaints page
- Worker management with individual passwords, areas, edit/delete, completed wash count, last activity, ratings, and GPS data
- Next-dawn bookings view with area counters, worker assignment, proof image support, and end-of-dawn report
- Notification history with unread badge, scrollable list, show all, and clear all

Admin destructive actions such as clearing all bookings/customers require the current admin password. Admin mutation requests are protected with a signed session plus a CSRF token.

## Worker Dashboard

Workers sign in through `/worker` with their own passwords. A worker can:

- View assigned confirmed bookings
- See route progress and suggested route map
- Mark a wash as completed only after uploading proof photo
- Send an unable-to-reach report to the admin
- Share GPS location for admin visibility and ETA calculation

Workers do not see customer phone numbers and do not have access to the admin dashboard.

## Loyalty Rewards

- Each completed wash awards `10` loyalty points.
- Customers can redeem `100` points for one free wash.
- Loyalty redemption is applied server-side during booking creation.
- The points balance is shown in My Bookings when the customer searches by phone number.
- Searching by booking reference shows that booking only, plus a hint to search by phone to see points.

## Promo Codes

- Promo codes can discount by fixed EGP amount or by percentage.
- Promo codes can have expiry dates and active/inactive status.
- Invalid promo codes show a clear form error.
- Correct promo codes update the final price before booking submission.
- If the final price becomes `0 EGP`, the booking is confirmed without payment instructions.

## Worker GPS and ETA

- The worker dashboard requests browser geolocation permission.
- If allowed, worker coordinates are securely posted to `/api/worker/location`.
- Admin worker cards show the latest GPS update and a map link.
- Next-dawn booking cards show ETA when both worker GPS and the customer car location contain coordinates.

## AI Customer Support

The current assistant is a local rule-based support endpoint at `/api/assistant`. It answers common questions about:

- Booking flow
- Pricing
- Payment instructions
- Rewards
- Complaints
- Booking status by phone number or booking reference
- Smart navigation to booking, tracking, payment, rewards, or complaint flows

This can later be upgraded to a real LLM provider without changing the customer-facing widget.

## Security Notes

Current local/dev protections:

- Admin dashboard protected by signed cookie session
- Admin mutation routes protected with CSRF token checks
- Admin login and password-change rate limits
- Worker login protected by worker-specific credentials
- OTP send/verify rate limits by phone and IP
- Booking submission rate limits by phone and IP
- Server-side validation for booking input
- Honeypot spam field
- Current admin password required before clearing all bookings/customers

Production recommendations:

- Move data from JSON files to a real database
- Store images in object storage
- Add HTTPS-only cookies in deployment
- Add CAPTCHA/Turnstile to OTP and booking flows if spam appears
- Add database-level unique constraints and capacity transactions
- Add audit logs for admin actions
- Add separate admin accounts instead of sharing one password

## Tests

The project includes lightweight booking-rule tests using Node's built-in test runner:

- Daily capacity blocks the 21st booking
- Duplicate plate is blocked on the same date
- OTP token behavior around failed/successful submission
- Loyalty points and free-wash redemption

Run:

```bash
npm test
```

## Production Upgrade Path

Recommended production stack:

- Database: Supabase Postgres or managed PostgreSQL
- Storage: Supabase Storage for optional car images
- Auth: Supabase Auth, Clerk, or NextAuth for admin users
- Spam protection: Turnstile or reCAPTCHA, plus per-phone and per-IP rate limiting
- Deployment: Vercel or a Node-capable host

Suggested database table:

```sql
create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  customer_name text not null,
  phone_number text not null,
  car_brand text not null,
  car_model text not null,
  car_color text not null,
  car_year text,
  plate_number text,
  car_image_url text,
  governorate text not null,
  city text not null,
  area text not null,
  area_name text not null,
  address text,
  building_number text,
  car_location text,
  booking_date date not null,
  booking_time_window text not null,
  notes text,
  promo_code text,
  loyalty_points integer not null default 0,
  loyalty_points_earned integer default 0,
  loyalty_reward_redeemed boolean not null default false,
  completed_by_worker_name text,
  worker_rating integer,
  worker_feedback text,
  marketing_consent boolean not null default true,
  source_language text not null default 'en',
  payment_status text not null default 'Pending',
  booking_status text not null default 'Pending',
  created_at timestamptz not null default now()
);
```

Add a partial unique/capacity enforcement strategy in production using a transaction or database function so two simultaneous requests cannot exceed 20 bookings for the same day.
