import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { CountryConfirmation } from "./CountryConfirmation";
import { BusinessDetailsStep } from "./BusinessDetailsStep";
import { StripeConnectStep } from "./StripeConnectStep";
import { Button } from "@/components/ui";
import { useLocation } from "wouter";

export function OnboardingMerchantFlow() {
  // 1. Detect Country
  const { data: geoData, isLoading: isLoadingGeo } = trpc.merchantAuth.detectCountry.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  // Local state for persistence
  const [country, setCountry] = useState<"AU" | "NZ" | null>(null);
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();

  // Form State
  const [businessName, setBusinessName] = useState("");
  const [abn, setAbn] = useState("");
  const [nzbn, setNzbn] = useState("");
  const [phone, setPhone] = useState("");

  // Hydrate country on load, preferring localStorage, then geo detection
  useEffect(() => {
    const savedCountry = localStorage.getItem("merchant_onboarding_country") as "AU" | "NZ" | null;
    if (savedCountry) {
      setCountry(savedCountry);
    } else if (geoData?.country) {
      setCountry(geoData.country);
      localStorage.setItem("merchant_onboarding_country", geoData.country);
    }
  }, [geoData?.country]);

  const handleCountryOverride = (newCountry: "AU" | "NZ") => {
    setCountry(newCountry);
    localStorage.setItem("merchant_onboarding_country", newCountry);
  };

  const handleNextStep = () => {
    if (step < 4) {
      // Fast forward to step 4 for Phase 4 execution
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    }
  };

  if (isLoadingGeo && !country) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin opacity-50" />
      </div>
    );
  }

  // Step 5 (Finished)
  if (step === 5) {
    setLocation("/supplier");
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl overflow-hidden">
      
      {/* 2. Global Country Confirmation Overlay */}
      {country && (
        <CountryConfirmation country={country} onOverride={handleCountryOverride} />
      )}

      {/* Main Wizard Area */}
      <main className="flex-1 overflow-y-auto w-full relative">
        <div className="max-w-2xl mx-auto px-6 py-20 pb-40">
          
          <div className="space-y-2 mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-3xl font-bold tracking-tight">
              {step === 4 ? "Set up Payments" : "Set up your Storefront"}
            </h1>
            <p className="text-muted-foreground">
              {step === 4 
                ? "Connect your bank account to start accepting payments." 
                : "Let's verify your business details to accept payments."}
            </p>
          </div>

          <div className="bg-card/50 backdrop-blur-md border border-border rounded-3xl p-8 shadow-sm">
            {step === 1 && country && (
              <>
                <BusinessDetailsStep
                  country={country}
                  businessName={businessName}
                  setBusinessName={setBusinessName}
                  abn={abn}
                  setAbn={setAbn}
                  nzbn={nzbn}
                  setNzbn={setNzbn}
                  phone={phone}
                  setPhone={setPhone}
                />
                <div className="mt-8 flex justify-end">
                  <Button size="lg" className="rounded-full shadow-lg hover:shadow-xl transition-all" onClick={handleNextStep}>
                    Continue
                  </Button>
                </div>
              </>
            )}

            {step === 4 && (
              <StripeConnectStep onNext={handleNextStep} />
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
