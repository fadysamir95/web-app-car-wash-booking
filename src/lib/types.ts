import type { BookingStatus, PaymentStatus, ServiceArea } from "./constants";

export type Booking = {
  id: string;
  customerName: string;
  phoneNumber: string;
  carType: string;
  plateNumber: string;
  carImageName?: string;
  area: ServiceArea;
  address: string;
  buildingNumber: string;
  carLocation: string;
  bookingDate: string;
  bookingTimeWindow: string;
  notes?: string;
  promoCode?: string;
  consent: true;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  createdAt: string;
};

export type BookingInput = Omit<
  Booking,
  "id" | "bookingTimeWindow" | "paymentStatus" | "bookingStatus" | "createdAt" | "consent"
> & {
  consent: boolean;
};

export type BookingCapacity = {
  date: string;
  count: number;
  remaining: number;
  fullyBooked: boolean;
};
