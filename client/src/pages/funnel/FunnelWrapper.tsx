/**
 * Funnel Wrapper Component
 * 
 * Simple, clean light-mode consultation funnel.
 * Includes expanded contact fields and image upload capabilities.
 */
import { useState, useEffect, useCallback } from "react";
import IOSInstallPrompt from "@/components/IOSInstallPrompt";
import ImageUploadSheet, { UploadedImage } from "./components/ImageUploadSheet";
import { Camera, Image as ImageIcon, ChevronRight } from "lucide-react";
import { TeaserRegistrationForm } from "@/components/auth/TeaserRegistrationForm";
import { trpc } from "@/lib/trpc";

// Generate unique session ID
const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Types
export interface FunnelStepData {
  intent?: {
    projectType: string;
    projectDescription: string;
  };
  contact?: {
    firstName: string;
    lastName: string;
    birthdate: string;
    email: string;
    phone?: string;
  };
  style?: {
    stylePreferences: string[];
    referenceImages: string[];
  };
  bodyPlacement?: {
    placementImages: string[];
  };
  budget?: {
    placement: string;
    estimatedSize: string;
    budgetMin: number;
    budgetMax: number;
    budgetLabel: string;
  };
  availability?: {
    preferredTimeframe: string;
    preferredMonths: string[];
    urgency: 'flexible' | 'moderate' | 'urgent';
  };
}

export interface ArtistProfile {
  id: string;
  slug: string;
  displayName: string;
  tagline?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  styleOptions: string[];
  placementOptions: string[];
  budgetRanges: { label: string; min: number; max: number | null }[];
  enabledSteps: string[];
}

interface FunnelWrapperProps {
  artistSlug: string;
}

// Simple project types without emojis
const PROJECT_TYPES = [
  { id: 'full-sleeve', label: 'Full Sleeve' },
  { id: 'half-sleeve', label: 'Half Sleeve' },
  { id: 'back-piece', label: 'Back Piece' },
  { id: 'chest-piece', label: 'Chest Piece' },
  { id: 'cover-up', label: 'Cover Up' },
  { id: 'small-piece', label: 'Small Piece' },
  { id: 'touch-up', label: 'Touch Up' },
  { id: 'custom', label: 'Custom Project' },
];

// Simple style options
const STYLE_OPTIONS = [
  'Realism', 'Traditional', 'Neo-Traditional', 'Japanese',
  'Blackwork', 'Dotwork', 'Watercolor', 'Geometric',
  'Minimalist', 'Fine Line', 'Other'
];

// Budget ranges
const BUDGET_RANGES = [
  { label: 'Under $500', min: 0, max: 500 },
  { label: '$500 - $1,000', min: 500, max: 1000 },
  { label: '$1,000 - $2,500', min: 1000, max: 2500 },
  { label: '$2,500 - $5,000', min: 2500, max: 5000 },
  { label: '$5,000 - $10,000', min: 5000, max: 10000 },
  { label: '$10,000+', min: 10000, max: null },
];

// Timeframe options
const TIMEFRAME_OPTIONS = [
  { id: 'asap', label: 'As soon as possible' },
  { id: '1-3months', label: 'Within 1-3 months' },
  { id: '3-6months', label: 'Within 3-6 months' },
  { id: '6months+', label: '6+ months from now' },
  { id: 'flexible', label: 'Flexible / No rush' },
];

