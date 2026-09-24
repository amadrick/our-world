"use client";

import { ArrowLeft, LoaderCircle, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { site } from "@/config/site";
import { ApiError, signIn } from "@/lib/admin/api";

interface AdminLoginProps {
  enabled: boolean;
  defaultPasswordHint: string | null;
}

export function AdminLogin({ enabled, defaultPasswordHint }: AdminLoginProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn(password);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-map px-5 py-10">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-7 shadow-panel sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
          <Lock className="size-5 text-foreground/70" />
        </span>
        <h1 className="mt-5 font-serif text-[32px] leading-none">Add places</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Sign in to add recommendations to {site.title}.
        </p>

        {enabled ? (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px]">
                Admin password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl text-[16px]"
                aria-invalid={Boolean(error)}
              />
            </div>
            {error && (
              <p role="alert" className="text-[14px] text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={pending || !password}
              className="h-12 w-full rounded-xl text-[15px] font-semibold"
            >
              {pending && <LoaderCircle className="animate-spin" />}
              Sign in
            </Button>
            {defaultPasswordHint && (
              <p className="pt-1 text-center text-[13px] text-muted-foreground">
                Local default: <code className="font-mono text-foreground">{defaultPasswordHint}</code>
                . Set <code className="font-mono">ADMIN_PASSWORD</code> to change it.
              </p>
            )}
          </form>
        ) : (
          <p className="mt-6 rounded-2xl bg-note px-4 py-3 text-[14px] leading-relaxed text-note-foreground">
            Admin sign-in is turned off until <code className="font-mono">ADMIN_PASSWORD</code> is set
            for this deployment.
          </p>
        )}
      </div>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to the guide
      </Link>
    </main>
  );
}
