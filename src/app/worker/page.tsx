import { AdminLogin } from "@/components/admin-login";
import { WorkerBoard } from "@/components/worker-board";
import { isAdminAuthenticated } from "@/lib/admin";
import { getTomorrowDateValue, toDateInputValue } from "@/lib/date";
import { readBookings } from "@/lib/store";

export default async function WorkerPage() {
  if (!(await isAdminAuthenticated())) {
    return <AdminLogin />;
  }

  const today = toDateInputValue(new Date());
  const tomorrow = getTomorrowDateValue();
  const bookings = (await readBookings()).filter((booking) => booking.bookingDate === today || booking.bookingDate === tomorrow);
  return <WorkerBoard initialBookings={bookings} />;
}
