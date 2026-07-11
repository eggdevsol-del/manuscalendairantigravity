import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, CalendarDays, MapPin, Video, Users, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function PublicEvents() {
  const [, params] = useRoute("/events/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug;
  const [checkingOutId, setCheckingOutId] = useState<number | null>(null);

  const { data: seminars, isLoading, error } = trpc.storefront.getPublicSeminars.useQuery(
    { slug: slug || "" },
    { enabled: !!slug, retry: false }
  );

  const checkoutMutation = trpc.storefront.createSeminarCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start checkout");
      setCheckingOutId(null);
    },
  });

  const handleRegister = (seminarId: number) => {
    setCheckingOutId(seminarId);
    checkoutMutation.mutate({ seminarId });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (error || !seminars) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Events Not Found</h1>
        <p className="text-muted-foreground mb-6">This artist may not have any upcoming events.</p>
        <button
          onClick={() => setLocation(`/${slug}`)}
          className="px-6 py-3 bg-secondary/50 hover:bg-secondary/50 text-white rounded-full transition-colors font-medium text-sm"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white overflow-x-hidden font-sans pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => setLocation(`/${slug}`)}
          className="p-2 -ml-2 rounded-full hover:bg-secondary/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <span className="font-bold tracking-wider uppercase text-sm">Upcoming Events</span>
        <div className="w-9" />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="text-3xl font-extrabold mb-8">Seminars & Events</h1>

        {seminars.length === 0 ? (
          <div className="text-center py-20 bg-secondary/50 rounded-3xl border border-border">
            <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Upcoming Events</h2>
            <p className="text-muted-foreground text-sm">Check back later for live and virtual seminars.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {seminars.map((seminar: any) => {
              const eventDate = new Date(seminar.date);
              const isVirtual = seminar.type === "virtual";
              const spotsLeft = seminar.capacity - (seminar.ticketsSold || 0);
              const isSoldOut = spotsLeft <= 0;
              const isCheckingOut = checkingOutId === seminar.id;

              return (
                <motion.div
                  key={seminar.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-secondary/50 rounded-[24px] border border-border overflow-hidden hover:border-border transition-colors"
                >
                  <div className="p-6">
                    {/* Type Badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isVirtual ? "bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)] border border-purple-500/20" : "bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)] border border-[var(--color-status-info-border)]"}`}>
                        {isVirtual ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                        {isVirtual ? "Virtual" : "In Person"}
                      </span>
                      {isSoldOut && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)] border border-[var(--color-status-danger-border)]">
                          Sold Out
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-xl font-bold mb-2 leading-tight">{seminar.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-3">{seminar.description}</p>

                    {/* Meta Row */}
                    <div className="flex flex-wrap items-center gap-4 mb-5 text-muted-foreground text-xs">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{eventDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · {eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>{spotsLeft > 0 ? `${spotsLeft} spots left` : "No spots available"}</span>
                      </div>
                    </div>

                    {/* Price + CTA */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <span className="text-2xl font-bold tracking-tight">
                        ${(seminar.priceCents / 100).toFixed(2)}
                      </span>
                      {isSoldOut ? (
                        <span className="text-[var(--color-status-danger-text)] font-semibold text-sm bg-[var(--color-status-danger-bg)] px-5 py-2.5 rounded-full">
                          Sold Out
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRegister(seminar.id)}
                          disabled={isCheckingOut}
                          className="bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-6 rounded-full transition-all active:scale-95 text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                          {isCheckingOut ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Register"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
