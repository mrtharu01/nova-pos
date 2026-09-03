import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ email?: string }>;

export default async function CheckEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const { email } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-[32px] border bg-card p-2 shadow-xl">
        <div className="rounded-[24px] bg-muted/35 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary/10 text-primary"><MailCheck className="h-7 w-7" /></div>
          <h1 className="mt-5 text-2xl font-bold">Check your email</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            We sent a confirmation link{email ? <> to <strong className="text-foreground">{email}</strong></> : null}. Confirm it to activate your NOVA owner account.
          </p>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
