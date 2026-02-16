import { FABMenu, FABMenuItem } from "@/ui";
import { FileSignature, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { FormSigningDialog } from "./FormSigningDialog";
import { toast } from "sonner";

export function FormsFABMenu() {
    const { data: pendingForms, refetch: refetchForms } = trpc.forms.getPendingForms.useQuery({});
    const signForm = trpc.forms.signForm.useMutation({
        onSuccess: () => {
            toast.success("Form signed successfully");
            refetchForms();
        },
        onError: () => toast.error("Failed to sign form")
    });

    const [activeForm, setActiveForm] = useState<any>(null);

    if (!pendingForms || pendingForms.length === 0) return null;

    const menuItems: FABMenuItem[] = pendingForms.map((form) => ({
        id: `sign-${form.id}`,
        label: `Sign: ${form.title}`,
        icon: FileSignature,
        onClick: () => setActiveForm(form),
        closeOnClick: false // We will close manually after signing
    }));

    // Add a general "Form" indicator
    const mainIcon = <div className="relative">
        <FileSignature className="w-6 h-6" />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-background">
            {pendingForms.length}
        </div>
    </div>;

    return (
        <>
            <div className="fixed bottom-24 right-6 z-50">
                <FABMenu
                    items={menuItems}
                    toggleIcon={mainIcon}
                />
            </div>

            {activeForm && (
                <FormSigningDialog
                    isOpen={!!activeForm}
                    onClose={() => setActiveForm(null)}
                    onSign={async (signature) => {
                        await signForm.mutateAsync({
                            formId: activeForm.id,
                            signature
                        });
                        setActiveForm(null);
                    }}
                    formTitle={activeForm.title}
                    formContent={activeForm.content}
                    isSigning={signForm.isPending}
                />
            )}
        </>
    );
}
