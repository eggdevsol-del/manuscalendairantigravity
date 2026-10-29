import {
  CheckCircle2,
  MessageSquare,
  Package,
  Store,
  Tag,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { money } from "@/features/workspace/bookingPresentation";
import { Avatar, Feedback } from "../design/primitives";
import { messagePreview } from "../data/messagePresentation";
import { Group, Note, Widget, compactMoney, relativeDay, useNow } from "../design/LockParts";
import {
  lowStock,
  orderBelt,
  ordersSince,
  share,
  soldBetween,
  soldSince,
} from "../design/landingData";

/** The supplier's landing page: the same lock screen, for a store. Rings for orders to pack, stock running
 *  low and the last 30 days of sales, then groups for packing, the order belt, low stock, messages and the
 *  store itself. Store settings sit behind the avatar. */
export default function SupplierHome() {
  const { user } = useAuth();
  const now = useNow();
  const profile = trpc.merchantAuth.getMerchantProfile.useQuery();
  const orders = trpc.storefront.getOrders.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const products = trpc.storefront.getProducts.useQuery();
  const conversations = trpc.conversations.list.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (key: string) => setOpen(o => (o === key ? null : key));

  const all = orders.data ?? [];
  const belt = orderBelt(all);
  // The store's own low-stock level; nothing counts as low until it loads.
  const low = profile.data
    ? lowStock(products.data ?? [], profile.data.lowStockThreshold)
    : [];
  const sold = soldSince(all, now);
  // Each ring measures against the store's own data: the last 30 days' orders, all products, and the
  // 30 days before.
  const soldBefore = soldBetween(all, now - 60 * 86400000, now - 30 * 86400000);
  const currency = profile.data?.country === "NZ" ? "NZD" : "AUD";
  const live = profile.data?.status === "active";
  const items = (o: (typeof all)[number]) => {
    const n = (o.items ?? []).reduce((sum, i) => sum + (i.quantity || 0), 0);
    return `${n} item${n === 1 ? "" : "s"}`;
  };
  const chats = [...(conversations.data ?? [])].sort(
    (a, b) => (b.unreadCount || 0) - (a.unreadCount || 0)
  );

  return (
    <div className="v3-screen iosm-home">
      <Link href="/settings" className="iosm-avatar" aria-label="Store settings">
        <Avatar name={profile.data?.businessName || user?.name} src={user?.avatar} />
      </Link>
      <section className="iosm-lock" aria-label="Your store at a glance">
        <time className="iosm-clock" dateTime={new Date(now).toISOString()}>
          {new Date(now)
            .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
            .replace(/\s?(am|pm)/i, "")}
        </time>
        <p className="iosm-date">
          {profile.data?.businessName ||
            new Date(now).toLocaleDateString("en-AU", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
        </p>
        <div className="iosm-widgets">
          <Widget
            href="/merchant/orders"
            value={share(
              belt.toPack.length,
              Math.max(belt.toPack.length, ordersSince(all, now))
            )}
            label={String(belt.toPack.length)}
            caption="to pack"
          />
          <Widget
            href="/merchant/products"
            value={share(low.length, (products.data ?? []).length)}
            label={String(low.length)}
            caption="running low"
          />
          <Widget
            href="/merchant/orders"
            value={share(sold, Math.max(sold, soldBefore))}
            label={compactMoney(sold)}
            caption="sold, 30 days"
          />
        </div>
      </section>

      <Feedback
        loading={orders.isLoading}
        error={orders.error || products.error || profile.error}
        onRetry={() => {
          void orders.refetch();
          void products.refetch();
          void profile.refetch();
        }}
      />

      <Group
        id="pack"
        icon={<Package />}
        title="To pack"
        href="/merchant/orders"
        open={open === "pack"}
        onToggle={toggle}
      >
        {belt.toPack.length ? (
          belt.toPack.map(o => (
            <Note
              key={o.id}
              icon={<Package />}
              title={`Order #${o.id}`}
              detail={`${o.buyerName || o.buyerEmail || "Customer"} · ${items(o)}`}
              when={money(o.totalAmountCents, o.currency || currency)}
              href="/merchant/orders"
            />
          ))
        ) : (
          <Note
            icon={<CheckCircle2 />}
            title="All packed"
            detail="Nothing waiting to ship"
            href="/merchant/orders"
          />
        )}
      </Group>

      <Group
        id="belt"
        icon={<Truck />}
        title="Order belt"
        href="/merchant/orders"
        open={open === "belt"}
        onToggle={toggle}
        peek={1}
      >
        <div className="iosm-belt" aria-label="Orders by stage">
          {(
            [
              ["To pack", belt.toPack],
              ["On the way", belt.shipped],
            ] as const
          ).map(([label, list]) => (
            <div key={label} className="iosm-lane">
              <small>
                {label} · {list.length}
              </small>
              {list.slice(0, 6).map(o => (
                <Link key={o.id} href="/merchant/orders" className="iosm-box">
                  <b>#{o.id}</b>
                  <em>{compactMoney(o.totalAmountCents)}</em>
                </Link>
              ))}
              {!list.length && <i>Empty</i>}
            </div>
          ))}
        </div>
      </Group>

      <Group
        id="low"
        icon={<Tag />}
        title="Running low"
        href="/merchant/products"
        open={open === "low"}
        onToggle={toggle}
      >
        {low.length ? (
          low.map(({ product, low: variants }) => (
            <Note
              key={product.id}
              icon={<Tag />}
              title={product.title}
              detail={variants
                .map(v => `${v.name ? `${v.name}: ` : ""}${v.inventoryCount ?? 0} left`)
                .join(" · ")}
              href="/merchant/products"
            />
          ))
        ) : (
          <Note
            icon={<CheckCircle2 />}
            title="Stock looks healthy"
            detail={`${(products.data ?? []).length} products`}
            href="/merchant/products"
          />
        )}
      </Group>

      {chats.length > 0 && (
        <Group
          id="messages"
          icon={<MessageSquare />}
          title="Messages"
          href="/conversations"
          open={open === "messages"}
          onToggle={toggle}
        >
          {chats.map(c => (
            <Note
              key={c.id}
              icon={<MessageSquare />}
              title={`${c.otherUser?.name || "Conversation"}${c.unreadCount ? ` · ${c.unreadCount} new` : ""}`}
              detail={messagePreview(c.lastMessage?.content, c.lastMessage?.messageType)}
              href={`/chat/${c.id}`}
              live={!!c.unreadCount}
            />
          ))}
        </Group>
      )}

      <Group
        id="store"
        icon={<Store />}
        title="Store"
        href="/merchant/store"
        open={open === "store"}
        onToggle={toggle}
      >
        <Note
          icon={<Store />}
          title={live ? "Live on Tattoi" : "Not published yet"}
          detail={
            live
              ? "Artists can find your store and its products"
              : "Only you can see your store. Publish it when you're ready"
          }
          href="/merchant/store"
          live={!live}
        />
        <Note
          icon={<Tag />}
          title="Products"
          detail={`${(products.data ?? []).length} in your catalogue`}
          href="/merchant/products"
        />
        {all[0]?.createdAt && (
          <Note
            icon={<Truck />}
            title="Latest order"
            detail={`#${all[0].id} · ${money(all[0].totalAmountCents, all[0].currency || currency)}`}
            when={relativeDay(all[0].createdAt, now)}
            href="/merchant/orders"
          />
        )}
      </Group>
      <p className="iosm-foot">Store settings live behind your logo, top right.</p>
    </div>
  );
}
