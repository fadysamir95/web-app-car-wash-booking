import { DEFAULT_SERVICE } from "./constants";
import type { Booking, PromoCode } from "./types";

export function promoDiscountAmount(promo: PromoCode | null | undefined, basePrice: number = DEFAULT_SERVICE.priceEgp) {
  if (!promo) return 0;
  if (promo.type === "free_wash") return basePrice;
  if (promo.discountType === "percentage") {
    return Math.min(basePrice, Math.round(basePrice * Math.min(Math.max(promo.discountPercent || 0, 0), 100) / 100));
  }
  return Math.min(basePrice, Math.max(promo.discountEgp || 0, 0));
}

export function finalPriceFromPromo(promo: PromoCode | null | undefined, basePrice: number = DEFAULT_SERVICE.priceEgp) {
  return Math.max(basePrice - promoDiscountAmount(promo, basePrice), 0);
}

export function bookingFinalPrice(booking: Booking, promos: readonly PromoCode[] = []) {
  if (typeof booking.finalPriceEgp === "number") return booking.finalPriceEgp;
  const promo = booking.promoCode ? promos.find((item) => item.code === booking.promoCode) : null;
  return finalPriceFromPromo(promo);
}

export function promoDisplayValue(promo: PromoCode) {
  return promo.discountType === "percentage" ? `${promo.discountPercent || 0}%` : `${promo.discountEgp} EGP`;
}
