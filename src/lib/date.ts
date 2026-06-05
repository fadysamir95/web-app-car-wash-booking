export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTomorrowDateValue() {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateInputValue(tomorrow);
}

export function isBookingDateAllowed(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value >= getTomorrowDateValue();
}

export function getUpcomingDateValues(days = 14) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index + 1);
    return toDateInputValue(date);
  });
}

export function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-EG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}
