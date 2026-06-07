"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BadgePercent, Ban, Bell, CalendarDays, CheckCircle2, ClipboardList, Download, Droplets, Eye, EyeOff, ExternalLink, Hourglass, LogOut, Map as MapIcon, MapPin, Megaphone, MessageSquareWarning, Pencil, Save, Search, Send, Settings as SettingsIcon, ShieldCheck, Smartphone, Trash2, UserCog, Users, WalletCards, X } from "lucide-react";
import { BOOKING_STATUSES, DEFAULT_SERVICE, PROMO_CODES, SERVICE_AREAS } from "@/lib/constants";
import { formatDisplayDate, toDateInputValue } from "@/lib/date";
import { bookingFinalPrice as calculateBookingFinalPrice, promoDisplayValue } from "@/lib/pricing";
import type { Booking, CustomerSummary, PromoCode, PublicWorker, ServiceSettings } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n";
import { BrandLogo } from "./brand-logo";
import { useLanguage } from "./language-provider";
import { LanguageSwitcher } from "./language-switcher";

type Tab = "todayOps" | "customers" | "allBookings" | "pendingBookings" | "confirmedBookings" | "cancelledBookings" | "completedWashes" | "promoCodes" | "revenue" | "settings" | "campaigns" | "complaints" | "workers";
type NotificationItem = {
  id: string;
  text: string;
  createdAt: string;
  read: boolean;
};
type PendingDelete =
  | { type: "booking"; id: string; label: string }
  | { type: "customer"; phoneNumber: string; label: string }
  | { type: "allBookings"; label: string }
  | { type: "allCustomers"; label: string };
type PendingStatusChange = {
  bookingId: string;
  customerName: string;
  bookingReference: string;
  carLabel: string;
  area: string;
  from: Booking["bookingStatus"];
  to: Booking["bookingStatus"];
};

