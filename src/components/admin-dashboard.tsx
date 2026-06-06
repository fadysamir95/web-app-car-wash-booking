"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BadgePercent, Ban, Bell, CalendarDays, CheckCircle2, ClipboardList, Download, Droplets, Eye, EyeOff, ExternalLink, Hourglass, LogOut, Map as MapIcon, Megaphone, MessageSquareWarning, Pencil, Save, Search, Send, ShieldCheck, SlidersHorizontal, Smartphone, Trash2, UserCog, Users, WalletCards, X } from "lucide-react";
import { BOOKING_STATUSES, DEFAULT_SERVICE, PROMO_CODES, SERVICE_AREAS } from "@/lib/constants";
import { formatDisplayDate } from "@/lib/date";
import { bookingFinalPrice as calculateBookingFinalPrice, promoDisplayValue } from "@/lib/pricing";
import type { Booking, CustomerSummary, PromoCode, PublicWorker, ServiceSettings } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n";
import { useLanguage } from "./language-provider";
import { LanguageSwitcher } from "./language-switcher";

type Tab = "todayOps" | "customers" | "allBookings" | "pendingBookings" | "confirmedBookings" | "cancelledBookings" | "completedWashes" | "promoCodes" | "revenue" | "settings" | "campaigns" | "complaints" | "workers";
type NotificationItem = {
  id: string;
  text: string;
  createdAt: string;
};
type PendingDelete =
  | { type: "booking"; id: string; label: string }
  | { type: "customer"; phoneNumber: string; label: string }
  | { type: "allBookings"; label: string }
  | { type: "allCustomers"; label: string };

