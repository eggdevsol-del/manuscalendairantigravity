/**
 * CreatePromotionWizard - SSOT Compliant
 * 
 * Multi-step wizard for creating gift vouchers, discount cards, and credits.
 * Allows full customization of templates, colors, gradients, branding,
 * custom background images with live resize, and logo upload.
 * 
 * @version 1.1.0
 */

import { useState, useRef } from "react";
import { FullScreenSheet } from "@/components/ui/ssot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Percent, CreditCard, Check, ChevronRight, Upload, X, Image as ImageIcon, Palette, ZoomIn, Move } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PromotionCard, PromotionCardData } from "./PromotionCard";
import {
  PromotionType,
  SOLID_COLORS,
  GRADIENTS,
  CARD_TEMPLATES,
  getTypeDefaults,
  getContrastTextColor,
} from "./cardTemplates";
import { InteractiveCardPreview } from "./InteractiveCardPreview";
import { useAuth } from "@/_core/hooks/useAuth";

type WizardStep = 'type' | 'value' | 'design' | 'preview';

interface CreatePromotionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: PromotionType;
  onSuccess?: () => void;
}

export function CreatePromotionWizard({
  isOpen,
  onClose,
  defaultType = 'voucher',
  onSuccess,
}: CreatePromotionWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<WizardStep>('type');

  // Form state
  const [type, setType] = useState<PromotionType>(defaultType);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [valueType, setValueType] = useState<'fixed' | 'percentage'>('fixed');
  const [value, setValue] = useState('');
  const [templateDesign, setTemplateDesign] = useState('classic');
  const [colorMode, setColorMode] = useState<'solid' | 'gradient' | 'custom'>('gradient');
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const [gradientId, setGradientId] = useState<string>('gold_shimmer');
  const [customColor, setCustomColor] = useState('#667eea');
  const [customText, setCustomText] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [backgroundScale, setBackgroundScale] = useState(1);
  const [backgroundPositionX, setBackgroundPositionX] = useState(50);
  const [backgroundPositionY, setBackgroundPositionY] = useState(50);

  // Upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Get artist name for display on card
  const artistName = user?.name || 'Artist';

  // Create mutation
  const createMutation = trpc.promotions.createTemplate.useMutation({
    onSuccess: () => {
      toast.success('Promotion created successfully!');
      utils.promotions.getPromotions.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      console.error('[CreatePromotionWizard] Create error:', error);
      toast.error(error.message || 'Failed to create promotion');
    },
  });

  // Upload mutation
  const uploadMutation = trpc.upload.uploadImage.useMutation();

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const result = await uploadMutation.mutateAsync({
          base64,
          filename: file.name,
          folder: 'promotion-logos',
        });
        setLogoUrl(result.url);
        toast.success('Logo uploaded!');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[CreatePromotionWizard] Logo upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Local preview state for immediate feedback
  const [localBackgroundPreview, setLocalBackgroundPreview] = useState<string | null>(null);

  // Handle background upload
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setUploadingBackground(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        // Set local preview immediately
        setLocalBackgroundPreview(base64);

        const result = await uploadMutation.mutateAsync({
          base64,
          filename: file.name,
          folder: 'promotion-backgrounds',
        });
        setBackgroundImageUrl(result.url);
        toast.success('Background uploaded!');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[CreatePromotionWizard] Background upload error:', error);
      toast.error('Failed to upload background');
      setLocalBackgroundPreview(null); // Clear preview on error
    } finally {
      setUploadingBackground(false);
    }
  };

  // Step navigation
  const goNext = () => {
    const steps: WizardStep[] = ['type', 'value', 'design', 'preview'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const goBack = () => {
    const steps: WizardStep[] = ['type', 'value', 'design', 'preview'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  // Get step title
  const getStepTitle = () => {
    switch (step) {
      case 'type': return 'Choose Type';
      case 'value': return 'Set Value';
      case 'design': return 'Customize Design';
      case 'preview': return 'Preview & Create';
    }
  };

  // Build preview data
  const previewData: PromotionCardData = {
    id: 0,
    type,
    name: name || getTypeDefaults(type).labelSingular,
    description,
    valueType,
    value: valueType === 'fixed' ? (parseFloat(value) || 0) * 100 : parseInt(value) || 0,
    templateDesign,
    primaryColor: colorMode === 'solid' ? primaryColor : (colorMode === 'custom' ? 'custom' : null),
    gradientFrom: colorMode === 'gradient' ? gradientId : null,
    customText: customText || null,
    customColor: colorMode === 'custom' ? customColor : undefined,
    logoUrl,
    backgroundImageUrl: localBackgroundPreview || backgroundImageUrl,
    backgroundScale,
    backgroundPositionX,
    backgroundPositionY,
    artistName,
    status: 'active',
  };

  // Handle create
  const handleCreate = () => {
    createMutation.mutate({
      type,
      name: name || getTypeDefaults(type).labelSingular,
      description: description || null,
      valueType,
      value: valueType === 'fixed' ? Math.round((parseFloat(value) || 0) * 100) : parseInt(value) || 0,
      templateDesign,
      primaryColor: colorMode === 'solid' ? primaryColor : (colorMode === 'custom' ? customColor : null),
      gradientFrom: colorMode === 'gradient' ? gradientId : null,
      gradientTo: null,
      customText: customText || null,
      logoUrl,
      backgroundImageUrl,
      backgroundScale,
      backgroundPositionX,
      backgroundPositionY,
    });
  };

  // Validation
  const canProceed = () => {
    // Block navigation if uploads are in progress
    if (uploadingLogo || uploadingBackground) return false;

    switch (step) {
      case 'type': return true;
      case 'value': return value && parseFloat(value) > 0;
      case 'design': return true;
      case 'preview': return true;
    }
  };

  return (
    <FullScreenSheet
      open={isOpen}
      onClose={onClose}
      title={getStepTitle()}
      onBack={step !== 'type' ? goBack : undefined}
      contextContent={
        <div className="flex items-center gap-2">
          {['type', 'value', 'design', 'preview'].map((s, i) => (
            <div
              key={s}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                step === s ? "bg-white w-6" : "bg-white/30"
              )}
            />
          ))}
        </div>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Step: Type Selection */}
          {step === 'type' && (
            <TypeSelectionStep
              selected={type}
              onSelect={setType}
            />
          )}

          {/* Step: Value Configuration */}
          {step === 'value' && (
            <ValueConfigStep
              type={type}
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
              valueType={valueType}
              setValueType={setValueType}
              value={value}
              setValue={setValue}
            />
          )}

          {/* Step: Design Customization */}
          {step === 'design' && (
            <DesignCustomizationStep
              type={type}
              templateDesign={templateDesign}
              setTemplateDesign={setTemplateDesign}
              colorMode={colorMode}
              setColorMode={setColorMode}
              primaryColor={primaryColor}
              setPrimaryColor={setPrimaryColor}
              gradientId={gradientId}
              setGradientId={setGradientId}
              customColor={customColor}
              setCustomColor={setCustomColor}
              customText={customText}
              setCustomText={setCustomText}
              logoUrl={logoUrl}
              setLogoUrl={setLogoUrl}
              backgroundImageUrl={backgroundImageUrl}
              setBackgroundImageUrl={setBackgroundImageUrl}
              backgroundScale={backgroundScale}
              setBackgroundScale={setBackgroundScale}
              backgroundPositionX={backgroundPositionX}
              setBackgroundPositionX={setBackgroundPositionX}
              backgroundPositionY={backgroundPositionY}
              setBackgroundPositionY={setBackgroundPositionY}
              uploadingLogo={uploadingLogo}
              uploadingBackground={uploadingBackground}
              handleLogoUpload={handleLogoUpload}
              handleBackgroundUpload={handleBackgroundUpload}
              logoInputRef={logoInputRef}
              backgroundInputRef={backgroundInputRef}
              previewData={previewData}
            />
          )}

          {/* Step: Preview & Create */}
          {step === 'preview' && (
            <PreviewStep
              previewData={previewData}
              isCreating={createMutation.isPending}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom Action */}
      <div className="mt-8 space-y-3">
        {step === 'preview' ? (
          <Button
            className="w-full h-14 rounded-xl font-bold text-base"
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Promotion'}
          </Button>
        ) : (
          <Button
            className="w-full h-14 rounded-xl font-bold text-base"
            onClick={goNext}
            disabled={!canProceed()}
          >
            Continue
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        )}
      </div>
    </FullScreenSheet>
  );
}

// Type Selection Step
function TypeSelectionStep({
  selected,
  onSelect,
}: {
  selected: PromotionType;
  onSelect: (type: PromotionType) => void;
}) {
  const types: { id: PromotionType; icon: any; title: string; description: string }[] = [
    {
      id: 'voucher',
      icon: Gift,
      title: 'Gift Voucher',
      description: 'A fixed dollar amount that can be redeemed on any booking',
    },
    {
      id: 'discount',
      icon: Percent,
      title: 'Discount Card',
      description: 'A percentage off the total booking price',
    },
    {
      id: 'credit',
      icon: CreditCard,
      title: 'Store Credit',
      description: 'Credit balance that can be used across multiple bookings',
    },
  ];

  return (
    <div className="space-y-4">
      {types.map(t => {
        const Icon = t.icon;
        const isSelected = selected === t.id;

        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={cn(
              "w-full p-4 rounded-xl border transition-all text-left flex items-start gap-4",
              isSelected
                ? "bg-primary/10 border-primary/50"
                : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
              isSelected ? "bg-primary text-primary-foreground" : "bg-black/10 dark:bg-white/10"
            )}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className={cn(
                "font-semibold text-base",
                isSelected ? "text-primary" : "text-foreground"
              )}>
                {t.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t.description}
              </p>
            </div>
            {isSelected && (
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Value Configuration Step
function ValueConfigStep({
  type,
  name,
  setName,
  description,
  setDescription,
  valueType,
  setValueType,
  value,
  setValue,
}: {
  type: PromotionType;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  valueType: 'fixed' | 'percentage';
  setValueType: (v: 'fixed' | 'percentage') => void;
  value: string;
  setValue: (v: string) => void;
}) {
  const defaults = getTypeDefaults(type);

  return (
    <div className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={defaults.labelSingular}
          className="h-12 rounded-xl"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description..."
          className="rounded-xl resize-none"
          rows={2}
        />
      </div>

      {/* Value Type (only for discount) */}
      {type === 'discount' && (
        <div className="space-y-2">
          <Label>Discount Type</Label>
          <div className="flex gap-2">
            <button
              onClick={() => setValueType('percentage')}
              className={cn(
                "flex-1 py-3 rounded-xl border transition-all",
                valueType === 'percentage'
                  ? "bg-primary/10 border-primary/50 text-primary"
                  : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
              )}
            >
              Percentage (%)
            </button>
            <button
              onClick={() => setValueType('fixed')}
              className={cn(
                "flex-1 py-3 rounded-xl border transition-all",
                valueType === 'fixed'
                  ? "bg-primary/10 border-primary/50 text-primary"
                  : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
              )}
            >
              Fixed ($)
            </button>
          </div>
        </div>
      )}

      {/* Value */}
      <div className="space-y-2">
        <Label>
          {valueType === 'percentage' ? 'Discount Percentage' : 'Value'}
        </Label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {valueType === 'percentage' ? '' : '$'}
          </span>
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={valueType === 'percentage' ? '10' : '50'}
            className={cn(
              "h-14 rounded-xl text-2xl font-bold text-center",
              valueType === 'fixed' && "pl-8"
            )}
          />
          {valueType === 'percentage' && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl">
              %
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Design Customization Step
function DesignCustomizationStep({
  type,
  templateDesign,
  setTemplateDesign,
  colorMode,
  setColorMode,
  primaryColor,
  setPrimaryColor,
  gradientId,
  setGradientId,
  customColor,
  setCustomColor,
  customText,
  setCustomText,
  logoUrl,
  setLogoUrl,
  backgroundImageUrl,
  setBackgroundImageUrl,
  backgroundScale,
  setBackgroundScale,
  backgroundPositionX,
  setBackgroundPositionX,
  backgroundPositionY,
  setBackgroundPositionY,
  uploadingLogo,
  uploadingBackground,
  handleLogoUpload,
  handleBackgroundUpload,
  logoInputRef,
  backgroundInputRef,
  previewData,
}: {
  type: PromotionType;
  templateDesign: string;
  setTemplateDesign: (v: string) => void;
  colorMode: 'solid' | 'gradient' | 'custom';
  setColorMode: (v: 'solid' | 'gradient' | 'custom') => void;
  primaryColor: string | null;
  setPrimaryColor: (v: string | null) => void;
  gradientId: string;
  setGradientId: (v: string) => void;
  customColor: string;
  setCustomColor: (v: string) => void;
  customText: string;
  setCustomText: (v: string) => void;
  logoUrl: string | null;
  setLogoUrl: (v: string | null) => void;
  backgroundImageUrl: string | null;
  setBackgroundImageUrl: (v: string | null) => void;
  backgroundScale: number;
  setBackgroundScale: (v: number) => void;
  backgroundPositionX: number;
  setBackgroundPositionX: (v: number) => void;
  backgroundPositionY: number;
  setBackgroundPositionY: (v: number) => void;
  uploadingLogo: boolean;
  uploadingBackground: boolean;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBackgroundUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  backgroundInputRef: React.RefObject<HTMLInputElement | null>;
  previewData: PromotionCardData;
}) {
  const availableTemplates = CARD_TEMPLATES.filter(t => t.forTypes.includes(type));

  return (
    <div className="space-y-6">
      {/* Live Preview with Interactivity */}
      <div className="flex flex-col items-center gap-4 py-2">
        <InteractiveCardPreview
          data={previewData}
          onUpdatePosition={(x: number, y: number) => {
            setBackgroundPositionX(x);
            setBackgroundPositionY(y);
          }}
          onUpdateScale={setBackgroundScale}
        />

        {/* Helper text */}
        {backgroundImageUrl && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Move className="w-3 h-3" /> Drag to move • <ZoomIn className="w-3 h-3" /> Scroll to zoom
          </p>
        )}
      </div>

      {/* Template Selection */}
      <div className="space-y-2">
        <Label>Card Style</Label>
        <div className="flex gap-2">
          {availableTemplates.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplateDesign(t.id)}
              className={cn(
                "flex-1 py-3 px-2 rounded-xl border transition-all text-sm",
                templateDesign === t.id
                  ? "bg-primary/10 border-primary/50 text-primary"
                  : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Color Mode Toggle */}
      <div className="space-y-2">
        <Label>Color Style</Label>
        <div className="flex gap-2">
          <button
            onClick={() => setColorMode('gradient')}
            className={cn(
              "flex-1 py-3 rounded-xl border transition-all text-sm",
              colorMode === 'gradient'
                ? "bg-primary/10 border-primary/50 text-primary"
                : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
            )}
          >
            Gradient
          </button>
          <button
            onClick={() => setColorMode('solid')}
            className={cn(
              "flex-1 py-3 rounded-xl border transition-all text-sm",
              colorMode === 'solid'
                ? "bg-primary/10 border-primary/50 text-primary"
                : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
            )}
          >
            Solid
          </button>
          <button
            onClick={() => setColorMode('custom')}
            className={cn(
              "flex-1 py-3 rounded-xl border transition-all text-sm flex items-center justify-center gap-1",
              colorMode === 'custom'
                ? "bg-primary/10 border-primary/50 text-primary"
                : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
            )}
          >
            <Palette className="w-4 h-4" />
            Custom
          </button>
        </div>
      </div>

      {/* Color/Gradient Selection */}
      <div className="space-y-2">
        <Label>
          {colorMode === 'gradient' ? 'Choose Gradient' : colorMode === 'custom' ? 'Pick Custom Color' : 'Choose Color'}
        </Label>

        {colorMode === 'custom' ? (
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-16 h-16 rounded-xl cursor-pointer border-2 border-white/20"
            />
            <div className="flex-1">
              <Input
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#667eea"
                className="h-12 rounded-xl font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter any hex color code
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {colorMode === 'gradient' ? (
              GRADIENTS.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGradientId(g.id)}
                  className={cn(
                    "aspect-square rounded-xl border-2 transition-all",
                    gradientId === g.id ? "border-primary scale-110" : "border-transparent"
                  )}
                  style={{
                    background: `linear-gradient(${g.direction}, ${g.from}, ${g.to})`,
                  }}
                  title={g.name}
                />
              ))
            ) : (
              SOLID_COLORS.filter(c => c.id !== 'custom').map(c => (
                <button
                  key={c.id}
                  onClick={() => setPrimaryColor(c.id)}
                  className={cn(
                    "aspect-square rounded-xl border-2 transition-all",
                    primaryColor === c.id ? "border-primary scale-110" : "border-transparent"
                  )}
                  style={{ background: c.value }}
                  title={c.name}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Logo Upload */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Brand Logo (optional)
        </Label>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          className="hidden"
        />
        {logoUrl ? (
          <div className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-xl">
            <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-lg bg-white" />
            <span className="flex-1 text-sm text-muted-foreground truncate">Logo uploaded</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogoUrl(null)}
              className="shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
          >
            {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
          </Button>
        )}
      </div>

      {/* Background Image Upload */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          Background Image (optional)
        </Label>
        <div className="flex justify-between items-center px-1">
          <span className="text-xs text-muted-foreground">
            Rec: 1000x600px (1.66 aspect ratio)
          </span>
          <a
            href="/voucher-template.svg"
            download="voucher-template.svg"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Move className="w-3 h-3" />
            Download Template Guide
          </a>
        </div>

        {/* Image Controls - Only show if image exists */}
        {backgroundImageUrl && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 bg-black/5 dark:bg-white/5 rounded-xl space-y-4 mb-4 border border-white/10"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ZoomIn className="w-3 h-3" /> Zoom
                </Label>
                <span className="text-xs font-mono">{Math.round(backgroundScale * 100)}%</span>
              </div>
              <Slider
                value={[backgroundScale]}
                min={0.5}
                max={3}
                step={0.1}
                onValueChange={([v]) => setBackgroundScale(v)}
                className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
              />

              <div className="flex items-center justify-between pt-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Move className="w-3 h-3" /> Position X
                </Label>
                <span className="text-xs font-mono">{backgroundPositionX}%</span>
              </div>
              <Slider
                value={[backgroundPositionX]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setBackgroundPositionX(v)}
                className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
              />

              <div className="flex items-center justify-between pt-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Move className="w-3 h-3 rotate-90" /> Position Y
                </Label>
                <span className="text-xs font-mono">{backgroundPositionY}%</span>
              </div>
              <Slider
                value={[backgroundPositionY]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setBackgroundPositionY(v)}
                className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
              />
            </div>
          </motion.div>
        )}

        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/*"
          onChange={handleBackgroundUpload}
          className="hidden"
        />
        {backgroundImageUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-xl">
              <img src={backgroundImageUrl} alt="Background" className="w-16 h-10 object-cover rounded-lg" />
              <span className="flex-1 text-sm text-muted-foreground truncate">Background uploaded</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBackgroundImageUrl(null)}
                className="shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Background Resize Controls */}
            <div className="space-y-4 p-4 bg-black/5 dark:bg-white/5 rounded-xl">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <ZoomIn className="w-4 h-4" />
                  Scale: {(backgroundScale * 100).toFixed(0)}%
                </Label>
                <Slider
                  value={[backgroundScale]}
                  onValueChange={([v]) => setBackgroundScale(v)}
                  min={0.5}
                  max={3}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Move className="w-4 h-4" />
                  Position X: {backgroundPositionX}%
                </Label>
                <Slider
                  value={[backgroundPositionX]}
                  onValueChange={([v]) => setBackgroundPositionX(v)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Position Y: {backgroundPositionY}%</Label>
                <Slider
                  value={[backgroundPositionY]}
                  onValueChange={([v]) => setBackgroundPositionY(v)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl"
            onClick={() => backgroundInputRef.current?.click()}
            disabled={uploadingBackground}
          >
            {uploadingBackground ? 'Uploading...' : 'Upload Background Image'}
          </Button>
        )}
      </div>

      {/* Custom Text */}
      <div className="space-y-2">
        <Label>Custom Text (optional)</Label>
        <Input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="e.g., Holiday Special"
          className="h-12 rounded-xl"
          maxLength={30}
        />
      </div>
    </div>
  );
}

// Preview Step
function PreviewStep({
  previewData,
  isCreating,
}: {
  previewData: PromotionCardData;
  isCreating: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Large Preview */}
      <div className="flex justify-center py-8">
        <PromotionCard data={previewData} size="lg" />
      </div>

      {/* Summary */}
      <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-foreground">Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span className="font-medium capitalize">{previewData.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{previewData.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Value</span>
            <span className="font-medium">
              {previewData.valueType === 'percentage'
                ? `${previewData.value}%`
                : `$${(previewData.value / 100).toFixed(2)}`
              }
            </span>
          </div>
          {previewData.artistName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Artist</span>
              <span className="font-medium">{previewData.artistName}</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        This will create a template you can send to clients or auto-apply to new bookings.
      </p>
    </div>
  );
}

export default CreatePromotionWizard;