export default function FunnelWrapper({ artistSlug }: FunnelWrapperProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Form data - Intent
  const [projectType, setProjectType] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  // Form data - Contact (expanded)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Form data - Style
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<UploadedImage[]>([]);
  const [showReferenceUpload, setShowReferenceUpload] = useState(false);

  // Form data - Body Placement
  const [bodyPlacementImages, setBodyPlacementImages] = useState<UploadedImage[]>([]);
  const [showBodyPlacementUpload, setShowBodyPlacementUpload] = useState(false);

  // Form data - Budget & Availability
  const [selectedBudget, setSelectedBudget] = useState<typeof BUDGET_RANGES[0] | null>(null);
  const [timeframe, setTimeframe] = useState('');

  // Total steps: Intent, Contact, Style+References, Body Placement, Budget, Availability
  const totalSteps = 6;

  // Initialize
  useEffect(() => {
    const initFunnel = async () => {
      try {
        setLoading(true);

        // Generate session ID
        let storedSessionId = sessionStorage.getItem(`funnel_session_${artistSlug}`);
        if (!storedSessionId) {
          storedSessionId = generateSessionId();
          sessionStorage.setItem(`funnel_session_${artistSlug}`, storedSessionId);
        }
        setSessionId(storedSessionId);

        // Fetch artist profile
        console.log(`[Funnel] Fetching artist profile for slug: ${artistSlug}`);
        const response = await fetch(`/api/public/artist/${artistSlug}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[Funnel] Error fetching artist:`, errorData);
          if (response.status === 404) {
            setError("This booking link is not available");
          } else {
            setError("Something went wrong. Please try again.");
          }
          return;
        }

        const data = await response.json();
        console.log(`[Funnel] Artist profile loaded:`, data.displayName);
        setArtistProfile(data);

      } catch (err) {
        console.error("[Funnel] Init error:", err);
        setError("Failed to load. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    initFunnel();
  }, [artistSlug]);

  // Upload images to server
  const uploadImages = async (images: UploadedImage[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const image of images) {
      if (image.uploadedUrl) {
        uploadedUrls.push(image.uploadedUrl);
        continue;
      }

      if (!image.file) continue;

      try {
        // Convert to base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(image.file!);
        });

        // Upload via API
        const response = await fetch('/api/trpc/upload.uploadImage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json: {
              fileData: base64,
              fileName: image.file.name,
              contentType: image.file.type,
            }
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('[Funnel] Upload response:', JSON.stringify(result));
          if (result.result?.data?.json?.url) {
            uploadedUrls.push(result.result.data.json.url);
            console.log('[Funnel] Successfully uploaded:', result.result.data.json.url);
          } else {
            console.error('[Funnel] Upload succeeded but no URL in response:', result);
          }
        } else {
          const errorText = await response.text();
          console.error('[Funnel] Upload failed:', response.status, errorText);
        }
      } catch (err) {
        console.error('[Funnel] Image upload error:', err);
      }
    }

    return uploadedUrls;
  };

  // Handle form submission

  // Helper for Base64 conversion
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const uploadMutation = trpc.upload.uploadImage.useMutation();

  const processImages = async (
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
        // Update UI to show uploading
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
          console.error("Upload failed", error);
          updatedImages[i] = { ...img, uploading: false, error: "Upload failed" };
        }
        // Update UI after upload
        setImages([...updatedImages]);
      }
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!artistProfile) {
      console.error('[Funnel] No artist profile');
      return;
    }

    console.log('[Funnel] Starting submission...');
    setSubmitting(true);

    try {
      // Upload images first
      const referenceUrls = await processImages(referenceImages, setReferenceImages);
      const placementUrls = await processImages(bodyPlacementImages, setBodyPlacementImages);

      const submitData = {
        artistId: artistProfile.id,
        sessionId,
        intent: {
          projectType,
          projectDescription,
        },
        contact: {
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim(), // For backward compatibility
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

      console.log('[Funnel] Submit data:', JSON.stringify(submitData, null, 2));

      const response = await fetch('/api/public/funnel/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      console.log('[Funnel] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Funnel] Submit error response:', errorText);
        throw new Error(`Failed to submit: ${errorText}`);
      }

      const result = await response.json();
      console.log('[Funnel] Submit success:', result);

      setSubmitted(true);
      sessionStorage.removeItem(`funnel_session_${artistSlug}`);

      // Show install prompt after a short delay on success
      setTimeout(() => {
        setShowInstallPrompt(true);
        console.log('[Funnel] Showing install prompt after successful submission');
      }, 1500);

    } catch (err) {
      console.error("[Funnel] Submit error:", err);
      alert("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Validation for each step
  const canProceed = () => {
    switch (currentStep) {
      case 0: // Intent
        return projectType && projectDescription.trim().length >= 10;
      case 1: // Contact
        return firstName.trim() && lastName.trim() && email.trim() && email.includes('@') && birthdate;
      case 2: // Style + References
        return selectedStyles.length > 0;
      case 3: // Body Placement (optional, can skip)
        return true;
      case 4: // Budget
        return selectedBudget !== null;
      case 5: // Availability
        return timeframe;
      default:
        return false;
    }
  };

  // Next step
  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  // Previous step
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Toggle style selection
  const toggleStyle = (style: string) => {
    setSelectedStyles(prev =>
      prev.includes(style)
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-2">Loading...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !artistProfile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Not Available
          </h1>
          <p className="text-gray-600 mb-6">
            {error || "This booking link is not available."}
          </p>
          <p className="text-sm text-gray-500">
            Please contact the artist directly if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  // Success state (Teaser Registration)
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <TeaserRegistrationForm
          email={email}
          name={`${firstName} ${lastName}`.trim()}
          artistName={artistProfile.displayName}
        />
      </div>
    );
  }

  // Step titles
  const stepTitles = [
    "What are you looking for?",
    "Your contact details",
    "Style preferences",
    "Show us the placement area",
    "Your budget",
    "When would you like to get tattooed?"
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-gray-900 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-sm font-medium text-gray-900">
            {artistProfile.displayName}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-6 max-w-lg mx-auto">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          {stepTitles[currentStep]}
        </h2>

        {/* Step 0: Intent */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Project type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PROJECT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setProjectType(type.id)}
                    className={`p-3 text-left rounded-lg border transition-colors ${projectType === type.id
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <span className="text-sm font-medium text-gray-900">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe your idea
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Tell us about your vision..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none text-gray-900 bg-white placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                {projectDescription.length < 10
                  ? `At least ${10 - projectDescription.length} more characters`
                  : 'Great!'
                }
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Contact (Expanded) */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of birth *
              </label>
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                You must be 18 or older to book a tattoo
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your phone number"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white placeholder-gray-400"
              />
            </div>
          </div>
        )}

        {/* Step 2: Style + Reference Images */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Select all styles you're interested in
              </p>
              <div className="flex flex-wrap gap-2">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style}
                    onClick={() => toggleStyle(style)}
                    className={`px-4 py-2 rounded-full border transition-colors ${selectedStyles.includes(style)
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Images Upload Button */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference images (optional)
              </label>
              <button
                type="button"
                onClick={() => setShowReferenceUpload(true)}
                className="w-full p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {referenceImages.length > 0
                        ? `${referenceImages.length} image${referenceImages.length > 1 ? 's' : ''} added`
                        : 'Add reference images'
                      }
                    </p>
                    <p className="text-xs text-gray-500">
                      Tattoos, artwork, or inspiration
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              {/* Preview thumbnails */}
              {referenceImages.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                  {referenceImages.slice(0, 4).map((img) => (
                    <div key={img.id} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {referenceImages.length > 4 && (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-gray-600">+{referenceImages.length - 4}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Body Placement */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600">
              Upload photos of the body area where you'd like the tattoo. This helps the artist understand the placement and size better.
            </p>

            <button
              type="button"
              onClick={() => setShowBodyPlacementUpload(true)}
              className="w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 transition-colors flex flex-col items-center justify-center gap-3"
            >
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                <Camera className="w-7 h-7 text-gray-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">
                  {bodyPlacementImages.length > 0
                    ? `${bodyPlacementImages.length} photo${bodyPlacementImages.length > 1 ? 's' : ''} added`
                    : 'Add body placement photos'
                  }
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Take or upload photos of the area
                </p>
              </div>
            </button>

            {/* Preview thumbnails */}
            {bodyPlacementImages.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {bodyPlacementImages.map((img) => (
                  <div key={img.id} className="aspect-square rounded-lg overflow-hidden">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 text-center">
              This step is optional but highly recommended
            </p>
          </div>
        )}

        {/* Step 4: Budget */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              What's your budget for this project?
            </p>
            <div className="space-y-2">
              {BUDGET_RANGES.map((budget) => (
                <button
                  key={budget.label}
                  onClick={() => setSelectedBudget(budget)}
                  className={`w-full p-4 text-left rounded-lg border transition-colors ${selectedBudget?.label === budget.label
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <span className="font-medium text-gray-900">{budget.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Availability */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              When are you hoping to get started?
            </p>
            <div className="space-y-2">
              {TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTimeframe(option.id)}
                  className={`w-full p-4 text-left rounded-lg border transition-colors ${timeframe === option.id
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <span className="font-medium text-gray-900">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-lg mx-auto flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              disabled={submitting}
              className="flex-1 py-3 px-6 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed() || submitting}
            className={`${currentStep === 0 ? 'w-full' : 'flex-1'} py-3 px-6 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {submitting
              ? 'Submitting...'
              : currentStep === totalSteps - 1
                ? 'Submit Request'
                : currentStep === 3 && bodyPlacementImages.length === 0
                  ? 'Skip for now'
                  : 'Continue'
            }
          </button>
        </div>
      </div>

      {/* Reference Images Upload Sheet */}
      <ImageUploadSheet
        isOpen={showReferenceUpload}
        onClose={() => setShowReferenceUpload(false)}
        onImagesChange={setReferenceImages}
        images={referenceImages}
        title="Reference Images"
        description="Upload tattoos, artwork, or any inspiration for your project"
        maxImages={10}
      />

      {/* Body Placement Upload Sheet */}
      <ImageUploadSheet
        isOpen={showBodyPlacementUpload}
        onClose={() => setShowBodyPlacementUpload(false)}
        onImagesChange={setBodyPlacementImages}
        images={bodyPlacementImages}
        title="Body Placement Photos"
        description="Show the area where you'd like the tattoo placed"
        maxImages={5}
      />
    </div>
  );
}
