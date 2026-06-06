import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLogin } from "@/components/admin-login";
import { isAdminAuthenticated } from "@/lib/admin";
import { readBookings, readSettings } from "@/lib/store";
import { publicWorker, readWorkers } from "@/lib/workers";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    return <AdminLogin />;
  }

  const [bookings, settings, workers] = await Promise.all([readBookings(), readSettings(), readWorkers()]);
  return <AdminDashboard initialBookings={bookings} initialSettings={settings} initialWorkers={workers.map(publicWorker)} />;
}
