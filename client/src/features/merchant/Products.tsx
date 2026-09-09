import { useState } from "react";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Plus, Search } from "lucide-react";
import { Input, Button, Label } from "@/components/ui";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { trpc } from "@/lib/trpc";
import { ShopifySyncTier } from "./ShopifySyncTier";

type ProductDraft = {
  id?: number;
  title: string;
  description: string;
  price: string;
  stock: string;
  shipping: string;
  imageUrl: string;
  fulfillmentType: "pickup" | "delivery" | "both" | "digital";
  isActive: boolean;
  variants?: { id: number; name: string; price: string; stock: string }[];
};
const empty: ProductDraft = {
  title: "",
  description: "",
  price: "",
  stock: "0",
  shipping: "0",
  imageUrl: "",
  fulfillmentType: "delivery",
  isActive: true,
};
export function MerchantProducts() {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const query = trpc.storefront.getProducts.useQuery();
  const utils = trpc.useUtils();
  const saved = () => {
    setDraft(null);
    void query.refetch();
    void utils.merchantAuth.getDashboardStats.invalidate();
  };
  const create = trpc.storefront.createProduct.useMutation({
    onSuccess: saved,
  });
  const update = trpc.storefront.updateProduct.useMutation({
    onSuccess: saved,
  });
  const busy = create.isPending || update.isPending;
  const products = (query.data || []).filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );
  const edit = (product?: NonNullable<typeof query.data>[number]) => {
    create.reset();
    update.reset();
    setDraft(
      product
        ? {
            id: product.id,
            title: product.title,
            description: product.description || "",
            price: (product.priceCents / 100).toFixed(2),
            stock: String(product.inventoryCount),
            shipping: ((product.shippingCents || 0) / 100).toFixed(2),
            imageUrl: product.imageUrl || "",
            fulfillmentType: product.fulfillmentType,
            isActive: product.isActive === 1,
            variants: product.variants.map(v => ({
              id: v.id,
              name: v.name,
              price: (v.priceCents / 100).toFixed(2),
              stock: String(v.inventoryCount),
            })),
          }
        : { ...empty }
    );
  };
  return (
    <PageShell>
      <PageHeader
        title="Products"
        subtitle="Your catalogue, ready for your customers."
      />
      <div className="px-4 py-4 space-y-5 max-w-4xl mx-auto">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
            <Input
              aria-label="Search products"
              placeholder="Search products"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
          <Button className="h-12" onClick={() => edit()}>
            <Plus className="w-4 h-4 mr-2" />
            Add product
          </Button>
          <Button
            className="h-12"
            variant="outline"
            onClick={() => setSyncOpen(true)}
          >
            Shopify sync
          </Button>
        </div>
        {query.isLoading && <p role="status">Loading your catalogue…</p>}
        {query.error && (
          <div role="alert" className="rounded-xl border p-5">
            <p>We couldn't load your products.</p>
            <Button variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {!query.isLoading && !query.error && products.length === 0 && (
          <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
            <h2 className="text-xl font-semibold">
              {search ? "No matching products" : "Your catalogue starts here"}
            </h2>
            <p className="text-muted-foreground">
              {search
                ? "Try a different product name."
                : "Add your first product or connect Shopify to import your catalogue."}
            </p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map(p => (
            <button
              key={p.id}
              onClick={() => edit(p)}
              className="flex gap-4 rounded-2xl border bg-card p-4 text-left hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
            >
              {p.imageUrl && (
                <img
                  src={p.imageUrl}
                  alt=""
                  className="w-20 h-20 rounded-xl object-cover"
                  loading="lazy"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="font-semibold block truncate">{p.title}</span>
                <span className="block mt-1">
                  ${(p.priceCents / 100).toFixed(2)}
                </span>
                <span className="block text-sm text-muted-foreground mt-2">
                  {p.variants.length
                    ? p.variants.reduce((sum, v) => sum + v.inventoryCount, 0)
                    : p.inventoryCount}{" "}
                  in stock · {p.isActive ? "Published" : "Hidden"}
                </span>
              </span>
              <span className="text-sm text-primary">Edit</span>
            </button>
          ))}
        </div>
      </div>
      <SheetShell
        isOpen={syncOpen}
        onClose={() => setSyncOpen(false)}
        title="Connect Shopify"
        description="Import and refresh your catalogue."
      >
        <ShopifySyncTier />
      </SheetShell>
      <SheetShell
        isOpen={!!draft}
        onClose={() => !busy && setDraft(null)}
        title={draft?.id ? "Edit product" : "Add product"}
        description="Set the details your customers need to order."
      >
        {draft && (
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              const data = {
                title: draft.title.trim(),
                description: draft.description,
                priceCents: draft.variants?.length
                  ? Math.min(
                      ...draft.variants.map(v =>
                        Math.round(Number(v.price) * 100)
                      )
                    )
                  : Math.round(Number(draft.price) * 100),
                inventoryCount: Number(draft.stock),
                shippingCents: Math.round(Number(draft.shipping) * 100),
                fulfillmentType: draft.fulfillmentType,
                ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
                isActive: draft.isActive,
                variants: draft.variants?.map(v => ({
                  id: v.id,
                  priceCents: Math.round(Number(v.price) * 100),
                  inventoryCount: Number(v.stock),
                })),
              };
              if (draft.id) update.mutate({ ...data, id: draft.id });
              else create.mutate(data);
            }}
          >
            {(
              [
                ["title", "Product name", "text"],
                ["price", "Price ($)", "number"],
                ["stock", "Quantity in stock", "number"],
                ["shipping", "Delivery charge ($)", "number"],
                ["imageUrl", "Image URL (optional)", "url"],
              ] as const
            )
              .filter(
                ([field]) =>
                  !draft.variants?.length || !["price", "stock"].includes(field)
              )
              .map(([field, label, type]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`product-${field}`}>{label}</Label>
                  <Input
                    id={`product-${field}`}
                    type={type}
                    min={field === "price" ? "0.01" : "0"}
                    step={field === "stock" ? "1" : "0.01"}
                    required={field !== "imageUrl"}
                    value={draft[field]}
                    onChange={e =>
                      setDraft({ ...draft, [field]: e.target.value })
                    }
                  />
                </div>
              ))}
            {!!draft.variants?.length && (
              <section className="space-y-3">
                <h3 className="font-semibold">Product options</h3>
                {draft.variants.map((v, index) => (
                  <div key={v.id} className="rounded-xl border p-3 space-y-2">
                    <p className="font-medium">{v.name}</p>
                    <Label htmlFor={`variant-price-${v.id}`}>Price ($)</Label>
                    <Input
                      id={`variant-price-${v.id}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={v.price}
                      onChange={e =>
                        setDraft({
                          ...draft,
                          variants: draft.variants!.map((item, i) =>
                            i === index
                              ? { ...item, price: e.target.value }
                              : item
                          ),
                        })
                      }
                    />
                    <Label htmlFor={`variant-stock-${v.id}`}>
                      Available quantity
                    </Label>
                    <Input
                      id={`variant-stock-${v.id}`}
                      type="number"
                      min="0"
                      max="1000000"
                      step="1"
                      required
                      value={v.stock}
                      onChange={e =>
                        setDraft({
                          ...draft,
                          variants: draft.variants!.map((item, i) =>
                            i === index
                              ? { ...item, stock: e.target.value }
                              : item
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </section>
            )}
            <div className="space-y-2">
              <Label htmlFor="product-description">Description</Label>
              <textarea
                id="product-description"
                className="w-full border rounded-xl p-3 bg-background"
                value={draft.description}
                onChange={e =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-fulfillment">Fulfilment</Label>
              <select
                id="product-fulfillment"
                className="w-full border rounded-xl p-3 bg-background"
                value={draft.fulfillmentType}
                onChange={e =>
                  setDraft({
                    ...draft,
                    fulfillmentType: e.target
                      .value as ProductDraft["fulfillmentType"],
                  })
                }
              >
                <option value="delivery">Delivery</option>
                <option value="pickup">Pickup</option>
                <option value="both">Delivery or pickup</option>
                <option value="digital">Digital</option>
              </select>
            </div>
            <label className="flex items-center gap-3 min-h-11">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={e =>
                  setDraft({ ...draft, isActive: e.target.checked })
                }
              />
              Publish product
            </label>
            {(create.error || update.error) && (
              <p role="alert" className="text-destructive text-sm">
                {create.error?.message || update.error?.message}
              </p>
            )}
            <Button type="submit" className="w-full h-12" disabled={busy}>
              {busy ? "Saving…" : "Save product"}
            </Button>
          </form>
        )}
      </SheetShell>
    </PageShell>
  );
}
