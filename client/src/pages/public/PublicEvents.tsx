import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, CalendarDays, MapPin, Video, Users, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function PublicEvents() {
  const [, params] = useRoute("/events/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug;

  const { data: seminars, isLoading, error } = trpc.storefront.getPublicSeminars.useQuery(
    { slug: slug || "" },
    { enabled: !!slug, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
      </div>
    );
  }

  if (error || !seminars) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Events Not Found</h1>
        <p className="text-white/60 mb-6">This artist may not have any upcoming events.</p>
        <button
          onClick={() => setLocation(`/${slug}`)}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors font-medium text-sm"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden font-sans pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => setLocation(`/${slug}`)}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white/70" />
        </button>
        <span className="font-bold tracking-wider uppercase text-sm">Upcoming Events</span>
        <div className="w-9" />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="text-3xl font-extrabold mb-8">Seminars & Events</h1>

        {seminars.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5">
            <CalendarDays className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Upcoming Events</h2>
            <p className="text-white/50 text-sm">Check back later for live and virtual seminars.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {seminars.map((seminar: any) => {
              const eventDate = new Date(seminar.date);
              const isVirtual = seminar.type === "virtual";
              const spotsLeft = seminar.capacity - (seminar.ticketsSold || 0);
              const isSoldOut = spotsLeft <= 0;

              return (
                <motion.div
                  key={seminar.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-[24px] border border-white/10 overflow-hidden hover:border-white/20 transition-colors"
                >
                  <div className="p-6">
                    {/* Type Badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isVirtual ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>
                        {isVirtual ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                        {isVirtual ? "Virtual" : "In Person"}
                      </span>
                      {isSoldOut && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                          Sold Out
                        </span>
                      )}
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-xl font-bold mb-2 leading-tight">{seminar.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed mb-4 line-clamp-3">{seminar.description}</p>

                    {/* Meta Row */}
                    <div className="flex flex-wrap items-center gap-4 mb-5 text-white/60 text-xs">
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
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <span className="text-2xl font-bold tracking-tight">
                        ${(seminar.priceCents / 100).toFixed(2)}
                      </span>
                      {isSoldOut ? (
                        <span className="text-red-400 font-semibold text-sm bg-red-500/10 px-5 py-2.5 rounded-full">
                          Sold Out
                        </span>
                      ) : (
                        <button
                          className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-6 rounded-full transition-all active:scale-95 text-sm"
                        >
                          Register
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
