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

const DEFAULT_STYLES = [
  { id: 'realism', label: 'Realism', emoji: '📷' },
  { id: 'traditional', label: 'Traditional', emoji: '⚓' },
  { id: 'neo-traditional', label: 'Neo-Traditional', emoji: '🌹' },
  { id: 'japanese', label: 'Japanese', emoji: '🐉' },
  { id: 'blackwork', label: 'Blackwork', emoji: '⬛' },
  { id: 'dotwork', label: 'Dotwork', emoji: '⚫' },
  { id: 'watercolor', label: 'Watercolor', emoji: '🎨' },
  { id: 'geometric', label: 'Geometric', emoji: '📐' },
  { id: 'minimalist', label: 'Minimalist', emoji: '✨' },
  { id: 'other', label: 'Other', emoji: '🤔' },
];

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

  // Use artist's custom styles if available, otherwise defaults
  const availableStyles = artistProfile.styleOptions?.length > 0
    ? artistProfile.styleOptions.map(id => 
        DEFAULT_STYLES.find(s => s.id === id) || { id, label: id, emoji: '🎨' }
      )
    : DEFAULT_STYLES;

  const toggleStyle = (styleId: string) => {
    setSelectedStyles(prev => 
      prev.includes(styleId)
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const dataUrl = await new Promise<string>((resolve) => {
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
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    onNext('style', {
      stylePreferences: selectedStyles,
      referenceImages,
    });
  };

  const isValid = selectedStyles.length > 0;

  return (
    <FunnelStepWrapper
      title="What style are you into?"
      subtitle="Select all that apply"
      onNext={handleNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      nextDisabled={!isValid}
      submitting={submitting}
    >
      {/* Style selection */}
      <div className="grid grid-cols-2 gap-3">
        {availableStyles.map((style, index) => (
          <motion.button
            key={style.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => toggleStyle(style.id)}
            className={`
              relative p-3 rounded-xl border-2 text-left transition-all
              ${selectedStyles.includes(style.id)
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50'
              }
            `}
          >
            <span className="text-lg mr-2">{style.emoji}</span>
            <span className="font-medium text-foreground text-sm">{style.label}</span>
            
            {selectedStyles.includes(style.id) && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
              >
                <Check className="w-2.5 h-2.5 text-primary-foreground" />
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Reference images */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          Reference images <span className="text-muted-foreground">(optional, up to 5)</span>
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
                className="relative aspect-square rounded-xl overflow-hidden bg-muted"
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
              className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors"
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
          Share inspiration photos, reference images, or examples of work you love
        </p>
      </div>
    </FunnelStepWrapper>
  );
}
