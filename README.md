# VAYAX

Mobile-first web app for VAYAX car care bookings in New October City, Giza.

Slogan: `Your car, our care`

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Local JSON data store for development
- Signed cookie admin session

The local JSON store is intentionally isolated in `src/lib/store.ts`, so it can later be replaced with Supabase, Firebase, PostgreSQL, or another production database without rewriting the booking UI.

## Features

- Arabic and English language selection on first visit
- Saved language preference with RTL/LTR switching
- Header language switcher across customer and admin pages
- Customer booking form with client and server validation
- Four-step booking wizard: customer, car location, car information, booking date
- OTP phone verification before booking
- Returning customer shortcut to reuse previous booking data
- Multiple previous car selection for repeat customers
- Rebook previous service from the My Bookings page
- Loyalty rewards: every completed wash earns 10 points, and 100 points can be redeemed for a free wash
- Supported service scope only: Giza, New October City, Degla Palms, 800 Feddan, Sakan Misr, Ebni Betak
- Browser geolocation helper with Google Maps link fallback
- Building number required, street name and GPS/Maps location optional
- Tomorrow-first booking date rule
- 12:00 AM to 5:00 AM booking window shown beside dates
- Required customer acknowledgement of the wash time window
- Maximum 20 active bookings per day
- Confirmation page payment flow with Instapay helper, copy number, and WhatsApp transfer proof message
- My Bookings page with latest device booking shortcut and booking tracking
- Worker and service rating after completed bookings, with optional feedback
- Protected admin dashboard
- Customers, bookings, revenue, smart offers, complaints, settings, workers, and next-day operations admin views
- Admin filters by date, area, and search with reset
- Search by phone, name, or plate number
- Booking status updates
- Delete single booking/customer and delete all bookings/customers with confirmation
- Bulk delete all bookings/customers requires the current admin password
- Daily booking counters
- Admin notification history with unread badge, show all, and clear all
- Worker dashboard with proof photo upload before marking a wash completed
- Worker GPS location updates from the worker dashboard when browser location permission is granted
- Admin worker location visibility and ETA estimates for next-dawn bookings when GPS coordinates are available
- Car photo upload and admin preview
- Built-in AI-style customer support widget for booking, pricing, payment, rewards, complaints, and booking-status questions
- Assistant replies in Arabic or English based on the customer message and can send customers to the relevant page
- Dark mode support
- Server-side validation, honeypot spam field, and basic in-memory rate limiting

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

## Admin Credentials

Local development credentials are stored in `.env.local`:

```env
ADMIN_PASSWORD=change-this
ADMIN_SESSION_SECRET=change-this-to-a-long-random-value
WORKER_PASSWORD=worker-dev-password
```

Change these values before any real deployment. `WORKER_PASSWORD` is used as the default worker password/fallback when the local worker data file is first created. After adding real workers from the admin dashboard, each worker can have a separate password.

## Data Storage

Bookings are stored locally in:

```text
data/bookings.json
```

This file is ignored by git because it contains customer data.

Stored booking fields include customer name, phone number, car brand, model, color, manufacture year, plate number, optional car photo data, area, address, building number, car location, booking date, time window, promo code, loyalty reward fields, payment status, booking status, worker rating, service rating, completed worker name, and created date.

The current development model also stores marketing-ready fields such as marketing consent, loyalty points, customer ID, language source, governorate, city, and area assignment.

## Loyalty Rewards

- Each completed wash awards `10` loyalty points.
- Customers can redeem `100` points for one free wash.
- Loyalty redemption is applied server-side during booking creation.

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
