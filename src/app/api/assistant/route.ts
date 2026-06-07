import { NextResponse } from "next/server";
import { readBookings, readSettings } from "@/lib/store";
import { normalizePhone } from "@/lib/validation";

type AssistantAction = {
  label: string;
  href: string;
};

function isArabic(text: string) {
  return /[\u0600-\u06ff]/.test(text);
}

function response(answer: string, action?: AssistantAction) {
  return NextResponse.json({ answer, action });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = String(body?.message || "").trim();
  const arabic = isArabic(message);
  const settings = await readSettings();

  if (!message) {
    return response(
      arabic
        ? "اسألني عن الحجز، السعر، الدفع، النقاط، أو تتبع حجزك."
        : "Ask me about booking, pricing, payment, rewards, or your booking status."
    );
  }

  const lower = message.toLowerCase();
  const phone = normalizePhone(message);
  const reference = message.toUpperCase().match(/CW-[A-Z0-9]{6}/)?.[0];

  if (reference || /^01[0125]\d{8}$/.test(phone)) {
    const bookings = await readBookings();
    const booking = bookings.find((item) => item.id === reference || item.phoneNumber === phone);
    if (booking) {
      return response(
        arabic
          ? `حجزك ${booking.id}: الحالة ${booking.bookingStatus}. التاريخ ${booking.bookingDate}. المنطقة ${booking.areaName || booking.area}.`
          : `Booking ${booking.id}: ${booking.bookingStatus}. Date: ${booking.bookingDate}. Area: ${booking.areaName || booking.area}.`,
        { label: arabic ? "فتح تتبع الحجز" : "Open booking tracking", href: `/my-booking?ref=${booking.id}` }
      );
    }
    return response(
      arabic ? "لم أجد حجزًا بهذا الرقم. جرّب رقم الحجز أو رقم الهاتف المستخدم في الحجز." : "I could not find a booking with that value. Try the booking reference or the phone number used for booking.",
      { label: arabic ? "صفحة حجوزاتي" : "My Bookings", href: "/my-booking" }
    );
  }

  if (lower.includes("book") || lower.includes("reserve") || lower.includes("rebook") || message.includes("احجز") || message.includes("حجز") || message.includes("مرة تانية")) {
    return response(
      arabic ? "يمكنك بدء حجز جديد من الفورم الرئيسي. لو كنت حجزت قبل كده، بعد التحقق من رقم الهاتف هنقترح عليك بياناتك السابقة لتوفير الوقت." : "You can start a new booking from the main form. If you booked before, phone verification will let you reuse previous details.",
      { label: arabic ? "اذهب للحجز" : "Go to booking", href: "/#booking" }
    );
  }

  if (lower.includes("status") || lower.includes("track") || lower.includes("my booking") || message.includes("تتبع") || message.includes("حجوزاتي") || message.includes("حالة")) {
    return response(
      arabic ? "افتح صفحة حجوزاتي واكتب رقم الهاتف أو رقم الحجز لعرض الحالة وإرسال صورة التحويل عند الحاجة." : "Open My Bookings and enter your phone number or booking reference to view the status and send the payment screenshot when needed.",
      { label: arabic ? "فتح حجوزاتي" : "Open My Bookings", href: "/my-booking" }
    );
  }

  if (lower.includes("price") || lower.includes("cost") || message.includes("سعر") || message.includes("تكلفة")) {
    const activePrices = settings.areas.filter((area) => area.active).map((area) => area.priceEgp);
    const minPrice = Math.min(...activePrices, settings.servicePriceEgp);
    return response(
      arabic ? `تبدأ أسعار الخدمة من ${minPrice} جنيه حسب المنطقة المختارة، والسعر النهائي يظهر قبل تأكيد الحجز.` : `Service prices start from ${minPrice} EGP depending on the selected area. The final price appears before booking confirmation.`,
      { label: arabic ? "احجز الآن" : "Book now", href: "/#booking" }
    );
  }

  if (lower.includes("payment") || lower.includes("instapay") || lower.includes("wallet") || message.includes("دفع") || message.includes("تحويل") || message.includes("انستاباي") || message.includes("محفظة")) {
    return response(
      arabic
        ? `بعد إرسال الحجز ستظهر تعليمات الدفع. رقم التحويل وواتساب التأكيد هو ${settings.paymentPhone}.`
        : `After submitting a booking, payment instructions appear on the confirmation page. Payment and WhatsApp confirmation number: ${settings.paymentPhone}.`,
      { label: arabic ? "تتبع حجزك" : "Track your booking", href: "/my-booking" }
    );
  }

  if (lower.includes("reward") || lower.includes("points") || lower.includes("loyalty") || message.includes("نقاط") || message.includes("مكافآت")) {
    return response(
      arabic ? "كل غسلة مكتملة تضيف 10 نقاط. عند 100 نقطة يمكنك استخدام المكافأة للحصول على غسلة مجانية." : "Every completed wash earns 10 points. At 100 points, you can redeem a free wash.",
      { label: arabic ? "احجز واستخدم النقاط" : "Book and redeem points", href: "/#booking" }
    );
  }

  if (lower.includes("time") || lower.includes("window") || message.includes("موعد") || message.includes("الساعة")) {
    return response(
      arabic ? `موعد غسيل السيارة: ${settings.washWindowAr}. آخر موعد للحجز قبل بداية يوم الغسيل الساعة 12:00 صباحًا.` : `Vehicle washing window: ${settings.washWindow}. Booking closes when the wash day starts at 12:00 AM.`,
      { label: arabic ? "اختيار موعد الحجز" : "Choose booking date", href: "/#booking" }
    );
  }

  if (lower.includes("complaint") || lower.includes("problem") || message.includes("شكوى") || message.includes("مشكلة")) {
    return response(
      arabic ? "لو الخدمة اكتملت، افتح صفحة حجوزاتي وقيّم الخدمة. إذا كان التقييم أقل من 3 نجوم سيظهر لك فورم الشكوى تلقائيًا." : "If the service is completed, open My Bookings and rate it. If the rating is below 3 stars, the complaint form appears automatically.",
      { label: arabic ? "فتح حجوزاتي" : "Open My Bookings", href: "/my-booking" }
    );
  }

  return response(
    arabic
      ? "أقدر أساعدك في الحجز، السعر، الدفع، تتبع الحجز، النقاط، أو الشكاوى. اكتب رقم الحجز أو رقم الهاتف لو عايز تعرف حالة حجزك."
      : "I can help with bookings, pricing, payment instructions, booking status, rewards, and complaints. Share your booking reference or phone number for status.",
    { label: arabic ? "ابدأ من الصفحة الرئيسية" : "Go to homepage", href: "/" }
  );
}
