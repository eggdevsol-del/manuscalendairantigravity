import { useState, useEffect } from "react";
import { PageShell, PageHeader, LoadingState } from "@/components/ui/ssot";
import { Button, Card, Label, Textarea } from "@/components/ui";
import { tokens } from "@/ui/tokens";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileText, HeartPulse, Save, ListIcon } from "lucide-react";

const DEFAULT_MEDICAL_TEMPLATE = `**MEDICAL RELEASE AND QUESTIONNAIRE**
Please review and answer the following questions to ensure your safety during the tattoo procedure.

1. Do you have any heart conditions, epilepsy, or diabetes?
2. Are you currently taking any blood-thinning medication?
3. Do you have any communicable diseases or infections?
4. Are you pregnant or nursing?
5. Do you have any allergies (e.g., to latex, specific metals, or soaps)?

I confirm that the information provided is accurate and true to the best of my knowledge. I understand that withholding medical information may pose risks to my health and the tattoo process.`;

const DEFAULT_CONSENT_TEMPLATE = `**TATTOO PROCEDURE CONSENT FORM**
By signing this form, I acknowledge and agree to the following:

1. I am over the age of 18 and consent to receiving a tattoo.
2. I have been informed of the nature of the tattoo procedure, the anticipated results, and the potential risks, including but not limited to infection, scarring, allergic reactions, and variations in color or design.
3. I understand that a tattoo is an irreversible modification to my body.
4. I have received, read, and understand the aftercare instructions provided to me.
5. I release the artist and the studio from any liability arising from the procedure or my failure to follow aftercare instructions.
6. I grant the artist the right to photograph my tattoo and use the images for promotional purposes.`;

type TabType = 'medical' | 'consent' | 'register';

export default function RegulationPage({ onBack }: { onBack: () => void }) {
    const [activeTab, setActiveTab] = useState<TabType>('register');
    const [medical, setMedical] = useState("");
    const [consent, setConsent] = useState("");

    const { data: templates, isLoading: templatesLoading } = trpc.forms.getTemplates.useQuery();
    const { data: logs, isLoading: logsLoading } = trpc.forms.getProcedureLogs.useQuery(undefined, {
        enabled: activeTab === 'register'
    });

    const updateTemplates = trpc.forms.updateTemplates.useMutation({
        onSuccess: () => toast.success("Templates saved successfully"),
        onError: (err) => toast.error("Failed to save: " + err.message)
    });

    useEffect(() => {
        if (templates) {
            setMedical(templates.medicalTemplate || DEFAULT_MEDICAL_TEMPLATE);
            setConsent(templates.consentTemplate || DEFAULT_CONSENT_TEMPLATE);
        }
    }, [templates]);

    const handleSave = () => {
        updateTemplates.mutate({
            medicalTemplate: medical,
            consentTemplate: consent,
        });
    };

    if (templatesLoading) return <LoadingState fullScreen message="Loading templates..." />;

    const tabs = [
        { id: 'register', label: 'Procedure Log', icon: ListIcon },
        { id: 'medical', label: 'Medical', icon: HeartPulse },
        { id: 'consent', label: 'Consent', icon: FileText },
    ] as const;

    return (
        <PageShell>
            <PageHeader title="Regulation & Forms" onBack={onBack} />

            <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[15vh] opacity-80">
                <p className="text-3xl font-light text-foreground/90 tracking-tight">Regulation & Records</p>
                <p className="text-muted-foreground text-sm font-medium mt-1">Configure templates and view procedure logs</p>
            </div>

            <div className={tokens.contentContainer.base}>
                <div className="flex-1 w-full h-full px-4 pt-6 overflow-y-auto mobile-scroll touch-pan-y">
                    <div className="pb-32 max-w-lg mx-auto space-y-6">

                        {/* Tab Switcher */}
                        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar whitespace-nowrap">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all font-medium text-xs whitespace-nowrap min-w-[80px]",
                                        activeTab === tab.id
                                            ? "bg-primary text-primary-foreground shadow-lg"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'register' ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h3 className="text-lg font-bold px-1">Procedure Log (QLD Form 9)</h3>

                                {logsLoading ? (
                                    <div className="p-12 text-center text-muted-foreground">Loading logs...</div>
                                ) : !logs || logs.length === 0 ? (
                                    <div className="p-12 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-muted-foreground">
                                        No procedure logs found.
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse min-w-max">
                                                <thead>
                                                    <tr className="bg-white/10 text-muted-foreground font-bold uppercase tracking-wider">
                                                        <th className="p-3 border-b border-white/10 whitespace-nowrap">Date</th>
                                                        <th className="p-3 border-b border-white/10 whitespace-nowrap">Client</th>
                                                        <th className="p-3 border-b border-white/10 whitespace-nowrap">Artist License</th>
                                                        <th className="p-3 border-b border-white/10 whitespace-nowrap">Amount</th>
                                                        <th className="p-3 border-b border-white/10 whitespace-nowrap">Payment</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {logs.map((log) => (
                                                        <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                            <td className="p-3 font-mono whitespace-nowrap">{new Date(log.date).toLocaleDateString()}</td>
                                                            <td className="p-3 font-medium whitespace-nowrap">{log.clientName}</td>
                                                            <td className="p-3 text-muted-foreground whitespace-nowrap">{log.artistLicenceNumber}</td>
                                                            <td className="p-3 text-green-400 font-bold whitespace-nowrap">${(log.amountPaid).toFixed(2)}</td>
                                                            <td className="p-3 text-muted-foreground whitespace-nowrap">{log.paymentMethod}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <Card className={cn(tokens.card.base, tokens.card.bg, "border-0 p-6 space-y-4")}>
                                    {activeTab === 'medical' && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="space-y-2">
                                                <Label className="text-lg font-bold">Medical Release Template</Label>
                                                <p className="text-xs text-muted-foreground mb-4">Standard medical questionnaire and liability release.</p>
                                                <Textarea
                                                    value={medical}
                                                    onChange={(e) => setMedical(e.target.value)}
                                                    placeholder="Enter medical history questions..."
                                                    rows={12}
                                                    className="bg-white/5 border-white/10 leading-relaxed"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'consent' && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="space-y-2">
                                                <Label className="text-lg font-bold">Procedure Consent Template</Label>
                                                <p className="text-xs text-muted-foreground mb-4">Consent for the tattoo procedure, risks, and copyright.</p>
                                                <Textarea
                                                    value={consent}
                                                    onChange={(e) => setConsent(e.target.value)}
                                                    placeholder="Enter procedure consent terms..."
                                                    rows={12}
                                                    className="bg-white/5 border-white/10 leading-relaxed"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </Card>

                                <Button
                                    className="w-full h-12 shadow-xl shadow-primary/20"
                                    onClick={handleSave}
                                    disabled={updateTemplates.isPending}
                                >
                                    <Save className="w-5 h-5 mr-2" />
                                    {updateTemplates.isPending ? "Saving..." : "Save All Templates"}
                                </Button>
                            </>
                        )}

                    </div>
                </div>
            </div>
        </PageShell>
    );
}
