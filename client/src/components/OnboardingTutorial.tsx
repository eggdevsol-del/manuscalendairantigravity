import { Button, Card } from "@/components/ui";
import { Calendar, MessageCircle, Sparkles, X } from "lucide-react";
import { useState } from "react";

interface OnboardingTutorialProps {
  onComplete: () => void;
}

const tutorialScreens = [
  {
    icon: MessageCircle,
    title: "Chat with Artists",
    description:
      "Connect directly with artists through real-time messaging. Discuss your ideas, ask questions, and get personalized responses.",
    color: "from-primary to-accent",
  },
  {
    icon: Calendar,
    title: "Book Appointments",
    description:
      "View available time slots and book appointments that fit your schedule. Get instant confirmations and reminders.",
    color: "from-accent to-secondary",
  },
  {
    icon: Sparkles,
    title: "Stay Updated",
    description:
      "Receive notifications about your appointments, messages, and important updates. Never miss a booking again.",
    color: "from-secondary to-primary",
  },
];

export default function OnboardingTutorial({
  onComplete,
}: OnboardingTutorialProps) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleNext = () => {
    if (currentScreen < tutorialScreens.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentScreen(currentScreen + 1);
        setIsAnimating(false);
      }, 300);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    // Role selection already sets hasCompletedOnboarding, just proceed
    onComplete();
  };

  const screen = tutorialScreens[currentScreen];
  const Icon = screen.icon;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Skip button */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSkip}
          className="tap-target"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div
          className={`w-full max-w-md transition-all duration-300 ${
            isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
          }`}
        >
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div
              className={`w-32 h-32 rounded-full bg-gradient-to-br ${screen.color} flex items-center justify-center shadow-2xl animate-in fade-in zoom-in duration-500`}
            >
              <Icon className="w-16 h-16 text-white" />
            </div>
          </div>

          {/* Content */}
          <Card className="p-8 text-center space-y-4 border-2 animate-in slide-in-from-bottom duration-500">
            <h2 className="text-2xl font-bold text-foreground">
              {screen.title}
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              {screen.description}
            </p>
          </Card>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="px-6 py-8 space-y-4 mobile-safe-area">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-4">
          {tutorialScreens.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentScreen ? "w-8 bg-primary" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Action buttons */}
        <Button
          size="lg"
          className="w-full h-14 text-lg font-semibold"
          onClick={handleNext}
        >
          {currentScreen < tutorialScreens.length - 1 ? "Next" : "Get Started"}
        </Button>
      </div>
    </div>
  );
}
