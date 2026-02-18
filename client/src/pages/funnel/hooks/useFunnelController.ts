/**
 * useFunnelController Hook
 * 
 * Manages the state and logic for the artist consultation funnel.
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { UploadedImage } from "../components/ImageUploadSheet";
import { fileToBase64, generateSessionId } from "../funnelImage";
import { ArtistProfile } from "../FunnelWrapper";

export function useFunnelController(artistSlug: string) {
    // 1. Initial Data Fetching & Setup
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);
    const [sessionId, setSessionId] = useState<string>("");
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);

    // 2. Form State - Intent
    const [projectType, setProjectType] = useState('');
    const [projectDescription, setProjectDescription] = useState('');

    // 3. Form State - Contact
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // 4. Form State - Style & References
    const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
    const [referenceImages, setReferenceImages] = useState<UploadedImage[]>([]);
    const [showReferenceUpload, setShowReferenceUpload] = useState(false);

    // 5. Form State - Body Placement
    const [bodyPlacementImages, setBodyPlacementImages] = useState<UploadedImage[]>([]);
    const [showBodyPlacementUpload, setShowBodyPlacementUpload] = useState(false);

    // 6. Form State - Budget & Availability
    const [selectedBudget, setSelectedBudget] = useState<{ label: string; min: number; max: number | null } | null>(null);
    const [timeframe, setTimeframe] = useState('');

    const totalSteps = 6;

    // -- Initialization --
    useEffect(() => {
        const initFunnel = async () => {
            try {
                setLoading(true);

                // Session ID
                let id = sessionStorage.getItem(`funnel_session_${artistSlug}`);
                if (!id) {
                    id = generateSessionId();
                    sessionStorage.setItem(`funnel_session_${artistSlug}`, id);
                }
                setSessionId(id);

                // Fetch Profile
                const response = await fetch(`/api/public/artist/${artistSlug}`);
                if (!response.ok) {
                    if (response.status === 404) setError("This booking link is not available");
                    else setError("Something went wrong. Please try again.");
                    return;
                }

                const data = await response.json();
                setArtistProfile(data);
            } catch (err) {
                setError("Failed to load. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        initFunnel();
    }, [artistSlug]);

    const uploadMutation = trpc.upload.uploadImage.useMutation();

    // -- Image Processing --
    const processImages = useCallback(async (
        images: UploadedImage[],
        setImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>
    ): Promise<string[]> => {
        const urls: string[] = [];
        const updatedImages = [...images];

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            if (img.uploadedUrl) {
                urls.push(img.uploadedUrl);
                continue;
            }

            if (img.file) {
                updatedImages[i] = { ...img, uploading: true };
                setImages([...updatedImages]);

                try {
                    const base64 = await fileToBase64(img.file);
                    const result = await uploadMutation.mutateAsync({
                        base64,
                        filename: img.file.name,
                        contentType: img.file.type,
                        folder: 'consultations'
                    });

                    if (result.success && result.url) {
                        urls.push(result.url);
                        updatedImages[i] = { ...img, uploadedUrl: result.url, uploading: false };
                    }
                } catch (error) {
                    updatedImages[i] = { ...img, uploading: false, error: "Upload failed" };
                }
                setImages([...updatedImages]);
            }
        }
        return urls;
    }, [uploadMutation]);

    // -- Submission --
    const handleSubmit = async () => {
        if (!artistProfile) return;
        setSubmitting(true);

        try {
            const referenceUrls = await processImages(referenceImages, setReferenceImages);
            const placementUrls = await processImages(bodyPlacementImages, setBodyPlacementImages);

            const submitData = {
                artistId: artistProfile.id,
                sessionId,
                intent: { projectType, projectDescription },
                contact: {
                    firstName,
                    lastName,
                    name: `${firstName} ${lastName}`.trim(),
                    birthdate,
                    email,
                    phone: phone || undefined,
                },
                style: {
                    stylePreferences: selectedStyles,
                    referenceImages: referenceUrls,
                },
                bodyPlacement: {
                    placementImages: placementUrls,
                },
                budget: {
                    placement: projectType,
                    estimatedSize: '',
                    budgetMin: selectedBudget?.min || 0,
                    budgetMax: selectedBudget?.max || 0,
                    budgetLabel: selectedBudget?.label || '',
                },
            };

            const response = await fetch('/api/public/funnel/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData),
            });

            if (!response.ok) throw new Error("Failed to submit");

            setSubmitted(true);
            sessionStorage.removeItem(`funnel_session_${artistSlug}`);

            setTimeout(() => setShowInstallPrompt(true), 1500);
        } catch (err) {
            alert("Failed to submit. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    // -- Navigation & Logic helpers --
    const canProceed = useCallback(() => {
        switch (currentStep) {
            case 0: return projectType && projectDescription.trim().length >= 10;
            case 1: return firstName.trim() && lastName.trim() && email.trim() && email.includes('@') && birthdate;
            case 2: return selectedStyles.length > 0;
            case 3: return true; // Optional placement
            case 4: return !!selectedBudget;
            case 5: return !!timeframe;
            default: return false;
        }
    }, [currentStep, projectType, projectDescription, firstName, lastName, email, birthdate, selectedStyles, selectedBudget, timeframe]);

    const handleNext = () => {
        if (currentStep < totalSteps - 1) setCurrentStep(prev => prev + 1);
        else handleSubmit();
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
    };

    const toggleStyle = (style: string) => {
        setSelectedStyles(prev =>
            prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
        );
    };

    return {
        // State
        loading, error, artistProfile, currentStep, totalSteps,
        submitting, submitted, showInstallPrompt, setShowInstallPrompt,

        // Form fields
        projectType, setProjectType, projectDescription, setProjectDescription,
        firstName, setFirstName, lastName, setLastName, birthdate, setBirthdate,
        email, setEmail, phone, setPhone,
        selectedStyles, toggleStyle,
        referenceImages, setReferenceImages, showReferenceUpload, setShowReferenceUpload,
        bodyPlacementImages, setBodyPlacementImages, showBodyPlacementUpload, setShowBodyPlacementUpload,
        selectedBudget, setSelectedBudget, timeframe, setTimeframe,

        // Actions
        handleNext, handleBack, canProceed
    };
}
