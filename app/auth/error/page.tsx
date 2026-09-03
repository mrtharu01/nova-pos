import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-[32px] border bg-card p-2 shadow-xl">
        <div className="rounded-[24px] bg-muted/35 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-destructive/10 text-destructive"><CircleAlert className="h-7 w-7" /></div>
          <h1 className="mt-5 text-2xl font-bold">Authentication link failed</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">The link may have expired or already been used. Try signing in or creating the account again.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button asChild variant="outline"><Link href="/signup">Sign up</Link></Button>
            <Button asChild><Link href="/login">Sign in</Link></Button>
          </div>
        </div>
      </div>
    </main>
  );
}
