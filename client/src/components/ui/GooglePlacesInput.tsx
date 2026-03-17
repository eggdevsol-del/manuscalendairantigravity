import React from 'react';
import Autocomplete from 'react-google-autocomplete';
import { cn } from '@/lib/utils';
import { tokens } from '@/ui/tokens';

interface GooglePlacesInputProps {
    onPlaceSelected: (place: any) => void;
    placeholder?: string;
    className?: string;
    defaultValue?: string;
    types?: string[];
}

export const GooglePlacesInput = React.forwardRef<HTMLInputElement, GooglePlacesInputProps>(
    ({ onPlaceSelected, placeholder = "Search location...", className, defaultValue, types = ['(cities)'] }, ref) => {

        // Hardcoded fallback for Capacitor/PWA cache bugs where env variables are stripped from JS bundle
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBNYw3_dI5dw7xjWKcLs23EYNDrQfjZrnE";

        if (!apiKey) {
            return (
                <div className="text-xs text-destructive p-2 bg-destructive/10 rounded-[4px] border border-destructive/20">
                    Google Maps API Key is missing from environment.
                </div>
            );
        }

        return (
            <Autocomplete
                apiKey={apiKey}
                onPlaceSelected={onPlaceSelected}
                options={{
                    types: types,
                }}
                defaultValue={defaultValue}
                placeholder={placeholder}
                className={cn(
                    "flex h-9 w-full rounded-[4px] border border-white/10 bg-white/5 px-3 py-1 text-sm shadow-sm transition-colors",
                    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
            />
        );
    }
);

GooglePlacesInput.displayName = "GooglePlacesInput";
