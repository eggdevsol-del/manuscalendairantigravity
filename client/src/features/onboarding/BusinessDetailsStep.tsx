import React, { useState } from "react";
import { Input, Label, Button } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface BusinessDetailsStepProps {
  country: "AU" | "NZ";
  businessName: string;
  setBusinessName: (val: string) => void;
  abn: string;
  setAbn: (val: string) => void;
  nzbn: string;
  setNzbn: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
}

export function BusinessDetailsStep({
  country,
  businessName,
  setBusinessName,
  abn,
  setAbn,
  nzbn,
  setNzbn,
  phone,
  setPhone,
}: BusinessDetailsStepProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<"idle" | "valid" | "warning">("idle");
  const [validationMessage, setValidationMessage] = useState("");

  const { refetch: validateAbn } = trpc.merchantAuth.validateAbn.useQuery(
    { abn: abn.replace(/\s/g, "") },
    { enabled: false }
  );

  const { refetch: validateNzbn } = trpc.merchantAuth.validateNzbn.useQuery(
    { nzbn: nzbn.replace(/\s/g, "") },
    { enabled: false }
  );

  const handleValidation = async () => {
    if (country === "AU" && (!abn || abn.length < 11)) return;
    if (country === "NZ" && (!nzbn || nzbn.length < 13)) return;

    setIsValidating(true);
    try {
      if (country === "AU") {
        const { data } = await validateAbn();
        if (data?.valid) {
          setValidationResult("valid");
          setValidationMessage("ABN verified");
        } else {
          setValidationResult("warning");
          setValidationMessage("ABN name mismatch, but you can proceed.");
        }
      } else {
        const { data } = await validateNzbn();
        if (data?.valid) {
          setValidationResult("valid");
          setValidationMessage("NZBN verified");
        } else {
          setValidationResult("warning");
          setValidationMessage("NZBN name mismatch, but you can proceed.");
        }
      }
    } catch (error) {
      toast.error("Failed to validate business number");
      setValidationResult("idle");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Legal Business Name
        </Label>
        <Input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Inky Supplies Pty Ltd"
          className="bg-accent/5"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>{country === "AU" ? "ABN (Australian Business Number)" : "NZBN (New Zealand Business Number)"}</span>
          {validationResult === "valid" && <span className="text-emerald-500 flex items-center gap-1 text-[10px]"><CheckCircle2 className="w-3 h-3" /> {validationMessage}</span>}
          {validationResult === "warning" && <span className="text-amber-500 flex items-center gap-1 text-[10px]"><AlertCircle className="w-3 h-3" /> {validationMessage}</span>}
        </Label>
        <div className="flex gap-2">
          {country === "AU" ? (
            <Input
              value={abn}
              onChange={(e) => setAbn(e.target.value)}
              onBlur={handleValidation}
              placeholder="11 digit ABN"
              className="bg-accent/5 font-mono"
              maxLength={14}
            />
          ) : (
            <Input
              value={nzbn}
              onChange={(e) => setNzbn(e.target.value)}
              onBlur={handleValidation}
              placeholder="13 digit NZBN"
              className="bg-accent/5 font-mono"
              maxLength={13}
            />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Business Phone
        </Label>
        <div className="flex relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
            {country === "AU" ? "+61" : "+64"}
          </div>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={country === "AU" ? " 400 000 000" : " 21 000 000"}
            className="bg-accent/5 pl-10"
            type="tel"
          />
        </div>
      </div>
    </div>
  );
}
