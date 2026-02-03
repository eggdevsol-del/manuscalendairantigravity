import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getGoogleMapsLink(address: string): string {
  if (!address) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function getGoogleMapsEmbedUrl(address: string): string {
  if (!address) return '';
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}
