/**
 * PromotionWizardContent - Extracted core logic for the Promotion Wizard
 * 
 * Separated from CreatePromotionWizard to allow rendering inside different
 * shells (FullScreenSheet or FABMenu).
 */

import { useState, useRef, useEffect } from "react";
import { SelectionCard } from "@/components/ui/ssot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Percent, CreditCard, Check, ChevronRight, Upload, X, Image as ImageIcon, Palette, ZoomIn, Move, Clock, Zap, ArrowLeft, Maximize2 } from "lucide-react";
import { tokens } from "@/ui/tokens";
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

export type WizardStep = 'type' | 'value' | 'rules' | 'design' | 'preview';

interface PromotionWizardContentProps {
    onClose: () => void;
    onSuccess?: () => void;
    initialData?: PromotionCardData | null;
    onStepChange?: (step: WizardStep) => void;
}

export function PromotionWizardContent({ onClose, onSuccess, initialData, onStepChange }: PromotionWizardContentProps) {
    const { user } = useAuth();
    const [step, setStep] = useState<WizardStep>('type');

    useEffect(() => {
        onStepChange?.(step);
    }, [step, onStepChange]);

    // Form state - Same as CreatePromotionWizard.tsx
    const [type, setType] = useState<PromotionType>(initialData?.type || 'voucher');
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [valueType, setValueType] = useState<'fixed' | 'percentage'>(
        initialData?.valueType || 'fixed'
    );

    const initialValue = initialData
        ? (initialData.valueType === 'fixed' ? (initialData.value / 100).toString() : initialData.value.toString())
        : '';
    const [value, setValue] = useState(initialValue);

    const [templateDesign, setTemplateDesign] = useState(initialData?.templateDesign || 'classic');

    const [validityDuration, setValidityDuration] = useState<string>(
        initialData?.validityDuration ? initialData.validityDuration.toString() : ''
    );
    const [noExpiry, setNoExpiry] = useState<boolean>(!initialData?.validityDuration);
    const [autoApplyTrigger, setAutoApplyTrigger] = useState<'none' | 'new_client' | 'birthday'>(
        initialData?.autoApplyTrigger || 'none'
    );

    const getInitialColorMode = () => {
        if (!initialData) return 'gradient';
        if (initialData.gradientFrom) return 'gradient';
        if (initialData.primaryColor === 'custom' || initialData.customColor) return 'custom';
        if (initialData.primaryColor) return 'solid';
        return 'gradient';
    };

    const [colorMode, setColorMode] = useState<'solid' | 'gradient' | 'custom'>(getInitialColorMode());
    const [primaryColor, setPrimaryColor] = useState<string | null>(
        initialData?.primaryColor && initialData.primaryColor !== 'custom' ? initialData.primaryColor : null
    );
    const [gradientId, setGradientId] = useState<string>(initialData?.gradientFrom || 'gold_shimmer');
    const [customColor, setCustomColor] = useState(initialData?.customColor || '#667eea');
    const [customText, setCustomText] = useState(initialData?.customText || '');
    const [logoUrl, setLogoUrl] = useState<string | null>(initialData?.logoUrl || null);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(initialData?.backgroundImageUrl || null);
    const [backgroundScale, setBackgroundScale] = useState(initialData?.backgroundScale || 1);
    const [backgroundPositionX, setBackgroundPositionX] = useState(initialData?.backgroundPositionX ?? 50);
    const [backgroundPositionY, setBackgroundPositionY] = useState(initialData?.backgroundPositionY ?? 50);

    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingBackground, setUploadingBackground] = useState(false);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const backgroundInputRef = useRef<HTMLInputElement>(null);

    const utils = trpc.useUtils();
    const artistName = user?.name || 'Artist';

    const createMutation = trpc.promotions.createTemplate.useMutation({
        onSuccess: () => {
            toast.success('Promotion created successfully!');
            utils.promotions.getPromotions.invalidate();
            onSuccess?.();
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create promotion');
        },
    });

    const updateMutation = trpc.promotions.updateTemplate.useMutation({
        onSuccess: () => {
            toast.success('Promotion updated!');
            utils.promotions.getPromotions.invalidate();
            onSuccess?.();
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to update promotion');
        },
    });

    const uploadMutation = trpc.upload.uploadImage.useMutation();

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
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
            toast.error('Failed to upload logo');
        } finally {
            setUploadingLogo(false);
        }
    };

    const [localBackgroundPreview, setLocalBackgroundPreview] = useState<string | null>(null);

    const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingBackground(true);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result as string;
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
            toast.error('Failed to upload background');
            setLocalBackgroundPreview(null);
        } finally {
            setUploadingBackground(false);
        }
    };

    const goNext = () => {
        const steps: WizardStep[] = ['type', 'value', 'rules', 'design', 'preview'];
        const currentIndex = steps.indexOf(step);
        if (currentIndex < steps.length - 1) setStep(steps[currentIndex + 1]);
    };

    const goBack = () => {
        const steps: WizardStep[] = ['type', 'value', 'rules', 'design', 'preview'];
        const currentIndex = steps.indexOf(step);
        if (currentIndex > 0) setStep(steps[currentIndex - 1]);
        else onClose();
    };

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
        validityDuration: noExpiry ? null : (parseInt(validityDuration) || null),
        autoApplyTrigger,
    };

    const handleSave = () => {
        const payload = {
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
            validityDuration: noExpiry ? null : (parseInt(validityDuration) || null),
            autoApplyTrigger,
        };

        if (initialData) {
            updateMutation.mutate({ id: initialData.id, ...payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const canProceed = () => {
        if (uploadingLogo || uploadingBackground) return false;
        switch (step) {
            case 'type': return true;
            case 'value': return !!value && parseFloat(value) > 0 && !!name.trim();
            default: return true;
        }
    };

    const fab = tokens.fab;
    const card = tokens.card;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <motion.div variants={fab.animation.item} className={cn(fab.itemRow, "p-4 border-b border-white/10 shrink-0 mb-2")}>
                <button onClick={goBack} className={fab.itemButton}>
                    <ArrowLeft className={fab.itemIconSize} />
                </button>
                <div className="flex-1 min-w-0 ml-1">
                    <p className={cn(fab.itemLabel, "uppercase tracking-widest font-bold truncate")}>
                        {getStepTitle(step)}
                    </p>
                    <p className="text-[8px] text-muted-foreground font-mono">STEP {getStepIndex(step)} OF 5</p>
                </div>
            </motion.div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={fab.animation.panel}
                        className="space-y-6"
                    >
                        {step === 'type' && <TypeSelectionStep selected={type} onSelect={setType} goNext={goNext} />}
                        {step === 'value' && <ValueConfigStep type={type} name={name} setName={setName} description={description} setDescription={setDescription} valueType={valueType} setValueType={setValueType} value={value} setValue={setValue} />}
                        {step === 'rules' && <RulesConfigStep validityDuration={validityDuration} setValidityDuration={setValidityDuration} noExpiry={noExpiry} setNoExpiry={setNoExpiry} autoApplyTrigger={autoApplyTrigger} setAutoApplyTrigger={setAutoApplyTrigger} />}
                        {step === 'design' && <DesignCustomizationStep type={type} templateDesign={templateDesign} setTemplateDesign={setTemplateDesign} colorMode={colorMode} setColorMode={setColorMode} primaryColor={primaryColor} setPrimaryColor={setPrimaryColor} gradientId={gradientId} setGradientId={setGradientId} customColor={customColor} setCustomColor={setCustomColor} customText={customText} setCustomText={setCustomText} logoUrl={logoUrl} setLogoUrl={setLogoUrl} backgroundImageUrl={backgroundImageUrl} setBackgroundImageUrl={setBackgroundImageUrl} backgroundScale={backgroundScale} setBackgroundScale={setBackgroundScale} backgroundPositionX={backgroundPositionX} setBackgroundPositionX={setBackgroundPositionX} backgroundPositionY={backgroundPositionY} setBackgroundPositionY={setBackgroundPositionY} uploadingLogo={uploadingLogo} uploadingBackground={uploadingBackground} handleLogoUpload={handleLogoUpload} handleBackgroundUpload={handleBackgroundUpload} logoInputRef={logoInputRef} backgroundInputRef={backgroundInputRef} previewData={previewData} />}
                        {step === 'preview' && <PreviewStep previewData={previewData} isCreating={createMutation.isPending} />}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Action Footer */}
            <div className="p-4 pt-2 border-t border-white/10 flex gap-2 shrink-0">
                {step === 'preview' ? (
                    <button
                        className="flex-1 py-3 rounded-[4px] text-xs font-bold uppercase tracking-widest transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        onClick={handleSave}
                        disabled={!canProceed() || createMutation.isPending || updateMutation.isPending}
                    >
                        {(createMutation.isPending || updateMutation.isPending) ? '...' : (initialData ? 'Update' : 'Create')}
                    </button>
                ) : (
                    <button
                        className="flex-1 py-3 rounded-[4px] text-xs font-bold uppercase tracking-widest transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        onClick={goNext}
                        disabled={!canProceed()}
                    >
                        Continue
                    </button>
                )}
            </div>
        </div>
    );
}

// Sub-components extracted from CreatePromotionWizard.tsx
function TypeSelectionStep({ selected, onSelect, goNext }: { selected: PromotionType; onSelect: (type: PromotionType) => void; goNext: () => void; }) {
    const types: { id: PromotionType; icon: any; title: string; description: string }[] = [
        { id: 'voucher', icon: Gift, title: 'Gift Voucher', description: 'Fixed dollar amount' },
        { id: 'discount', icon: Percent, title: 'Discount Card', description: 'Percentage off' },
        { id: 'credit', icon: CreditCard, title: 'Store Credit', description: 'Balance used across bookings' },
    ];
    const fab = tokens.fab;
    const card = tokens.card;

    return (
        <div className="flex flex-col gap-2 w-full pt-2">
            {types.map(t => {
                const isSelected = selected === t.id;
                return (
                    <motion.div
                        key={t.id}
                        variants={fab.animation.item}
                        className={cn(fab.itemRow, "cursor-pointer active:scale-95 transition-transform px-1")}
                        onClick={() => {
                            onSelect(t.id);
                            goNext();
                        }}
                    >
                        <div className="flex-1 min-w-0 flex flex-col items-end">
                            <p className={cn(fab.itemLabel, "font-bold text-foreground")}>{t.title}</p>
                            <p className="text-[9px] text-muted-foreground opacity-70">{t.description}</p>
                        </div>
                        <div className={cn(isSelected ? fab.itemButtonHighlight : fab.itemButton, "shrink-0")}>
                            <t.icon className={fab.itemIconSize} />
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}

function ValueConfigStep({ type, name, setName, description, setDescription, valueType, setValueType, value, setValue }: any) {
    const defaults = getTypeDefaults(type);
    const fab = tokens.fab;
    const card = tokens.card;

    return (
        <div className="flex flex-col gap-3 w-full">
            <motion.div variants={fab.animation.item} className="space-y-1">
                <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Identity</p>
                <div className={cn(card.base, card.bg, "p-2 space-y-2")}>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Voucher Name"
                        className="h-9 text-xs bg-white/5 border-white/10"
                    />
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Public description..."
                        className="min-h-[50px] text-[10px] bg-white/5 border-white/10 p-2"
                    />
                </div>
            </motion.div>

            <motion.div variants={fab.animation.item} className="space-y-1">
                <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Configuration</p>
                <div className={cn(card.base, card.bg, "p-2 space-y-2")}>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setValueType('fixed')}
                            className={cn("flex-1 py-1.5 rounded-[4px] text-[10px] font-bold transition-all", valueType === 'fixed' ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground")}
                        >
                            Fixed
                        </button>
                        <button
                            onClick={() => setValueType('percentage')}
                            className={cn("flex-1 py-1.5 rounded-[4px] text-[10px] font-bold transition-all", valueType === 'percentage' ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground")}
                        >
                            Percent
                        </button>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{valueType === 'fixed' ? '$' : ''}</span>
                        <Input
                            type="number"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="h-10 pl-7 text-sm font-bold bg-white/5 border-white/10"
                            placeholder="0"
                        />
                        {valueType === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function RulesConfigStep({ validityDuration, setValidityDuration, noExpiry, setNoExpiry, autoApplyTrigger, setAutoApplyTrigger }: any) {
    const fab = tokens.fab;
    const card = tokens.card;

    return (
        <div className="flex flex-col gap-3 w-full">
            <motion.div variants={fab.animation.item} className="space-y-1">
                <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Validity</p>
                <div className={cn(card.base, card.bg, "p-2 space-y-3")}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-foreground">No Expiry</span>
                        <Switch checked={noExpiry} onCheckedChange={setNoExpiry} className="scale-75 origin-right" />
                    </div>
                    {!noExpiry && (
                        <div className="relative">
                            <Input
                                type="number"
                                value={validityDuration}
                                onChange={(e: any) => setValidityDuration(e.target.value)}
                                placeholder="Days"
                                className="h-9 text-xs bg-white/5 border-white/10 pr-12"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground uppercase font-bold">Days</span>
                        </div>
                    )}
                </div>
            </motion.div>

            <motion.div variants={fab.animation.item} className="space-y-1">
                <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Auto-Apply Trigger</p>
                <div className="flex flex-col gap-1">
                    {['none', 'new_client', 'birthday'].map(t => {
                        const isSelected = autoApplyTrigger === t;
                        return (
                            <button
                                key={t}
                                onClick={() => setAutoApplyTrigger(t as any)}
                                className={cn(card.base, card.bg, card.interactive, "p-2 flex items-center justify-between w-full")}
                            >
                                <span className="text-[10px] font-medium text-foreground capitalize">{t.replace('_', ' ')}</span>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            </button>
                        );
                    })}
                </div>
            </motion.div>
        </div>
    );
}

function DesignCustomizationStep({
    colorMode, setColorMode, gradientId, setGradientId, previewData,
    handleLogoUpload, uploadingLogo, logoInputRef,
    backgroundImageUrl, setBackgroundImageUrl, backgroundScale, setBackgroundScale,
    backgroundPositionX, setBackgroundPositionX, backgroundPositionY, setBackgroundPositionY,
    uploadingBackground, handleBackgroundUpload, backgroundInputRef
}: any) {
    const fab = tokens.fab;
    const card = tokens.card;

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Real-time Preview */}
            <motion.div variants={fab.animation.item} className="flex justify-center -mx-2">
                <div className="w-full scale-[0.75] origin-top">
                    <PromotionCard data={previewData} size="lg" className="shadow-2xl" />
                </div>
            </motion.div>

            <div className="-mt-16 space-y-3">
                {/* Theme Toggle */}
                <motion.div variants={fab.animation.item} className="space-y-1">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Theme Mode</p>
                    <div className="flex gap-1">
                        {['solid', 'gradient', 'custom'].map(m => (
                            <button
                                key={m}
                                onClick={() => setColorMode(m as any)}
                                className={cn("flex-1 py-1.5 rounded-[4px] text-[9px] font-bold uppercase transition-all", colorMode === m ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground")}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Gradient Selection */}
                {colorMode === 'gradient' && (
                    <motion.div variants={fab.animation.item} className="grid grid-cols-4 gap-1.5 p-2 bg-white/5 rounded-[4px]">
                        {Object.keys(GRADIENTS).map(g => (
                            <button
                                key={g}
                                onClick={() => setGradientId(g)}
                                className={cn("h-6 rounded-sm border transition-all", gradientId === g ? "border-white scale-110 shadow-lg" : "border-white/10 opacity-60")}
                                style={{ background: (GRADIENTS as any)[g].css }}
                            />
                        ))}
                    </motion.div>
                )}

                {/* Background Customization */}
                <motion.div variants={fab.animation.item} className="space-y-1">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Card Background</p>
                    <div className={cn(card.base, card.bg, "p-2 space-y-3")}>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-foreground">Custom Image</span>
                            <button
                                onClick={() => backgroundInputRef.current?.click()}
                                disabled={uploadingBackground}
                                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
                            >
                                {uploadingBackground ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            </button>
                            <input type="file" ref={backgroundInputRef} onChange={handleBackgroundUpload} className="hidden" accept="image/*" />
                        </div>

                        {backgroundImageUrl && (
                            <div className="space-y-3 pt-1 border-t border-white/5">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[8px] text-muted-foreground uppercase font-bold">
                                        <div className="flex items-center gap-1"><Maximize2 className="w-2.5 h-2.5" /> Scale</div>
                                        <span>{Math.round(backgroundScale * 100)}%</span>
                                    </div>
                                    <Slider
                                        value={[backgroundScale]}
                                        min={0.5}
                                        max={3}
                                        step={0.05}
                                        onValueChange={([val]) => setBackgroundScale(val)}
                                        className="py-1"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[8px] text-muted-foreground uppercase font-bold">
                                        <div className="flex items-center gap-1"><Move className="w-2.5 h-2.5" /> Horizontal Position</div>
                                        <span>{backgroundPositionX}%</span>
                                    </div>
                                    <Slider
                                        value={[backgroundPositionX]}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onValueChange={([val]) => setBackgroundPositionX(val)}
                                        className="py-1"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[8px] text-muted-foreground uppercase font-bold">
                                        <div className="flex items-center gap-1"><Move className="w-2.5 h-2.5 rotate-90" /> Vertical Position</div>
                                        <span>{backgroundPositionY}%</span>
                                    </div>
                                    <Slider
                                        value={[backgroundPositionY]}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onValueChange={([val]) => setBackgroundPositionY(val)}
                                        className="py-1"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Logo Branding */}
                <motion.div variants={fab.animation.item} className="space-y-1">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Branding</p>
                    <div className={cn(card.base, card.bg, "p-2 flex items-center justify-between")}>
                        <span className="text-[10px] font-semibold text-foreground">Custom Logo</span>
                        <button
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploadingLogo}
                            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
                        >
                            {uploadingLogo ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        </button>
                        <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

function PreviewStep({ previewData, isCreating }: { previewData: PromotionCardData, isCreating: boolean }) {
    const fab = tokens.fab;
    const card = tokens.card;

    return (
        <div className="flex flex-col gap-4 w-full text-center">
            <motion.div variants={fab.animation.item}>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">Final Preview</p>
                <h4 className="text-sm font-black text-foreground">Ready to Deploy?</h4>
            </motion.div>

            <motion.div variants={fab.animation.item} className="flex justify-center -mx-4">
                <div className="w-full scale-[0.65] origin-top">
                    <PromotionCard data={previewData} size="lg" className="shadow-2xl" />
                </div>
            </motion.div>

            <motion.div variants={fab.animation.item} className="-mt-12 space-y-2">
                <div className={cn(card.base, card.bg, "p-3")}>
                    <p className="text-[9px] leading-relaxed text-muted-foreground font-medium italic">
                        "Your new {previewData.type} template is ready. Once created, you can issue it to clients directly from your dashboard."
                    </p>
                </div>
                <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-[4px] bg-emerald-500/10">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Validated</span>
                </div>
            </motion.div>
        </div>
    );
}

function getStepTitle(step: WizardStep) {
    switch (step) {
        case 'type': return 'Voucher Type';
        case 'value': return 'Voucher Value';
        case 'rules': return 'Voucher Rules';
        case 'design': return 'Design & Styling';
        case 'preview': return 'Final Preview';
    }
}

function getStepIndex(step: WizardStep) {
    const steps: WizardStep[] = ['type', 'value', 'rules', 'design', 'preview'];
    return steps.indexOf(step) + 1;
}
