/**
 * Image Upload Sheet Component
 *
 * Reusable bottom sheet for uploading images in the funnel.
 * Used for both reference images and body placement photos.
 */
import { useState, useRef, useCallback } from "react";
import {
  X,
  Upload,
  Camera,
  Image as ImageIcon,
  Trash2,
  Plus,
} from "lucide-react";

interface ImageUploadSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onImagesChange: (images: UploadedImage[]) => void;
  images: UploadedImage[];
  title: string;
  description: string;
  maxImages?: number;
}

export interface UploadedImage {
  id: string;
  file?: File;
  preview: string;
  uploading?: boolean;
  uploadedUrl?: string;
  error?: string;
}

export default function ImageUploadSheet({
  isOpen,
  onClose,
  onImagesChange,
  images,
  title,
  description,
  maxImages = 5,
}: ImageUploadSheetProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const generateId = () =>
    `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const remainingSlots = maxImages - images.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      const newImages: UploadedImage[] = filesToProcess.map(file => ({
        id: generateId(),
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
      }));

      onImagesChange([...images, ...newImages]);
    },
    [images, maxImages, onImagesChange]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [handleFiles]
  );

  const removeImage = useCallback(
    (id: string) => {
      const imageToRemove = images.find(img => img.id === id);
      if (imageToRemove?.preview && !imageToRemove.uploadedUrl) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      onImagesChange(images.filter(img => img.id !== id));
    },
    [images, onImagesChange]
  );

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const openCamera = () => {
    cameraInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-background rounded-t-3xl max-h-[85vh] overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Upload area */}
          {images.length < maxImages && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-[4px] p-8 text-center transition-colors mb-6 ${dragActive
                  ? "border-foreground bg-white/10"
                  : "border-border hover:border-foreground/30"
                }`}
            >
              <div className="flex flex-col items-center">
                <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  Drag & drop images here
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  or use the buttons below
                </p>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={openFileSelector}
                    className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-[4px] text-sm font-medium hover:opacity-90 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Choose Files
                  </button>
                  <button
                    type="button"
                    onClick={openCamera}
                    className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-[4px] text-sm font-medium hover:bg-white/5 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </button>
                </div>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Image preview grid */}
          {images.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {images.length} of {maxImages} images
                </p>
                {images.length < maxImages && (
                  <button
                    type="button"
                    onClick={openFileSelector}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-4 h-4" />
                    Add more
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {images.map(image => (
                  <div
                    key={image.id}
                    className="relative aspect-square rounded-[4px] overflow-hidden bg-muted border border-border/50"
                  >
                    <img
                      src={image.preview}
                      alt="Upload preview"
                      className="w-full h-full object-cover"
                    />

                    {/* Loading overlay */}
                    {image.uploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}

                    {/* Error overlay */}
                    {image.error && (
                      <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center p-2">
                        <p className="text-xs text-white text-center">
                          {image.error}
                        </p>
                      </div>
                    )}

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="absolute top-1 right-1 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {images.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No images added yet
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/50 bg-background">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-primary text-primary-foreground rounded-[4px] font-medium hover:bg-primary/90 transition-colors"
          >
            Done ({images.length} {images.length === 1 ? "image" : "images"})
          </button>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
