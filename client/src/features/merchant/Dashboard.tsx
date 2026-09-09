import { Link } from "wouter";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Button } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { MerchantSetupStepper } from "@/features/onboarding/MerchantSetupStepper";

export function MerchantDashboard() {
  const profile = trpc.merchantAuth.getMerchantProfile.useQuery();
  const stats = trpc.merchantAuth.getDashboardStats.useQuery();
  return (
    <PageShell>
      <PageHeader
        title="Your store"
        subtitle={
          profile.data?.businessName ||
          "Orders, products and payments in one place."
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto mobile-scroll max-w-4xl mx-auto w-full px-4 py-5 pb-28 space-y-5">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/merchant/orders"
            className="rounded-full bg-primary text-primary-foreground px-5 py-3 font-semibold"
          >
            Manage orders
          </Link>
          <Link
            href="/merchant/products"
            className="rounded-full border px-5 py-3"
          >
            Products
          </Link>
          <Link href="/settings" className="rounded-full border px-5 py-3">
            Settings
          </Link>
        </div>
        {(profile.error || stats.error) && (
          <div role="alert" className="rounded-2xl border p-5">
            <p>We couldn't load your store. Your saved data has not changed.</p>
            <Button
              variant="outline"
              onClick={() => {
                void profile.refetch();
                void stats.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        )}
        {stats.isLoading && <p role="status">Loading store activity…</p>}
        {stats.data && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Paid sales</p>
              <strong className="text-2xl">
                {new Intl.NumberFormat("en-AU", {
                  style: "currency",
                  currency: profile.data?.country === "NZ" ? "NZD" : "AUD",
                }).format(stats.data.revenueCents / 100)}
              </strong>
              <p className="text-xs text-muted-foreground mt-2">
                Recorded paid and fulfilled orders, before fees.
              </p>
            </div>
            <Link
              href="/merchant/orders"
              className="rounded-2xl border bg-card p-5"
            >
              <p className="text-sm text-muted-foreground">Ready to fulfil</p>
              <strong className="text-2xl">{stats.data.pendingOrders}</strong>
              <p className="text-xs mt-2">View paid orders →</p>
            </Link>
            <Link
              href="/merchant/products"
              className="rounded-2xl border bg-card p-5"
            >
              <p className="text-sm text-muted-foreground">
                Low-stock products
              </p>
              <strong className="text-2xl">{stats.data.lowStockItems}</strong>
              <p className="text-xs mt-2">Review inventory →</p>
            </Link>
            <div className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Completed sales</p>
              <strong className="text-2xl">{stats.data.totalOrders}</strong>
            </div>
          </div>
        )}
        <MerchantSetupStepper />
        <section className="rounded-2xl border bg-card p-5 space-y-2">
          <h2 className="font-semibold">Keep your catalogue current</h2>
          <p className="text-sm text-muted-foreground">
            Manage products and stock, or connect Shopify to import your
            catalogue.
          </p>
          <Link
            href="/merchant/products"
            className="inline-block underline py-2"
          >
            Open products
          </Link>
        </section>
      </div>
    </PageShell>
  );
}
