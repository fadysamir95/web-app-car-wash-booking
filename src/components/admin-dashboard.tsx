"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Check, ExternalLink, LogOut, Search, Users } from "lucide-react";
import { BOOKING_STATUSES, DEFAULT_SERVICE, PAYMENT_STATUSES, SERVICE_AREAS, SERVICE_CONFIG } from "@/lib/constants";
import type { Booking, CustomerSummary } from "@/lib/types";
import { useLanguage } from "./language-provider";
import { LanguageSwitcher } from "./language-switcher";

type Tab = "customers" | "bookings" | "analytics";

export function AdminDashboard({ initialBookings }: { initialBookings: Booking[] }) {
  const { language, dir, t } = useLanguage();
  const [bookings, setBookings] = useState(initialBookings);
  const [tab, setTab] = useState<Tab>("bookings");
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
        (booking.plateNumber || "").toLowerCase().includes(normalized);
      return matchesDate && matchesArea && matchesPayment && matchesQuery;
    });
  }, [bookings, dateFilter, areaFilter, paymentFilter, query]);

  const customers = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();
    for (const booking of bookings) {
      const existing = map.get(booking.phoneNumber);
      if (!existing) {
        map.set(booking.phoneNumber, {
          customerId: booking.customerId,
          customerName: booking.customerName,
          phoneNumber: booking.phoneNumber,
          carBrand: booking.carBrand,
          carModel: booking.carModel,
          carColor: booking.carColor,
          plateNumber: booking.plateNumber,
          area: booking.areaName || booking.area,
          totalBookings: 1,
          lastBookingDate: booking.bookingDate,
          loyaltyPoints: booking.loyaltyPoints
        });
      } else {
        existing.totalBookings += 1;
        if (booking.bookingDate > existing.lastBookingDate) {
          existing.lastBookingDate = booking.bookingDate;
          existing.area = booking.areaName || booking.area;
        }
      }
    }
    return [...map.values()].sort((a, b) => b.lastBookingDate.localeCompare(a.lastBookingDate));
  }, [bookings]);

  const dailyCounts = useMemo(() => {
    return bookings.reduce<Record<string, number>>((acc, booking) => {
      if (booking.bookingStatus !== "Cancelled") acc[booking.bookingDate] = (acc[booking.bookingDate] || 0) + 1;
      return acc;
    }, {});
  }, [bookings]);

  const topAreas = useMemo(() => {
    const counts = bookings.reduce<Record<string, number>>((acc, booking) => {
      const label = areaLabel(booking.area, language);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [bookings, language]);

  const confirmedRevenue = bookings.filter((booking) => booking.paymentStatus === "Verified").length * DEFAULT_SERVICE.priceEgp;
  const repeatCustomers = customers.filter((customer) => customer.totalBookings > 1).length;

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
    <main className="min-h-svh bg-slate-100 px-4 py-5 dark:bg-slate-950 sm:px-6" dir={dir}>
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-sky-700">{t("brand")}</p>
            <h1 className="text-3xl font-black text-slate-950 dark:text-white">{t("adminDashboard")}</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
              <ExternalLink className="h-4 w-4" />
              View Website
            </Link>
            <LanguageSwitcher />
            <button type="button" onClick={logout} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white dark:bg-white dark:text-slate-950">
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-5">
          <Metric title={t("totalCustomers")} value={customers.length} />
          <Metric title={t("totalBookings")} value={bookings.length} />
          <Metric title={t("pendingPayments")} value={bookings.filter((booking) => booking.paymentStatus === "Pending").length} />
          <Metric title={t("confirmedPayments")} value={bookings.filter((booking) => booking.paymentStatus === "Verified").length} />
          <Metric title={t("revenue")} value={`${confirmedRevenue} EGP`} />
        </section>

        <nav className="mt-5 flex gap-2 overflow-x-auto rounded-[8px] bg-white p-2 shadow-sm dark:bg-slate-900">
          <TabButton active={tab === "customers"} onClick={() => setTab("customers")} icon={<Users className="h-4 w-4" />} label={t("customers")} />
          <TabButton active={tab === "bookings"} onClick={() => setTab("bookings")} icon={<Check className="h-4 w-4" />} label={t("bookings")} />
          <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")} icon={<BarChart3 className="h-4 w-4" />} label={t("analytics")} />
        </nav>

        {tab === "bookings" ? (
          <>
            <Filters
              dateFilter={dateFilter}
              areaFilter={areaFilter}
              paymentFilter={paymentFilter}
              query={query}
              setDateFilter={setDateFilter}
              setAreaFilter={setAreaFilter}
              setPaymentFilter={setPaymentFilter}
              setQuery={setQuery}
            />
            <section className="mt-4 grid gap-3">
              {filtered.map((booking) => (
                <article key={booking.id} className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
                  <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
                    <div>
                      <h2 className="text-lg font-black text-slate-950 dark:text-white">{booking.customerName}</h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{booking.phoneNumber}</p>
                      <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                        {booking.carBrand} {booking.carModel} - {booking.carColor}
                        {booking.plateNumber ? ` - ${booking.plateNumber}` : ""}
                      </p>
                    </div>
                    <div className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                      <p>
                        <strong>{t("assignedArea")}:</strong> {areaLabel(booking.area, language)}
                      </p>
                      <p>
                        <strong>{t("detailedAddress")}:</strong> {booking.address || "-"} {booking.buildingNumber ? `, ${booking.buildingNumber}` : ""}
                      </p>
                      {booking.carLocation ? (
                        <a className="font-bold text-sky-700" href={booking.carLocation} target="_blank" rel="noreferrer">
                          {t("carLocation")}
                        </a>
                      ) : null}
                    </div>
                    <div className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                      <p>
                        <strong>{t("bookingDate")}:</strong> {booking.bookingDate}
                      </p>
                      <p>
                        <strong>{t("paymentStatus")}:</strong> {booking.paymentStatus}
                      </p>
                      <p>
                        <strong>{t("bookingStatus")}:</strong> {booking.bookingStatus}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <StatusSelect label={t("paymentStatus")} value={booking.paymentStatus} options={PAYMENT_STATUSES} onChange={(value) => updateBooking(booking.id, { paymentStatus: value as Booking["paymentStatus"] })} />
                    <StatusSelect label={t("bookingStatus")} value={booking.bookingStatus} options={BOOKING_STATUSES} onChange={(value) => updateBooking(booking.id, { bookingStatus: value as Booking["bookingStatus"] })} />
                    <button type="button" onClick={() => updateBooking(booking.id, { paymentStatus: "Verified", bookingStatus: "Confirmed" })} className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-[8px] bg-emerald-500 px-4 text-sm font-black text-white">
                      <Check className="h-4 w-4" />
                      {t("confirm")}
                    </button>
                  </div>
                </article>
              ))}
              {filtered.length === 0 ? <Empty text={t("noBookings")} /> : null}
            </section>
          </>
        ) : null}

        {tab === "customers" ? (
          <section className="mt-4 overflow-hidden rounded-[8px] bg-white shadow-sm dark:bg-slate-900">
            {customers.length === 0 ? (
              <Empty text={t("noCustomers")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-slate-50 text-start dark:bg-slate-800">
                    <tr>
                      {[t("fullName"), t("phoneNumber"), t("carBrand"), t("carModel"), t("carColor"), t("plateNumber"), t("area"), t("totalBookingsLabel"), t("lastBookingDate")].map((heading) => (
                        <th key={heading} className="p-3 text-start font-black text-slate-600 dark:text-slate-200">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.phoneNumber} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-3 font-bold text-slate-950 dark:text-white">{customer.customerName}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{customer.phoneNumber}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{customer.carBrand}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{customer.carModel}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{customer.carColor}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{customer.plateNumber || "-"}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{customer.area}</td>
                        <td className="p-3 font-black text-slate-950 dark:text-white">{customer.totalBookings}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{customer.lastBookingDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {tab === "analytics" ? (
          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <AnalyticsCard title={t("bookingsPerDay")} items={Object.entries(dailyCounts).map(([date, count]) => [`${date}`, `${count}/${SERVICE_CONFIG.maxBookingsPerDay}`])} />
            <AnalyticsCard title={t("topAreas")} items={topAreas.map(([area, count]) => [area, String(count)])} />
            <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
              <p className="text-sm font-bold text-slate-500">{t("repeatCustomers")}</p>
              <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{repeatCustomers}</p>
              <p className="mt-4 text-sm font-bold text-slate-500">{t("revenue")}</p>
              <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{confirmedRevenue} EGP</p>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Filters(props: {
  dateFilter: string;
  areaFilter: string;
  paymentFilter: string;
  query: string;
  setDateFilter: (value: string) => void;
  setAreaFilter: (value: string) => void;
  setPaymentFilter: (value: string) => void;
  setQuery: (value: string) => void;
}) {
  const { language, t } = useLanguage();
  return (
    <section className="mt-4 grid gap-3 rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900 sm:grid-cols-5">
      <label>
        <span className="label">{t("bookingDate")}</span>
        <input className="field" type="date" value={props.dateFilter} onChange={(event) => props.setDateFilter(event.target.value)} />
      </label>
      <label>
        <span className="label">{t("area")}</span>
        <select className="field" value={props.areaFilter} onChange={(event) => props.setAreaFilter(event.target.value)}>
          <option value="">{t("allAreas")}</option>
          {SERVICE_AREAS.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name[language]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">{t("paymentStatus")}</span>
        <select className="field" value={props.paymentFilter} onChange={(event) => props.setPaymentFilter(event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="label">{t("search")}</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" />
          <input className="field pl-9 rtl:pl-3 rtl:pr-9" value={props.query} onChange={(event) => props.setQuery(event.target.value)} />
        </span>
      </label>
    </section>
  );
}

function Metric({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-10 items-center gap-2 rounded-[8px] px-4 text-sm font-black ${active ? "bg-sky-600 text-white" : "bg-transparent text-slate-600 dark:text-slate-300"}`}>
      {icon}
      {label}
    </button>
  );
}

function StatusSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function AnalyticsCard({ title, items }: { title: string; items: string[][] }) {
  return (
    <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
      <h2 className="text-lg font-black text-slate-950 dark:text-white">{title}</h2>
      <div className="mt-4 grid gap-2">
        {items.length === 0 ? <p className="text-sm text-slate-500">-</p> : null}
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-[8px] bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <span className="font-bold text-slate-700 dark:text-slate-200">{label}</span>
            <span className="font-black text-slate-950 dark:text-white">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-[8px] bg-white p-8 text-center text-sm font-bold text-slate-500 dark:bg-slate-900">{text}</div>;
}

function areaLabel(areaId: string, language: "en" | "ar") {
  return SERVICE_AREAS.find((area) => area.id === areaId)?.name[language] || areaId;
}
