import { useState } from "react";
import { Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  ActionLink,
  Feedback,
  Row,
  Screen,
  SearchField,
  Status,
} from "../design/primitives";

export default function Products() {
  const query = trpc.storefront.getProducts.useQuery();
  const profile = trpc.merchantAuth.getMerchantProfile.useQuery();
  const [search, setSearch] = useState("");
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
    <Screen title="Products" subtitle="Your Shopify catalogue on Tattoi">
      <p className="v3-muted">
        Manage products, variants and stock in Shopify. Review the imported
        catalogue here.
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
      ) : (
        <ActionLink href="/settings">Review Shopify connection</ActionLink>
      )}
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
              <details>
                <summary>View {p.variants.length} variants</summary>
                {p.variants.map(v => (
                  <Row
                    key={v.id}
                    title={v.name}
                    detail={`${v.inventoryCount} in stock`}
                  />
                ))}
              </details>
            )}
          </article>
        ))}
      </div>
      {!query.isLoading && !query.error && !products.length && (
        <Feedback
          empty={
            search
              ? "No matching products."
              : "Connect and import your Shopify catalogue in Settings."
          }
        />
      )}
    </Screen>
  );
}
