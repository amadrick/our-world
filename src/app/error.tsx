"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-map p-6">
      <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-panel">
        <p className="font-serif text-[30px] leading-tight">Something went sideways</p>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          The guide couldn&apos;t load just now. Give it another try in a moment.
        </p>
        <Button onClick={reset} className="mt-6 h-11 rounded-full px-6">
          <RotateCcw />
          Try again
        </Button>
      </div>
    </main>
  );
}
