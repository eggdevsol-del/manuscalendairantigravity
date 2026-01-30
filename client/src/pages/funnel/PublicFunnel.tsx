/**
 * Public Funnel Entry Point
 * Route: /start/:slug
 * 
 * This is the public-facing consultation funnel entry point.
 * No authentication required.
 */

import { useRoute } from "wouter";
import FunnelWrapper from "./FunnelWrapper";

export default function PublicFunnel() {
  const [match, params] = useRoute("/start/:slug");
  
  if (!match || !params?.slug) {
    return null;
  }

  return <FunnelWrapper artistSlug={params.slug} />;
}
