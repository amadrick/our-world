import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-map" aria-busy>
      <div className="absolute top-4 bottom-4 left-4 hidden w-[400px] flex-col gap-4 rounded-[32px] glass p-6 lg:flex">
        <Skeleton className="mt-1 h-8 w-72" />
        <Skeleton className="h-4 w-full" />
        <div className="flex flex-wrap gap-2 pt-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-3.5 pt-3">
            <Skeleton className="size-11 rounded-[14px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-2 bottom-2 h-[48%] rounded-[32px] glass p-5 lg:hidden">
        <Skeleton className="mx-auto h-1 w-9" />
        <Skeleton className="mt-5 h-6 w-64" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="mt-5 flex gap-3.5">
            <Skeleton className="size-11 rounded-[14px]" />
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
