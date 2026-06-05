# Car Wash Booking

Mobile-first web app for overnight car wash bookings in New October City, Giza.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Local JSON data store for development
- Signed cookie admin session

The local JSON store is intentionally isolated in `src/lib/store.ts`, so it can later be replaced with Supabase, Firebase, PostgreSQL, or another production database without rewriting the booking UI.

## Features

- Customer booking form with required validation
- Supported service scope only: Giza, New October City, Degla Palms, 800 Feddan, Sakan Misr, Ebni Betak
- Browser geolocation helper with Google Maps link fallback
- Tomorrow-first booking date rule
- 12:00 AM to 5:00 AM booking window shown beside dates
- Maximum 20 active bookings per day
- Payment pending confirmation flow
- Instapay helper deep link and WhatsApp transfer proof message
- Protected admin dashboard
- Admin filters by date, area, payment status
- Search by phone or plate number
- Payment and booking status updates
- Daily booking counters

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
```

Change both values before any real deployment.

## Data Storage

Bookings are stored locally in:

```text
data/bookings.json
```

This file is ignored by git because it contains customer data.

Stored booking fields include customer name, phone number, car type, plate number, area, address, building number, car location, booking date, time window, promo code, payment status, booking status, and created date.

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
  customer_name text not null,
  phone_number text not null,
  car_type text not null,
  plate_number text not null,
  car_image_url text,
  area text not null,
  address text not null,
  building_number text not null,
  car_location text not null,
  booking_date date not null,
  booking_time_window text not null,
  notes text,
  promo_code text,
  payment_status text not null default 'Pending',
  booking_status text not null default 'Pending',
  created_at timestamptz not null default now()
);
```

Add a partial unique/capacity enforcement strategy in production using a transaction or database function so two simultaneous requests cannot exceed 20 bookings for the same day.
