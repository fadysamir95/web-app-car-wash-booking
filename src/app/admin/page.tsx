import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLogin } from "@/components/admin-login";
import { isAdminAuthenticated } from "@/lib/admin";
import { readBookings } from "@/lib/store";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    return <AdminLogin />;
  }

  const bookings = await readBookings();
  return <AdminDashboard initialBookings={bookings} />;
}
