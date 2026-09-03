import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; next?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : "/";

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:flex sm:items-center sm:justify-center">
      <div className="mx-auto w-full max-w-md rounded-[32px] border bg-card p-2 shadow-2xl shadow-black/5">
        <div className="rounded-[24px] bg-muted/35 p-6 sm:p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary text-lg font-black text-primary-foreground shadow-lg shadow-primary/25">N</div>
            <div>
              <p className="text-xl font-black tracking-tight">NOVA POS</p>
              <p className="text-sm text-muted-foreground">Secure business access</p>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to access your register and inventory.</p>
          </div>

          {params.error ? (
            <div className="mb-5 rounded-[16px] border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
              {params.error}
            </div>
          ) : null}

          <form action={login} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold">Email</label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@business.com" />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold">Password</label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
            </div>
            <Button type="submit" size="lg" className="w-full">
              <LockKeyhole className="mr-2 h-4 w-4" />
              Sign in
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-2 rounded-[16px] border bg-background/60 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            Access is protected by Supabase Auth and row-level database policies.
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            First-time owner?{" "}
            <Link href="/signup" className="font-bold text-primary hover:underline">Create the owner account</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
