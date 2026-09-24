"use client";

import { ArrowLeft, Loader } from "react-feather";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { site } from "@/config/site";
import { ApiError, signIn } from "@/lib/admin/api";
import { ImageBackdrop } from "./image-backdrop";

interface AdminLoginProps {
  backdrop: string[];
  enabled: boolean;
  defaultPasswordHint: string | null;
}

export function AdminLogin({ backdrop, enabled, defaultPasswordHint }: AdminLoginProps) {
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
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <ImageBackdrop images={backdrop} />
      <div className="glass glass-thick w-full max-w-sm rounded-[32px] p-7 sm:p-8">
        <h1 className="text-xl font-medium">Add places</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Sign in to add recommendations to {site.title}.
        </p>

        {enabled ? (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="password">Admin password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={pending || !password} className="w-full">
              {pending && <Loader size={16} className="animate-spin" />}
              Sign in
            </Button>
            {defaultPasswordHint && (
              <p className="pt-1 text-center text-sm text-muted-foreground">
                Local default: <span className="text-foreground">{defaultPasswordHint}</span>. Set
                ADMIN_PASSWORD to change it.
              </p>
            )}
          </form>
        ) : (
          <p className="glass-fill mt-6 rounded-[20px] px-4 py-3 text-sm">
            Admin sign-in is turned off until ADMIN_PASSWORD is set for this deployment.
          </p>
        )}
      </div>
      <Link
        href="/"
        className="glass glass-interactive mt-6 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm"
      >
        <ArrowLeft size={14} />
        Back to the guide
      </Link>
    </main>
  );
}
