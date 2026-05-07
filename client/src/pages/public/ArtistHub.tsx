import React from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, Instagram, Facebook, ArrowRight, Store, CalendarDays, Link as LinkIcon, CalendarPlus } from "lucide-react";
import { motion } from "framer-motion";

export default function ArtistHub() {
  const [, params] = useRoute("/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug;

  const { data: artist, isLoading, error } = trpc.funnel.getArtistBySlug.useQuery(
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

  if (error || !artist) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Artist Not Found</h1>
        <p className="text-white/60 mb-6">The link you followed may be broken or the artist no longer exists.</p>
        <button 
          onClick={() => setLocation("/")}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors font-medium text-sm"
        >
          Return Home
        </button>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden font-sans relative selection:bg-white/20">
      {/* Background Gradients & Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[500px] bg-gradient-to-b from-indigo-500/20 via-purple-500/5 to-transparent blur-[120px] rounded-full opacity-60 mix-blend-screen" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-pink-500/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-6 py-16 flex flex-col items-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative mb-6 group"
        >
          <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_40px_rgba(168,85,247,0.4)]">
            <div className="w-full h-full rounded-full overflow-hidden bg-black/50 backdrop-blur-sm relative">
              {artist.profileImage ? (
                <img 
                  src={artist.profileImage} 
                  alt={artist.displayName} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/40 text-3xl font-light">
                  {artist.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 mb-2"
        >
          {artist.displayName}
        </motion.h1>
        
        {artist.bio && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-white/60 text-center text-sm leading-relaxed max-w-[280px] mb-8 font-medium"
          >
            {artist.bio}
          </motion.p>
        )}

        {/* Social Links Row */}
        {(artist.instagramUsername || artist.facebookName) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-4 mb-10"
          >
            {artist.instagramUsername && (
              <a 
                href={`https://instagram.com/${artist.instagramUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-all hover:scale-110 hover:border-pink-500/30 group"
              >
                <Instagram className="w-4 h-4 text-white/70 group-hover:text-pink-400 transition-colors" />
              </a>
            )}
            {artist.facebookName && (
              <a 
                href={`https://facebook.com/${artist.facebookName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-all hover:scale-110 hover:border-blue-500/30 group"
              >
                <Facebook className="w-4 h-4 text-white/70 group-hover:text-blue-400 transition-colors" />
              </a>
            )}
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-all hover:scale-110 hover:border-white/30 group"
            >
              <LinkIcon className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
            </button>
          </motion.div>
        )}

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full flex flex-col gap-3"
        >
          {/* Primary CTA: Book Consult */}
          <motion.button
            variants={itemVariants}
            onClick={() => setLocation(`/start/${slug}`)}
            className="group relative w-full overflow-hidden rounded-[20px] p-[1px] transition-all active:scale-[0.98]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative w-full bg-black/80 backdrop-blur-xl px-6 py-5 rounded-[20px] flex items-center justify-between transition-colors group-hover:bg-black/60">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 group-hover:scale-110 transition-transform">
                  <CalendarPlus className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-base font-bold text-white tracking-wide">Book Consult</span>
                  <span className="text-[11px] text-white/50 uppercase tracking-widest font-semibold mt-0.5">Start a new project</span>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
          </motion.button>

          {/* Storefront (Phase 4) */}
          {artist.hasProducts && (
            <motion.button
              variants={itemVariants}
              onClick={() => setLocation(`/shop/${slug}`)}
              className="group relative w-full overflow-hidden rounded-[20px] bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all active:scale-[0.98]"
            >
              <div className="w-full px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                    <Store className="w-5 h-5 text-white/70" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-base font-bold text-white tracking-wide">Storefront</span>
                    <span className="text-[11px] text-white/40 uppercase tracking-widest font-semibold mt-0.5">Aftercare & Merch</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
              </div>
            </motion.button>
          )}

          {/* Seminars (Phase 4) */}
          {artist.hasSeminars && (
            <motion.button
              variants={itemVariants}
              onClick={() => setLocation(`/events/${slug}`)}
              className="group relative w-full overflow-hidden rounded-[20px] bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all active:scale-[0.98]"
            >
              <div className="w-full px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                    <CalendarDays className="w-5 h-5 text-white/70" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-base font-bold text-white tracking-wide">Upcoming Seminars</span>
                    <span className="text-[11px] text-white/40 uppercase tracking-widest font-semibold mt-0.5">Live & Virtual Events</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
              </div>
            </motion.button>
          )}
        </motion.div>

        {/* Footer branding */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-16 text-center"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/20">
            Powered by Tattoi
          </span>
        </motion.div>
      </div>
    </div>
  );
}
