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
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-8 text-center shadow-raised">
        <p className="text-lg font-semibold">Something went sideways</p>
        <p className="mt-2 text-base text-muted-foreground">
          The guide couldn’t load just now. Give it another try in a moment.
        </p>
        <Button onClick={reset} size="lg" className="mt-6 w-full">
          <RotateCcw size={18} />
          Try again
        </Button>
      </div>
    </main>
  );
}
