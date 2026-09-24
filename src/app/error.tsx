"use client";

import { RotateCcw } from "react-feather";
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
      <div className="max-w-sm glass glass-thick rounded-[32px] p-8 text-center">
        <p className="text-lg font-medium">Something went sideways</p>
        <p className="mt-2 text-base text-muted-foreground">
          The guide couldn’t load just now. Give it another try in a moment.
        </p>
        <Button onClick={reset} className="mt-6">
          <RotateCcw size={16} />
          Try again
        </Button>
      </div>
    </main>
  );
}
