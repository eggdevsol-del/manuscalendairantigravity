import { useState, useEffect } from "react";
import { PageShell, PageHeader, LoadingState } from "@/components/ui/ssot";
import { Button, Card, Label, Textarea } from "@/components/ui";
import { tokens } from "@/ui/tokens";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileText, HeartPulse, Scale, Save, ListIcon } from "lucide-react";

type TabType = 'form9' | 'medical' | 'consent' | 'register';

export default function RegulationPage({ onBack }: { onBack: () => void }) {
    const [activeTab, setActiveTab] = useState<TabType>('form9');
    const [form9, setForm9] = useState("");
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
            setForm9(templates.form9Template || "");
            setMedical(templates.medicalTemplate || "");
            setConsent(templates.consentTemplate || "");
        }
    }, [templates]);

    const handleSave = () => {
        updateTemplates.mutate({
            form9Template: form9,
            medicalTemplate: medical,
            consentTemplate: consent,
        });
    };

    if (templatesLoading) return <LoadingState fullScreen message="Loading templates..." />;

    const tabs = [
        { id: 'form9', label: 'Form 9', icon: Scale },
        { id: 'medical', label: 'Medical', icon: HeartPulse },
        { id: 'consent', label: 'Consent', icon: FileText },
        { id: 'register', label: 'Register', icon: ListIcon },
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
                                    {activeTab === 'form9' && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="space-y-2">
                                                <Label className="text-lg font-bold">QLD Form 9 Template</Label>
                                                <p className="text-xs text-muted-foreground mb-4">This content will be snapshots into the Procedure Log for Queensland Health requirements.</p>
                                                <Textarea
                                                    value={form9}
                                                    onChange={(e) => setForm9(e.target.value)}
                                                    placeholder="Enter standard Form 9 legal text..."
                                                    rows={12}
                                                    className="bg-white/5 border-white/10 font-mono text-xs leading-relaxed"
                                                />
                                            </div>
                                        </div>
                                    )}

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
