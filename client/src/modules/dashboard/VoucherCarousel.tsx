import { Card, CardContent } from "@/components/ui";
import { Ticket } from "lucide-react";

interface VoucherCarouselProps {
  vouchers: any[];
}

export function VoucherCarousel({ vouchers }: VoucherCarouselProps) {
  if (!vouchers || vouchers.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Your Vouchers</h2>
      <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 scroll-smooth snap-x">
        {vouchers.map(voucher => (
          <Card
            key={voucher.id}
            className="min-w-[280px] snap-center bg-gray-900 text-white border-none relative overflow-hidden h-36"
          >
            {/* Decorative Circles */}
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background" />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background" />

            <CardContent className="p-5 h-full flex flex-col justify-between relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">
                    {voucher.template?.name}
                  </h3>
                  <p className="text-white/70 text-xs">
                    From {voucher.artist?.name}
                  </p>
                </div>
                <Ticket className="text-white/20 w-8 h-8" />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider">
                    Value
                  </p>
                  <p className="text-xl font-bold">
                    ${(voucher.template?.value / 100).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white/20 px-2 py-1 rounded text-xs font-mono tracking-widest">
                  {voucher.code}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
