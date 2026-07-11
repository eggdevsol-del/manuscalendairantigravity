import React from "react";
import { Users, TrendingUp, Package, MapPin, ExternalLink } from "lucide-react";

export function ArtistsTier() {
  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-6 border-b border-border/50">
        <h3 className="text-xl font-bold text-foreground">Top Performing Artists</h3>
        <p className="text-sm text-muted-foreground mt-1">Commercial profiles and purchasing habits.</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Sample Artist Card */}
        <div className="bg-secondary/20 border border-border/50 rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--color-status-success-bg)] flex items-center justify-center">
                <Users className="w-6 h-6 text-[var(--color-status-success-text)]" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-foreground">Sarah Tattoo</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Melbourne, VIC
                </p>
              </div>
            </div>
            <button className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline">
              View Profile <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background/50 rounded-md p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">AOV</p>
              <p className="text-lg font-light text-foreground">$425.00</p>
            </div>
            <div className="bg-background/50 rounded-md p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Orders</p>
              <p className="text-lg font-light text-foreground">24</p>
            </div>
            <div className="bg-background/50 rounded-md p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Top Brand</p>
              <p className="text-lg font-light text-foreground">Kwadron</p>
            </div>
            <div className="bg-background/50 rounded-md p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Pref. Needles</p>
              <p className="text-lg font-light text-foreground">1203RL</p>
            </div>
          </div>
        </div>

        {/* Another Sample Artist Card */}
        <div className="bg-secondary/20 border border-border/50 rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--color-status-info-bg)] flex items-center justify-center">
                <Users className="w-6 h-6 text-[var(--color-status-info-text)]" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-foreground">Mike Ink</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Sydney, NSW
                </p>
              </div>
            </div>
            <button className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline">
              View Profile <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background/50 rounded-md p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">AOV</p>
              <p className="text-lg font-light text-foreground">$310.00</p>
            </div>
            <div className="bg-background/50 rounded-md p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Orders</p>
              <p className="text-lg font-light text-foreground">18</p>
            </div>
            <div className="bg-background/50 rounded-md p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Top Brand</p>
              <p className="text-lg font-light text-foreground">Cheyenne</p>
            </div>
            <div className="bg-background/50 rounded-md p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Pref. Needles</p>
              <p className="text-lg font-light text-foreground">1007CM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