export function AdminDashboard({
  initialBookings,
  initialSettings,
  initialWorkers
}: {
  initialBookings: Booking[];
  initialSettings: ServiceSettings;
  initialWorkers: PublicWorker[];
}) {
  const { language, dir, t } = useLanguage();
  const [bookings, setBookings] = useState(initialBookings);
  const [tab, setTab] = useState<Tab>("todayOps");
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
  const [promos, setPromos] = useState<PromoCode[]>(PROMO_CODES.map((promo) => ({ ...promo, discountType: "amount", active: true })));
  const [promoForm, setPromoForm] = useState({ code: "", label: "", discountType: "amount", discountValue: "25", expiresAt: "" });
  const [settings, setSettings] = useState<ServiceSettings>(initialSettings);
  const [workers, setWorkers] = useState<PublicWorker[]>(initialWorkers);
  const [workerForm, setWorkerForm] = useState({ name: "", password: "", areas: initialSettings.areas.filter((area) => area.active).map((area) => area.id) });
  const [adminPasswordForm, setAdminPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
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
  const paidOrConfirmedBookings = bookings.filter((booking) => booking.paymentStatus === "Verified").length;
  const conversionRate = bookings.length > 0 ? Math.round((paidOrConfirmedBookings / bookings.length) * 100) : 0;
  const topRevenueArea = topRevenueAreaLabel(bookings, language);
  const topDemandDay = topDemandDayLabel(dailyCounts, language);
  const unpaidCancellations = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Cancelled" && booking.paymentStatus === "Rejected").length;
  const unpaidCancellationRate = bookings.length > 0 ? Math.round((unpaidCancellations / bookings.length) * 100) : 0;
  const bestPromo = bestPromoLabel(bookings);
  const repeatCustomers = customers.filter((customer) => customer.totalBookings > 1).length;
  const pendingBookings = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Pending").length;
  const confirmedBookings = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Confirmed").length;
  const cancelledBookings = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Cancelled").length;
  const completedWashes = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Completed").length;
  const complaints = bookings.filter((booking) => booking.complaint);
  const todayBookings = todayValue ? bookings.filter((booking) => booking.bookingDate === todayValue) : [];
  const todayPending = todayBookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Pending").length;
  const todayConfirmed = todayBookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Confirmed").length;
  const todayCompleted = todayBookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Completed").length;
  const todayRemaining = todayBookings.filter((booking) => {
    const status = normalizedBookingStatus(booking.bookingStatus);
    return status !== "Cancelled" && status !== "Completed";
  }).length;
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) || null;
  const capacityWarnings = useMemo(() => {
    const warningAt = settings.maxBookingsPerDay - 2;
    return Object.entries(dailyCounts)
      .filter(([, count]) => count >= warningAt)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [dailyCounts, settings.maxBookingsPerDay]);

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

  async function deleteAllBookings(reason: "bookings" | "customers") {
    const response = await fetch("/api/admin/bookings", { method: "DELETE" });
    if (!response.ok) return;
    const payload = (await response.json()) as { bookings: Booking[] };
    setBookings(payload.bookings);
    setSelectedBookingId("");
    knownBookingIds.current = new Set();
    notify(
      reason === "customers"
        ? language === "ar" ? "تم مسح كل العملاء والحجوزات." : "All customers and bookings were deleted."
        : language === "ar" ? "تم مسح كل الحجوزات." : "All bookings were deleted."
    );
  }

  function requestDeleteBooking(booking: Booking) {
    setPendingDelete({ type: "booking", id: booking.id, label: `${booking.id} - ${booking.customerName}` });
  }

  function requestDeleteCustomer(customer: CustomerSummary) {
    setPendingDelete({ type: "customer", phoneNumber: customer.phoneNumber, label: `${customer.customerName} - ${customer.phoneNumber}` });
  }

  function requestDeleteAllBookings() {
    setPendingDelete({
      type: "allBookings",
      label: language === "ar" ? `سيتم مسح كل الحجوزات (${bookings.length}) نهائيًا.` : `This will permanently delete all bookings (${bookings.length}).`
    });
  }

  function requestDeleteAllCustomers() {
    setPendingDelete({
      type: "allCustomers",
      label: language === "ar" ? `سيتم مسح كل العملاء (${customers.length}) وكل الحجوزات المرتبطة بهم (${bookings.length}) نهائيًا.` : `This will permanently delete all customers (${customers.length}) and all related bookings (${bookings.length}).`
    });
  }

  async function confirmPendingDelete() {
    if (!pendingDelete) return;
    const current = pendingDelete;
    setPendingDelete(null);
    if (current.type === "booking") await deleteBooking(current.id);
    else if (current.type === "customer") await deleteCustomer(current.phoneNumber);
    else if (current.type === "allCustomers") await deleteAllBookings("customers");
    else await deleteAllBookings("bookings");
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
        discountType: promoForm.discountType,
        discountEgp: promoForm.discountType === "amount" ? Number(promoForm.discountValue || 0) : 0,
        discountPercent: promoForm.discountType === "percentage" ? Number(promoForm.discountValue || 0) : undefined,
        expiresAt: promoForm.expiresAt ? `${promoForm.expiresAt}T23:59:59.999Z` : undefined,
        active: true
      })
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { promos: PromoCode[] };
    setPromos(payload.promos);
    setPromoForm({ code: "", label: "", discountType: "amount", discountValue: "25", expiresAt: "" });
  }

  async function deletePromo(code: string) {
    const response = await fetch(`/api/admin/promos/${encodeURIComponent(code)}`, { method: "DELETE" });
    if (!response.ok) return;
    const payload = (await response.json()) as { promos: PromoCode[] };
    setPromos(payload.promos);
  }

  async function saveSettings() {
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { settings: ServiceSettings };
    setSettings(payload.settings);
    notify(language === "ar" ? "تم حفظ الإعدادات العامة." : "General settings saved.");
  }

  async function changePassword() {
    if (adminPasswordForm.newPassword !== adminPasswordForm.confirmPassword || adminPasswordForm.newPassword.length < 8) {
      notify(language === "ar" ? "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل ومتطابقة." : "New password must be at least 8 characters and match confirmation.");
      return;
    }
    const response = await fetch("/api/admin/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminPasswordForm)
    });
    if (!response.ok) {
      notify(language === "ar" ? "لم يتم تغيير كلمة المرور. تأكد من كلمة المرور الحالية." : "Password was not changed. Check the current password.");
      return;
    }
    setAdminPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    notify(language === "ar" ? "تم تغيير كلمة مرور الأدمن." : "Admin password changed.");
  }

  async function addWorker() {
    const response = await fetch("/api/admin/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workerForm)
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { worker: PublicWorker };
    setWorkers((current) => [payload.worker, ...current]);
    setWorkerForm({ name: "", password: "", areas: settings.areas.filter((area) => area.active).map((area) => area.id) });
    notify(language === "ar" ? "تم إضافة العامل." : "Worker added.");
  }

  async function deleteWorker(id: string) {
    const response = await fetch(`/api/admin/workers/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    const payload = (await response.json()) as { workers: PublicWorker[] };
    setWorkers(payload.workers);
    notify(language === "ar" ? "تم حذف العامل." : "Worker deleted.");
  }

  async function updateWorker(id: string, updates: { name?: string; password?: string; areas?: string[] }) {
    const response = await fetch(`/api/admin/workers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { worker: PublicWorker };
    setWorkers((current) => current.map((worker) => (worker.id === id ? payload.worker : worker)));
    notify(language === "ar" ? "تم تعديل بيانات العامل." : "Worker updated.");
  }

  function sendSegmentCampaign(segment: CustomerSummary[], label: string) {
    const message = language === "ar"
      ? `عرض خاص من Car Wash Booking لعملاء ${label}. احجز غسلتك القادمة الآن.`
      : `Special offer from Car Wash Booking for ${label}. Book your next wash now.`;
    const phoneList = segment.map((customer) => `${customer.phoneNumber} - ${customer.customerName}`).join("\n");
    void navigator.clipboard.writeText(`${message}\n\n${phoneList}`);
    notify(language === "ar" ? "تم نسخ رسالة العرض وقائمة العملاء." : "Campaign message and customer list copied.");
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
            <Link href="/worker" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-white px-4 text-sm font-black text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
              <ExternalLink className="h-4 w-4" />
              {t("workerBoard")}
            </Link>
            <LanguageSwitcher variant="surface" />
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
                  <span>{count}/{settings.maxBookingsPerDay}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="mt-5 grid gap-2 rounded-[8px] bg-white p-2 shadow-sm dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
          <TabButton active={tab === "todayOps"} onClick={() => setTab("todayOps")} icon={<CalendarDays className="h-4 w-4" />} label={language === "ar" ? "متابعة اليوم" : "Today"} value={todayBookings.length} />
          <TabButton active={tab === "customers"} onClick={() => setTab("customers")} icon={<Users className="h-4 w-4" />} label={t("customers")} value={customers.length} />
          <TabButton active={tab === "allBookings"} onClick={() => setTab("allBookings")} icon={<ClipboardList className="h-4 w-4" />} label={t("allBookings")} value={bookings.length} />
          <TabButton active={tab === "pendingBookings"} onClick={() => setTab("pendingBookings")} icon={<Hourglass className="h-4 w-4" />} label={t("pendingBookings")} value={pendingBookings} />
          <TabButton active={tab === "confirmedBookings"} onClick={() => setTab("confirmedBookings")} icon={<ShieldCheck className="h-4 w-4" />} label={t("confirmedBookings")} value={confirmedBookings} />
          <TabButton active={tab === "cancelledBookings"} onClick={() => setTab("cancelledBookings")} icon={<Ban className="h-4 w-4" />} label={t("cancelledBookings")} value={cancelledBookings} />
          <TabButton active={tab === "completedWashes"} onClick={() => setTab("completedWashes")} icon={<Droplets className="h-4 w-4" />} label={t("completedWashes")} value={completedWashes} />
          <TabButton active={tab === "promoCodes"} onClick={() => setTab("promoCodes")} icon={<BadgePercent className="h-4 w-4" />} label={t("promoCodes")} value={promos.length} />
          <TabButton active={tab === "revenue"} onClick={() => setTab("revenue")} icon={<WalletCards className="h-4 w-4" />} label={t("revenue")} value={`${confirmedRevenue} EGP`} />
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")} icon={<SlidersHorizontal className="h-4 w-4" />} label={language === "ar" ? "الإعدادات" : "Settings"} value={settings.servicePriceEgp} />
          <TabButton active={tab === "campaigns"} onClick={() => setTab("campaigns")} icon={<Megaphone className="h-4 w-4" />} label={language === "ar" ? "العروض الذكية" : "Smart Offers"} value={customers.length} />
          <TabButton active={tab === "complaints"} onClick={() => setTab("complaints")} icon={<MessageSquareWarning className="h-4 w-4" />} label={language === "ar" ? "الشكاوى" : "Complaints"} value={complaints.length} />
          <TabButton active={tab === "workers"} onClick={() => setTab("workers")} icon={<UserCog className="h-4 w-4" />} label={language === "ar" ? "العمال" : "Workers"} value={workers.length} />
        </nav>

        {tab === "todayOps" ? (
          <TodayOperationsPanel
            bookings={todayBookings}
            workers={workers}
            settings={settings}
            language={language}
            todayValue={todayValue}
            analyticsTime={analyticsTime}
            stats={{
              total: todayBookings.length,
              pending: todayPending,
              confirmed: todayConfirmed,
              completed: todayCompleted,
              remaining: todayRemaining
            }}
            onOpenBooking={setSelectedBookingId}
          />
        ) : null}

        {tab === "allBookings" || tab === "pendingBookings" || tab === "confirmedBookings" || tab === "cancelledBookings" || tab === "completedWashes" ? (
          <>
            <Filters
              dateFilter={dateFilter}
              areaFilter={areaFilter}
              query={query}
              setDateFilter={setDateFilter}
              setAreaFilter={setAreaFilter}
              setQuery={setQuery}
              settings={settings}
            />
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={requestDeleteAllBookings} disabled={bookings.length === 0} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-rose-600 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
                <Trash2 className="h-4 w-4" />
                {language === "ar" ? "مسح كل الحجوزات" : "Delete all bookings"}
              </button>
            </div>
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
                        <CheckCircle2 className="h-4 w-4" />
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
              <button type="button" onClick={requestDeleteAllCustomers} disabled={customers.length === 0} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-rose-600 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
                <Trash2 className="h-4 w-4" />
                {language === "ar" ? "مسح كل العملاء" : "Delete all customers"}
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
                  <span className="label">{t("promoDiscountType")}</span>
                  <select className="field" value={promoForm.discountType} onChange={(event) => setPromoForm({ ...promoForm, discountType: event.target.value })}>
                    <option value="amount">{t("fixedAmount")}</option>
                    <option value="percentage">{t("percentage")}</option>
                  </select>
                </label>
                <label>
                  <span className="label">{t("promoDiscount")}</span>
                  <input className="field" inputMode="numeric" value={promoForm.discountValue} onChange={(event) => setPromoForm({ ...promoForm, discountValue: event.target.value.replace(/\D/g, "") })} />
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
                      <p className="mt-1 font-bold text-slate-500">{promo.label} - {promoDisplayValue(promo)}</p>
                      <p className="mt-1 text-xs font-black text-slate-400">
                        {language === "ar" ? "ينتهي في" : "Expires"}: {promo.expiresAt ? formatDisplayDate(promo.expiresAt.slice(0, 10), language) : language === "ar" ? "بدون تاريخ انتهاء" : "No expiry date"}
                      </p>
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

        {tab === "settings" ? (
          <SettingsPanel
            settings={settings}
            setSettings={setSettings}
            onSave={saveSettings}
            adminPasswordForm={adminPasswordForm}
            setAdminPasswordForm={setAdminPasswordForm}
            onChangePassword={changePassword}
            language={language}
          />
        ) : null}

        {tab === "campaigns" ? (
          <CampaignsPanel
            customers={customers}
            bookings={bookings}
            language={language}
            now={analyticsTime}
            onSend={sendSegmentCampaign}
          />
        ) : null}

        {tab === "complaints" ? (
          <section className="mt-4 grid gap-3">
            {complaints.map((booking) => (
              <article key={booking.id} className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-rose-700">{booking.id}</p>
                    <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{booking.customerName}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">{booking.carBrand} {booking.carModel} - {booking.areaName || booking.area}</p>
                  </div>
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-800 dark:bg-rose-950 dark:text-rose-100">{booking.rating}/5</span>
                </div>
                <p className="mt-3 rounded-[8px] bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{booking.complaint?.text}</p>
                <p className="mt-2 text-xs font-bold text-slate-400">{booking.complaint?.createdAt ? new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.complaint.createdAt)) : ""}</p>
              </article>
            ))}
            {complaints.length === 0 ? <Empty text={language === "ar" ? "لا توجد شكاوى حتى الآن." : "No complaints yet."} /> : null}
          </section>
        ) : null}

        {tab === "workers" ? (
          <WorkersPanel
            workers={workers}
            workerForm={workerForm}
            setWorkerForm={setWorkerForm}
            settings={settings}
            language={language}
            onAdd={addWorker}
            onUpdate={updateWorker}
            onDelete={deleteWorker}
          />
        ) : null}

        {tab === "revenue" ? (
          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <AnalyticsCard title={t("bookingsPerDay")} items={Object.entries(dailyCounts).map(([date, count]) => [formatDisplayDate(date, language), `${count}/${settings.maxBookingsPerDay}`])} />
            <AnalyticsCard title={t("topAreas")} items={topAreas.map(([area, count]) => [area, String(count)])} />
            <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
              <p className="text-sm font-bold text-slate-500">{t("repeatCustomers")}</p>
              <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{repeatCustomers}</p>
              <p className="mt-4 text-sm font-bold text-slate-500">{t("revenue")}</p>
              <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{confirmedRevenue} EGP</p>
            </div>
            <AnalyticsCard
              title={t("smartAnalytics")}
              items={[
                [t("conversionRate"), `${conversionRate}%`],
                [t("topRevenueArea"), topRevenueArea],
                [t("topDemandDay"), topDemandDay],
                [t("unpaidCancellationRate"), `${unpaidCancellationRate}%`],
                [t("bestPromo"), bestPromo],
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
          title={deleteModalTitle(pendingDelete.type, language, t)}
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
  settings: ServiceSettings;
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
          {props.settings.areas.filter((area) => area.active).map((area) => (
            <option key={area.id} value={area.id}>
              {language === "ar" ? area.nameAr : area.nameEn}
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

function TodayOperationsPanel({
  bookings,
  workers,
  settings,
  language,
  todayValue,
  analyticsTime,
  stats,
  onOpenBooking
}: {
  bookings: Booking[];
  workers: PublicWorker[];
  settings: ServiceSettings;
  language: "en" | "ar";
  todayValue: string;
  analyticsTime: number;
  stats: { total: number; pending: number; confirmed: number; completed: number; remaining: number };
  onOpenBooking: (id: string) => void;
}) {
  const routeUrl = buildRouteUrl(bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) !== "Cancelled"));
  const afterWashWindow = analyticsTime ? new Date(analyticsTime).getHours() >= 5 : false;
  const overdue = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Confirmed");
  const sortedBookings = [...bookings].sort((a, b) => a.area.localeCompare(b.area) || a.createdAt.localeCompare(b.createdAt));
  const label = {
    title: language === "ar" ? "متابعة اليوم" : "Today Operations",
    date: language === "ar" ? "تاريخ اليوم" : "Today",
    total: language === "ar" ? "حجوزات اليوم" : "Today bookings",
    pending: language === "ar" ? "معلقة" : "Pending",
    confirmed: language === "ar" ? "مؤكدة" : "Confirmed",
    completed: language === "ar" ? "تم الغسيل" : "Washed",
    remaining: language === "ar" ? "متبقي" : "Remaining",
    route: language === "ar" ? "فتح خريطة اليوم" : "Open today route",
    worker: language === "ar" ? "العامل المسؤول" : "Assigned worker",
    proof: language === "ar" ? "إثبات الصورة" : "Photo proof",
    hasProof: language === "ar" ? "مرفوعة" : "Uploaded",
    noProof: language === "ar" ? "غير مرفوعة" : "Missing",
    noBookings: language === "ar" ? "لا توجد حجوزات اليوم." : "No bookings today.",
    overdue: language === "ar" ? "يوجد حجز مؤكد لم يتم تسجيل غسيله بعد الساعة 5 صباحًا." : "A confirmed booking has not been marked washed after 5 AM.",
    status: language === "ar" ? "الحالة" : "Status"
  };

  return (
    <section className="mt-4 grid gap-4">
      <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase text-sky-700">{label.title}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
              {label.date}: {todayValue ? formatDisplayDate(todayValue, language) : "-"}
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">
              {stats.total}/{settings.maxBookingsPerDay} {language === "ar" ? "من الحد اليومي" : "daily capacity"}
            </p>
          </div>
          {routeUrl ? (
            <a href={routeUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
              <MapIcon className="h-4 w-4" />
              {label.route}
            </a>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <TodayStat title={label.total} value={stats.total} />
          <TodayStat title={label.pending} value={stats.pending} tone="amber" />
          <TodayStat title={label.confirmed} value={stats.confirmed} tone="emerald" />
          <TodayStat title={label.completed} value={stats.completed} tone="sky" />
          <TodayStat title={label.remaining} value={stats.remaining} tone="rose" />
        </div>

        {afterWashWindow && overdue.length > 0 ? (
          <div className="mt-4 rounded-[8px] border border-amber-300 bg-amber-50 p-3 text-sm font-black text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
            <AlertTriangle className="me-2 inline h-4 w-4" />
            {label.overdue}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        {sortedBookings.map((booking) => {
          const worker = workers.find((item) => item.areas.includes(booking.area));
          const status = normalizedBookingStatus(booking.bookingStatus);
          return (
            <button
              key={booking.id}
              type="button"
              onClick={() => onOpenBooking(booking.id)}
              className="rounded-[8px] bg-white p-4 text-start shadow-sm transition hover:shadow-md dark:bg-slate-900"
            >
              <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr_1fr] lg:items-center">
                <div>
                  <p className="text-xs font-black uppercase text-sky-700">{booking.id}</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{booking.customerName}</h3>
                  <p className="mt-1 text-sm font-bold text-slate-500">{booking.carBrand} {booking.carModel} - {booking.carColor}</p>
                </div>
                <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  <p>{areaLabel(booking.area, language)}</p>
                  <p className="mt-1">{booking.address || "-"}</p>
                </div>
                <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  <p><span className="text-slate-400">{label.worker}: </span>{worker?.name || "-"}</p>
                  <p className="mt-1"><span className="text-slate-400">{label.proof}: </span>{booking.washProofImageDataUrl ? label.hasProof : label.noProof}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <span className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-black ${statusBadgeClass(status)}`}>
                    {label.status}: {bookingStatusLabel(status, language)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
        {sortedBookings.length === 0 ? <Empty text={label.noBookings} /> : null}
      </div>
    </section>
  );
}

function TodayStat({ title, value, tone = "slate" }: { title: string; value: number; tone?: "slate" | "amber" | "emerald" | "sky" | "rose" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-950 dark:bg-slate-800 dark:text-white",
    amber: "bg-amber-50 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100",
    emerald: "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-100",
    sky: "bg-sky-50 text-sky-950 dark:bg-sky-950/35 dark:text-sky-100",
    rose: "bg-rose-50 text-rose-950 dark:bg-rose-950/35 dark:text-rose-100"
  } as const;
  return (
    <div className={`rounded-[8px] p-4 ${tones[tone]}`}>
      <p className="text-sm font-black opacity-70">{title}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function SettingsPanel({
  settings,
  setSettings,
  onSave,
  adminPasswordForm,
  setAdminPasswordForm,
  onChangePassword,
  language
}: {
  settings: ServiceSettings;
  setSettings: (settings: ServiceSettings) => void;
  onSave: () => void;
  adminPasswordForm: { currentPassword: string; newPassword: string; confirmPassword: string };
  setAdminPasswordForm: (form: { currentPassword: string; newPassword: string; confirmPassword: string }) => void;
  onChangePassword: () => void;
  language: "en" | "ar";
}) {
  function updateArea(index: number, updates: Partial<ServiceSettings["areas"][number]>) {
    setSettings({
      ...settings,
      areas: settings.areas.map((area, areaIndex) => (areaIndex === index ? { ...area, ...updates } : area))
    });
  }

  function addArea() {
    setSettings({
      ...settings,
      areas: [
        ...settings.areas,
        { id: `area-${settings.areas.length + 1}`, nameEn: "New Area", nameAr: "New Area", priceEgp: settings.servicePriceEgp, active: true }
      ]
    });
  }

  function updateAreaEnglishName(index: number, value: string) {
    updateArea(index, { id: slugifyAreaName(value), nameEn: value });
  }

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
        <h2 className="text-lg font-black text-slate-950 dark:text-white">{language === "ar" ? "الإعدادات العامة" : "General Settings"}</h2>
        <div className="mt-4 grid gap-3">
          <label><span className="label">{language === "ar" ? "السعر" : "Price"}</span><input className="field" inputMode="numeric" value={settings.servicePriceEgp} onChange={(event) => setSettings({ ...settings, servicePriceEgp: Number(event.target.value || 0) })} /></label>
          <label><span className="label">{language === "ar" ? "رقم الدفع" : "Payment number"}</span><input className="field" value={settings.paymentPhone} onChange={(event) => setSettings({ ...settings, paymentPhone: event.target.value.replace(/\D/g, "") })} /></label>
          <label><span className="label">{language === "ar" ? "الحد الأقصى اليومي" : "Daily capacity"}</span><input className="field" inputMode="numeric" value={settings.maxBookingsPerDay} onChange={(event) => setSettings({ ...settings, maxBookingsPerDay: Number(event.target.value || 1) })} /></label>
          <label><span className="label">{language === "ar" ? "وقت الغسيل بالإنجليزية" : "Wash window EN"}</span><input className="field" value={settings.washWindow} onChange={(event) => setSettings({ ...settings, washWindow: event.target.value })} /></label>
          <label><span className="label">{language === "ar" ? "وقت الغسيل بالعربية" : "Wash window AR"}</span><input className="field" value={settings.washWindowAr} onChange={(event) => setSettings({ ...settings, washWindowAr: event.target.value })} /></label>
          <button type="button" onClick={onSave} className="inline-flex h-12 items-center justify-center rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-sky-500">
            {language === "ar" ? "حفظ الإعدادات" : "Save settings"}
          </button>
        </div>
        <div className="mt-5 rounded-[8px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
          <h3 className="text-base font-black text-slate-950 dark:text-white">{language === "ar" ? "تغيير كلمة مرور الأدمن" : "Change admin password"}</h3>
          <div className="mt-3 grid gap-3">
            <label><span className="label">{language === "ar" ? "كلمة المرور الحالية" : "Current password"}</span><input className="field" type="password" value={adminPasswordForm.currentPassword} onChange={(event) => setAdminPasswordForm({ ...adminPasswordForm, currentPassword: event.target.value })} /></label>
            <label><span className="label">{language === "ar" ? "كلمة المرور الجديدة" : "New password"}</span><input className="field" type="password" value={adminPasswordForm.newPassword} onChange={(event) => setAdminPasswordForm({ ...adminPasswordForm, newPassword: event.target.value })} /></label>
            <label><span className="label">{language === "ar" ? "تأكيد كلمة المرور" : "Confirm password"}</span><input className="field" type="password" value={adminPasswordForm.confirmPassword} onChange={(event) => setAdminPasswordForm({ ...adminPasswordForm, confirmPassword: event.target.value })} /></label>
            <button type="button" onClick={onChangePassword} className="inline-flex h-12 items-center justify-center rounded-[8px] bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950">
              {language === "ar" ? "تغيير كلمة المرور" : "Change password"}
            </button>
          </div>
        </div>
      </div>
      <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">{language === "ar" ? "المناطق المتاحة" : "Available areas"}</h2>
          <button type="button" onClick={addArea} className="rounded-[8px] bg-sky-600 px-3 py-2 text-xs font-black text-white">{language === "ar" ? "إضافة منطقة" : "Add area"}</button>
        </div>
        <div className="mt-4 grid gap-3">
          {settings.areas.map((area, index) => (
            <div key={`${area.id}-${index}`} className="grid gap-2 rounded-[8px] bg-slate-50 p-3 dark:bg-slate-800 sm:grid-cols-[1fr_1fr_120px_110px]">
              <input className="field" value={area.nameEn} onChange={(event) => updateAreaEnglishName(index, event.target.value)} placeholder="Degla Palms" />
              <input className="field" value={area.nameAr} onChange={(event) => updateArea(index, { nameAr: event.target.value })} placeholder="دجلة بالمز" dir="auto" />
              <input className="field" inputMode="numeric" value={area.priceEgp} onChange={(event) => updateArea(index, { priceEgp: Number(event.target.value || 0) })} />
              <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={area.active} onChange={(event) => updateArea(index, { active: event.target.checked })} />
                {language === "ar" ? "متاحة" : "Active"}
              </label>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CampaignsPanel({
  customers,
  bookings,
  language,
  now,
  onSend
}: {
  customers: CustomerSummary[];
  bookings: Booking[];
  language: "en" | "ar";
  now: number;
  onSend: (segment: CustomerSummary[], label: string) => void;
}) {
  const byPhone = new Map(bookings.map((booking) => [booking.phoneNumber, booking]));
  const inactive30 = customers.filter((customer) => now - new Date(customer.lastBookingDate).getTime() > 30 * 24 * 60 * 60 * 1000);
  const repeat = customers.filter((customer) => customer.totalBookings > 1);
  const usedPromo = customers.filter((customer) => bookings.some((booking) => booking.phoneNumber === customer.phoneNumber && booking.promoCode));
  const areas = [...new Set(customers.map((customer) => customer.area))];
  const segments = [
    { label: language === "ar" ? "لم يحجز منذ 30 يوم" : "Inactive 30 days", customers: inactive30 },
    { label: language === "ar" ? "حجز أكثر من مرة" : "Repeat customers", customers: repeat },
    { label: language === "ar" ? "استخدم بروموكود" : "Used promo code", customers: usedPromo }
  ];

  return (
    <section className="mt-4 grid gap-3 lg:grid-cols-2">
      {segments.map((segment) => (
        <CampaignCard key={segment.label} label={segment.label} count={segment.customers.length} onSend={() => onSend(segment.customers, segment.label)} language={language} />
      ))}
      {areas.map((area) => {
        const segment = customers.filter((customer) => customer.area === area && byPhone.has(customer.phoneNumber));
        return <CampaignCard key={area} label={`${language === "ar" ? "منطقة" : "Area"}: ${area}`} count={segment.length} onSend={() => onSend(segment, area)} language={language} />;
      })}
    </section>
  );
}

function CampaignCard({ label, count, onSend, language }: { label: string; count: number; onSend: () => void; language: "en" | "ar" }) {
  return (
    <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
      <p className="text-sm font-black text-sky-700">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{count}</p>
      <button type="button" disabled={count === 0} onClick={onSend} className="mt-4 inline-flex h-11 items-center justify-center rounded-[8px] bg-emerald-500 px-4 text-sm font-black text-white disabled:bg-slate-400">
        {language === "ar" ? "تجهيز رسالة العرض" : "Prepare campaign"}
      </button>
    </div>
  );
}

function WorkersPanel({
  workers,
  workerForm,
  setWorkerForm,
  settings,
  language,
  onAdd,
  onUpdate,
  onDelete
}: {
  workers: PublicWorker[];
  workerForm: { name: string; password: string; areas: string[] };
  setWorkerForm: (form: { name: string; password: string; areas: string[] }) => void;
  settings: ServiceSettings;
  language: "en" | "ar";
  onAdd: () => void;
  onUpdate: (id: string, updates: { name?: string; password?: string; areas?: string[] }) => void;
  onDelete: (id: string) => void;
}) {
  function toggleArea(areaId: string) {
    const hasArea = workerForm.areas.includes(areaId);
    setWorkerForm({ ...workerForm, areas: hasArea ? workerForm.areas.filter((item) => item !== areaId) : [...workerForm.areas, areaId] });
  }

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
        <h2 className="text-lg font-black text-slate-950 dark:text-white">{language === "ar" ? "إضافة عامل" : "Add worker"}</h2>
        <div className="mt-4 grid gap-3">
          <label><span className="label">{language === "ar" ? "اسم العامل" : "Worker name"}</span><input className="field" value={workerForm.name} onChange={(event) => setWorkerForm({ ...workerForm, name: event.target.value })} /></label>
          <label><span className="label">{language === "ar" ? "كلمة المرور" : "Password"}</span><input className="field" value={workerForm.password} onChange={(event) => setWorkerForm({ ...workerForm, password: event.target.value })} /></label>
          <div>
            <span className="label">{language === "ar" ? "المناطق المسؤول عنها" : "Assigned areas"}</span>
            <div className="mt-2 grid gap-2">
              {settings.areas.filter((area) => area.active).map((area) => (
                <label key={area.id} className="flex items-center gap-2 rounded-[8px] bg-slate-50 p-2 text-sm font-bold dark:bg-slate-800">
                  <input type="checkbox" checked={workerForm.areas.includes(area.id)} onChange={() => toggleArea(area.id)} />
                  {language === "ar" ? area.nameAr : area.nameEn}
                </label>
              ))}
            </div>
          </div>
          <button type="button" onClick={onAdd} className="inline-flex h-12 items-center justify-center rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-sky-500">
            {language === "ar" ? "إضافة العامل" : "Add worker"}
          </button>
        </div>
      </div>
      <div className="grid gap-3">
        {workers.map((worker) => (
          <WorkerCard
            key={worker.id}
            worker={worker}
            settings={settings}
            language={language}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

function WorkerCard({
  worker,
  settings,
  language,
  onUpdate,
  onDelete
}: {
  worker: PublicWorker;
  settings: ServiceSettings;
  language: "en" | "ar";
  onUpdate: (id: string, updates: { name?: string; password?: string; areas?: string[] }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [draft, setDraft] = useState({
    name: worker.name,
    password: worker.passwordPreview || "",
    areas: worker.areas
  });

  function toggleArea(areaId: string) {
    const hasArea = draft.areas.includes(areaId);
    setDraft({ ...draft, areas: hasArea ? draft.areas.filter((item) => item !== areaId) : [...draft.areas, areaId] });
  }

  function saveWorker() {
    onUpdate(worker.id, {
      name: draft.name,
      password: draft.password && draft.password !== worker.passwordPreview ? draft.password : undefined,
      areas: draft.areas
    });
    setEditing(false);
  }

  return (
    <article className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <input className="field max-w-sm" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          ) : (
            <h2 className="text-lg font-black text-slate-950 dark:text-white">{worker.name}</h2>
          )}
          <p className="mt-1 text-sm font-bold text-slate-500">{worker.areas.join(", ") || "-"}</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <button type="button" onClick={saveWorker} className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-emerald-500 px-3 text-xs font-black text-white">
              <Save className="h-3.5 w-3.5" />
              {language === "ar" ? "حفظ" : "Save"}
            </button>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-sky-600 px-3 text-xs font-black text-white">
              <Pencil className="h-3.5 w-3.5" />
              {language === "ar" ? "تعديل" : "Edit"}
            </button>
          )}
          <button type="button" onClick={() => onDelete(worker.id)} className="rounded-[8px] bg-rose-600 px-3 py-2 text-xs font-black text-white">{language === "ar" ? "حذف" : "Delete"}</button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <DetailItem label={language === "ar" ? "الغسلات المكتملة" : "Completed washes"} value={String(worker.completedWashes)} />
        <DetailItem label={language === "ar" ? "آخر نشاط" : "Last activity"} value={worker.lastActivityAt ? new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(worker.lastActivityAt)) : "-"} />
      </div>

      <div className="mt-3 rounded-[8px] bg-slate-50 p-3 dark:bg-slate-800">
        <span className="label">{language === "ar" ? "كلمة المرور" : "Password"}</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          {editing ? (
            <input className="field" type={showPassword ? "text" : "password"} value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder={language === "ar" ? "اكتب كلمة مرور جديدة" : "Enter new password"} />
          ) : (
            <div className="field flex items-center text-sm font-black">
              {worker.passwordPreview ? (showPassword ? worker.passwordPreview : "••••••••") : language === "ar" ? "غير محفوظة - عدّل العامل لإضافة كلمة مرور" : "Not stored - edit worker to add a password"}
            </div>
          )}
          <button type="button" onClick={() => setShowPassword((current) => !current)} className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPassword ? (language === "ar" ? "إخفاء" : "Hide") : language === "ar" ? "إظهار" : "Show"}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 rounded-[8px] bg-slate-50 p-3 dark:bg-slate-800">
          <span className="label">{language === "ar" ? "المناطق المسؤول عنها" : "Assigned areas"}</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {settings.areas.filter((area) => area.active).map((area) => (
              <label key={area.id} className="flex items-center gap-2 rounded-[8px] bg-white p-2 text-sm font-bold dark:bg-slate-900">
                <input type="checkbox" checked={draft.areas.includes(area.id)} onChange={() => toggleArea(area.id)} />
                {language === "ar" ? area.nameAr : area.nameEn}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </article>
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

        {booking.washProofImageDataUrl ? (
          <div className="mt-4 rounded-[8px] bg-slate-50 p-4 dark:bg-slate-800">
            <h3 className="text-sm font-black text-slate-500 dark:text-slate-300">{language === "ar" ? "إثبات إتمام الغسيل" : "Wash completion proof"}</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={booking.washProofImageDataUrl} alt={booking.washProofImageName || "Wash proof"} className="mt-3 max-h-80 w-full rounded-[8px] object-cover" />
            <p className="mt-2 text-xs font-bold text-slate-500">{booking.washProofImageName}</p>
          </div>
        ) : null}

        {booking.complaint ? (
          <div className="mt-4 rounded-[8px] border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/35">
            <h3 className="text-sm font-black text-rose-800 dark:text-rose-100">{language === "ar" ? "شكوى العميل" : "Customer complaint"}</h3>
            <p className="mt-2 text-sm leading-6 text-rose-900 dark:text-rose-100">{booking.complaint.text}</p>
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
              <CheckCircle2 className="h-4 w-4" />
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

function deleteModalTitle(type: PendingDelete["type"], language: "en" | "ar", t: (key: TranslationKey) => string) {
  if (type === "booking") return t("deleteBookingConfirm");
  if (type === "customer") return t("deleteCustomerConfirm");
  if (type === "allCustomers") return language === "ar" ? "هل تريد مسح كل العملاء؟" : "Delete all customers?";
  return language === "ar" ? "هل تريد مسح كل الحجوزات؟" : "Delete all bookings?";
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
      className={`flex min-h-24 items-center justify-between gap-3 rounded-[8px] px-4 text-start transition ${
        active ? "bg-sky-600 text-white shadow-sm" : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      <span className="min-w-0">
        <span className="flex items-start gap-2 text-sm font-black leading-5">
          {icon}
          <span className="whitespace-normal break-words">{label}</span>
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
  return calculateBookingFinalPrice(booking, PROMO_CODES.map((promo) => ({ ...promo, discountType: "amount", active: true })));
}

function revenueSince(bookings: Booking[], dateValue: string) {
  if (!dateValue) return 0;
  return bookings
    .filter((booking) => booking.paymentStatus === "Verified" && booking.bookingDate >= dateValue)
    .reduce((total, booking) => total + bookingFinalPrice(booking), 0);
}

function topRevenueAreaLabel(bookings: Booking[], language: "en" | "ar") {
  const totals = bookings
    .filter((booking) => booking.paymentStatus === "Verified")
    .reduce<Record<string, number>>((acc, booking) => {
      const label = areaLabel(booking.area, language);
      acc[label] = (acc[label] || 0) + bookingFinalPrice(booking);
      return acc;
    }, {});
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} - ${top[1]} EGP` : "-";
}

function topDemandDayLabel(dailyCounts: Record<string, number>, language: "en" | "ar") {
  const top = Object.entries(dailyCounts).sort((a, b) => b[1] - a[1])[0];
  return top ? `${formatDisplayDate(top[0], language)} - ${top[1]}` : "-";
}

function bestPromoLabel(bookings: Booking[]) {
  const counts = bookings.reduce<Record<string, number>>((acc, booking) => {
    if (booking.promoCode) acc[booking.promoCode] = (acc[booking.promoCode] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} - ${top[1]}` : "-";
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

function slugifyAreaName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `area-${Date.now()}`;
}

function statusBadgeClass(status: string) {
  const normalized = normalizedBookingStatus(status);
  if (normalized === "Pending") return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-100";
  if (normalized === "Confirmed") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100";
  if (normalized === "Completed") return "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-100";
  return "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-100";
}

function buildRouteUrl(bookings: Booking[]) {
  const stops = bookings
    .map((booking) => booking.carLocation || [booking.address, booking.areaName].filter(Boolean).join(", "))
    .filter(Boolean)
    .slice(0, 10);

  if (stops.length === 0) return "";
  if (stops.length === 1) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`;

  const params = new URLSearchParams({
    api: "1",
    origin: stops[0],
    destination: stops[stops.length - 1],
    travelmode: "driving"
  });
  const waypoints = stops.slice(1, -1).join("|");
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
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
