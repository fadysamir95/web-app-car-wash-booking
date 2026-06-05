import type { BookingStatus, PaymentStatus, ServiceArea } from "./constants";

export type BookingTimelineEvent = {
  status: BookingStatus;
  label: string;
  createdAt: string;
  note?: string;
};

export type PromoCode = {
  code: string;
  type: "fixed" | "free_wash";
  discountEgp: number;
  label: string;
  active: boolean;
  maxUses?: number;
  expiresAt?: string;
};

export type Booking = {
  id: string;
  customerId: string;
  customerName: string;
  phoneNumber: string;
  carBrand: string;
  carModel: string;
  carColor: string;
  plateNumber?: string;
  carImageName?: string;
  governorate: string;
  city: string;
  area: ServiceArea;
  areaName: string;
  address?: string;
  buildingNumber?: string;
  carLocation?: string;
  bookingDate: string;
  bookingTimeWindow: string;
  notes?: string;
  promoCode?: string;
  finalPriceEgp?: number;
  loyaltyPoints: number;
  marketingConsent: boolean;
  consent: true;
  washWindowAcknowledged: true;
  sourceLanguage: "en" | "ar";
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  expiresAt?: string;
  cancellationReason?: string;
  timeline: BookingTimelineEvent[];
  createdAt: string;
};

export type BookingInput = Omit<
  Booking,
  | "id"
  | "customerId"
  | "bookingTimeWindow"
  | "paymentStatus"
  | "bookingStatus"
  | "expiresAt"
  | "cancellationReason"
  | "timeline"
  | "finalPriceEgp"
  | "createdAt"
  | "consent"
  | "washWindowAcknowledged"
> & {
  consent: boolean;
  washWindowAcknowledged: boolean;
};

export type BookingCapacity = {
  date: string;
  count: number;
  remaining: number;
  fullyBooked: boolean;
};

export type CustomerSummary = {
  customerId: string;
  customerName: string;
  phoneNumber: string;
  carBrand: string;
  carModel: string;
  carColor: string;
  plateNumber?: string;
  area: string;
  totalBookings: number;
  lastBookingDate: string;
  loyaltyPoints: number;
};
