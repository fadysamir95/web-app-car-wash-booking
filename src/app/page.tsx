import Image from "next/image";
import { ArrowRight, Clock, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { BookingForm } from "@/components/booking-form";
import { SERVICE_CONFIG } from "@/lib/constants";

export default function Home() {
  return (
    <main>
      <section className="relative min-h-[92svh] overflow-hidden">
        <Image
          src="/images/hero-car-wash.png"
          alt="Clean car at night ready for mobile car wash service"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/88 via-slate-950/56 to-sky-950/20" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:py-10">
          <div className="flex min-h-[38svh] flex-col justify-center pb-2 pt-8 text-white lg:min-h-[82svh]">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-2 text-sm font-bold ring-1 ring-white/20">
              <Sparkles className="h-4 w-4 text-sky-200" />
              Overnight mobile wash
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.04] sm:text-5xl lg:text-6xl">
              Car Wash Booking
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-100 sm:text-lg">
              Book a polished car wash in {SERVICE_CONFIG.city}, {SERVICE_CONFIG.governorate}. We wash from{" "}
              {SERVICE_CONFIG.bookingWindow}, with only {SERVICE_CONFIG.maxBookingsPerDay} bookings per day.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#booking"
                className="inline-flex h-12 items-center gap-2 rounded-[8px] bg-sky-500 px-5 text-sm font-black text-white shadow-lg shadow-sky-950/25 transition hover:bg-sky-400"
              >
                Book your car wash
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/admin"
                className="inline-flex h-12 items-center rounded-[8px] bg-white/12 px-5 text-sm font-black text-white ring-1 ring-white/20 transition hover:bg-white/18"
              >
                Admin
              </a>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-slate-100 sm:grid-cols-3">
              <Fact icon={<Clock className="h-4 w-4" />} title="12 AM - 5 AM" />
              <Fact icon={<MapPin className="h-4 w-4" />} title="4 supported areas" />
              <Fact icon={<ShieldCheck className="h-4 w-4" />} title="Pay to confirm" />
            </div>
          </div>
          <div className="pb-10 lg:flex lg:items-end lg:pb-4">
            <BookingForm />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-4">
          {SERVICE_CONFIG.areas.map((area) => (
            <div key={area} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-sky-700">Available area</p>
              <h3 className="mt-2 text-lg font-black text-slate-950">{area}</h3>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Fact({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] bg-white/10 px-3 py-2 ring-1 ring-white/15">
      {icon}
      <span className="font-bold">{title}</span>
    </div>
  );
}
