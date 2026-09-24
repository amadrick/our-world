import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-map" aria-busy>
      <div className="absolute top-4 bottom-4 left-4 hidden w-[400px] flex-col gap-4 rounded-[28px] bg-white/90 p-6 shadow-panel lg:flex">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full" />
        <div className="flex flex-wrap gap-2 pt-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-3 pt-2">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[46%] rounded-t-[28px] bg-white p-5 lg:hidden">
        <Skeleton className="mx-auto h-1.5 w-10" />
        <Skeleton className="mt-5 h-5 w-28" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="mt-5 flex gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
