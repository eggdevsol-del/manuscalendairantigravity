<<<<<<< HEAD
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Share, X, Plus, Smartphone } from "lucide-react";
=======
import { Button } from "@/components/ui/button";
import { Share, X, Plus, Smartphone, MessageCircle, Gift, Calendar, Bell } from "lucide-react";
>>>>>>> f67b805f30b6e59529d357c59fa5a255ab93fc80
import { useEffect, useState } from "react";

interface IOSInstallPromptProps {
  // If true, force show the prompt (used on funnel success screen)
  forceShow?: boolean;
  onDismiss?: () => void;
}

export default function IOSInstallPrompt({ forceShow = false, onDismiss }: IOSInstallPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    console.log('[IOSInstallPrompt] Initializing, forceShow:', forceShow);
    
    // Check if device is iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // If forceShow is true, show immediately
    if (forceShow) {
      console.log('[IOSInstallPrompt] Force showing prompt');
      setShowPrompt(true);
      return;
    }

    // Check if already installed as PWA
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
    if (isInStandaloneMode) {
      console.log('[IOSInstallPrompt] Already in standalone mode, not showing');
      return;
    }

    // Don't auto-show on funnel pages - only show when forceShow is true
    const isFunnelPage = window.location.pathname.startsWith('/start/');
    if (isFunnelPage) {
      console.log('[IOSInstallPrompt] On funnel page, not auto-showing');
      return;
    }

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('ios-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    // Show again after 24 hours
    if (dismissedTime > oneDayAgo) {
      console.log('[IOSInstallPrompt] Dismissed recently, not showing');
      return;
    }

    // Only show for iOS devices not in standalone mode
    if (isIOSDevice && !isInStandaloneMode) {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        console.log('[IOSInstallPrompt] Showing prompt after delay');
        setShowPrompt(true);
      }, 3000); // Show after 3 seconds

      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleDismiss = () => {
    console.log('[IOSInstallPrompt] Dismissing prompt');
    setShowPrompt(false);
    if (!forceShow) {
      localStorage.setItem('ios-install-dismissed', Date.now().toString());
    }
    onDismiss?.();
  };

  const handleGotIt = () => {
    handleDismiss();
  };

  if (!showPrompt) {
    return null;
  }

  // For non-iOS devices when forceShow is true, show a generic install prompt
  if (forceShow && !isIOS) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div 
          className="w-full max-w-sm max-h-[70vh] overflow-y-auto rounded-2xl p-6"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-2 -right-2 h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
              onClick={handleDismiss}
            >
              <X className="h-5 w-5" />
            </Button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                <Smartphone className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Stay Connected</h2>
              <p className="text-sm text-white/70">
                Get the app for the best experience
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Instant Messaging</p>
                  <p className="text-xs text-white/60">Chat directly with your artist</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Exclusive Vouchers</p>
                  <p className="text-xs text-white/60">Receive promotions & discounts</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Track Appointments</p>
                  <p className="text-xs text-white/60">Manage your bookings easily</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Push Notifications</p>
                  <p className="text-xs text-white/60">Never miss an update</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
                onClick={handleDismiss}
              >
                Maybe Later
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
                onClick={() => window.location.href = '/signup'}
              >
                Create Account
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // iOS-specific install prompt
  if (!isIOS) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="w-full max-w-sm max-h-[70vh] overflow-y-auto rounded-2xl p-6"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
            onClick={handleDismiss}
          >
            <X className="h-5 w-5" />
          </Button>
          
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Smartphone className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Install the App</h2>
            <p className="text-sm text-white/70">
              Add to your home screen for the best experience
            </p>
          </div>

          {/* iOS Install Steps */}
          <div className="space-y-4 mb-6 p-4 rounded-xl bg-white/5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <span className="text-purple-400 font-bold text-sm">1</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Tap the Share button</p>
                <div className="flex items-center gap-2 mt-1">
                  <Share className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-white/60">At the bottom of Safari</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <span className="text-purple-400 font-bold text-sm">2</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Select "Add to Home Screen"</p>
                <div className="flex items-center gap-2 mt-1">
                  <Plus className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-white/60">Scroll down in the share menu</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <span className="text-purple-400 font-bold text-sm">3</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Tap "Add" to confirm</p>
                <p className="text-xs text-white/60 mt-1">The app will appear on your home screen</p>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-2 mb-6">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wider">Benefits</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-xs text-white/80">
                <MessageCircle className="w-3 h-3 text-purple-400" />
                <span>Instant chat</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <Gift className="w-3 h-3 text-blue-400" />
                <span>Vouchers</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <Calendar className="w-3 h-3 text-green-400" />
                <span>Appointments</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <Bell className="w-3 h-3 text-orange-400" />
                <span>Notifications</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
              onClick={handleDismiss}
            >
              Maybe Later
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
              onClick={handleGotIt}
            >
              Got It!
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
