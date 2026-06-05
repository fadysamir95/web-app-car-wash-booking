"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, Bell, Check, Download, ExternalLink, LogOut, Pencil, Save, Search, Send, Smartphone, Trash2, Users, X } from "lucide-react";
import { BOOKING_STATUSES, DEFAULT_SERVICE, PROMO_CODES, SERVICE_AREAS, SERVICE_CONFIG } from "@/lib/constants";
import { formatDisplayDate } from "@/lib/date";
import type { Booking, CustomerSummary, PromoCode } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n";
import { useLanguage } from "./language-provider";
import { LanguageSwitcher } from "./language-switcher";

type Tab = "customers" | "allBookings" | "pendingBookings" | "confirmedBookings" | "cancelledBookings" | "completedWashes" | "promoCodes" | "revenue";
type NotificationItem = {
  id: string;
  text: string;
  createdAt: string;
};
type PendingDelete =
  | { type: "booking"; id: string; label: string }
  | { type: "customer"; phoneNumber: string; label: string };

export function AdminDashboard({ initialBookings }: { initialBookings: Booking[] }) {
  const { language, dir, t } = useLanguage();
  const [bookings, setBookings] = useState(initialBookings);
  const [tab, setTab] = useState<Tab>("confirmedBookings");
  const [dateFilter, setDateFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [query, setQuery] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<CustomerSummary | null>(null);
  const [editingCustomerPhone, setEditingCustomerPhone] = useState("");
  const [newBookingAlert, setNewBookingAlert] = useState<Booking | null>(null);
  const [notificationHistoryOpen, setNotificationHistoryOpen] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState<NotificationItem[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [toast, setToast] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [analyticsNow, setAnalyticsNow] = useState("");
  const [promos, setPromos] = useState<PromoCode[]>(PROMO_CODES.map((promo) => ({ ...promo, active: true })));
  const [promoForm, setPromoForm] = useState({ code: "", label: "", discountEgp: "25", expiresAt: "" });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const knownBookingIds = useRef(new Set(initialBookings.map((booking) => booking.id)));

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesDate = !dateFilter || booking.bookingDate === dateFilter;
      const matchesArea = !areaFilter || booking.area === areaFilter;
      const matchesQuery =
        !normalized ||
        booking.customerName.toLowerCase().includes(normalized) ||
        booking.phoneNumber.toLowerCase().includes(normalized) ||
        (booking.plateNumber || "").toLowerCase().includes(normalized);
      return matchesDate && matchesArea && matchesQuery;
    });
  }, [bookings, dateFilter, areaFilter, query]);

  const displayedBookings = useMemo(() => {
    if (tab === "pendingBookings") return filtered.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Pending");
    if (tab === "confirmedBookings") return filtered.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Confirmed");
    if (tab === "cancelledBookings") return filtered.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Cancelled");
    if (tab === "completedWashes") return filtered.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Completed");
    return filtered;
  }, [filtered, tab]);

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

  const confirmedRevenue = bookings
    .filter((booking) => booking.paymentStatus === "Verified")
    .reduce((total, booking) => total + bookingFinalPrice(booking), 0);
  const analyticsTime = analyticsNow ? new Date(analyticsNow).getTime() : 0;
  const todayValue = analyticsNow.slice(0, 10);
  const weekAgoValue = analyticsTime ? new Date(analyticsTime - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : "";
  const monthAgoValue = analyticsTime ? new Date(analyticsTime - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : "";
  const revenueToday = revenueSince(bookings, todayValue);
  const revenueWeek = revenueSince(bookings, weekAgoValue);
  const revenueMonth = revenueSince(bookings, monthAgoValue);
  const freeBookings = bookings.filter((booking) => bookingFinalPrice(booking) === 0).length;
  const repeatCustomers = customers.filter((customer) => customer.totalBookings > 1).length;
  const pendingBookings = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Pending").length;
  const confirmedBookings = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Confirmed").length;
  const cancelledBookings = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Cancelled").length;
  const completedWashes = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Completed").length;
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) || null;
  const capacityWarnings = useMemo(() => {
    const warningAt = SERVICE_CONFIG.maxBookingsPerDay - 2;
    return Object.entries(dailyCounts)
      .filter(([, count]) => count >= warningAt)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [dailyCounts]);

  async function updateBooking(id: string, updates: Partial<Pick<Booking, "bookingStatus">>) {
    const oldBooking = bookings.find((booking) => booking.id === id);
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });

    if (!response.ok) return;
    const payload = (await response.json()) as { booking: Booking };
    setBookings((current) => current.map((booking) => (booking.id === id ? payload.booking : booking)));
    if (oldBooking && updates.bookingStatus) {
      const message =
        t("bookingMoved")
          .replace("{reference}", oldBooking.id)
          .replace("{customer}", oldBooking.customerName)
          .replace("{car}", [oldBooking.carBrand, oldBooking.carModel, oldBooking.carColor].filter(Boolean).join(" "))
          .replace("{from}", bookingStatusLabel(oldBooking.bookingStatus, language))
          .replace("{to}", bookingStatusLabel(payload.booking.bookingStatus, language));
      notify(message);
    }
  }

  async function deleteBooking(id: string) {
    const response = await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    const payload = (await response.json()) as { bookings: Booking[] };
    setBookings(payload.bookings);
    if (selectedBookingId === id) setSelectedBookingId("");
    notify(t("bookingDeleted").replace("{reference}", id));
  }

  async function runPrimaryBookingAction(booking: Booking) {
    const action = primaryBookingAction(booking);
    if (!action) return;
    if (normalizedBookingStatus(booking.bookingStatus) === "Pending") {
      window.open(customerWhatsAppUrl(booking, language), "_blank", "noopener,noreferrer");
    }
    await updateBooking(booking.id, { bookingStatus: action.next });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  async function saveCustomer() {
    if (!editingCustomer) return;
    const response = await fetch(`/api/admin/customers/${encodeURIComponent(editingCustomerPhone)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingCustomer)
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { bookings: Booking[] };
    setBookings(payload.bookings);
    setEditingCustomer(null);
  }

  async function deleteCustomer(phoneNumber: string) {
    const response = await fetch(`/api/admin/customers/${encodeURIComponent(phoneNumber)}`, { method: "DELETE" });
    if (!response.ok) return;
    const payload = (await response.json()) as { bookings: Booking[] };
    setBookings(payload.bookings);
  }

  function requestDeleteBooking(booking: Booking) {
    setPendingDelete({ type: "booking", id: booking.id, label: `${booking.id} - ${booking.customerName}` });
  }

  function requestDeleteCustomer(customer: CustomerSummary) {
    setPendingDelete({ type: "customer", phoneNumber: customer.phoneNumber, label: `${customer.customerName} - ${customer.phoneNumber}` });
  }

  async function confirmPendingDelete() {
    if (!pendingDelete) return;
    const current = pendingDelete;
    setPendingDelete(null);
    if (current.type === "booking") await deleteBooking(current.id);
    else await deleteCustomer(current.phoneNumber);
  }

  function exportCustomersCsv() {
    const headers = ["Customer Name", "Phone Number", "Car Brand", "Car Model", "Car Color", "Plate Number", "Area", "Total Bookings", "Last Booking Date"];
    const rows = customers.map((customer) => [
      customer.customerName,
      customer.phoneNumber,
      customer.carBrand,
      customer.carModel,
      customer.carColor,
      customer.plateNumber || "",
      customer.area,
      String(customer.totalBookings),
      customer.lastBookingDate
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "car-wash-customers.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function sendSmsToAll() {
    const phones = customers.map((customer) => customer.phoneNumber).join(";");
    window.location.href = `sms:${phones}?body=${encodeURIComponent(t("campaignMessage"))}`;
  }

  async function prepareWhatsAppCampaign() {
    const phoneList = customers.map((customer) => `${customer.phoneNumber} - ${customer.customerName}`).join("\n");
    await navigator.clipboard.writeText(`${t("campaignMessage")}\n\n${phoneList}`);
    notify(t("whatsAppCampaignCopied"));
    window.open(`https://wa.me/?text=${encodeURIComponent(t("campaignMessage"))}`, "_blank", "noopener,noreferrer");
  }

  async function addPromoCode() {
    const response = await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: promoForm.code,
        label: promoForm.label || promoForm.code,
        discountEgp: Number(promoForm.discountEgp || 0),
        expiresAt: promoForm.expiresAt ? `${promoForm.expiresAt}T23:59:59.999Z` : undefined,
        active: true
      })
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { promos: PromoCode[] };
    setPromos(payload.promos);
    setPromoForm({ code: "", label: "", discountEgp: "25", expiresAt: "" });
  }

  async function deletePromo(code: string) {
    const response = await fetch(`/api/admin/promos/${encodeURIComponent(code)}`, { method: "DELETE" });
    if (!response.ok) return;
    const payload = (await response.json()) as { promos: PromoCode[] };
    setPromos(payload.promos);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 4500);
  }

  function notify(message: string) {
    setNotificationHistory((current) => [
      { id: `${Date.now()}-${current.length}`, text: message, createdAt: new Date().toLocaleTimeString() },
      ...current
    ].slice(0, 20));
    showToast(message);
  }

  useEffect(() => {
    queueMicrotask(() => {
      if ("Notification" in window) setNotificationPermission(Notification.permission);
      setAnalyticsNow(new Date().toISOString());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/promos", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { promos: PromoCode[] }) => {
        if (!cancelled) setPromos(payload.promos || []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkNewBookings() {
      const response = await fetch("/api/admin/bookings", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { bookings: Booking[] };
      if (cancelled) return;

      const latestNewBooking = payload.bookings.find((booking) => !knownBookingIds.current.has(booking.id));
      knownBookingIds.current = new Set(payload.bookings.map((booking) => booking.id));
      setBookings(payload.bookings);

      if (latestNewBooking) {
        const message = `${t("newBookingAlert")}: ${latestNewBooking.customerName} - ${latestNewBooking.phoneNumber}`;
        setNewBookingAlert(latestNewBooking);
        setNotificationHistory((current) => [
          { id: `${Date.now()}-${latestNewBooking.id}`, text: message, createdAt: new Date().toLocaleTimeString() },
          ...current
        ].slice(0, 20));
        playNewBookingSound();
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(t("newBookingAlert"), {
            body: `${latestNewBooking.customerName} - ${latestNewBooking.phoneNumber}`
          });
        }
      }
    }

    const timer = window.setInterval(checkNewBookings, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [t]);

  async function enableNotifications() {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationHistoryOpen((current) => !current)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200"
                aria-label={t("notificationHistory")}
              >
                <Bell className="h-4 w-4" />
                {notificationHistory.length > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[0.65rem] font-black text-white">{notificationHistory.length}</span> : null}
              </button>
              {notificationHistoryOpen ? (
                <div className="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-[8px] bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 rtl:left-0 rtl:right-auto">
                  <div className="border-b border-slate-100 p-3 text-sm font-black text-slate-950 dark:border-slate-800 dark:text-white">{t("notificationHistory")}</div>
                  <div className="max-h-80 overflow-y-auto">
                    {notificationHistory.length === 0 ? (
                      <p className="p-4 text-sm font-bold text-slate-500">{t("noNotifications")}</p>
                    ) : (
                      notificationHistory.map((item) => (
                        <div key={item.id} className="border-b border-slate-100 p-3 text-sm last:border-0 dark:border-slate-800">
                          <p className="font-bold text-slate-800 dark:text-slate-100">{item.text}</p>
                          <p className="mt-1 text-xs font-bold text-slate-400">{item.createdAt}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <Link href="/" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
              <ExternalLink className="h-4 w-4" />
              View Website
            </Link>
            <Link href="/worker" className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-white px-4 text-sm font-black text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
              <ExternalLink className="h-4 w-4" />
              {t("workerBoard")}
            </Link>
            <LanguageSwitcher />
            <button type="button" onClick={logout} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white dark:bg-white dark:text-slate-950">
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-3">
          {newBookingAlert ? (
            <button
              type="button"
              onClick={() => {
                setTab("allBookings");
                setNewBookingAlert(null);
              }}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-emerald-300 bg-emerald-50 p-4 text-start text-sm font-black text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
            >
              <span>
                {t("newBookingAlert")}: {newBookingAlert.customerName} - {newBookingAlert.phoneNumber}
              </span>
              <Bell className="h-5 w-5" />
            </button>
          ) : null}
          {notificationPermission === "default" ? (
            <button type="button" onClick={enableNotifications} className="inline-flex h-10 w-fit items-center gap-2 rounded-[8px] bg-white px-4 text-sm font-black text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
              <Bell className="h-4 w-4" />
              {t("enableNotifications")}
            </button>
          ) : null}
          {capacityWarnings.length > 0 ? (
            <div className="grid gap-2">
              {capacityWarnings.map(([date, count]) => (
                <div key={date} className="flex items-center justify-between gap-3 rounded-[8px] border border-amber-300 bg-amber-50 p-4 text-sm font-black text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    {t("capacityWarning").replace("{date}", formatDisplayDate(date, language))}
                  </span>
                  <span>{count}/{SERVICE_CONFIG.maxBookingsPerDay}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="mt-5 grid gap-2 rounded-[8px] bg-white p-2 shadow-sm dark:bg-slate-900 sm:grid-cols-3 xl:grid-cols-8">
          <TabButton active={tab === "customers"} onClick={() => setTab("customers")} icon={<Users className="h-4 w-4" />} label={t("customers")} value={customers.length} />
          <TabButton active={tab === "allBookings"} onClick={() => setTab("allBookings")} icon={<Check className="h-4 w-4" />} label={t("allBookings")} value={bookings.length} />
          <TabButton active={tab === "pendingBookings"} onClick={() => setTab("pendingBookings")} icon={<Bell className="h-4 w-4" />} label={t("pendingBookings")} value={pendingBookings} />
          <TabButton active={tab === "confirmedBookings"} onClick={() => setTab("confirmedBookings")} icon={<Check className="h-4 w-4" />} label={t("confirmedBookings")} value={confirmedBookings} />
          <TabButton active={tab === "cancelledBookings"} onClick={() => setTab("cancelledBookings")} icon={<X className="h-4 w-4" />} label={t("cancelledBookings")} value={cancelledBookings} />
          <TabButton active={tab === "completedWashes"} onClick={() => setTab("completedWashes")} icon={<Check className="h-4 w-4" />} label={t("completedWashes")} value={completedWashes} />
          <TabButton active={tab === "promoCodes"} onClick={() => setTab("promoCodes")} icon={<Pencil className="h-4 w-4" />} label={t("promoCodes")} value={promos.length} />
          <TabButton active={tab === "revenue"} onClick={() => setTab("revenue")} icon={<BarChart3 className="h-4 w-4" />} label={t("revenue")} value={`${confirmedRevenue} EGP`} />
        </nav>

        {tab === "allBookings" || tab === "pendingBookings" || tab === "confirmedBookings" || tab === "cancelledBookings" || tab === "completedWashes" ? (
          <>
            <Filters
              dateFilter={dateFilter}
              areaFilter={areaFilter}
              query={query}
              setDateFilter={setDateFilter}
              setAreaFilter={setAreaFilter}
              setQuery={setQuery}
            />
            <section className="mt-4 grid gap-3">
              {displayedBookings.map((booking) => (
                <article key={booking.id} onClick={() => setSelectedBookingId(booking.id)} className="cursor-pointer rounded-[8px] bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-slate-900">
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
                        <strong>{t("bookingDate")}:</strong> {formatDisplayDate(booking.bookingDate, language)}
                      </p>
                      <p>
                        <strong>{t("bookingStatus")}:</strong> {bookingStatusLabel(booking.bookingStatus, language)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <div onClick={(event) => event.stopPropagation()}>
                      <StatusSelect label={t("bookingStatus")} value={normalizedBookingStatus(booking.bookingStatus)} options={BOOKING_STATUSES} language={language} onChange={(value) => updateBooking(booking.id, { bookingStatus: value as Booking["bookingStatus"] })} />
                    </div>
                    {primaryBookingAction(booking) ? (
                      <button type="button" onClick={(event) => { event.stopPropagation(); runPrimaryBookingAction(booking); }} className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-[8px] bg-emerald-500 px-4 text-sm font-black text-white">
                        <Check className="h-4 w-4" />
                        {t(primaryBookingAction(booking)!.label)}
                      </button>
                    ) : null}
                    <button type="button" onClick={(event) => { event.stopPropagation(); requestDeleteBooking(booking); }} className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-[8px] bg-rose-600 px-4 text-sm font-black text-white">
                      <Trash2 className="h-4 w-4" />
                      {t("delete")}
                    </button>
                  </div>
                </article>
              ))}
              {displayedBookings.length === 0 ? <Empty text={t("noBookings")} /> : null}
            </section>
          </>
        ) : null}

        {tab === "customers" ? (
          <section className="mt-4 overflow-hidden rounded-[8px] bg-white shadow-sm dark:bg-slate-900">
            <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
              <button type="button" onClick={exportCustomersCsv} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-sky-600 px-3 text-sm font-black text-white">
                <Download className="h-4 w-4" />
                {t("exportCustomers")}
              </button>
              <button type="button" onClick={sendSmsToAll} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-slate-950 px-3 text-sm font-black text-white dark:bg-white dark:text-slate-950">
                <Smartphone className="h-4 w-4" />
                {t("sendSmsAll")}
              </button>
              <button type="button" onClick={prepareWhatsAppCampaign} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-emerald-500 px-3 text-sm font-black text-white">
                <Send className="h-4 w-4" />
                {t("sendWhatsAppAll")}
              </button>
            </div>
            {customers.length === 0 ? (
              <Empty text={t("noCustomers")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-slate-50 text-start dark:bg-slate-800">
                    <tr>
                      {[t("fullName"), t("phoneNumber"), t("carBrand"), t("carModel"), t("carColor"), t("plateNumber"), t("area"), t("totalBookingsLabel"), t("lastBookingDate"), t("actions")].map((heading) => (
                        <th key={heading} className="p-3 text-start font-black text-slate-600 dark:text-slate-200">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.phoneNumber} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-3 font-bold text-slate-950 dark:text-white">{editingCustomerPhone === customer.phoneNumber && editingCustomer ? <SmallInput value={editingCustomer.customerName} onChange={(value) => setEditingCustomer({ ...editingCustomer, customerName: value })} /> : customer.customerName}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{editingCustomerPhone === customer.phoneNumber && editingCustomer ? <SmallInput value={editingCustomer.phoneNumber} onChange={(value) => setEditingCustomer({ ...editingCustomer, phoneNumber: value })} /> : customer.phoneNumber}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{editingCustomerPhone === customer.phoneNumber && editingCustomer ? <SmallInput value={editingCustomer.carBrand} onChange={(value) => setEditingCustomer({ ...editingCustomer, carBrand: value })} /> : customer.carBrand}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{editingCustomerPhone === customer.phoneNumber && editingCustomer ? <SmallInput value={editingCustomer.carModel} onChange={(value) => setEditingCustomer({ ...editingCustomer, carModel: value })} /> : customer.carModel}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{editingCustomerPhone === customer.phoneNumber && editingCustomer ? <SmallInput value={editingCustomer.carColor} onChange={(value) => setEditingCustomer({ ...editingCustomer, carColor: value })} /> : customer.carColor}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{editingCustomerPhone === customer.phoneNumber && editingCustomer ? <SmallInput value={editingCustomer.plateNumber || ""} onChange={(value) => setEditingCustomer({ ...editingCustomer, plateNumber: value })} /> : customer.plateNumber || "-"}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{customer.area}</td>
                        <td className="p-3 font-black text-slate-950 dark:text-white">{customer.totalBookings}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{formatDisplayDate(customer.lastBookingDate, language)}</td>
                        <td className="p-3">
                          {editingCustomerPhone === customer.phoneNumber ? (
                            <div className="flex gap-2">
                              <button type="button" onClick={saveCustomer} className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-emerald-500 px-3 text-xs font-black text-white"><Save className="h-3.5 w-3.5" />{t("save")}</button>
                              <button type="button" onClick={() => setEditingCustomer(null)} className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-slate-200 px-3 text-xs font-black text-slate-950"><X className="h-3.5 w-3.5" />{t("cancel")}</button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setEditingCustomer(customer); setEditingCustomerPhone(customer.phoneNumber); }} className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-sky-600 px-3 text-xs font-black text-white"><Pencil className="h-3.5 w-3.5" />{t("edit")}</button>
                              <button type="button" onClick={() => requestDeleteCustomer(customer)} className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-rose-600 px-3 text-xs font-black text-white"><Trash2 className="h-3.5 w-3.5" />{t("delete")}</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {tab === "promoCodes" ? (
          <section className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
              <h2 className="text-lg font-black text-slate-950 dark:text-white">{t("addPromoCode")}</h2>
              <div className="mt-4 grid gap-3">
                <label>
                  <span className="label">{t("promoCode")}</span>
                  <input className="field" value={promoForm.code} onChange={(event) => setPromoForm({ ...promoForm, code: event.target.value.toLowerCase() })} placeholder="free-wash" />
                </label>
                <label>
                  <span className="label">{t("promoLabel")}</span>
                  <input className="field" value={promoForm.label} onChange={(event) => setPromoForm({ ...promoForm, label: event.target.value })} />
                </label>
                <label>
                  <span className="label">{t("promoDiscount")}</span>
                  <input className="field" inputMode="numeric" value={promoForm.discountEgp} onChange={(event) => setPromoForm({ ...promoForm, discountEgp: event.target.value.replace(/\D/g, "") })} />
                </label>
                <label>
                  <span className="label">{t("promoExpiry")}</span>
                  <input className="field" type="date" value={promoForm.expiresAt} onChange={(event) => setPromoForm({ ...promoForm, expiresAt: event.target.value })} />
                </label>
                <button type="button" onClick={addPromoCode} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
                  {t("save")}
                </button>
              </div>
            </div>
            <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
              <h2 className="text-lg font-black text-slate-950 dark:text-white">{t("promoCodes")}</h2>
              <div className="mt-4 grid gap-2">
                {promos.map((promo) => (
                  <div key={promo.code} className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] bg-slate-50 p-3 text-sm dark:bg-slate-800">
                    <div>
                      <p className="font-black text-slate-950 dark:text-white">{promo.code}</p>
                      <p className="mt-1 font-bold text-slate-500">{promo.label} - {promo.discountEgp} EGP</p>
                    </div>
                    <button type="button" onClick={() => deletePromo(promo.code)} className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-rose-600 px-3 text-xs font-black text-white">
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("delete")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "revenue" ? (
          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <AnalyticsCard title={t("bookingsPerDay")} items={Object.entries(dailyCounts).map(([date, count]) => [formatDisplayDate(date, language), `${count}/${SERVICE_CONFIG.maxBookingsPerDay}`])} />
            <AnalyticsCard title={t("topAreas")} items={topAreas.map(([area, count]) => [area, String(count)])} />
            <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
              <p className="text-sm font-bold text-slate-500">{t("repeatCustomers")}</p>
              <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{repeatCustomers}</p>
              <p className="mt-4 text-sm font-bold text-slate-500">{t("revenue")}</p>
              <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{confirmedRevenue} EGP</p>
            </div>
            <AnalyticsCard
              title={t("revenue")}
              items={[
                [t("revenueToday"), `${revenueToday} EGP`],
                [t("revenueWeek"), `${revenueWeek} EGP`],
                [t("revenueMonth"), `${revenueMonth} EGP`],
                [t("freeBookings"), String(freeBookings)],
                [t("cancelledBookings"), String(cancelledBookings)]
              ]}
            />
          </section>
        ) : null}
      </div>
      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-[8px] bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-2xl dark:bg-white dark:text-slate-950">
          {toast}
        </div>
      ) : null}
      {selectedBooking ? (
        <BookingDetailsModal
          booking={selectedBooking}
          language={language}
          onClose={() => setSelectedBookingId("")}
          onDelete={() => requestDeleteBooking(selectedBooking)}
          onPrimaryAction={() => runPrimaryBookingAction(selectedBooking)}
          onStatusChange={(status) => updateBooking(selectedBooking.id, { bookingStatus: status })}
          t={t}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDeleteModal
          title={pendingDelete.type === "booking" ? t("deleteBookingConfirm") : t("deleteCustomerConfirm")}
          label={pendingDelete.label}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmPendingDelete}
          t={t}
        />
      ) : null}
    </main>
  );
}

function Filters(props: {
  dateFilter: string;
  areaFilter: string;
  query: string;
  setDateFilter: (value: string) => void;
  setAreaFilter: (value: string) => void;
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
      <label className="sm:col-span-3">
        <span className="label">{t("search")}</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3" />
          <input className="field pl-9 rtl:pl-3 rtl:pr-9" value={props.query} onChange={(event) => props.setQuery(event.target.value)} />
        </span>
      </label>
    </section>
  );
}

function BookingDetailsModal({
  booking,
  language,
  onClose,
  onDelete,
  onPrimaryAction,
  onStatusChange,
  t
}: {
  booking: Booking;
  language: "en" | "ar";
  onClose: () => void;
  onDelete: () => void;
  onPrimaryAction: () => void;
  onStatusChange: (status: Booking["bookingStatus"]) => void;
  t: (key: TranslationKey) => string;
}) {
  const action = primaryBookingAction(booking);
  const price = bookingFinalPrice(booking);
  const promo = booking.promoCode || "-";

  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-slate-950/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onClose}>
      <section className="max-h-[92svh] w-full overflow-y-auto rounded-t-[8px] bg-white p-4 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-white sm:max-w-3xl sm:rounded-[8px] sm:p-6" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-black uppercase text-sky-700">{t("bookingReference")}: {booking.id}</p>
            <h2 className="mt-1 text-2xl font-black">{booking.customerName}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">{booking.phoneNumber}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailItem label={t("bookingStatus")} value={bookingStatusLabel(booking.bookingStatus, language)} />
          <DetailItem label={t("bookingDate")} value={formatDisplayDate(booking.bookingDate, language)} />
          <DetailItem label={t("assignedArea")} value={areaLabel(booking.area, language)} />
          <DetailItem label={t("servicePrice")} value={`${price} EGP`} />
          <DetailItem label={t("promoCode")} value={promo} />
          <DetailItem label={t("bookingReference")} value={booking.id} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[8px] bg-slate-50 p-4 dark:bg-slate-800">
            <h3 className="text-sm font-black text-slate-500 dark:text-slate-300">{t("carInfo")}</h3>
            <p className="mt-2 text-sm font-bold">{booking.carBrand} {booking.carModel}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{booking.carColor}{booking.plateNumber ? ` - ${booking.plateNumber}` : ""}</p>
            {booking.carImageName ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{booking.carImageName}</p> : null}
          </div>

          <div className="rounded-[8px] bg-slate-50 p-4 dark:bg-slate-800">
            <h3 className="text-sm font-black text-slate-500 dark:text-slate-300">{t("locationInfo")}</h3>
            <p className="mt-2 text-sm font-bold">{booking.address || "-"}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{booking.buildingNumber || "-"}</p>
            {booking.carLocation ? (
              <a className="mt-2 inline-flex text-sm font-black text-sky-700 dark:text-sky-300" href={booking.carLocation} target="_blank" rel="noreferrer">
                {t("carLocation")}
              </a>
            ) : null}
          </div>
        </div>

        {booking.notes ? (
          <div className="mt-4 rounded-[8px] bg-slate-50 p-4 dark:bg-slate-800">
            <h3 className="text-sm font-black text-slate-500 dark:text-slate-300">{t("notes")}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{booking.notes}</p>
          </div>
        ) : null}

        <div className="mt-4 rounded-[8px] bg-slate-50 p-4 dark:bg-slate-800">
          <h3 className="text-sm font-black text-slate-500 dark:text-slate-300">{t("bookingTimeline")}</h3>
          <div className="mt-3 grid gap-2">
            {(booking.timeline || []).map((item) => (
              <div key={`${item.status}-${item.createdAt}`} className="rounded-[8px] bg-white p-3 text-sm dark:bg-slate-900">
                <p className="font-black">{item.label}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</p>
                {item.note ? <p className="mt-1 text-slate-600 dark:text-slate-300">{item.note}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <StatusSelect label={t("bookingStatus")} value={normalizedBookingStatus(booking.bookingStatus)} options={BOOKING_STATUSES} language={language} onChange={(value) => onStatusChange(value as Booking["bookingStatus"])} />
          {action ? (
            <button type="button" onClick={onPrimaryAction} className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-[8px] bg-emerald-500 px-4 text-sm font-black text-white">
              <Check className="h-4 w-4" />
              {t(action.label)}
            </button>
          ) : null}
          <button type="button" onClick={onDelete} className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-[8px] bg-rose-600 px-4 text-sm font-black text-white">
            <Trash2 className="h-4 w-4" />
            {t("delete")}
          </button>
        </div>
      </section>
    </div>
  );
}

function ConfirmDeleteModal({
  title,
  label,
  onCancel,
  onConfirm,
  t
}: {
  title: string;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onCancel}>
      <section className="w-full max-w-md rounded-[8px] bg-white p-5 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-white" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
            <Trash2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-black">{title}</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">{label}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-slate-100 px-4 text-sm font-black text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            {t("cancel")}
          </button>
          <button type="button" onClick={onConfirm} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-rose-600 px-4 text-sm font-black text-white">
            {t("delete")}
          </button>
        </div>
      </section>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-slate-50 p-3 dark:bg-slate-800">
      <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function SmallInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      className="h-9 w-32 rounded-[8px] border border-slate-200 bg-white px-2 text-xs font-bold text-slate-950 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TabButton({ active, onClick, icon, label, value }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-20 items-center justify-between gap-3 rounded-[8px] px-4 text-start transition ${
        active ? "bg-sky-600 text-white shadow-sm" : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-black">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <span className="mt-2 block text-2xl font-black">{value}</span>
      </span>
    </button>
  );
}

function StatusSelect({ label, value, options, language, onChange }: { label: string; value: string; options: readonly string[]; language: "en" | "ar"; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {bookingStatusLabel(option, language)}
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

function primaryBookingAction(booking: Booking): { label: TranslationKey; next: Booking["bookingStatus"] } | null {
  const status = normalizedBookingStatus(booking.bookingStatus);
  if (status === "Pending") return { label: "paidReceived", next: "Confirmed" };
  if (status === "Confirmed") return { label: "washDone", next: "Completed" };
  return null;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function areaLabel(areaId: string, language: "en" | "ar") {
  return SERVICE_AREAS.find((area) => area.id === areaId)?.name[language] || areaId;
}

function bookingFinalPrice(booking: Booking) {
  if (typeof booking.finalPriceEgp === "number") return booking.finalPriceEgp;
  const promo = booking.promoCode ? PROMO_CODES.find((item) => item.code === booking.promoCode) : null;
  return Math.max(DEFAULT_SERVICE.priceEgp - (promo?.discountEgp || 0), 0);
}

function revenueSince(bookings: Booking[], dateValue: string) {
  if (!dateValue) return 0;
  return bookings
    .filter((booking) => booking.paymentStatus === "Verified" && booking.bookingDate >= dateValue)
    .reduce((total, booking) => total + bookingFinalPrice(booking), 0);
}

function normalizedBookingStatus(status: string): Booking["bookingStatus"] {
  if (status === "Pending Payment" || status === "Payment Under Review") return "Pending";
  if (status === "Scheduled") return "Confirmed";
  if (status === "Confirmed" || status === "Completed" || status === "Cancelled" || status === "Pending") {
    return status;
  }
  return "Pending";
}

function bookingStatusLabel(status: string, language: "en" | "ar") {
  const normalized = normalizedBookingStatus(status);
  const labels = {
    en: {
      Pending: "Pending",
      Confirmed: "Completed",
      Completed: "Vehicle washed",
      Cancelled: "Cancelled"
    },
    ar: {
      Pending: "معلق",
      Confirmed: "مكتمل",
      Completed: "تم الغسيل",
      Cancelled: "ملغي"
    }
  } as const;
  return labels[language][normalized];
}

function customerWhatsAppUrl(booking: Booking, language: "en" | "ar") {
  const phone = toWhatsAppPhone(booking.phoneNumber);
  const area = areaLabel(booking.area, language);
  const washWindow = language === "ar" ? DEFAULT_SERVICE.bookingWindowAr : DEFAULT_SERVICE.bookingWindow;
  const bookingDate = formatDisplayDate(booking.bookingDate, language);
  const message =
    language === "ar"
      ? `مرحبًا ${booking.customerName}، تم استلام حجز غسيل السيارة بنجاح.\nرقم الحجز: ${booking.id}\nتاريخ الحجز: ${bookingDate}\nالمنطقة: ${area}\nموعد الغسيل: ${washWindow}\nلإلغاء الحجز يرجى إبلاغنا قبل الساعة 10 مساءً.`
      : `Hello ${booking.customerName}, your car wash booking has been received successfully.\nBooking reference: ${booking.id}\nBooking date: ${bookingDate}\nArea: ${area}\nWash time: ${washWindow}\nTo cancel your booking, please let us know before 10:00 PM.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function toWhatsAppPhone(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return `2${digits}`;
  return `20${digits}`;
}

function playNewBookingSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.25);
  } catch {
    // Browser audio can be blocked until the admin interacts with the page.
  }
}
