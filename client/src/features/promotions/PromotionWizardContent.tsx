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
import { Gift, Percent, CreditCard, Check, ChevronRight, Upload, X, Image as ImageIcon, Palette, ZoomIn, Move, Clock, Zap, ArrowLeft } from "lucide-react";
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
            case 'value': return !!value && parseFloat(value) > 0;
            default: return true;
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Dynamic Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={goBack} className="p-2 hover:bg-white/5 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="font-bold">{getStepTitle(step)}</h3>
                        <p className="text-xs text-muted-foreground">Step {getStepIndex(step)} of 5</p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                    >
                        {step === 'type' && <TypeSelectionStep selected={type} onSelect={setType} />}
                        {step === 'value' && <ValueConfigStep type={type} name={name} setName={setName} description={description} setDescription={setDescription} valueType={valueType} setValueType={setValueType} value={value} setValue={setValue} />}
                        {step === 'rules' && <RulesConfigStep validityDuration={validityDuration} setValidityDuration={setValidityDuration} noExpiry={noExpiry} setNoExpiry={setNoExpiry} autoApplyTrigger={autoApplyTrigger} setAutoApplyTrigger={setAutoApplyTrigger} />}
                        {step === 'design' && <DesignCustomizationStep type={type} templateDesign={templateDesign} setTemplateDesign={setTemplateDesign} colorMode={colorMode} setColorMode={setColorMode} primaryColor={primaryColor} setPrimaryColor={setPrimaryColor} gradientId={gradientId} setGradientId={setGradientId} customColor={customColor} setCustomColor={setCustomColor} customText={customText} setCustomText={setCustomText} logoUrl={logoUrl} setLogoUrl={setLogoUrl} backgroundImageUrl={backgroundImageUrl} setBackgroundImageUrl={setBackgroundImageUrl} backgroundScale={backgroundScale} setBackgroundScale={setBackgroundScale} backgroundPositionX={backgroundPositionX} setBackgroundPositionX={setBackgroundPositionX} backgroundPositionY={backgroundPositionY} setBackgroundPositionY={setBackgroundPositionY} uploadingLogo={uploadingLogo} uploadingBackground={uploadingBackground} handleLogoUpload={handleLogoUpload} handleBackgroundUpload={handleBackgroundUpload} logoInputRef={logoInputRef} backgroundInputRef={backgroundInputRef} previewData={previewData} />}
                        {step === 'preview' && <PreviewStep previewData={previewData} isCreating={createMutation.isPending} />}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Action Footer */}
            <div className="p-4 border-t border-white/10 flex gap-2 shrink-0">
                {step === 'preview' ? (
                    <Button className="flex-1 font-bold h-12" onClick={handleSave} disabled={!canProceed() || createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : (initialData ? 'Save Changes' : 'Create')}
                    </Button>
                ) : (
                    <Button className="flex-1 h-12" onClick={goNext} disabled={!canProceed()}>
                        Continue
                    </Button>
                )}
            </div>
        </div>
    );
}

// Sub-components extracted from CreatePromotionWizard.tsx
function TypeSelectionStep({ selected, onSelect }: { selected: PromotionType; onSelect: (type: PromotionType) => void; }) {
    const types: { id: PromotionType; icon: any; title: string; description: string }[] = [
        { id: 'voucher', icon: Gift, title: 'Gift Voucher', description: 'Fixed dollar amount' },
        { id: 'discount', icon: Percent, title: 'Discount Card', description: 'Percentage off' },
        { id: 'credit', icon: CreditCard, title: 'Store Credit', description: 'Balance used across bookings' },
    ];
    return (
        <div className="grid gap-3">
            {types.map(t => (
                <SelectionCard key={t.id} selected={selected === t.id} onClick={() => onSelect(t.id)} icon={t.icon} title={t.title} description={t.description} />
            ))}
        </div>
    );
}

function ValueConfigStep({ type, name, setName, description, setDescription, valueType, setValueType, value, setValue }: any) {
    const defaults = getTypeDefaults(type);
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={defaults.labelSingular} className="h-11" />
            </div>
            <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description..." className="min-h-[80px]" />
            </div>
            <div className="space-y-2">
                <Label>{valueType === 'percentage' ? 'Percentage' : 'Value'}</Label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{valueType === 'percentage' ? '' : '$'}</span>
                    <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="h-12 pl-8 text-xl font-bold" />
                    {valueType === 'percentage' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xl">%</span>}
                </div>
            </div>
        </div>
    );
}

function RulesConfigStep({ validityDuration, setValidityDuration, noExpiry, setNoExpiry, autoApplyTrigger, setAutoApplyTrigger }: any) {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2"><Clock className="w-4 h-4" /> Validity</h4>
                <div className="bg-white/5 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between"><Label>No Expiry</Label><Switch checked={noExpiry} onCheckedChange={setNoExpiry} /></div>
                    {!noExpiry && <Input type="number" value={validityDuration} onChange={(e: any) => setValidityDuration(e.target.value)} placeholder="Days" />}
                </div>
            </div>
            <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2"><Zap className="w-4 h-4" /> Trigger</h4>
                <div className="grid gap-2">
                    {['none', 'new_client', 'birthday'].map(t => (
                        <button key={t} onClick={() => setAutoApplyTrigger(t as any)} className={cn("p-3 rounded-lg border text-left text-sm transition-all", autoApplyTrigger === t ? "bg-primary/20 border-primary" : "bg-white/5 border-white/10")}>
                            <div className="capitalize font-medium">{t.replace('_', ' ')}</div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function DesignCustomizationStep({ colorMode, setColorMode, gradientId, setGradientId, previewData, handleLogoUpload, uploadingLogo, logoInputRef }: any) {
    return (
        <div className="space-y-6">
            <div className="aspect-video w-full">
                <PromotionCard data={previewData} size="sm" className="w-full h-full" />
            </div>
            <div className="space-y-3">
                <Label>Theme</Label>
                <div className="flex gap-2">
                    {['solid', 'gradient', 'custom'].map(m => (
                        <button key={m} onClick={() => setColorMode(m as any)} className={cn("flex-1 py-2 rounded-lg border text-xs capitalize", colorMode === m ? "bg-primary/20 border-primary" : "bg-white/5 border-white/10")}>{m}</button>
                    ))}
                </div>
            </div>
            {colorMode === 'gradient' && (
                <div className="grid grid-cols-4 gap-2">
                    {Object.keys(GRADIENTS).map(g => (
                        <button key={g} onClick={() => setGradientId(g)} className={cn("h-10 rounded-md border-2", gradientId === g ? "border-white" : "border-transparent text-[0px]")} style={{ background: (GRADIENTS as any)[g].css }} />
                    ))}
                </div>
            )}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-3"><Palette className="w-5 h-5" /><span>Update Logo</span></div>
                <Button variant="outline" size="sm" disabled={uploadingLogo} onClick={() => logoInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> {uploadingLogo ? '...' : 'Upload'}
                </Button>
                <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
            </div>
        </div>
    );
}

function PreviewStep({ previewData, isCreating }: { previewData: PromotionCardData, isCreating: boolean }) {
    return (
        <div className="space-y-6 text-center">
            <h4 className="text-lg font-bold">Does it look good?</h4>
            <div className="max-w-sm mx-auto">
                <PromotionCard data={previewData} size="lg" className="shadow-2xl" />
            </div>
            <p className="text-sm text-muted-foreground">This will be saved to your templates and can be issued to clients immediately.</p>
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
