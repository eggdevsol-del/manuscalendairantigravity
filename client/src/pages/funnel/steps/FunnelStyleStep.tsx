/**
 * Funnel Style Step
 * Third step: Style preferences and reference images
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import FunnelStepWrapper from "../components/FunnelStepWrapper";
import type { ArtistProfile, FunnelStepData } from "../FunnelWrapper";

interface FunnelStyleStepProps {
  artistProfile: ArtistProfile;
  stepData: FunnelStepData;
  onNext: (stepName: string, data: any) => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  submitting: boolean;
}
export default function FunnelStyleStep({
  artistProfile,
  stepData,
  onNext,
  onBack,
  isFirstStep,
  isLastStep,
  submitting,
}: FunnelStyleStepProps) {
  const [selectedStyles, setSelectedStyles] = useState<string[]>(
    stepData.style?.stylePreferences || []
  );
  const [referenceImages, setReferenceImages] = useState<string[]>(
    stepData.style?.referenceImages || []
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableServices = (artistProfile.services || [])
    .filter((s: any) => s.showInFunnel !== false)
    .map((s: any) => ({
      id: s.name,
      label: s.name,
      price: s.price,
      duration: s.duration,
      sittings: s.sittings,
    }));

  const toggleStyle = (serviceName: string) => {
    setSelectedStyles(prev =>
      prev.includes(serviceName) ? [] : [serviceName]
    );
  }; const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      // For now, convert to base64 data URLs
      // In production, these would be uploaded to S3/storage
      const newImages: string[] = [];

      for (const file of Array.from(files)) {
        if (referenceImages.length + newImages.length >= 5) break;

        const reader = new FileReader();
        const dataUrl = await new Promise<string>(resolve => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newImages.push(dataUrl);
      }

      setReferenceImages(prev => [...prev, ...newImages].slice(0, 5));
    } catch (err) {
      console.error("Failed to process images:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    onNext("style", {
      stylePreferences: selectedStyles,
      referenceImages,
    });
  };

  const isValid = selectedStyles.length > 0;

  return (
    <FunnelStepWrapper
      title="What service are you looking for?"
      subtitle="Select the service you'd like to book"
      onNext={handleNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      nextDisabled={!isValid}
      submitting={submitting}
    >
      {/* Service selection */}
      <div className="grid gap-3">
        {availableServices.length > 0 ? (
          availableServices.map((service: any, index: number) => (
            <motion.button
              key={service.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => toggleStyle(service.id)}
              className={`
                relative p-4 rounded-[4px] border-2 text-left transition-all flex flex-col gap-1
                ${selectedStyles.includes(service.id)
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
                }
              `}
            >
              <div className="flex justify-between items-start w-full pr-8">
                <span className="font-semibold text-foreground text-sm">
                  {service.label}
                </span>
                <span className="font-bold text-primary text-sm">${service.price}</span>
              </div>
              {(service.duration > 0 || service.sittings > 1) && (
                <div className="flex gap-3 text-[11px] text-muted-foreground font-mono mt-1">
                  {service.duration > 0 && <span>{service.duration / 60}h</span>}
                  {service.sittings > 1 && <span>Project: {service.sittings} Sittings</span>}
                </div>
              )}

              {selectedStyles.includes(service.id) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1/2 -translate-y-1/2 right-4 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-3.5 h-3.5 text-primary-foreground" />
                </motion.div>
              )}
            </motion.button>
          ))
        ) : (
          <div className="p-6 border border-dashed border-border rounded-[4px] text-center text-sm text-muted-foreground">
            This artist has not listed any public services yet.
          </div>
        )}
      </div>

      {/* Reference images */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          Reference images{" "}
          <span className="text-muted-foreground">(optional, up to 5)</span>
        </label>

        <div className="grid grid-cols-3 gap-2">
          {/* Existing images */}
          <AnimatePresence>
            {referenceImages.map((img, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative aspect-square rounded-[4px] overflow-hidden bg-muted"
              >
                <img
                  src={img}
                  alt={`Reference ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Upload button */}
          {referenceImages.length < 5 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-[4px] border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors"
            >
              {uploading ? (
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Upload</span>
                </>
              )}
            </motion.button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <p className="text-xs text-muted-foreground mt-2">
          Share inspiration photos, reference images, or examples of work you
          love
        </p>
      </div>
    </FunnelStepWrapper>
  );
}