const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ADMIN_SESSION_REFRESH_MS = 5 * 60 * 1000;
const PAGE_SIZE = 20;

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
  const [operationDateFilter, setOperationDateFilter] = useState("");
  const [operationAreaFilter, setOperationAreaFilter] = useState("");
  const [query, setQuery] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<CustomerSummary | null>(null);
  const [editingCustomerPhone, setEditingCustomerPhone] = useState("");
  const [newBookingAlert, setNewBookingAlert] = useState<Booking | null>(null);
  const [notificationHistoryOpen, setNotificationHistoryOpen] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState<NotificationItem[]>([]);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [justReadNotificationIds, setJustReadNotificationIds] = useState<Set<string>>(new Set());
  const [revenueVisible, setRevenueVisible] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [toast, setToast] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null);
  const [pendingStatusWorkerId, setPendingStatusWorkerId] = useState("");
  const [analyticsNow, setAnalyticsNow] = useState("");
  const [promos, setPromos] = useState<PromoCode[]>(PROMO_CODES.map((promo) => ({ ...promo, discountType: "amount", active: true })));
  const [promoForm, setPromoForm] = useState({ code: "", label: "", discountType: "amount", discountValue: "25", expiresAt: "" });
  const [editingPromoCode, setEditingPromoCode] = useState("");
  const [settings, setSettings] = useState<ServiceSettings>(initialSettings);
  const [workers, setWorkers] = useState<PublicWorker[]>(initialWorkers);
  const [workerForm, setWorkerForm] = useState({ name: "", password: "", areas: initialSettings.areas.filter((area) => area.active).map((area) => area.id) });
  const [adminPasswordForm, setAdminPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [bookingsPage, setBookingsPage] = useState(1);
  const [customersPage, setCustomersPage] = useState(1);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const knownBookingIds = useRef(new Set(initialBookings.map((booking) => booking.id)));
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const notificationsLoaded = useRef(false);
  const lastAdminActivity = useRef(0);
  const lastSessionRefresh = useRef(0);

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
  const bookingPages = Math.max(1, Math.ceil(displayedBookings.length / PAGE_SIZE));
  const currentBookingsPage = Math.min(bookingsPage, bookingPages);
  const pagedBookings = displayedBookings.slice((currentBookingsPage - 1) * PAGE_SIZE, currentBookingsPage * PAGE_SIZE);

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
  const customerPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const currentCustomersPage = Math.min(customersPage, customerPages);
  const pagedCustomers = customers.slice((currentCustomersPage - 1) * PAGE_SIZE, currentCustomersPage * PAGE_SIZE);

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
  const analyticsDate = analyticsTime ? new Date(analyticsTime) : null;
  const todayValue = analyticsDate ? toDateInputValue(analyticsDate) : "";
  const currentOperationDateValue = analyticsDate ? getDawnOperationDateValue(analyticsDate) : "";
  const operationDateValue = operationDateFilter || currentOperationDateValue;
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
  const pendingBookings = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Pending").length;
  const confirmedBookings = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Confirmed").length;
  const cancelledBookings = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Cancelled").length;
  const completedWashes = bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Completed").length;
  const complaints = bookings.filter((booking) => booking.complaint);
  const workersWithRatings = useMemo(
    () =>
      workers.map((worker) => {
        const ratings = bookings
          .filter((booking) => booking.completedByWorkerId === worker.id && booking.workerRating)
          .map((booking) => booking.workerRating || 0);
        const averageRating = ratings.length ? Math.round((ratings.reduce((total, rating) => total + rating, 0) / ratings.length) * 10) / 10 : undefined;
        return { ...worker, averageRating };
      }),
    [bookings, workers]
  );
  const todayBookings = operationDateValue ? bookings.filter((booking) => booking.bookingDate === operationDateValue) : [];
  const dawnConfirmedBookings = todayBookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Confirmed");
  const displayedDawnBookings = operationAreaFilter ? dawnConfirmedBookings.filter((booking) => booking.area === operationAreaFilter) : dawnConfirmedBookings;
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) || null;
  const unreadNotifications = notificationHistory.filter((item) => !item.read).length;
  const displayedNotifications = showAllNotifications ? notificationHistory : notificationHistory.slice(0, 6);
  const capacityWarnings = useMemo(() => {
    const warningAt = settings.maxBookingsPerDay - 2;
    return Object.entries(dailyCounts)
      .filter(([, count]) => count >= warningAt)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [dailyCounts, settings.maxBookingsPerDay]);

  async function updateBooking(id: string, updates: Partial<Pick<Booking, "bookingStatus" | "completedByWorkerId">>) {
    const oldBooking = bookings.find((booking) => booking.id === id);
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingStatus: updates.bookingStatus,
        workerId: updates.completedByWorkerId
      })
    });

    if (!response.ok) return;
    const payload = (await response.json()) as { booking: Booking; worker?: PublicWorker | null };
    setBookings((current) => current.map((booking) => (booking.id === id ? payload.booking : booking)));
    if (payload.worker) {
      setWorkers((current) => current.map((worker) => (worker.id === payload.worker?.id ? payload.worker : worker)));
    }
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

  function requestStatusChange(bookingId: string, nextStatus: Booking["bookingStatus"]) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    const from = normalizedBookingStatus(booking.bookingStatus);
    const to = normalizedBookingStatus(nextStatus);
    if (from === to) return;

    if (isSensitiveStatusChange(to)) {
      const defaultWorkerId = to === "Completed" ? workers.find((worker) => worker.areas.includes(booking.area))?.id || workers[0]?.id || "" : "";
      setPendingStatusWorkerId(defaultWorkerId);
      setPendingStatusChange({
        bookingId: booking.id,
        customerName: booking.customerName,
        bookingReference: booking.id,
        carLabel: [booking.carBrand, booking.carModel, booking.carColor].filter(Boolean).join(" "),
        area: booking.area,
        from,
        to
      });
      return;
    }

    void updateBooking(booking.id, { bookingStatus: to });
  }

  async function confirmPendingStatusChange() {
    if (!pendingStatusChange) return;
    const current = pendingStatusChange;
    const booking = bookings.find((item) => item.id === current.bookingId);
    if (current.to === "Completed" && !pendingStatusWorkerId) return;
    setPendingStatusChange(null);

    if (booking && current.from === "Pending" && current.to === "Confirmed") {
      window.open(customerWhatsAppUrl(booking, language), "_blank", "noopener,noreferrer");
    }

    await updateBooking(current.bookingId, { bookingStatus: current.to, completedByWorkerId: current.to === "Completed" ? pendingStatusWorkerId : undefined });
    setPendingStatusWorkerId("");
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
    requestStatusChange(booking.id, action.next);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  const logoutAfterIdle = useCallback(async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/admin";
  }, []);

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
    const generatedCode = nextPromoCode(promoForm.label, promos);
    const response = await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: generatedCode,
        label: promoForm.label || generatedCode,
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
    resetPromoForm();
  }

  async function savePromoCode() {
    if (!editingPromoCode) {
      await addPromoCode();
      return;
    }

    const response = await fetch(`/api/admin/promos/${encodeURIComponent(editingPromoCode)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: promoForm.label || editingPromoCode,
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
    resetPromoForm();
  }

  function editPromo(promo: PromoCode) {
    setEditingPromoCode(promo.code);
    setPromoForm({
      code: promo.code,
      label: promo.label,
      discountType: promo.discountType || "amount",
      discountValue: String(promo.discountType === "percentage" ? promo.discountPercent || 0 : promo.discountEgp || 0),
      expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 10) : ""
    });
  }

  function resetPromoForm() {
    setEditingPromoCode("");
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
      ? `عرض خاص من VAYAX لعملاء ${label}. احجز خدمتك القادمة الآن.`
      : `Special offer from VAYAX for ${label}. Book your next service now.`;
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
      { id: `${Date.now()}-${current.length}`, text: message, createdAt: new Date().toLocaleTimeString(), read: false },
      ...current
    ].slice(0, 60));
    showToast(message);
  }

  function toggleNotificationHistory() {
    setNotificationHistoryOpen((current) => {
      const next = !current;
      if (next) {
        const unreadIds = new Set(notificationHistory.filter((item) => !item.read).map((item) => item.id));
        setJustReadNotificationIds(unreadIds);
        setNotificationHistory((items) => items.map((item) => ({ ...item, read: true })));
      } else {
        setJustReadNotificationIds(new Set());
        setShowAllNotifications(false);
      }
      return next;
    });
  }

  function clearNotifications() {
    setNotificationHistory([]);
    setJustReadNotificationIds(new Set());
    setShowAllNotifications(false);
  }

  useEffect(() => {
    lastAdminActivity.current = Date.now();
    queueMicrotask(() => {
      if ("Notification" in window) setNotificationPermission(Notification.permission);
      setAnalyticsNow(new Date().toISOString());
      const savedNotifications = window.localStorage.getItem("carwash-admin-notifications");
      if (savedNotifications) {
        try {
          setNotificationHistory(JSON.parse(savedNotifications) as NotificationItem[]);
        } catch {
          setNotificationHistory([]);
        }
      }
      notificationsLoaded.current = true;
    });
    const interval = window.setInterval(() => setAnalyticsNow(new Date().toISOString()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let idleTimer = window.setTimeout(logoutAfterIdle, ADMIN_IDLE_TIMEOUT_MS);
    let refreshing = false;

    async function refreshAdminSession() {
      if (refreshing) return;
      const now = Date.now();
      if (now - lastSessionRefresh.current < ADMIN_SESSION_REFRESH_MS) return;

      refreshing = true;
      lastSessionRefresh.current = now;
      const response = await fetch("/api/admin/session", { method: "POST" }).catch(() => null);
      refreshing = false;
      if (response && response.status === 401) {
        await logoutAfterIdle();
      }
    }

    function recordActivity() {
      lastAdminActivity.current = Date.now();
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(logoutAfterIdle, ADMIN_IDLE_TIMEOUT_MS);
      void refreshAdminSession();
    }

    function checkResume() {
      if (Date.now() - lastAdminActivity.current >= ADMIN_IDLE_TIMEOUT_MS) {
        void logoutAfterIdle();
      }
    }

    const events: Array<keyof WindowEventMap> = ["click", "keydown", "pointermove", "touchstart"];
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    document.addEventListener("visibilitychange", checkResume);
    window.addEventListener("focus", checkResume);
    void refreshAdminSession();

    return () => {
      window.clearTimeout(idleTimer);
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      document.removeEventListener("visibilitychange", checkResume);
      window.removeEventListener("focus", checkResume);
    };
  }, [logoutAfterIdle]);

  useEffect(() => {
    if (!notificationsLoaded.current) return;
    window.localStorage.setItem("carwash-admin-notifications", JSON.stringify(notificationHistory));
  }, [notificationHistory]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!notificationHistoryOpen) return;
      if (notificationRef.current?.contains(event.target as Node)) return;
      setNotificationHistoryOpen(false);
      setJustReadNotificationIds(new Set());
      setShowAllNotifications(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationHistoryOpen]);

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
          { id: `${Date.now()}-${latestNewBooking.id}`, text: message, createdAt: new Date().toLocaleTimeString(), read: false },
          ...current
        ].slice(0, 60));
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
            <BrandLogo compact size="lg" bare />
            <h1 className="text-3xl font-black text-slate-950 dark:text-white">{t("adminDashboard")}</h1>
          </div>
          <div className="flex gap-2">
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={toggleNotificationHistory}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-white text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200"
                aria-label={t("notificationHistory")}
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[0.65rem] font-black text-white">{unreadNotifications}</span> : null}
              </button>
              {notificationHistoryOpen ? (
                <div className="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-[8px] bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 rtl:left-0 rtl:right-auto">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-3 text-sm font-black text-slate-950 dark:border-slate-800 dark:text-white">
                    <span>{t("notificationHistory")}</span>
                    {notificationHistory.length > 0 ? (
                      <button type="button" onClick={clearNotifications} className="rounded-[8px] bg-rose-50 px-2 py-1 text-xs font-black text-rose-700 dark:bg-rose-950/40 dark:text-rose-100">
                        {language === "ar" ? "مسح الكل" : "Clear all"}
                      </button>
                    ) : null}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notificationHistory.length === 0 ? (
                      <p className="p-4 text-sm font-bold text-slate-500">{t("noNotifications")}</p>
                    ) : (
                      displayedNotifications.map((item) => (
                        <div key={item.id} className={`border-b border-slate-100 p-3 text-sm last:border-0 dark:border-slate-800 ${justReadNotificationIds.has(item.id) ? "bg-sky-50 dark:bg-sky-950/30" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{item.text}</p>
                            {justReadNotificationIds.has(item.id) ? <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[0.65rem] font-black text-white">{language === "ar" ? "جديد" : "New"}</span> : null}
                          </div>
                          <p className="mt-1 text-xs font-bold text-slate-400">{item.createdAt}</p>
                        </div>
                      ))
                    )}
                    {!showAllNotifications && notificationHistory.length > 6 ? (
                      <button type="button" onClick={() => setShowAllNotifications(true)} className="h-10 w-full text-sm font-black text-sky-700 dark:text-sky-300">
                        {language === "ar" ? "عرض الكل" : "Show all"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <Link href="/" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
              <ExternalLink className="h-4 w-4" />
              {language === "ar" ? "عرض الموقع" : "View Website"}
            </Link>
            <Link href="/worker" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-white px-4 text-sm font-black text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
              <ExternalLink className="h-4 w-4" />
              {t("workerBoard")}
            </Link>
            <button
              type="button"
              onClick={() => setTab("settings")}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-black shadow-sm transition ${
                tab === "settings"
                  ? "bg-sky-600 text-white"
                  : "bg-white text-slate-700 hover:bg-sky-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <SettingsIcon className="h-4 w-4" />
              {language === "ar" ? "الإعدادات" : "Settings"}
            </button>
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
          <TabButton active={tab === "todayOps"} onClick={() => setTab("todayOps")} icon={<CalendarDays className="h-4 w-4" />} label={language === "ar" ? "حجوزات الفجر القادم" : "Next dawn bookings"} value={dawnConfirmedBookings.length} />
          <TabButton active={tab === "customers"} onClick={() => setTab("customers")} icon={<Users className="h-4 w-4" />} label={t("customers")} value={customers.length} />
          <TabButton active={tab === "allBookings"} onClick={() => setTab("allBookings")} icon={<ClipboardList className="h-4 w-4" />} label={t("allBookings")} value={bookings.length} />
          <TabButton active={tab === "pendingBookings"} onClick={() => setTab("pendingBookings")} icon={<Hourglass className="h-4 w-4" />} label={t("pendingBookings")} value={pendingBookings} />
          <TabButton active={tab === "confirmedBookings"} onClick={() => setTab("confirmedBookings")} icon={<ShieldCheck className="h-4 w-4" />} label={t("confirmedBookings")} value={confirmedBookings} />
          <TabButton active={tab === "cancelledBookings"} onClick={() => setTab("cancelledBookings")} icon={<Ban className="h-4 w-4" />} label={t("cancelledBookings")} value={cancelledBookings} />
          <TabButton active={tab === "completedWashes"} onClick={() => setTab("completedWashes")} icon={<Droplets className="h-4 w-4" />} label={t("completedWashes")} value={completedWashes} />
          <TabButton active={tab === "promoCodes"} onClick={() => setTab("promoCodes")} icon={<BadgePercent className="h-4 w-4" />} label={t("promoCodes")} value={promos.length} />
          <TabButton active={tab === "revenue"} onClick={() => setTab("revenue")} icon={<WalletCards className="h-4 w-4" />} label={t("revenue")} value={revenueVisible ? `${confirmedRevenue} EGP` : "••••••"} />
          <TabButton active={tab === "campaigns"} onClick={() => setTab("campaigns")} icon={<Megaphone className="h-4 w-4" />} label={language === "ar" ? "العروض الذكية" : "Smart Offers"} value={customers.length} />
          <TabButton active={tab === "complaints"} onClick={() => setTab("complaints")} icon={<MessageSquareWarning className="h-4 w-4" />} label={language === "ar" ? "الشكاوى" : "Complaints"} value={complaints.length} />
          <TabButton active={tab === "workers"} onClick={() => setTab("workers")} icon={<UserCog className="h-4 w-4" />} label={language === "ar" ? "العمال" : "Workers"} value={workers.length} />
        </nav>

        {tab === "todayOps" ? (
          <TodayOperationsPanel
            bookings={displayedDawnBookings}
            allDateBookings={todayBookings}
            workers={workersWithRatings}
            settings={settings}
            language={language}
            todayValue={operationDateValue}
            currentOperationDateValue={currentOperationDateValue}
            analyticsTime={analyticsTime}
            areaFilter={operationAreaFilter}
            onDateChange={setOperationDateFilter}
            onResetDate={() => setOperationDateFilter("")}
            onAreaFilterChange={setOperationAreaFilter}
            onMarkWashed={(bookingId) => requestStatusChange(bookingId, "Completed")}
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
              onReset={() => {
                setDateFilter("");
                setAreaFilter("");
                setQuery("");
              }}
            />
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={requestDeleteAllBookings} disabled={bookings.length === 0} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-rose-600 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400">
                <Trash2 className="h-4 w-4" />
                {language === "ar" ? "مسح كل الحجوزات" : "Delete all bookings"}
              </button>
            </div>
            <section className="mt-4 grid gap-3">
              {pagedBookings.map((booking) => (
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
                      <StatusSelect label={t("bookingStatus")} value={normalizedBookingStatus(booking.bookingStatus)} options={BOOKING_STATUSES} language={language} onChange={(value) => requestStatusChange(booking.id, value as Booking["bookingStatus"])} />
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
              {displayedBookings.length > PAGE_SIZE ? (
                <Pagination page={currentBookingsPage} pages={bookingPages} total={displayedBookings.length} language={language} onPageChange={setBookingsPage} />
              ) : null}
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
                    {pagedCustomers.map((customer) => (
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
            {customers.length > PAGE_SIZE ? (
              <div className="border-t border-slate-100 p-3 dark:border-slate-800">
                <Pagination page={currentCustomersPage} pages={customerPages} total={customers.length} language={language} onPageChange={setCustomersPage} />
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "promoCodes" ? (
          <section className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900">
              <h2 className="text-lg font-black text-slate-950 dark:text-white">
                {editingPromoCode ? (language === "ar" ? "تعديل كود الخصم" : "Edit Promo Code") : t("addPromoCode")}
              </h2>
              {editingPromoCode ? <p className="mt-1 text-xs font-black text-sky-700">{editingPromoCode}</p> : null}
              <div className="mt-4 grid gap-3">
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
                <button type="button" onClick={savePromoCode} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
                  {t("save")}
                </button>
                {editingPromoCode ? (
                  <button type="button" onClick={resetPromoForm} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-slate-200 px-4 text-sm font-black text-slate-950 dark:bg-slate-800 dark:text-white">
                    {language === "ar" ? "إلغاء التعديل" : "Cancel edit"}
                  </button>
                ) : null}
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
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => editPromo(promo)} className="inline-flex h-9 items-center rounded-[8px] bg-sky-600 px-3 text-xs font-black text-white">
                        {language === "ar" ? "تعديل" : "Edit"}
                      </button>
                      <button type="button" onClick={() => deletePromo(promo.code)} className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-rose-600 px-3 text-xs font-black text-white">
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("delete")}
                      </button>
                    </div>
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-500">{t("revenue")}</p>
                <button type="button" onClick={() => setRevenueVisible((current) => !current)} className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-slate-100 px-3 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  {revenueVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {revenueVisible ? (language === "ar" ? "إخفاء" : "Hide") : language === "ar" ? "إظهار" : "Show"}
                </button>
              </div>
              <p className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{revenueVisible ? `${confirmedRevenue} EGP` : "••••••"}</p>
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
          onStatusChange={(status) => requestStatusChange(selectedBooking.id, status)}
          t={t}
        />
      ) : null}
      {pendingStatusChange ? (
        <ConfirmStatusChangeModal
          change={pendingStatusChange}
          workers={workers}
          workerId={pendingStatusWorkerId}
          onWorkerChange={setPendingStatusWorkerId}
          language={language}
          onCancel={() => {
            setPendingStatusChange(null);
            setPendingStatusWorkerId("");
          }}
          onConfirm={confirmPendingStatusChange}
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
  onReset: () => void;
}) {
  const { language, t } = useLanguage();
  return (
    <section className="mt-4 grid gap-3 rounded-[8px] bg-white p-4 shadow-sm dark:bg-slate-900 sm:grid-cols-6">
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
      <div className="flex items-end">
        <button type="button" onClick={props.onReset} className="inline-flex h-12 w-full items-center justify-center rounded-[8px] bg-slate-200 px-4 text-sm font-black text-slate-950 dark:bg-slate-800 dark:text-white">
          {language === "ar" ? "إعادة ضبط" : "Reset"}
        </button>
      </div>
    </section>
  );
}

function TodayOperationsPanel({
  bookings,
  allDateBookings,
  workers,
  settings,
  language,
  todayValue,
  currentOperationDateValue,
  analyticsTime,
  areaFilter,
  onDateChange,
  onResetDate,
  onAreaFilterChange,
  onMarkWashed,
  onOpenBooking
}: {
  bookings: Booking[];
  allDateBookings: Booking[];
  workers: PublicWorker[];
  settings: ServiceSettings;
  language: "en" | "ar";
  todayValue: string;
  currentOperationDateValue: string;
  analyticsTime: number;
  areaFilter: string;
  onDateChange: (value: string) => void;
  onResetDate: () => void;
  onAreaFilterChange: (value: string) => void;
  onMarkWashed: (bookingId: string) => void;
  onOpenBooking: (id: string) => void;
}) {
  const [reportVisible, setReportVisible] = useState(false);
  const routeUrl = buildRouteUrl(bookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) !== "Cancelled"));
  const afterWashWindow = isPastWashDeadline(todayValue, analyticsTime);
  const overdue = allDateBookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Confirmed");
  const completedForDate = allDateBookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Completed");
  const cancelledForDate = allDateBookings.filter((booking) => normalizedBookingStatus(booking.bookingStatus) === "Cancelled");
  const workerWashCounts = completedForDate.reduce<Record<string, number>>((acc, booking) => {
    const workerKey = booking.completedByWorkerId || "unassigned";
    acc[workerKey] = (acc[workerKey] || 0) + 1;
    return acc;
  }, {});
  const workerWashSummary = Object.entries(workerWashCounts).map(([workerId, count]) => {
    const workerName = workers.find((worker) => worker.id === workerId)?.name || (language === "ar" ? "غير محدد" : "Unassigned");
    return `${workerName}: ${count}`;
  });
  const confirmedAreaCounts = allDateBookings.reduce<Record<string, number>>((acc, booking) => {
    if (normalizedBookingStatus(booking.bookingStatus) === "Confirmed") {
      acc[booking.area] = (acc[booking.area] || 0) + 1;
    }
    return acc;
  }, {});
  const sortedBookings = [...bookings].sort((a, b) => a.area.localeCompare(b.area) || a.createdAt.localeCompare(b.createdAt));
  const label = {
    title: language === "ar" ? "حجوزات الفجر القادم" : "Next dawn bookings",
    date: language === "ar" ? "تاريخ فجر يوم" : "dawn date",
    total: language === "ar" ? "حجوزات الفجر القادم" : "Next dawn bookings",
    route: language === "ar" ? "فتح خريطة فجر التشغيل" : "Open dawn route",
    worker: language === "ar" ? "العامل المسؤول" : "Assigned worker",
    proof: language === "ar" ? "إثبات الصورة" : "Photo proof",
    hasProof: language === "ar" ? "مرفوعة" : "Uploaded",
    noProof: language === "ar" ? "غير مرفوعة" : "Missing",
    noBookings: language === "ar" ? "لا توجد حجوزات لهذا التاريخ." : "No bookings for this date.",
    overdue: language === "ar" ? "يوجد حجز مؤكد لم يتم تسجيل غسيله بعد الساعة 5 صباحًا." : "A confirmed booking has not been marked washed after 5 AM.",
    status: language === "ar" ? "الحالة" : "Status",
    phone: language === "ar" ? "الهاتف" : "Phone",
    address: language === "ar" ? "العنوان" : "Address",
    location: language === "ar" ? "موقع السيارة" : "Car location",
    bookingDate: language === "ar" ? "تاريخ الحجز" : "Booking date",
    allAreas: language === "ar" ? "كل المناطق" : "All areas",
    confirmedBookings: language === "ar" ? "حجوزات مؤكدة" : "confirmed",
    dawnReport: language === "ar" ? "تقرير نهاية الفجر" : "Dawn report",
    washed: language === "ar" ? "تم غسلها" : "Washed",
    late: language === "ar" ? "متأخرة" : "Late",
    cancelled: language === "ar" ? "ملغية" : "Cancelled",
    workerWashes: language === "ar" ? "غسلات العمال" : "Worker washes",
    unassigned: language === "ar" ? "غير محدد" : "Unassigned",
    showReport: language === "ar" ? "عرض التقرير" : "Show report",
    hideReport: language === "ar" ? "إخفاء التقرير" : "Hide report",
    sendReport: language === "ar" ? "إرسال التقرير للأدمن" : "Send report to admin",
    washDone: language === "ar" ? "تم الغسيل" : "Washed",
    backToCurrent: language === "ar" ? "الرجوع إلى الفجر القادم" : "Back to next dawn"
  };
  const reportDate = todayValue ? formatDisplayDate(todayValue, language) : "-";
  const reportLateCount = afterWashWindow ? overdue.length : 0;
  const reportMessage =
    language === "ar"
      ? `تقرير نهاية الفجر - ${reportDate}\nتم غسلها: ${completedForDate.length}\nمتأخرة: ${reportLateCount}\nملغية: ${cancelledForDate.length}\nغسلات العمال:\n${workerWashSummary.length ? workerWashSummary.join("\n") : "-"}`
      : `Dawn report - ${reportDate}\nWashed: ${completedForDate.length}\nLate: ${reportLateCount}\nCancelled: ${cancelledForDate.length}\nWorker washes:\n${workerWashSummary.length ? workerWashSummary.join("\n") : "-"}`;
  const reportWhatsAppUrl = `https://wa.me/${toWhatsAppPhone(settings.paymentPhone)}?text=${encodeURIComponent(reportMessage)}`;

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
              {bookings.length}/{settings.maxBookingsPerDay} {language === "ar" ? "حجز مؤكد لهذا الفجر" : "confirmed bookings for this dawn"}
            </p>
          </div>
          {routeUrl ? (
            <a href={routeUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
              <MapIcon className="h-4 w-4" />
              {label.route}
            </a>
          ) : null}
        </div>

        {afterWashWindow && overdue.length > 0 ? (
          <div className="mt-4 rounded-[8px] border border-amber-300 bg-amber-50 p-3 text-sm font-black text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
            <AlertTriangle className="me-2 inline h-4 w-4" />
            {label.overdue}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setReportVisible((current) => !current)}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-[8px] bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950"
        >
          {reportVisible ? label.hideReport : label.showReport}
        </button>
        {reportVisible ? (
        <div className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-950 dark:text-white">{label.dawnReport}</h3>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-300">{reportDate}</span>
            </div>
            <a href={reportWhatsAppUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500">
              <Send className="h-4 w-4" />
              {label.sendReport}
            </a>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <ReportMetric label={label.washed} value={completedForDate.length} tone="emerald" />
            <ReportMetric label={label.late} value={reportLateCount} tone="amber" />
            <ReportMetric label={label.cancelled} value={cancelledForDate.length} tone="rose" />
          </div>
          <div className="mt-3 rounded-[8px] bg-white p-3 dark:bg-slate-900">
            <p className="text-sm font-black text-slate-600 dark:text-slate-300">{label.workerWashes}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(workerWashCounts).length > 0 ? (
                Object.entries(workerWashCounts).map(([workerId, count]) => {
                  const workerName = workers.find((worker) => worker.id === workerId)?.name || label.unassigned;
                  return (
                    <span key={workerId} className="inline-flex min-h-8 items-center rounded-full bg-sky-50 px-3 text-xs font-black text-sky-900 dark:bg-sky-950/45 dark:text-sky-100">
                      {workerName}: {count}
                    </span>
                  );
                })
              ) : (
                <span className="text-sm font-bold text-slate-500">-</span>
              )}
            </div>
          </div>
        </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <button
            type="button"
            onClick={() => onAreaFilterChange("")}
            className={`rounded-[8px] border p-4 text-start transition ${
              areaFilter === ""
                ? "border-sky-500 bg-sky-50 text-sky-950 shadow-sm dark:border-sky-700 dark:bg-sky-950/45 dark:text-sky-100"
                : "border-slate-200 bg-slate-50 text-slate-950 hover:border-sky-200 hover:bg-sky-50 dark:border-slate-800 dark:bg-slate-800 dark:text-white dark:hover:border-sky-800 dark:hover:bg-sky-950/35"
            }`}
          >
            <p className="text-sm font-black">{label.allAreas}</p>
            <p className="mt-2 text-3xl font-black">{bookings.length}</p>
            <p className="mt-1 text-xs font-bold opacity-70">{label.confirmedBookings}</p>
          </button>
          {settings.areas.filter((area) => area.active).map((area) => {
            const count = confirmedAreaCounts[area.id] || 0;
            const active = areaFilter === area.id;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => onAreaFilterChange(active ? "" : area.id)}
                className={`rounded-[8px] border p-4 text-start transition ${
                  active
                    ? "border-sky-500 bg-sky-50 text-sky-950 shadow-sm dark:border-sky-700 dark:bg-sky-950/45 dark:text-sky-100"
                    : "border-slate-200 bg-slate-50 text-slate-950 hover:border-sky-200 hover:bg-sky-50 dark:border-slate-800 dark:bg-slate-800 dark:text-white dark:hover:border-sky-800 dark:hover:bg-sky-950/35"
                }`}
              >
                <p className="text-sm font-black">{language === "ar" ? area.nameAr : area.nameEn}</p>
                <p className="mt-2 text-3xl font-black">{count}</p>
                <p className="mt-1 text-xs font-bold opacity-70">{label.confirmedBookings}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(220px,280px)_auto] md:items-end">
          <label>
            <span className="label">{label.date}</span>
            <input className="field" type="date" value={todayValue} onChange={(event) => onDateChange(event.target.value)} />
          </label>
          <button
            type="button"
            onClick={onResetDate}
            disabled={todayValue === currentOperationDateValue}
            className="inline-flex h-12 items-center justify-center rounded-[8px] bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:bg-white dark:text-slate-950 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          >
            {label.backToCurrent}
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {sortedBookings.map((booking) => {
          const worker = workers.find((item) => item.areas.includes(booking.area));
          const status = normalizedBookingStatus(booking.bookingStatus);
          return (
            <article
              key={booking.id}
              onClick={() => onOpenBooking(booking.id)}
              className="cursor-pointer rounded-[8px] bg-white p-4 text-start shadow-sm transition hover:shadow-md dark:bg-slate-900"
            >
              <div className="grid gap-4 lg:grid-cols-[160px_1.1fr_1fr_1fr]">
                <div className="overflow-hidden rounded-[8px] bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                  {booking.carImageDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={booking.carImageDataUrl} alt={booking.carImageName || "Car photo"} className="h-32 w-full object-cover" />
                  ) : booking.carImageName ? (
                    <div className="grid h-32 place-items-center px-3 text-center text-xs font-black text-slate-600 dark:text-slate-300">
                      <span>
                        {language === "ar" ? "اسم الصورة موجود لكن الملف غير متاح" : "Photo name exists but file is unavailable"}
                        <span className="mt-1 block truncate font-bold opacity-70">{booking.carImageName}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="grid h-32 place-items-center px-3 text-center text-xs font-black text-slate-500 dark:text-slate-300">
                      {language === "ar" ? "لا توجد صورة للسيارة" : "No car photo"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-sky-700">{booking.id}</p>
                  <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{booking.customerName}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{label.phone}: {booking.phoneNumber}</p>
                  <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {booking.carBrand} {booking.carModel} - {booking.carColor}
                    {booking.plateNumber ? ` - ${booking.plateNumber}` : ""}
                  </p>
                </div>

                <div className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                  <p>
                    <strong>{label.worker}: </strong>{worker?.name || "-"}
                  </p>
                  {worker ? (
                    <p>
                      <strong>ETA: </strong>{workerEtaLabel(worker, booking.carLocation, language)}
                    </p>
                  ) : null}
                  <p>
                    <strong>{label.proof}: </strong>{booking.washProofImageDataUrl ? label.hasProof : label.noProof}
                  </p>
                  <p>
                    <strong>{label.bookingDate}: </strong>{formatDisplayDate(booking.bookingDate, language)}
                  </p>
                </div>

                <div className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                  <p>
                    <strong>{label.address}: </strong>{areaLabel(booking.area, language)}{booking.address ? ` - ${booking.address}` : ""}{booking.buildingNumber ? `, ${booking.buildingNumber}` : ""}
                  </p>
                  {booking.carLocation ? (
                    <a className="inline-flex items-center gap-1 font-bold text-sky-700 dark:text-sky-300" href={booking.carLocation} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                      <MapPin className="h-4 w-4" />
                      {label.location}
                    </a>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-black ${statusBadgeClass(status)}`}>
                      {label.status}: {bookingStatusLabel(status, language)}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onMarkWashed(booking.id);
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-500"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {label.washDone}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {sortedBookings.length === 0 ? <Empty text={label.noBookings} /> : null}
      </div>
    </section>
  );
}

function ReportMetric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-100",
    amber: "bg-amber-50 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100",
    rose: "bg-rose-50 text-rose-950 dark:bg-rose-950/35 dark:text-rose-100"
  } as const;

  return (
    <div className={`rounded-[8px] p-4 ${tones[tone]}`}>
      <p className="text-sm font-black opacity-75">{label}</p>
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
            <div key={index} className="grid gap-2 rounded-[8px] bg-slate-50 p-3 dark:bg-slate-800 sm:grid-cols-[1fr_1fr_120px_110px]">
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
          <p className="mt-1 text-sm font-bold text-slate-500">{workerAreaLabels(worker.areas, settings)}</p>
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

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <DetailItem label={language === "ar" ? "متوسط تقييم العامل" : "Worker average rating"} value={worker.averageRating ? `${worker.averageRating}/5` : "-"} />
        <DetailItem label={language === "ar" ? "آخر تحديث GPS" : "Last GPS update"} value={worker.currentLocationUpdatedAt ? new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(worker.currentLocationUpdatedAt)) : "-"} />
      </div>

      {worker.currentLat && worker.currentLng ? (
        <a href={`https://www.google.com/maps/search/?api=1&query=${worker.currentLat},${worker.currentLng}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-[8px] bg-sky-600 px-4 text-sm font-black text-white">
          <MapPin className="h-4 w-4" />
          {language === "ar" ? "عرض موقع العامل" : "View worker location"}
        </a>
      ) : null}

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
            {booking.carImageDataUrl ? (
              <a href={booking.carImageDataUrl} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-[8px] ring-1 ring-slate-200 dark:ring-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={booking.carImageDataUrl} alt={booking.carImageName || "Car photo"} className="max-h-72 w-full object-cover" />
              </a>
            ) : null}
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
                <p className="font-black">{adminTimelineLabel(item.label, language)}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</p>
                {item.note ? <p className="mt-1 text-slate-600 dark:text-slate-300">{adminTimelineNote(item.note, language)}</p> : null}
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

function ConfirmStatusChangeModal({
  change,
  workers,
  workerId,
  onWorkerChange,
  language,
  onCancel,
  onConfirm,
  t
}: {
  change: PendingStatusChange;
  workers: PublicWorker[];
  workerId: string;
  onWorkerChange: (value: string) => void;
  language: "en" | "ar";
  onCancel: () => void;
  onConfirm: () => void;
  t: (key: TranslationKey) => string;
}) {
  const actionLabel = statusConfirmationActionLabel(change.to, language);
  const requiresWorker = change.to === "Completed";
  const selectableWorkers = [...workers].sort((a, b) => Number(b.areas.includes(change.area)) - Number(a.areas.includes(change.area)) || a.name.localeCompare(b.name));
  const message =
    language === "ar"
      ? `سيتم نقل الحجز ${change.bookingReference} الخاص بـ ${change.customerName} (${change.carLabel || "-"}) من ${bookingStatusLabel(change.from, language)} إلى ${bookingStatusLabel(change.to, language)}.`
      : `Booking ${change.bookingReference} for ${change.customerName} (${change.carLabel || "-"}) will move from ${bookingStatusLabel(change.from, language)} to ${bookingStatusLabel(change.to, language)}.`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onCancel}>
      <section className="w-full max-w-md rounded-[8px] bg-white p-5 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-white" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-black">{language === "ar" ? "تأكيد تغيير حالة الحجز" : "Confirm status change"}</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">{message}</p>
          </div>
        </div>
        {requiresWorker ? (
          <label className="mt-4 block">
            <span className="label">{language === "ar" ? "العامل الذي قام بالغسيل" : "Worker who washed the car"}</span>
            <select className="field" value={workerId} onChange={(event) => onWorkerChange(event.target.value)} required>
              <option value="">{language === "ar" ? "اختر العامل" : "Select worker"}</option>
              {selectableWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-slate-100 px-4 text-sm font-black text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            {t("cancel")}
          </button>
          <button type="button" onClick={onConfirm} disabled={requiresWorker && !workerId} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-emerald-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
            {actionLabel}
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

function workerAreaLabels(areaIds: string[], settings: ServiceSettings) {
  if (areaIds.length === 0) return "-";
  return areaIds
    .map((areaId) => {
      const area = settings.areas.find((item) => item.id === areaId);
      return area ? `${area.nameEn} - ${area.nameAr}` : areaId;
    })
    .join(", ");
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

function Pagination({ page, pages, total, language, onPageChange }: { page: number; pages: number; total: number; language: "en" | "ar"; onPageChange: (page: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] bg-white p-3 text-sm font-bold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
      <span>
        {language === "ar" ? "الصفحة" : "Page"} {page}/{pages} - {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-9 items-center rounded-[8px] bg-slate-100 px-3 text-xs font-black text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100"
        >
          {language === "ar" ? "السابق" : "Previous"}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className="inline-flex h-9 items-center rounded-[8px] bg-sky-600 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {language === "ar" ? "التالي" : "Next"}
        </button>
      </div>
    </div>
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

function isSensitiveStatusChange(status: Booking["bookingStatus"]) {
  return status === "Confirmed" || status === "Completed" || status === "Cancelled";
}

function statusConfirmationActionLabel(status: Booking["bookingStatus"], language: "en" | "ar") {
  if (status === "Confirmed") return language === "ar" ? "تأكيد تم الدفع" : "Confirm payment";
  if (status === "Completed") return language === "ar" ? "تأكيد تم الغسيل" : "Confirm washed";
  if (status === "Cancelled") return language === "ar" ? "تأكيد الإلغاء" : "Confirm cancellation";
  return language === "ar" ? "تأكيد" : "Confirm";
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

function workerEtaLabel(worker: PublicWorker, carLocation: string | undefined, language: "en" | "ar") {
  if (!worker.currentLat || !worker.currentLng || !carLocation) return "-";
  const destination = parseGoogleMapsCoordinates(carLocation);
  if (!destination) return "-";
  const distanceKm = distanceBetweenKm(worker.currentLat, worker.currentLng, destination.lat, destination.lng);
  const etaMinutes = Math.max(1, Math.round((distanceKm / 28) * 60));
  return language === "ar" ? `${etaMinutes} دقيقة تقريبًا` : `~${etaMinutes} min`;
}

function parseGoogleMapsCoordinates(value: string) {
  const match = value.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function distanceBetweenKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nextPromoCode(label: string, promos: PromoCode[]) {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || `promo-${Math.random().toString(36).slice(2, 8)}`;
  const existing = new Set(promos.map((promo) => promo.code));
  if (!existing.has(base)) return base;

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base.slice(0, 28)}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }

  return `promo-${Math.random().toString(36).slice(2, 8)}`;
}

function getDawnOperationDateValue(now: Date) {
  const operationDate = new Date(now);
  operationDate.setHours(0, 0, 0, 0);
  if (now.getHours() >= 10) {
    operationDate.setDate(operationDate.getDate() + 1);
  }
  return toDateInputValue(operationDate);
}

function isPastWashDeadline(bookingDate: string, currentTime: number) {
  if (!bookingDate || !currentTime) return false;
  const now = new Date(currentTime);
  const currentDate = toDateInputValue(now);
  if (bookingDate < currentDate) return true;
  if (bookingDate > currentDate) return false;
  return now.getHours() >= 5;
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

function adminTimelineLabel(label: string, language: "en" | "ar") {
  if (language === "en") return label;
  if (label.startsWith("Current status: ")) {
    return `الحالة الحالية: ${bookingStatusLabel(label.replace("Current status: ", ""), language)}`;
  }

  const labels: Record<string, string> = {
    "Booking submitted": "تم إرسال الحجز",
    "Booking confirmed": "تم تأكيد الحجز",
    "Auto cancelled": "تم الإلغاء تلقائيًا",
    "Status changed to Pending": "تم تغيير الحالة إلى معلق",
    "Status changed to Confirmed": "تم تغيير الحالة إلى مؤكد",
    "Status changed to Completed": "تم تغيير الحالة إلى تم الغسيل",
    "Status changed to Cancelled": "تم تغيير الحالة إلى ملغي",
    "Vehicle washed with proof": "تم تسجيل الغسيل مع صورة إثبات",
    "Service rated": "تم تقييم الخدمة",
    "Customer complaint received": "تم استلام شكوى العميل"
  };
  return labels[label] || label;
}

function adminTimelineNote(note: string, language: "en" | "ar") {
  if (language === "en") return note;
  if (note.startsWith("Completed by worker ")) {
    return `تم تنفيذ الغسيل بواسطة العامل ${note.replace("Completed by worker ", "")}`;
  }

  const notes: Record<string, string> = {
    "Awaiting payment confirmation.": "في انتظار تأكيد الدفع.",
    "Free wash promo applied.": "تم تطبيق بروموكود غسلة مجانية.",
    "Payment was not received within 3 hours.": "لم يتم استلام الدفع خلال 3 ساعات."
  };
  return notes[note] || note;
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
