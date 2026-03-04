import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ImageUploadProps {
    value: string;
    onChange: (url: string) => void;
    onRemove: () => void;
    label?: string;
    className?: string;
}

export function ImageUpload({
    value,
    onChange,
    onRemove,
    label = "Upload Image",
    className = "",
}: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadMutation = trpc.upload.uploadImage.useMutation({
        onSuccess: (data) => {
            onChange(data.url);
            setIsUploading(false);
        },
        onError: (error) => {
            toast.error(error.message || "Failed to upload image");
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        },
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be less than 5MB");
            return;
        }

        setIsUploading(true);

        // Read file as base64
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            await uploadMutation.mutateAsync({
                base64: base64,
                filename: file.name,
            });
        };
        reader.onerror = () => {
            toast.error("Failed to read file");
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    if (value) {
        return (
            <div className={`relative group ${className}`}>
                <img
                    src={value}
                    alt="Uploaded preview"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                        onClick={onRemove}
                        className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors"
                        title="Remove image"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 text-white/60 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all cursor-pointer overflow-hidden ${isUploading ? "opacity-50 pointer-events-none" : ""
                } ${className}`}
        >
            {isUploading ? (
                <>
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm font-medium">Uploading...</span>
                </>
            ) : (
                <>
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1">
                        <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium px-4 text-center">{label}</span>
                    <span className="text-xs opacity-60">JPEG, PNG, WebP up to 5MB</span>
                </>
            )}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
            />
        </div>
    );
}
