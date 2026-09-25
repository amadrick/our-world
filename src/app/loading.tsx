import { Skeleton } from "@/components/ui/skeleton";

function TabsSkeleton({ count }: { count: number }) {
  return (
    <div className="flex gap-6 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-16 shrink-0 flex-col items-center justify-center gap-2">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-3 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ChipsSkeleton({ count }: { count: number }) {
  return (
    <div className="flex gap-2 overflow-hidden pt-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-11 w-28 shrink-0 rounded-full" />
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-canvas" aria-busy>
      <div className="absolute top-4 bottom-4 left-4 hidden w-[400px] flex-col overflow-hidden rounded-2xl bg-surface shadow-raised lg:flex">
        <div className="border-b border-hairline px-6 pt-6 pb-4">
          <Skeleton className="h-6 w-72 rounded-full" />
          <div className="mt-3">
            <TabsSkeleton count={6} />
            <ChipsSkeleton count={3} />
          </div>
          <Skeleton className="mt-5 h-4 w-20 rounded-full" />
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
      <div className="absolute inset-x-0 top-0 border-b border-hairline bg-surface px-4 pt-[max(env(safe-area-inset-top),8px)] pb-3 lg:hidden">
        <TabsSkeleton count={5} />
        <ChipsSkeleton count={3} />
      </div>
      <Skeleton className="absolute bottom-[max(env(safe-area-inset-bottom),16px)] left-1/2 h-14 w-56 -translate-x-1/2 rounded-full lg:bottom-6 lg:left-[calc(50%+216px)]" />
    </main>
  );
}
