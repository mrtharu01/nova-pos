import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signup } from "@/app/login/actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:flex sm:items-center sm:justify-center">
      <div className="mx-auto w-full max-w-md rounded-[32px] border bg-card p-2 shadow-2xl shadow-black/5">
        <div className="rounded-[24px] bg-muted/35 p-6 sm:p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary text-lg font-black text-primary-foreground">N</div>
            <div>
              <p className="text-xl font-black tracking-tight">NOVA POS</p>
              <p className="text-sm text-muted-foreground">Owner setup</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Create owner account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the email that should own and manage this POS.</p>

          {params.error ? (
            <div className="mt-5 rounded-[16px] border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">{params.error}</div>
          ) : null}

          <form action={signup} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold">Owner email</label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="owner@business.com" />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold">Password</label>
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="At least 8 characters" />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm password</label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required placeholder="Repeat password" />
            </div>
            <Button type="submit" size="lg" className="w-full">
              <UserPlus className="mr-2 h-4 w-4" />
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already created it?{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
