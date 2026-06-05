export const SERVICE_CONFIG = {
  governorates: [
    {
      id: "giza",
      name: { en: "Giza", ar: "الجيزة" },
      cities: [
        {
          id: "new-october-city",
          name: { en: "New October City", ar: "6 أكتوبر الجديدة" },
          areas: [
            { id: "degla-palms", name: { en: "Degla Palms", ar: "دجلة بالمز" }, priceEgp: 25 },
            { id: "800-feddan", name: { en: "800 Feddan", ar: "800 فدان" }, priceEgp: 25 },
            { id: "sakan-misr", name: { en: "Sakan Misr", ar: "سكن مصر" }, priceEgp: 25 },
            { id: "ebni-betak", name: { en: "Ebni Betak", ar: "ابني بيتك" }, priceEgp: 25 }
          ]
        }
      ]
    }
  ],
  services: [
    {
      id: "standard-wash",
      name: { en: "Standard Car Wash", ar: "غسيل سيارة عادي" },
      priceEgp: 25,
      bookingWindow: "12:00 AM to 5:00 AM",
      bookingWindowAr: "12:00 صباحًا إلى 5:00 صباحًا"
    }
  ],
  maxBookingsPerDay: 20,
  paymentPhone: "01208878827",
  carBrands: ["Toyota", "Hyundai", "Kia", "BMW", "Mercedes", "Nissan", "Chevrolet", "MG", "Renault", "Peugeot", "Other"]
} as const;

export const PROMO_CODES = [
  {
    code: "free-wash",
    type: "free_wash",
    discountEgp: SERVICE_CONFIG.services[0].priceEgp,
    label: "Free wash"
  }
] as const;

export const DEFAULT_GOVERNORATE = SERVICE_CONFIG.governorates[0];
export const DEFAULT_CITY = DEFAULT_GOVERNORATE.cities[0];
export const DEFAULT_SERVICE = SERVICE_CONFIG.services[0];
export const SERVICE_AREAS = DEFAULT_CITY.areas;

export const PAYMENT_STATUSES = ["Pending", "Verified", "Rejected"] as const;
export const BOOKING_STATUSES = [
  "Pending Payment",
  "Payment Under Review",
  "Confirmed",
  "Scheduled",
  "Completed",
  "Cancelled"
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type ServiceArea = (typeof SERVICE_AREAS)[number]["id"];

export const ADMIN_SESSION_COOKIE = "carwash_admin";
