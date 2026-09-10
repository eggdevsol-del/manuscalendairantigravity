import { useState } from "react";
import { Plus, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import {
  Action,
  ActionLink,
  Feedback,
  Row,
  Screen,
  SearchField,
  Section,
  Status,
  Tabs,
} from "../design/primitives";

type Product =
  inferRouterOutputs<AppRouter>["storefront"]["getProducts"][number];
type Draft = {
  title: string;
  description: string;
  price: string;
  stock: string;
  shipping: string;
  imageUrl: string;
  fulfillmentType: Product["fulfillmentType"];
  isActive: boolean;
  variants: { id: number; name: string; price: string; stock: string }[];
};
export default function Products() {
  const query = trpc.storefront.getProducts.useQuery();
  const profile = trpc.merchantAuth.getMerchantProfile.useQuery();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"All" | "Published" | "Hidden">("All");
  const [selected, setSelected] = useState<Product | "new" | null>(null);
  const currency = profile.data?.country === "NZ" ? "NZD" : "AUD";
  const price = (cents: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(
      cents / 100
    );
  const products = (query.data || []).filter(
    p =>
      p.title.toLowerCase().includes(search.toLowerCase()) &&
      (tab === "All" || !!p.isActive === (tab === "Published"))
  );
  return (
    <Screen
      title="Products"
      subtitle="Your catalogue and availability"
      action={
        <Action onClick={() => setSelected("new")}>
          <Plus />
          Add product
        </Action>
      }
    >
      <Tabs
        items={["All", "Published", "Hidden"] as const}
        value={tab}
        onChange={setTab}
        label="Product visibility"
      />
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
      <Section title="Catalogue">
        {products.map(p => (
          <Row
            key={p.id}
            title={p.title}
            detail={
              price(p.priceCents) +
              " · " +
              (p.variants.length
                ? p.variants.reduce((sum, v) => sum + v.inventoryCount, 0)
                : p.inventoryCount) +
              " in stock"
            }
            icon={
              p.imageUrl ? (
                <img
                  className="v3-product-thumb"
                  src={p.imageUrl}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <Package />
              )
            }
            trailing={<Status>{p.isActive ? "Published" : "Hidden"}</Status>}
            onClick={() => setSelected(p)}
          />
        ))}
        {!query.isLoading && !query.error && !products.length && (
          <Feedback
            empty={
              search
                ? "No matching products."
                : "Add a product to start your catalogue."
            }
          />
        )}
      </Section>
      <ActionLink href="/settings" tone="quiet">
        Manage Shopify connection
      </ActionLink>
      <SheetShell
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={selected === "new" ? "Add product" : "Edit product"}
      >
        {selected && (
          <ProductEditor
            key={selected === "new" ? "new" : selected.id}
            product={selected === "new" ? undefined : selected}
            currency={currency}
            onSaved={() => {
              setSelected(null);
              void query.refetch();
            }}
          />
        )}
      </SheetShell>
    </Screen>
  );
}
function ProductEditor({
  product,
  currency,
  onSaved,
}: {
  product?: Product;
  currency: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    title: product?.title || "",
    description: product?.description || "",
    price: product ? String(product.priceCents / 100) : "",
    stock: String(product?.inventoryCount || 0),
    shipping: String((product?.shippingCents || 0) / 100),
    imageUrl: product?.imageUrl || "",
    fulfillmentType: product?.fulfillmentType || "delivery",
    isActive: product ? !!product.isActive : false,
    variants:
      product?.variants.map(v => ({
        id: v.id,
        name: v.name,
        price: String(v.priceCents / 100),
        stock: String(v.inventoryCount),
      })) || [],
  }));
  const [error, setError] = useState("");
  const create = trpc.storefront.createProduct.useMutation();
  const update = trpc.storefront.updateProduct.useMutation();
  const utils = trpc.useUtils();
  const busy = create.isPending || update.isPending;
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setError("");
    setDraft(d => ({ ...d, [key]: value }));
  }
  async function save() {
    if (busy) return;
    setError("");
    const prices = draft.variants.length
      ? draft.variants.map(v => Number(v.price))
      : [Number(draft.price)];
    const quantities = draft.variants.length
      ? draft.variants.map(v => Number(v.stock))
      : [Number(draft.stock)];
    if (
      !draft.title.trim() ||
      prices.some(p => !Number.isFinite(p) || p <= 0) ||
      quantities.some(q => !Number.isInteger(q) || q < 0 || q > 1000000) ||
      !Number.isFinite(Number(draft.shipping)) ||
      Number(draft.shipping) < 0
    ) {
      setError(
        "Enter a name, positive prices, whole stock quantities and a valid delivery charge."
      );
      return;
    }
    if (draft.imageUrl && !/^https?:\/\//i.test(draft.imageUrl)) {
      setError("Use an HTTP or HTTPS image URL.");
      return;
    }
    const data = {
      title: draft.title.trim(),
      description: draft.description,
      priceCents: Math.round(Math.min(...prices) * 100),
      inventoryCount: Number(draft.stock),
      shippingCents: Math.round(Number(draft.shipping) * 100),
      fulfillmentType: draft.fulfillmentType,
      isActive: draft.isActive,
      ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
    };
    try {
      if (product)
        await update.mutateAsync({
          ...data,
          id: product.id,
          variants: draft.variants.map(v => ({
            id: v.id,
            priceCents: Math.round(Number(v.price) * 100),
            inventoryCount: Number(v.stock),
          })),
        });
      else await create.mutateAsync(data);
      await utils.merchantAuth.getDashboardStats.invalidate();
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn’t save this product. Your changes are still here."
      );
    }
  }
  return (
    <form
      className="v3-form"
      onSubmit={e => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={busy} className="v3-form">
        <label>
          Product name
          <input
            required
            maxLength={250}
            value={draft.title}
            onChange={e => change("title", e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            value={draft.description}
            onChange={e => change("description", e.target.value)}
          />
        </label>
        {!draft.variants.length && (
          <div className="v3-form-pair">
            <label>
              Price · {currency}
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={draft.price}
                onChange={e => change("price", e.target.value)}
              />
            </label>
            <label>
              Quantity available
              <input
                type="number"
                min="0"
                max="1000000"
                step="1"
                required
                value={draft.stock}
                onChange={e => change("stock", e.target.value)}
              />
            </label>
          </div>
        )}
        {draft.variants.length > 0 && (
          <Section title="Product options">
            {draft.variants.map((v, i) => (
              <div key={v.id} className="v3-form">
                <h3>{v.name}</h3>
                <div className="v3-form-pair">
                  <label>
                    Price · {currency}
                    <input
                      aria-label={v.name + " price"}
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={v.price}
                      onChange={e =>
                        change(
                          "variants",
                          draft.variants.map((row, n) =>
                            n === i ? { ...row, price: e.target.value } : row
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      aria-label={v.name + " quantity"}
                      type="number"
                      min="0"
                      max="1000000"
                      step="1"
                      required
                      value={v.stock}
                      onChange={e =>
                        change(
                          "variants",
                          draft.variants.map((row, n) =>
                            n === i ? { ...row, stock: e.target.value } : row
                          )
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </Section>
        )}
        <label>
          Fulfilment
          <select
            aria-label="Fulfilment"
            value={draft.fulfillmentType}
            onChange={e =>
              change(
                "fulfillmentType",
                e.target.value as Draft["fulfillmentType"]
              )
            }
          >
            <option value="delivery">Delivery</option>
            <option value="pickup">Pickup</option>
            <option value="both">Delivery or pickup</option>
            <option value="digital">Digital</option>
          </select>
        </label>
        {(draft.fulfillmentType === "delivery" ||
          draft.fulfillmentType === "both") && (
          <label>
            Delivery charge · {currency}
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={draft.shipping}
              onChange={e => change("shipping", e.target.value)}
            />
          </label>
        )}
        <label>
          Image URL
          <input
            type="url"
            value={draft.imageUrl}
            onChange={e => change("imageUrl", e.target.value)}
          />
        </label>
        {product?.imageUrl && !draft.imageUrl && (
          <p className="v3-muted">
            The current image will be kept. Enter a new URL to replace it.
          </p>
        )}
        <label className="v3-inline">
          <input
            style={{ width: "auto", minHeight: 0 }}
            type="checkbox"
            checked={draft.isActive}
            onChange={e => change("isActive", e.target.checked)}
          />
          Publish in your store
        </label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <Action type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save product"}
      </Action>
    </form>
  );
}
