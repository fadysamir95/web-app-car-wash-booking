export const SERVICE_CONFIG = {
  governorate: "Giza",
  city: "New October City",
  areas: ["Degla Palms", "800 Feddan", "Sakan Misr", "Ebni Betak"],
  priceEgp: 25,
  bookingWindow: "12:00 AM to 5:00 AM",
  maxBookingsPerDay: 20,
  paymentPhone: "01208878827"
} as const;

export const PAYMENT_STATUSES = ["Pending", "Confirmed"] as const;
export const BOOKING_STATUSES = ["Pending", "Confirmed", "Cancelled", "Completed"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type ServiceArea = (typeof SERVICE_CONFIG.areas)[number];

export const ADMIN_SESSION_COOKIE = "carwash_admin";
