import { ChevronLeft, UploadCloud, Database, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DataImportSettingsProps {
    onBack: () => void;
}

export function DataImportSettings({ onBack }: DataImportSettingsProps) {
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<any[]>([]);

    // Core Mappings
    const [nameCol, setNameCol] = useState<string>("");
    const [phoneCol, setPhoneCol] = useState<string>("");
    const [emailCol, setEmailCol] = useState<string>("");

    const importMutation = trpc.dataImport.bulkImportClients.useMutation({
        onSuccess: (data) => {
            toast.success(`Successfully imported ${data.success} clients. Skipped ${data.skipped}.`);
            onBack();
        },
        onError: (err) => {
            toast.error(err.message || "Failed to import processing CSV.");
        }
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const uploadedFile = files[0];
        if (uploadedFile.type !== "text/csv" && !uploadedFile.name.endsWith('.csv')) {
            toast.error("Please explicitly upload a valid .csv file.");
            return;
        }

        setFile(uploadedFile);

        Papa.parse(uploadedFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (!results.meta.fields || results.meta.fields.length === 0) {
                    toast.error("Could not find any headers in the CSV.");
                    return;
                }
                const validHeaders = results.meta.fields.filter(h => h && h.trim() !== "");
                setCsvHeaders(validHeaders);
                setCsvData(results.data);

                // Auto-map common headers
                const lowerHeaders = validHeaders.map(h => h.toLowerCase().trim());

                const guessName = lowerHeaders.findIndex(h => h.includes('name') || h.includes('client'));
                if (guessName > -1) setNameCol(validHeaders[guessName]);

                const guessPhone = lowerHeaders.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('number'));
                if (guessPhone > -1) setPhoneCol(validHeaders[guessPhone]);

                const guessEmail = lowerHeaders.findIndex(h => h.includes('email'));
                if (guessEmail > -1) setEmailCol(validHeaders[guessEmail]);
            },
            error: (err) => {
                toast.error(`Parser error: ${err.message}`);
            }
        });
    };

    const handleImport = () => {
        if (!nameCol) {
            toast.error("You must map incredibly basic info like 'Client Name' before importing.");
            return;
        }

        // Construct standardized payload
        const payload = csvData.map(row => ({
            name: row[nameCol]?.trim() || "Unknown Client",
            phone: (phoneCol && phoneCol !== "SKIP") ? row[phoneCol]?.trim() : "",
            email: (emailCol && emailCol !== "SKIP") ? row[emailCol]?.trim() : "",
            source: "csv_import"
        })).filter(c => c.phone || c.email); // Must have at least one contact point

        if (payload.length === 0) {
            toast.error("No valid contacts found containing a phone or email.");
            return;
        }

        importMutation.mutate({ clients: payload });
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <h2 className="text-xl font-semibold text-foreground">Import Clients</h2>
            </div>

            <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
                <div className="pb-[180px] max-w-lg mx-auto space-y-6 px-4 pt-6">

                    {/* Header Info */}
                    <div className="flex flex-col items-center justify-center p-6 bg-primary/10 border border-primary/20 rounded-2xl text-center space-y-3">
                        <Database className="w-8 h-8 text-primary" />
                        <h3 className="font-semibold">Switching Apps?</h3>
                        <p className="text-sm text-primary/80">Upload a .CSV file exported from tools like Vagaro, Square, or Fresha to instantly copy your client roster directly into your Tattoi CRM safely.</p>
                    </div>

                    {!file ? (
                        <div className="space-y-4">
                            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground ml-1">Spreadsheet File</Label>
                            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/20 rounded-[4px] cursor-pointer bg-black/20 hover:bg-black/40 hover:border-white/40 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 mb-3 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground font-semibold"><span className="text-primary font-bold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-muted-foreground/60">CSV format only</p>
                                </div>
                                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-6">

                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-[4px] border border-white/10">
                                <div>
                                    <p className="font-semibold flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        {file.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">{csvData.length} records parsed securely.</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setCsvHeaders([]); }}>
                                    Remove
                                </Button>
                            </div>

                            <div className="space-y-4">
                                <div className="mb-2">
                                    <p className="text-muted-foreground text-sm font-medium">Map columns from your CSV</p>
                                </div>

                                <div className="space-y-4 p-4 bg-black/20 border border-white/10 rounded-[4px]">
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Client Name <span className="text-destructive">*</span></Label>
                                        <Select value={nameCol} onValueChange={setNameCol}>
                                            <SelectTrigger className="w-full bg-white/5 border-white/10">
                                                <SelectValue placeholder="Select CSV column..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {csvHeaders.map(h => (
                                                    <SelectItem key={h} value={h}>{h}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Phone Number</Label>
                                        <Select value={phoneCol} onValueChange={setPhoneCol}>
                                            <SelectTrigger className="w-full bg-white/5 border-white/10">
                                                <SelectValue placeholder="Select CSV column..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SKIP">-- Skip Phone --</SelectItem>
                                                {csvHeaders.map(h => (
                                                    <SelectItem key={h} value={h}>{h}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Email</Label>
                                        <Select value={emailCol} onValueChange={setEmailCol}>
                                            <SelectTrigger className="w-full bg-white/5 border-white/10">
                                                <SelectValue placeholder="Select CSV column..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SKIP">-- Skip Email --</SelectItem>
                                                {csvHeaders.map(h => (
                                                    <SelectItem key={h} value={h}>{h}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-[4px] mt-4 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-yellow-200/80 leading-snug">
                                        Clients must have either an email or a phone number to be imported. Records missing both will be safely skipped.
                                    </p>
                                </div>

                            </div>

                            <Button
                                className="w-full h-12 text-base font-semibold"
                                onClick={handleImport}
                                disabled={importMutation.isPending || !nameCol}
                            >
                                {importMutation.isPending ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                                ) : "Import Clients to CRM"}
                            </Button>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
