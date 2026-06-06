export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTomorrowDateValue(baseDate = new Date()) {
  const tomorrow = new Date(baseDate);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateInputValue(tomorrow);
}

export function getEarliestBookingDateValue(baseDate = new Date()) {
  return getTomorrowDateValue(baseDate);
}

export function isBookingDateAllowed(value: string, baseDate = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value >= getEarliestBookingDateValue(baseDate);
}

export function getUpcomingDateValues(days = 14, baseDate = new Date()) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index + 1);
    return toDateInputValue(date);
  });
}

export function formatDisplayDate(value: string, language: "en" | "ar" = "en") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}
