import { Skeleton } from "@/components/ui/skeleton";

function PillsSkeleton({ count }: { count: number }) {
  return (
    <div className="flex gap-2 overflow-hidden py-1">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-11 w-28 shrink-0 rounded-full" />
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-canvas" aria-busy>
      <div className="glass absolute top-4 bottom-4 left-4 hidden w-[400px] flex-col overflow-hidden rounded-2xl lg:flex">
        <div className="px-6 pt-6 pb-2">
          <Skeleton className="h-6 w-72 rounded-full" />
          <div className="mt-4">
            <PillsSkeleton count={4} />
          </div>
          <Skeleton className="mt-4 h-4 w-20 rounded-full" />
        </div>
        <div className="space-y-1 p-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 p-2">
              <Skeleton className="size-18 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="h-3 w-32 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 top-0 px-4 pt-[max(env(safe-area-inset-top),10px)] pb-3 lg:hidden">
        <PillsSkeleton count={3} />
      </div>
      <Skeleton className="absolute bottom-[max(env(safe-area-inset-bottom),16px)] left-1/2 h-14 w-56 -translate-x-1/2 rounded-full lg:bottom-6 lg:left-[calc(50%+216px)]" />
    </main>
  );
}
