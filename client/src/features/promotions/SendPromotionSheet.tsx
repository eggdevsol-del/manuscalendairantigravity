/**
 * SendPromotionSheet - SSOT Compliant
 * 
 * Sheet for sending promotions to specific clients or setting up auto-apply rules.
 * 
 * @version 1.0.0
 */

import { useState } from "react";
import { FullScreenSheet } from "@/components/ui/ssot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Search, User, Users, Calendar, Check, Send } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PromotionCard, PromotionCardData } from "./PromotionCard";
import { format } from "date-fns";

interface SendPromotionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  promotion: PromotionCardData;
  onSuccess?: () => void;
}

type SendMode = 'specific' | 'auto';

export function SendPromotionSheet({
  isOpen,
  onClose,
  promotion,
  onSuccess,
}: SendPromotionSheetProps) {
  const [mode, setMode] = useState<SendMode>('specific');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [autoApplyStartDate, setAutoApplyStartDate] = useState('');
  const [autoApplyEndDate, setAutoApplyEndDate] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>(
    promotion.validityDuration ? promotion.validityDuration.toString() : ''
  );

  const utils = trpc.useUtils();

  // Fetch clients
  const { data: clients, isLoading: loadingClients } = trpc.conversations.getClients.useQuery(
    undefined,
    { enabled: mode === 'specific' }
  );

  // Send mutation
  const sendMutation = trpc.promotions.issuePromotion.useMutation({
    onSuccess: () => {
      toast.success('Promotion sent successfully!');
      utils.promotions.getPromotions.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send promotion');
    },
  });

  // Auto-apply mutation
  const autoApplyMutation = trpc.promotions.createAutoApply.useMutation({
    onSuccess: () => {
      toast.success('Auto-apply rule created!');
      utils.promotions.getPromotions.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create auto-apply rule');
    },
  });

  // Filter clients by search
  const validClients = (clients || []).filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined);

  const filteredClients = validClients.filter(client => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (client.name?.toLowerCase() || '').includes(query) ||
      (client.email?.toLowerCase() || '').includes(query)
    );
  });

  // Toggle client selection
  const toggleClient = (clientId: string) => {
    setSelectedClientIds(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  // Handle send
  const handleSend = () => {
    if (mode === 'specific') {
      if (selectedClientIds.length === 0) {
        toast.error('Please select at least one client');
        return;
      }

      // Send to each selected client
      selectedClientIds.forEach(clientId => {
        sendMutation.mutate({
          templateId: promotion.id,
          clientId,
          expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
        });
      });
    } else {
      if (!autoApplyStartDate || !autoApplyEndDate) {
        toast.error('Please select date range');
        return;
      }

      autoApplyMutation.mutate({
        templateId: promotion.id,
        startDate: autoApplyStartDate,
        endDate: autoApplyEndDate,
      });
    }
  };

  const isPending = sendMutation.isPending || autoApplyMutation.isPending;

  return (
    <FullScreenSheet
      open={isOpen}
      onClose={onClose}
      title="Send Promotion"
      contextContent={
        <div>
          <p className="text-lg font-bold text-white">{promotion.name}</p>
          <p className="text-sm text-white/70">
            {promotion.valueType === 'percentage'
              ? `${promotion.value}% discount`
              : `$${(promotion.value / 100).toFixed(2)} value`
            }
          </p>
        </div>
      }
    >
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('specific')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all",
            mode === 'specific'
              ? "bg-primary text-primary-foreground"
              : "bg-black/5 dark:bg-white/5 text-muted-foreground"
          )}
        >
          <User className="w-4 h-4" />
          <span className="text-sm font-medium">Specific Client</span>
        </button>
        <button
          onClick={() => setMode('auto')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all",
            mode === 'auto'
              ? "bg-primary text-primary-foreground"
              : "bg-black/5 dark:bg-white/5 text-muted-foreground"
          )}
        >
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">Auto-Apply</span>
        </button>
      </div>

      {mode === 'specific' ? (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              className="h-12 rounded-xl pl-10"
            />
          </div>

          {/* Validity Override */}
          <div className="mb-4 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Validity for this issue (Optional)
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder={promotion.validityDuration ? `Default: ${promotion.validityDuration} days` : "No expiry"}
                className="h-12 rounded-xl pl-4"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                days
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Leave blank to use default rules or set to 0 for no expiry.
            </p>
          </div>

          {/* Client List */}
          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {loadingClients ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No clients found
              </div>
            ) : (
              filteredClients.map(client => {
                const isSelected = selectedClientIds.includes(client.id);
                return (
                  <button
                    key={client.id}
                    onClick={() => toggleClient(client.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border transition-all text-left flex items-center gap-3",
                      isSelected
                        ? "bg-primary/10 border-primary/50"
                        : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {client.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {client.email}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {selectedClientIds.length > 0 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              {selectedClientIds.length} client{selectedClientIds.length > 1 ? 's' : ''} selected
            </p>
          )}
        </>
      ) : (
        <>
          {/* Auto-Apply Configuration */}
          <div className="space-y-6">
            <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium text-foreground">Auto-Apply to New Clients</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This promotion will automatically be applied to all new clients who book during the selected date range.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={autoApplyStartDate}
                  onChange={(e) => setAutoApplyStartDate(e.target.value)}
                  className="h-12 rounded-xl"
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={autoApplyEndDate}
                  onChange={(e) => setAutoApplyEndDate(e.target.value)}
                  className="h-12 rounded-xl"
                  min={autoApplyStartDate || format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              After the end date, this promotion will stop being automatically applied.
            </p>
          </div>
        </>
      )}

      {/* Send Button */}
      <div className="mt-8">
        <Button
          className="w-full h-14 rounded-xl font-bold text-base"
          onClick={handleSend}
          disabled={isPending || (mode === 'specific' && selectedClientIds.length === 0)}
        >
          {isPending ? (
            'Sending...'
          ) : mode === 'specific' ? (
            <>
              <Send className="w-5 h-5 mr-2" />
              Send to {selectedClientIds.length || ''} Client{selectedClientIds.length !== 1 ? 's' : ''}
            </>
          ) : (
            <>
              <Calendar className="w-5 h-5 mr-2" />
              Create Auto-Apply Rule
            </>
          )}
        </Button>
      </div>
    </FullScreenSheet>
  );
}

export default SendPromotionSheet;
