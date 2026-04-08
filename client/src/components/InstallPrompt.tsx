import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { isPWA, setupInstallPrompt } from "@/lib/pwa";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [installHandler, setInstallHandler] = useState<ReturnType<
    typeof setupInstallPrompt
  > | null>(null);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isPWA()) {
      return;
    }

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      return;
    }

    const handler = setupInstallPrompt();
    setInstallHandler(handler);

    // Show prompt after a short delay
    const timer = setTimeout(() => {
      if (handler.isAvailable()) {
        setShowPrompt(true);
      }
    }, 5000); // Show after 5 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    if (installHandler) {
      const accepted = await installHandler.showPrompt();
      if (accepted) {
        setShowPrompt(false);
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-sm shadow-2xl border border-white/10" style={{ background: '#0e1732' }}>
        <CardHeader className="relative pb-3">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Install App
          </CardTitle>
          <CardDescription>
            Install this app on your device for a better experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Works offline</li>
            <li>• Faster loading</li>
            <li>• Push notifications</li>
            <li>• Home screen access</li>
          </ul>
          <Button onClick={handleInstall} className="w-full">
            Install Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
