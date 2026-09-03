import { Building2, MapPin, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBusiness } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

export default async function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:flex sm:items-center sm:justify-center">
      <div className="mx-auto w-full max-w-xl rounded-[36px] border bg-card p-2 shadow-2xl shadow-black/5">
        <div className="rounded-[28px] bg-muted/35 p-6 sm:p-9">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary text-lg font-black text-primary-foreground">N</div>
            <div><p className="text-xl font-black tracking-tight">NOVA POS</p><p className="text-sm text-muted-foreground">First-time setup</p></div>
          </div>

          <h1 className="text-3xl font-black tracking-tight">Set up your business</h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">This creates your owner workspace and the default <strong>Main</strong> inventory location. You can add products immediately afterward.</p>

          {params.error ? <div className="mt-5 rounded-[16px] border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">{params.error}</div> : null}

          <form action={createBusiness} className="mt-7 space-y-5">
            <div className="rounded-[24px] border bg-background p-2">
              <div className="rounded-[16px] p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-primary" />Business name</div>
                <Input name="name" required minLength={2} maxLength={120} placeholder="e.g. NECROS Atelier" className="bg-muted/40" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border bg-background p-2">
                <div className="rounded-[16px] p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><WalletCards className="h-4 w-4 text-primary" />Currency</div>
                  <Input name="currencyCode" defaultValue="LKR" maxLength={3} required className="uppercase bg-muted/40" />
                </div>
              </div>
              <div className="rounded-[24px] border bg-background p-2">
                <div className="rounded-[16px] p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" />Timezone</div>
                  <Input name="timezone" defaultValue="Asia/Colombo" required className="bg-muted/40" />
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full">Create business workspace</Button>
          </form>

          <form action="/auth/signout" method="post" className="mt-4 text-center">
            <button className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline" type="submit">Sign out and use another account</button>
          </form>
        </div>
      </div>
    </main>
  );
}
