import React from "react";
import { motion } from "framer-motion";
import { Search, MapPin, ExternalLink, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardTasks } from "@/features/dashboard/useDashboardTasks";

// Mock Data for Phase 1
const MOCK_SUPPLIERS = [
  {
    id: "s1",
    name: "InkVendor Supplies",
    category: "Equipment & Ink",
    location: "Melbourne, VIC",
    image: "https://images.unsplash.com/photo-1598371839696-5e5bb00b059b?w=800&auto=format&fit=crop&q=60",
    email: "orders@inkvendor.com.au"
  },
  {
    id: "s2",
    name: "Dr. Pickles Aftercare",
    category: "Aftercare Products",
    location: "Brisbane, QLD",
    image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&auto=format&fit=crop&q=60",
    email: "wholesale@drpickles.com"
  },
  {
    id: "s3",
    name: "Cheyenne Professional",
    category: "Machines",
    location: "Global",
    image: "https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=800&auto=format&fit=crop&q=60",
    email: "sales@cheyennetattoo.com"
  }
];

const MOCK_ARTISTS = [
  {
    id: "a1",
    name: "Sarah Chen",
    style: "Fineline / Floral",
    location: "Sydney, NSW",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=60",
    email: "collab@sarahchen.ink"
  },
  {
    id: "a2",
    name: "Marcus Thorne",
    style: "Traditional",
    location: "Melbourne, VIC",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=60",
    email: "marcus@thornetattoo.com"
  },
  {
    id: "a3",
    name: "Elena Rodriguez",
    style: "Realism",
    location: "Gold Coast, QLD",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=60",
    email: "elena.r@studio.com"
  }
];

export function ContactsTab() {
  const { actions } = useDashboardTasks();

  const handleContact = (email: string) => {
    actions.handleComms.email(email);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Search Bar */}
      <div className="relative px-1">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        <input
          type="text"
          placeholder="Search suppliers and artists..."
          className="w-full bg-secondary/50 border border-border rounded-full py-3.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/70 text-foreground"
        />
      </div>

      {/* Suppliers Matrix */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xl font-bold tracking-tight">Suppliers</h2>
          <button className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">See all</button>
        </div>
        
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-6 px-6 hide-scrollbar">
          {MOCK_SUPPLIERS.map((supplier, i) => (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={supplier.id}
              className="snap-start shrink-0 w-[280px] bg-card border border-border rounded-[24px] overflow-hidden group shadow-sm hover:shadow-md transition-all"
            >
              <div className="h-32 w-full overflow-hidden relative">
                <img src={supplier.image} alt={supplier.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-4 text-white">
                  <h3 className="font-bold text-lg leading-tight">{supplier.name}</h3>
                  <p className="text-xs font-medium text-white/80">{supplier.category}</p>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  {supplier.location}
                </div>
                
                <button 
                  onClick={() => handleContact(supplier.email)}
                  className="w-full py-2.5 bg-secondary/80 hover:bg-secondary rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-colors border border-border/50 text-foreground"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit Store
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Artists Matrix */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xl font-bold tracking-tight">Discover Artists</h2>
          <button className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">Explore</button>
        </div>
        
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-6 px-6 hide-scrollbar">
          {MOCK_ARTISTS.map((artist, i) => (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              key={artist.id}
              className="snap-start shrink-0 w-[160px] bg-card border border-border rounded-[24px] p-4 flex flex-col items-center text-center group shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-20 h-20 rounded-full p-1 border-2 border-primary/20 group-hover:border-primary/50 transition-colors mb-3">
                <img src={artist.avatar} alt={artist.name} className="w-full h-full rounded-full object-cover" />
              </div>
              <h3 className="font-bold text-[15px] leading-tight mb-1">{artist.name}</h3>
              <p className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-3">{artist.style}</p>
              
              <div className="mt-auto w-full space-y-2">
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  <MapPin className="w-3 h-3" />
                  {artist.location.split(',')[0]}
                </div>
                <button 
                  onClick={() => handleContact(artist.email)}
                  className="w-full py-2 bg-foreground text-background hover:opacity-90 rounded-xl font-bold text-xs flex justify-center items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Connect
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
}
