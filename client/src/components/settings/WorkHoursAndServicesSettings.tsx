import { useAuth } from "@/_core/hooks/useAuth";
import {
    Button,
    Card,
    Input,
    Label,
    Switch,
    Textarea,
} from "@/components/ui";
import { ModalShell } from "@/components/ui/overlays/modal-shell";
import { tokens } from "@/ui/tokens";
import { trpc } from "@/lib/trpc";
import {
    Plus,
    Trash2,
    Pencil,
    Layers,
    Clock,
    ChevronLeft,
    Globe,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface WorkHoursAndServicesProps {
    onBack: () => void;
}

interface DaySchedule {
    enabled: boolean;
    start: string;
    end: string;
    type?: "work" | "design" | "personal";
}

interface WorkSchedule {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
}

interface Service {
    name: string;
    duration: number;
    price: number;
    description: string;
    sittings?: number;
    color?: string;
    showInFunnel?: boolean;
}

const defaultSchedule: WorkSchedule = {
    monday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    tuesday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    wednesday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    thursday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    friday: { enabled: true, start: "09:00", end: "17:00", type: "work" },
    saturday: { enabled: false, start: "09:00", end: "17:00", type: "work" },
    sunday: { enabled: false, start: "09:00", end: "17:00", type: "work" },
};

export function WorkHoursAndServicesSettings({
    onBack,
}: WorkHoursAndServicesProps) {
    const { user } = useAuth();
    const [workSchedule, setWorkSchedule] =
        useState<WorkSchedule>(defaultSchedule);
    const [services, setServices] = useState<Service[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newService, setNewService] = useState<Service>({
        name: "",
        duration: 60,
        price: 0,
        description: "",
        sittings: 1,
        color: "#3b82f6",
        showInFunnel: true,
    });

    const [isProjectMode, setIsProjectMode] = useState(false);
    const utils = trpc.useUtils();
    const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
        enabled: !!user && (user.role === "artist" || user.role === "admin"),
    });

    const upsertMutation = trpc.artistSettings.upsert.useMutation({
        onSuccess: () => {
            utils.artistSettings.getPublicByArtistId.invalidate({ artistId: user?.id || "" });
            utils.artistSettings.get.invalidate();
            toast.success("Settings saved successfully");
        },
        onError: error => {
            toast.error("Failed to save settings: " + error.message);
        },
    });

    const initializedSettingsRef = useRef(false);

    useEffect(() => {
        if (artistSettings && !initializedSettingsRef.current) {
            initializedSettingsRef.current = true;
            if (artistSettings.workSchedule) {
                try {
                    const parsedSchedule = JSON.parse(artistSettings.workSchedule);
                    if (parsedSchedule && typeof parsedSchedule === "object") {
                        setWorkSchedule({ ...defaultSchedule, ...parsedSchedule });
                    }
                } catch (e) {
                    console.error("Failed to parse work schedule", e);
                    setWorkSchedule(defaultSchedule);
                }
            }

            if (artistSettings.services) {
                try {
                    const parsedServices = JSON.parse(artistSettings.services);
                    if (Array.isArray(parsedServices)) {
                        setServices(parsedServices);
                    }
                } catch (e) {
                    console.error("Failed to parse services", e);
                }
            }
        }
    }, [artistSettings]);

    // Removed Project Builder Logic (integrated directly into the base builder)

    const handleDayToggle = (day: keyof WorkSchedule) => {
        setWorkSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], enabled: !prev[day].enabled },
        }));
    };

    const handleTimeChange = (
        day: keyof WorkSchedule,
        field: "start" | "end",
        value: string
    ) => {
        setWorkSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value },
        }));
    };

    const handleTypeChange = (
        day: keyof WorkSchedule,
        value: "work" | "design" | "personal"
    ) => {
        setWorkSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], type: value },
        }));
    };

    const handleShowAddForm = () => {
        setShowAddForm(true);
        setEditingIndex(null);
    };

    const handleAddService = () => {
        if (!newService.name.trim()) {
            toast.error("Please enter a service name");
            return;
        }
        setServices(prev => [...prev, newService]);
        setNewService({
            name: "",
            duration: 60,
            price: 0,
            description: "",
            sittings: 1,
            color: "#3b82f6",
        });
        setShowAddForm(false);
        toast.success("Service added successfully");
    };


    const handleCancelAdd = () => {
        setNewService({
            name: "",
            duration: 60,
            price: 0,
            description: "",
            sittings: 1,
            color: "#3b82f6",
        });
        setShowAddForm(false);
    };

    const handleEditService = (index: number) => {
        setEditingIndex(index);
        setEditingService({ ...services[index] });
        setShowAddForm(false);
    };

    const handleSaveEdit = () => {
        if (!editingService?.name.trim()) {
            toast.error("Please enter a service name");
            return;
        }
        setServices(prev =>
            prev.map((service, i) => (i === editingIndex ? editingService : service))
        );
        setEditingIndex(null);
        setEditingService(null);
        toast.success("Service updated successfully");
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditingService(null);
    };

    const handleRemoveService = (index: number) => {
        setServices(prev => prev.filter((_, i) => i !== index));
        toast.success("Service removed");
    };

    const handleSave = () => {
        if (artistSettings) {
            upsertMutation.mutate({
                businessName: artistSettings.businessName || undefined,
                businessAddress: artistSettings.businessAddress || undefined,
                bsb: artistSettings.bsb || undefined,
                accountNumber: artistSettings.accountNumber || undefined,
                depositAmount: artistSettings.depositAmount || undefined,
                workSchedule: JSON.stringify(workSchedule),
                services: JSON.stringify(services),
            });
        }
    };

    const days: Array<{ key: keyof WorkSchedule; label: string }> = [
        { key: "monday", label: "Monday" },
        { key: "tuesday", label: "Tuesday" },
        { key: "wednesday", label: "Wednesday" },
        { key: "thursday", label: "Thursday" },
        { key: "friday", label: "Friday" },
        { key: "saturday", label: "Saturday" },
        { key: "sunday", label: "Sunday" },
    ];

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative">
            {/* 1. Page Header - Floating style */}
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <h2 className="text-xl font-semibold text-foreground">Work Hours & Services</h2>
            </div>

            {/* 2. Scroll Container */}
            <div className="flex-1 w-full overflow-y-auto mobile-scroll touch-pan-y relative z-10">
                <div className="pb-[180px] max-w-lg mx-auto space-y-8 px-4 pt-6">
                    {/* Work Schedule Section */}
                    <div>
                        <div className="mb-4">
                            <p className="text-muted-foreground text-sm font-medium">
                                Start / Finish Times
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Set enabled days and hours
                            </p>
                        </div>
                        <div className="space-y-4">
                            {days.map(({ key, label }) => {
                                const daySchedule = workSchedule[key] || {
                                    enabled: false,
                                    start: "09:00",
                                    end: "17:00",
                                };
                                return (
                                    <div key={key} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label
                                                className={cn(
                                                    "text-base",
                                                    daySchedule.enabled
                                                        ? "text-foreground"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                {label}
                                            </Label>
                                            <Switch
                                                checked={daySchedule.enabled}
                                                onCheckedChange={() => handleDayToggle(key)}
                                            />
                                        </div>

                                        {daySchedule.enabled && (
                                            <div className="flex flex-col gap-2 ml-4">
                                                {/* Type Selector */}
                                                <Select
                                                    value={daySchedule.type || "work"}
                                                    onValueChange={(val: any) =>
                                                        handleTypeChange(key, val)
                                                    }
                                                >
                                                    <SelectTrigger className="h-8 bg-white/5 border-white/10 text-xs w-full mb-1">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="work">Work</SelectItem>
                                                        <SelectItem value="design">Design</SelectItem>
                                                        <SelectItem value="personal">Personal</SelectItem>
                                                    </SelectContent>
                                                </Select>

                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <Input
                                                            type="time"
                                                            value={daySchedule.start}
                                                            onChange={e =>
                                                                handleTimeChange(key, "start", e.target.value)
                                                            }
                                                            className="bg-white/5 border-white/10"
                                                        />
                                                    </div>
                                                    <span className="flex items-center text-muted-foreground text-xs">
                                                        TO
                                                    </span>
                                                    <div className="flex-1">
                                                        <Input
                                                            type="time"
                                                            value={daySchedule.end}
                                                            onChange={e =>
                                                                handleTimeChange(key, "end", e.target.value)
                                                            }
                                                            className="bg-white/5 border-white/10"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Services Section */}
                    <div className="pt-4 border-t border-white/5">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground text-sm font-medium">
                                    Service Menu
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Manage list and pricing
                                </p>
                            </div>
                            {!showAddForm && (
                                <Button
                                    size="sm"
                                    onClick={handleShowAddForm}
                                    className="h-8 shadow-lg shadow-primary/20"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    New
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="p-4 space-y-1">
                        {showAddForm && (
                            <div className="p-4 border border-dashed border-white/20 rounded-[4px] space-y-3 bg-white/5 mb-4">
                                <h3 className="font-semibold text-sm">
                                    New Service Details
                                </h3>
                                <div className="space-y-4 mb-4 pb-4 border-b border-white/10">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-foreground font-semibold">Project Mode</Label>
                                        <div className="flex items-center gap-2">
                                            <span className={cn("text-xs font-medium", !isProjectMode ? "text-primary" : "text-muted-foreground")}>Single</span>
                                            <Switch
                                                checked={isProjectMode}
                                                onCheckedChange={(checked) => {
                                                    setIsProjectMode(checked);
                                                    if (checked) setNewService(prev => ({ ...prev, sittings: 2 }));
                                                    else setNewService(prev => ({ ...prev, sittings: 1 }));
                                                }}
                                            />
                                            <span className={cn("text-xs font-medium", isProjectMode ? "text-primary" : "text-muted-foreground")}>Project</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Service Name</Label>
                                        <Input
                                            placeholder="Name"
                                            value={newService.name}
                                            onChange={e =>
                                                setNewService({ ...newService, name: e.target.value })
                                            }
                                            className="bg-white/5 border-white/10"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 items-end">
                                        <div className="space-y-2 flex flex-col justify-end">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Duration (Hours)</Label>
                                            <Input
                                                type="number"
                                                placeholder="Hours"
                                                value={newService.duration / 60}
                                                onChange={e =>
                                                    setNewService({
                                                        ...newService,
                                                        duration: (parseInt(e.target.value) || 0) * 60,
                                                    })
                                                }
                                                className="bg-white/5 border-white/10"
                                            />
                                        </div>
                                        <div className="space-y-2 flex flex-col justify-end">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Price ($)</Label>
                                            <Input
                                                type="number"
                                                placeholder="Price"
                                                value={newService.price}
                                                onChange={e =>
                                                    setNewService({
                                                        ...newService,
                                                        price: parseInt(e.target.value) || 0,
                                                    })
                                                }
                                                className="bg-white/5 border-white/10"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Service Colour</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                title="Service Color"
                                                value={newService.color || "#3b82f6"}
                                                onChange={e =>
                                                    setNewService({
                                                        ...newService,
                                                        color: e.target.value,
                                                    })
                                                }
                                                className="w-12 h-10 p-1 bg-white/5 border-white/10 cursor-pointer"
                                            />
                                            <Input
                                                type="text"
                                                value={newService.color || "#3b82f6"}
                                                onChange={e =>
                                                    setNewService({
                                                        ...newService,
                                                        color: e.target.value,
                                                    })
                                                }
                                                className="flex-1 bg-white/5 border-white/10"
                                                placeholder="#3b82f6"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Show in Booking Funnel</Label>
                                            <Switch
                                                checked={newService.showInFunnel !== false}
                                                onCheckedChange={(checked) => setNewService({ ...newService, showInFunnel: checked })}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-snug">Allow clients to select this service directly from your public booking link.</p>
                                    </div>

                                    {isProjectMode && (
                                        <div className="space-y-2 bg-primary/10 border border-primary/20 p-3 rounded-[4px]">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Layers className="w-4 h-4 text-primary" />
                                                <Label className="text-primary font-semibold">Number of Appointments</Label>
                                            </div>
                                            <p className="text-xs text-muted-foreground/80 mb-2 leading-snug">
                                                This is a multi-session project. The total price entered above will be the combined cost for all sittings.
                                            </p>
                                            <Input
                                                type="number"
                                                min={2}
                                                value={newService.sittings || 2}
                                                onChange={e =>
                                                    setNewService({
                                                        ...newService,
                                                        sittings: Math.max(2, parseInt(e.target.value) || 2),
                                                    })
                                                }
                                                className="bg-black/30 border-white/20"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 pt-4 mt-2 border-t border-white/5">
                                    <Button size="sm" onClick={handleAddService}>
                                        Add
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleCancelAdd}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}

                        {services.map((service, index) => (
                            <div
                                key={index}
                                className="p-4 border border-white/10 rounded-[4px] bg-white/5"
                            >
                                {editingIndex === index && editingService ? (
                                    // Edit Mode
                                    <div className="space-y-3">
                                        <div className="space-y-4 mb-4 pb-4 border-b border-white/10">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-foreground font-semibold">Project Mode</Label>
                                                <div className="flex items-center gap-2">
                                                    <span className={cn("text-xs font-medium", editingService.sittings === 1 ? "text-primary" : "text-muted-foreground")}>Single</span>
                                                    <Switch
                                                        checked={(editingService.sittings || 1) > 1}
                                                        onCheckedChange={(checked) => setEditingService({ ...editingService, sittings: checked ? 2 : 1 })}
                                                    />
                                                    <span className={cn("text-xs font-medium", (editingService.sittings || 1) > 1 ? "text-primary" : "text-muted-foreground")}>Project</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Service Name</Label>
                                            </div>
                                            <Input
                                                value={editingService.name}
                                                onChange={e =>
                                                    setEditingService({
                                                        ...editingService,
                                                        name: e.target.value,
                                                    })
                                                }
                                                className="bg-white/5 border-white/10"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Duration (Hours)</Label>
                                                <Input
                                                    type="number"
                                                    value={editingService.duration / 60}
                                                    onChange={e =>
                                                        setEditingService({
                                                            ...editingService,
                                                            duration: (parseInt(e.target.value) || 0) * 60,
                                                        })
                                                    }
                                                    className="bg-white/5 border-white/10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Price ($)</Label>
                                                <Input
                                                    type="number"
                                                    value={editingService.price}
                                                    onChange={e =>
                                                        setEditingService({
                                                            ...editingService,
                                                            price: parseInt(e.target.value) || 0,
                                                        })
                                                    }
                                                    className="bg-white/5 border-white/10"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Service Colour</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="color"
                                                    value={editingService.color || "#3b82f6"}
                                                    onChange={e =>
                                                        setEditingService({
                                                            ...editingService,
                                                            color: e.target.value,
                                                        })
                                                    }
                                                    className="w-12 h-10 p-1 bg-white/5 border-white/10 cursor-pointer"
                                                />
                                                <Input
                                                    type="text"
                                                    value={editingService.color || "#3b82f6"}
                                                    onChange={e =>
                                                        setEditingService({
                                                            ...editingService,
                                                            color: e.target.value,
                                                        })
                                                    }
                                                    className="flex-1 bg-white/5 border-white/10"
                                                    placeholder="#3b82f6"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2 mt-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Show in Booking Funnel</Label>
                                                <Switch
                                                    checked={editingService.showInFunnel !== false}
                                                    onCheckedChange={(checked) => setEditingService({ ...editingService, showInFunnel: checked })}
                                                />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground leading-snug">Allow clients to select this service directly from your public booking link.</p>
                                        </div>
                                        {(editingService.sittings || 1) > 1 && (
                                            <div className="space-y-2 bg-primary/10 border border-primary/20 p-3 rounded-[4px] mt-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Layers className="w-4 h-4 text-primary" />
                                                    <Label className="text-primary font-semibold">Number of Appointments</Label>
                                                </div>
                                                <p className="text-xs text-muted-foreground/80 mb-2 leading-snug">
                                                    This is a multi-session project. The total price entered above will be the combined cost for all sittings.
                                                </p>
                                                <Input
                                                    type="number"
                                                    min={2}
                                                    value={editingService.sittings}
                                                    onChange={e =>
                                                        setEditingService({
                                                            ...editingService,
                                                            sittings: Math.max(2, parseInt(e.target.value) || 2),
                                                        })
                                                    }
                                                    className="bg-black/30 border-white/20"
                                                />
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-4 mt-2 border-t border-white/5">
                                            <Button size="sm" onClick={handleSaveEdit}>
                                                Save
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleCancelEdit}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    // View Mode
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-base text-foreground">
                                                {service.name}
                                            </h3>
                                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground font-mono">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {service.duration / 60}h
                                                </span>
                                                <span className="text-primary font-bold">
                                                    ${service.price}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {service.showInFunnel !== false ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                                                        <Globe className="w-3 h-3" />
                                                        In Funnel
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted border border-white/10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                        <Globe className="w-3 h-3 opacity-50" />
                                                        Hidden
                                                    </div>
                                                )}
                                                {service.sittings && service.sittings > 1 && (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[10px] font-bold text-primary uppercase tracking-wider">
                                                        <Layers className="w-3 h-3" />
                                                        Project: {service.sittings} Sittings
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:text-primary"
                                                onClick={() => handleEditService(index)}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:text-destructive"
                                                onClick={() => handleRemoveService(index)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <Button
                        className="w-full shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold"
                        onClick={handleSave}
                        disabled={upsertMutation.isPending}
                    >
                        {upsertMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>
        </div >
    );
}
