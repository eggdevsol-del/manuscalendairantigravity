import { DetailsSheet } from "../components/DetailsSheet";
import { useState } from "react";
import { Package } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { trpc } from "@/lib/trpc";
import {
  Action,
  ActionLink,
  Feedback,
  Row,
  Screen,
  SearchField,
  Status,
} from "../design/primitives";

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

export default function Products() {
  const { user } = useAuth();
  const isMerchant = user?.role === "merchant";
  const query = trpc.storefront.getProducts.useQuery();
  const profile = trpc.merchantAuth.getMerchantProfile.useQuery(undefined, {
    enabled: isMerchant,
  });
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const utils = trpc.useUtils();
  const onSaved = () => {
    setDraft(null);
    setSaved(true);
    void query.refetch();
    if (isMerchant) void utils.merchantAuth.getDashboardStats.invalidate();
    void utils.storefront.getArtistStorefront.invalidate();
  };
  const create = trpc.storefront.createProduct.useMutation({
    onSuccess: onSaved,
  });
  const update = trpc.storefront.updateProduct.useMutation({
    onSuccess: onSaved,
  });
  const busy = create.isPending || update.isPending;
  const edit = (product?: NonNullable<typeof query.data>[number]) => {
    create.reset();
    update.reset();
    setSaved(false);
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
        : {
            title: "",
            description: "",
            price: "",
            stock: "0",
            shipping: "0",
            imageUrl: "",
            fulfillmentType: "delivery",
            isActive: true,
          }
    );
  };
  const domain = profile.data?.shopifyDomain;
  const shopUrl =
    domain && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)
      ? `https://${domain}/admin/products`
      : null;
  const products = (query.data || []).filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );
  const currency = profile.data?.country === "NZ" ? "NZD" : "AUD";
  return (
    <Screen
      title="Products"
      subtitle="Your catalogue, ready for your customers"
      back={isMerchant ? undefined : "/business"}
      action={<Action onClick={() => edit()}>Add product</Action>}
    >
      <p className="v3-muted">
        Set your Tattoi prices, available stock and publishing status here.
      </p>
      {shopUrl ? (
        <a
          className="v3-action v3-action-secondary"
          href={shopUrl}
          target="_blank"
          rel="noreferrer"
        >
          Edit catalogue in Shopify
        </a>
      ) : isMerchant ? (
        <ActionLink href="/settings">Review Shopify connection</ActionLink>
      ) : null}
      {saved && <p role="status">Product saved.</p>}
      <SearchField
        value={search}
        onChange={setSearch}
        label="Search products"
      />
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      <div className="v3-catalogue-grid">
        {products.map(p => (
          <article className="v3-panel" key={p.id}>
            {p.imageUrl ? (
              <img
                className="v3-catalogue-image"
                src={p.imageUrl}
                alt={p.title}
                loading="lazy"
              />
            ) : (
              <Package aria-label="No product image" />
            )}
            <h2>{p.title}</h2>
            <p>
              {new Intl.NumberFormat("en-AU", {
                style: "currency",
                currency,
              }).format(p.priceCents / 100)}
            </p>
            <Status>{p.isActive ? "Published" : "Hidden"}</Status>
            <p className="v3-muted">
              {p.variants.length
                ? p.variants.reduce((sum, v) => sum + v.inventoryCount, 0)
                : p.inventoryCount}{" "}
              in stock
            </p>
            {!!p.variants.length && (
              <DetailsSheet title={<> View {p.variants.length} variants </>}>
                {p.variants.map(v => (
                  <Row
                    key={v.id}
                    title={v.name}
                    detail={`${v.inventoryCount} in stock`}
                  />
                ))}
              </DetailsSheet>
            )}
            <Action
              tone="secondary"
              onClick={() => edit(p)}
              aria-label={`Edit ${p.title}`}
            >
              Edit product
            </Action>
          </article>
        ))}
      </div>
      {!query.isLoading && !query.error && !products.length && (
        <Feedback
          empty={
            search
              ? "No matching products."
              : isMerchant
                ? "Add a product or import your Shopify catalogue in Store settings."
                : "Add your first product to start your catalogue."
          }
        />
      )}
      <SheetShell
        isOpen={!!draft}
        onClose={() => {
          if (!busy) setDraft(null);
        }}
        title={draft?.id ? "Edit product" : "Add product"}
        description="Set the details your customers need to order."
      >
        {draft && (
          <form
            className="v3-form"
            onSubmit={e => {
              e.preventDefault();
              if (busy) return;
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
                isActive: draft.isActive,
                variants: draft.variants?.map(v => ({
                  id: v.id,
                  priceCents: Math.round(Number(v.price) * 100),
                  inventoryCount: Number(v.stock),
                })),
              };
              if (draft.id)
                update.mutate({
                  ...data,
                  id: draft.id,
                  imageUrl: draft.imageUrl.trim() || null,
                });
              else
                create.mutate({
                  ...data,
                  ...(draft.imageUrl.trim()
                    ? { imageUrl: draft.imageUrl.trim() }
                    : {}),
                });
            }}
          >
            <fieldset disabled={busy}>
              {(
                [
                  ["title", "Product name", "text"],
                  ["price", `Price · ${currency}`, "number"],
                  ["stock", "Available quantity", "number"],
                  ["shipping", `Delivery charge · ${currency}`, "number"],
                  ["imageUrl", "Image URL (optional)", "url"],
                ] as const
              )
                .filter(
                  ([field]) =>
                    !draft.variants?.length ||
                    !["price", "stock"].includes(field)
                )
                .map(([field, label, type]) => (
                  <label key={field}>
                    {label}
                    <input
                      type={type}
                      min={field === "price" ? "0.01" : "0"}
                      step={field === "stock" ? "1" : "0.01"}
                      max={field === "stock" ? "1000000" : undefined}
                      required={field !== "imageUrl"}
                      value={draft[field]}
                      onChange={e =>
                        setDraft({ ...draft, [field]: e.target.value })
                      }
                    />
                  </label>
                ))}
              {!!draft.variants?.length && (
                <section className="v3-stack">
                  <h3>Product options</h3>
                  {draft.variants.map((variant, index) => (
                    <fieldset key={variant.id} className="v3-panel">
                      <legend>{variant.name}</legend>
                      {(
                        [
                          ["price", `Price · ${currency}`],
                          ["stock", "Available quantity"],
                        ] as const
                      ).map(([field, label]) => (
                        <label key={field}>
                          {label}
                          <input
                            aria-label={`${variant.name} ${label}`}
                            type="number"
                            required
                            min={field === "price" ? "0.01" : "0"}
                            max={field === "stock" ? "1000000" : undefined}
                            step={field === "stock" ? "1" : "0.01"}
                            value={variant[field]}
                            onChange={e =>
                              setDraft({
                                ...draft,
                                variants: draft.variants!.map((item, i) =>
                                  i === index
                                    ? { ...item, [field]: e.target.value }
                                    : item
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </section>
              )}
              <label>
                Description
                <textarea
                  value={draft.description}
                  rows={3}
                  onChange={e =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <label>
                Fulfilment
                <select
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
              </label>
              <div className="v3-check-list">
                <label>
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={e =>
                      setDraft({ ...draft, isActive: e.target.checked })
                    }
                  />
                  Publish product
                </label>
              </div>
              {(create.error || update.error) && (
                <p role="alert">{(create.error || update.error)?.message}</p>
              )}
              <Action type="submit">{busy ? "Saving…" : "Save product"}</Action>
            </fieldset>
          </form>
        )}
      </SheetShell>
    </Screen>
  );
}
