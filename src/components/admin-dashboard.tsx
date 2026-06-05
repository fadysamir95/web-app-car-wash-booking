"use client";

import { useMemo, useState } from "react";
import { Check, LogOut, Search } from "lucide-react";
import { BOOKING_STATUSES, PAYMENT_STATUSES, SERVICE_CONFIG } from "@/lib/constants";
import type { Booking } from "@/lib/types";

export function AdminDashboard({ initialBookings }: { initialBookings: Booking[] }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [dateFilter, setDateFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesDate = !dateFilter || booking.bookingDate === dateFilter;
      const matchesArea = !areaFilter || booking.area === areaFilter;
      const matchesPayment = !paymentFilter || booking.paymentStatus === paymentFilter;
      const matchesQuery =
        !normalized ||
        booking.phoneNumber.toLowerCase().includes(normalized) ||
        booking.plateNumber.toLowerCase().includes(normalized);
      return matchesDate && matchesArea && matchesPayment && matchesQuery;
    });
  }, [bookings, dateFilter, areaFilter, paymentFilter, query]);

  const dailyCounts = useMemo(() => {
    return bookings.reduce<Record<string, number>>((acc, booking) => {
      if (booking.bookingStatus !== "Cancelled") {
        acc[booking.bookingDate] = (acc[booking.bookingDate] || 0) + 1;
      }
      return acc;
    }, {});
  }, [bookings]);

  async function updateBooking(id: string, updates: Partial<Pick<Booking, "paymentStatus" | "bookingStatus">>) {
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });

    if (!response.ok) return;
    const payload = (await response.json()) as { booking: Booking };
    setBookings((current) => current.map((booking) => (booking.id === id ? payload.booking : booking)));
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <main className="min-h-svh bg-slate-100 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-sky-700">Car Wash Booking</p>
            <h1 className="text-3xl font-black text-slate-950">Admin Dashboard</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric title="Total bookings" value={bookings.length} />
          <Metric title="Pending payments" value={bookings.filter((booking) => booking.paymentStatus === "Pending").length} />
          <Metric title="Confirmed payments" value={bookings.filter((booking) => booking.paymentStatus === "Confirmed").length} />
        </section>

        <section className="mt-4 grid gap-3 rounded-[8px] bg-white p-4 shadow-sm sm:grid-cols-5">
          <label>
            <span className="label">Date</span>
            <input className="field" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>
          <label>
            <span className="label">Area</span>
            <select className="field" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
              <option value="">All areas</option>
              {SERVICE_CONFIG.areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Payment</span>
            <select className="field" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
              <option value="">All statuses</option>
              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="label">Search phone or plate</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="field pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
            </span>
          </label>
        </section>

        <section className="mt-4 grid gap-3 rounded-[8px] bg-white p-4 shadow-sm sm:grid-cols-4">
          {Object.entries(dailyCounts).length === 0 ? (
            <p className="text-sm text-slate-500">No daily counters yet.</p>
          ) : (
            Object.entries(dailyCounts).map(([date, count]) => (
              <div key={date} className="rounded-[8px] border border-slate-200 p-3">
                <p className="text-sm font-black text-slate-950">{date}</p>
                <p className={`mt-1 text-sm font-bold ${count >= SERVICE_CONFIG.maxBookingsPerDay ? "text-red-600" : "text-slate-600"}`}>
                  {count}/{SERVICE_CONFIG.maxBookingsPerDay} bookings
                </p>
              </div>
            ))
          )}
        </section>

        <section className="mt-4 grid gap-3">
          {filtered.map((booking) => (
            <article key={booking.id} className="rounded-[8px] bg-white p-4 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
                <div>
                  <h2 className="text-lg font-black text-slate-950">{booking.customerName}</h2>
                  <p className="mt-1 text-sm text-slate-600">{booking.phoneNumber}</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {booking.carType} - {booking.plateNumber}
                  </p>
                </div>
                <div className="text-sm leading-6 text-slate-700">
                  <p>
                    <strong>Area:</strong> {booking.area}
                  </p>
                  <p>
                    <strong>Address:</strong> {booking.address}, Building {booking.buildingNumber}
                  </p>
                  <a className="font-bold text-sky-700" href={booking.carLocation} target="_blank" rel="noreferrer">
                    Open location
                  </a>
                </div>
                <div className="text-sm leading-6 text-slate-700">
                  <p>
                    <strong>Date:</strong> {booking.bookingDate}
                  </p>
                  <p>
                    <strong>Window:</strong> {booking.bookingTimeWindow}
                  </p>
                  <p>
                    <strong>Created:</strong> {new Date(booking.createdAt).toLocaleString("en-EG")}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label>
                  <span className="label">Payment status</span>
                  <select
                    className="field"
                    value={booking.paymentStatus}
                    onChange={(event) => updateBooking(booking.id, { paymentStatus: event.target.value as Booking["paymentStatus"] })}
                  >
                    {PAYMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label">Booking status</span>
                  <select
                    className="field"
                    value={booking.bookingStatus}
                    onChange={(event) => updateBooking(booking.id, { bookingStatus: event.target.value as Booking["bookingStatus"] })}
                  >
                    {BOOKING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => updateBooking(booking.id, { paymentStatus: "Confirmed", bookingStatus: "Confirmed" })}
                  className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-[8px] bg-emerald-500 px-4 text-sm font-black text-white"
                >
                  <Check className="h-4 w-4" />
                  Confirm
                </button>
              </div>

              {booking.notes || booking.promoCode ? (
                <p className="mt-3 text-sm text-slate-600">
                  {booking.promoCode ? <strong>Promo: {booking.promoCode}. </strong> : null}
                  {booking.notes}
                </p>
              ) : null}
            </article>
          ))}

          {filtered.length === 0 ? (
            <div className="rounded-[8px] bg-white p-8 text-center text-sm font-bold text-slate-500">No bookings match these filters.</div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-[8px] bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}
