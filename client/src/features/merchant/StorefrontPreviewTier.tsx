import React from "react";
import { Store, ExternalLink, Package } from "lucide-react";

export function StorefrontPreviewTier() {
  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-6 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground">Storefront Preview</h3>
          <p className="text-sm text-muted-foreground mt-1">Live preview of your Tattoi storefront.</p>
        </div>
        <button className="px-4 py-2 bg-secondary text-foreground text-sm font-bold rounded-full flex items-center gap-2 hover:bg-secondary/80 transition-colors">
          View Live <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 flex-1 flex flex-col items-center justify-center bg-muted/10">
        {/* Mock Storefront */}
        <div className="w-full max-w-sm aspect-[9/16] bg-background border border-border rounded-[40px] shadow-2xl overflow-hidden relative">
          {/* Notch */}
          <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20">
            <div className="w-32 h-6 bg-card rounded-b-2xl"></div>
          </div>
          
          <div className="w-full h-full overflow-y-auto scrollbar-hide pb-20">
            {/* Store Header */}
            <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 relative">
              <div className="absolute -bottom-10 inset-x-0 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-card border-4 border-background flex items-center justify-center shadow-lg">
                  <Store className="w-8 h-8 text-primary" />
                </div>
              </div>
            </div>
            
            <div className="pt-14 px-6 text-center">
              <h2 className="text-xl font-bold text-foreground">Premium Supply Co.</h2>
              <p className="text-sm text-muted-foreground mt-1">Professional Tattoo Equipment</p>
            </div>

            <div className="px-4 mt-8 grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-secondary/20 rounded-md p-3">
                  <div className="aspect-square bg-background rounded-md mb-2 flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-[10px] font-bold text-foreground line-clamp-2 leading-tight">Cheyenne Hawk Pen</p>
                  <p className="text-[12px] text-muted-foreground mt-1">$999.00</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
