import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Button, Input, Label } from "@/components/ui";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { ClientProfileSheet } from "@/features/chat/ClientProfileSheet";
import { ClientsTab } from "@/features/dashboard/ClientsTab";
import { Search, Plus, ChevronRight, MessageCircle } from "lucide-react";
export default function Clients() {
  const { user } = useAuth();
  const query = trpc.conversations.getClients.useQuery();
  const utils = trpc.useUtils();
  const [, go] = useLocation();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("People");
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const create = trpc.conversations.createClient.useMutation({
    onSuccess: () => {
      void query.refetch();
      void utils.conversations.invalidate();
      setAdding(false);
      setName("");
      setEmail("");
      setPhone("");
    },
  });
  const chat = trpc.conversations.getOrCreate.useMutation({
    onSuccess: data => {
      if (data?.id) go(`/chat/${data.id}`);
    },
  });
  const clients = (query.data || [])
    .filter((c): c is NonNullable<typeof c> => !!c)
    .filter(c =>
      `${c.name} ${c.email} ${c.phone}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  return (
    <PageShell>
      <PageHeader
        title="Clients"
        subtitle="Your people, their pieces, your shared history"
        rightAction={
          <Button
            onClick={() => {
              create.reset();
              setAdding(true);
            }}
          >
            <Plus />
            Add client
          </Button>
        }
      />
      <main className="workspace-scroll">
        <div className="workspace-content space-y-5">
          <div
            className="workspace-tabs"
            role="tablist"
            aria-label="Client views"
          >
            {["People", "Session history"].map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Session history" ? (
            <ClientsTab />
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-3.5" size={19} />
                <Input
                  aria-label="Search clients"
                  placeholder="Search name, email or phone"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 min-h-12"
                />
              </div>
              {query.isLoading && <p role="status">Loading clients…</p>}
              {query.error && (
                <div role="alert">
                  <p>Couldn’t load clients.</p>
                  <Button onClick={() => query.refetch()}>Try again</Button>
                </div>
              )}
              {!query.isLoading && !query.error && !clients.length && (
                <div className="workspace-card">
                  <h2 className="font-semibold">
                    {search
                      ? "No matching clients"
                      : "Your client list starts here"}
                  </h2>
                  <p className="workspace-subtitle">
                    {search
                      ? "Try another name, email or phone number."
                      : "Clients appear here when they enquire. You can also add an existing client."}
                  </p>
                </div>
              )}
              {clients.map(c => (
                <div className="workspace-menu-row" key={c.id}>
                  <button
                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                    onClick={() => setSelected(c.id)}
                  >
                    <span className="workspace-avatar">
                      {c.avatar ? (
                        <img src={c.avatar} alt="" />
                      ) : (
                        c.name?.charAt(0) || "?"
                      )}
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate">
                        {c.name || "Client"}
                      </strong>
                      <span className="block text-sm text-muted-foreground truncate">
                        {c.email || c.phone || "No contact details"}
                      </span>
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Message ${c.name}`}
                    disabled={chat.isPending}
                    onClick={() =>
                      chat.mutate({ clientId: c.id, artistId: user!.id })
                    }
                  >
                    <MessageCircle />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`View ${c.name}`}
                    onClick={() => setSelected(c.id)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              ))}
              {chat.error && <p role="alert">{chat.error.message}</p>}
            </>
          )}
        </div>
      </main>
      <ClientProfileSheet
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        clientId={selected}
      />
      <SheetShell
        isOpen={adding}
        onClose={() => setAdding(false)}
        title="Add client"
      >
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            create.mutate({
              name: name.trim(),
              email: email.trim() || null,
              phone: phone.trim() || null,
            });
          }}
        >
          <div>
            <Label htmlFor="client-name">Full name</Label>
            <Input
              id="client-name"
              autoComplete="name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="client-email">Email (optional)</Label>
            <Input
              id="client-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="client-phone">Phone (optional)</Label>
            <Input
              id="client-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
          {create.error && <p role="alert">{create.error.message}</p>}
          <Button
            className="w-full"
            disabled={!name.trim() || create.isPending}
          >
            {create.isPending ? "Adding…" : "Add client"}
          </Button>
        </form>
      </SheetShell>
    </PageShell>
  );
}
