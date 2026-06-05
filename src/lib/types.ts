import type { BookingStatus, PaymentStatus, ServiceArea } from "./constants";

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
  referralCode?: string;
  loyaltyPoints: number;
  marketingConsent: boolean;
  consent: true;
  washWindowAcknowledged: true;
  sourceLanguage: "en" | "ar";
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  createdAt: string;
};

export type BookingInput = Omit<
  Booking,
  | "id"
  | "customerId"
  | "bookingTimeWindow"
  | "paymentStatus"
  | "bookingStatus"
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
