import Image from "next/image";

export function BrandLogo({ compact = false, dark = false, size = "md", bare = false }: { compact?: boolean; dark?: boolean; size?: "md" | "lg"; bare?: boolean }) {
  const iconSize = size === "lg" ? "h-20 w-20" : "h-12 w-12";
  const textSize = size === "lg" ? "text-2xl" : "text-lg";
  const frameClass = bare
    ? iconSize
    : `${iconSize} grid shrink-0 place-items-center overflow-hidden rounded-[8px] bg-white p-0.5 shadow-sm ring-1 ring-slate-200`;

  return (
    <span className="inline-flex items-center gap-3">
      <span className={frameClass}>
        <Image src={bare ? "/images/vayax-logo-transparent.png" : "/images/vayax-icon.png"} alt="VAYAX logo" width={160} height={160} className="h-full w-full object-contain" />
      </span>
      {!compact ? (
        <span className="leading-none">
          <span className={`block font-black ${textSize} ${dark ? "text-white" : "text-slate-950 dark:text-white"}`}>VAYAX</span>
          <span className={`mt-1 block text-[0.68rem] font-bold ${dark ? "text-slate-200" : "text-slate-500 dark:text-slate-300"}`}>
            Your car, our care
          </span>
        </span>
      ) : null}
    </span>
  );
}
