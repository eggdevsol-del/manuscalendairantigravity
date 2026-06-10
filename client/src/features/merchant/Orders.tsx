import React from "react";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Package, Search, Filter } from "lucide-react";
import { Input, Button } from "@/components/ui";

export function MerchantOrders() {
  return (
    <PageShell>
      <PageHeader title="Orders" />
      <div className="px-6 py-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10 h-14 rounded-md bg-secondary/20 border-transparent" placeholder="Search orders by ID or customer..." />
          </div>
          <Button variant="secondary" className="h-14 w-12 p-0 rounded-md shrink-0">
            <Filter className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mb-6">
            <Package className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h2 className="text-xl font-bold text-foreground">No Orders Yet</h2>
          <p className="text-muted-foreground mt-2 max-w-xs">
            When artists place orders on your storefront, they will appear here for fulfillment.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
