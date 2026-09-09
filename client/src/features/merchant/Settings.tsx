import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Input, Label, Button } from "@/components/ui";
import { MerchantSetupStepper } from "@/features/onboarding/MerchantSetupStepper";
import { ShopifySyncTier } from "./ShopifySyncTier";
export function MerchantSettings() {
  const query = trpc.merchantAuth.getMerchantProfile.useQuery();
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    phone: "",
    address: "",
  });
  const save = trpc.merchantAuth.updateProfile.useMutation({
    onSuccess: () => void query.refetch(),
  });
  useEffect(() => {
    if (query.data)
      setForm({
        businessName: query.data.businessName,
        contactName: query.data.contactName || "",
        phone: query.data.phone || "",
        address: query.data.address || "",
      });
  }, [query.data]);
  return (
    <PageShell>
      <PageHeader
        title="Store settings"
        subtitle="Business details, payments and integrations."
      />
      <div className="flex-1 min-h-0 overflow-y-auto mobile-scroll max-w-3xl w-full mx-auto p-4 pb-28 space-y-6">
        <Link href="/account-settings" className="inline-block underline py-2">
          Account, notifications and sign out
        </Link>
        {query.isLoading ? (
          <p role="status">Loading business details…</p>
        ) : query.error ? (
          <p role="alert">
            Business details could not be loaded.{" "}
            <button onClick={() => void query.refetch()}>Retry</button>
          </p>
        ) : (
          <form
            className="rounded-2xl border p-5 space-y-4"
            onSubmit={e => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            <h2 className="font-semibold">Business details</h2>
            {(["businessName", "contactName", "phone", "address"] as const).map(
              key => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`merchant-${key}`}>
                    {
                      {
                        businessName: "Business name",
                        contactName: "Contact name",
                        phone: "Phone",
                        address: "Business address",
                      }[key]
                    }
                  </Label>
                  <Input
                    id={`merchant-${key}`}
                    required={key === "businessName"}
                    value={form[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              )
            )}
            <p className="text-sm text-muted-foreground">
              Country: {query.data?.country}. Account verification is managed
              separately from these contact details.
            </p>
            {save.error && <p role="alert">{save.error.message}</p>}
            {save.isSuccess && <p role="status">Business details saved.</p>}
            <Button disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save business details"}
            </Button>
            {query.data?.status === "active" && (
              <Link
                href={`/shop/supplier-${query.data.id}`}
                className="block underline"
              >
                Open your public store
              </Link>
            )}
          </form>
        )}
        <MerchantSetupStepper />
        <section className="rounded-2xl border p-5">
          <ShopifySyncTier />
        </section>
      </div>
    </PageShell>
  );
}
