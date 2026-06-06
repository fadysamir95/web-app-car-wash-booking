import { WorkerLogin } from "@/components/worker-login";
import { WorkerBoard } from "@/components/worker-board";
import { getAuthenticatedWorkerId, isWorkerAuthenticated } from "@/lib/admin";
import { getTomorrowDateValue, toDateInputValue } from "@/lib/date";
import { readBookings } from "@/lib/store";
import { getWorkerById, publicWorker } from "@/lib/workers";

export default async function WorkerPage() {
  if (!(await isWorkerAuthenticated())) {
    return <WorkerLogin />;
  }

  const today = toDateInputValue(new Date());
  const tomorrow = getTomorrowDateValue();
  const workerId = await getAuthenticatedWorkerId();
  const worker = workerId ? await getWorkerById(workerId) : null;
  const allowedAreas = new Set(worker?.areas || []);
  const bookings = (await readBookings()).filter(
    (booking) => (booking.bookingDate === today || booking.bookingDate === tomorrow) && (allowedAreas.size === 0 || allowedAreas.has(booking.area))
  );
  return <WorkerBoard initialBookings={bookings} worker={worker ? publicWorker(worker) : null} />;
}
