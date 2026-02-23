import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function SplashScreen() {
    // Only show on first initialization per session
    const [isVisible, setIsVisible] = useState(() => !sessionStorage.getItem('splash_shown'));

    const handleComplete = () => {
        setIsVisible(false);
        sessionStorage.setItem('splash_shown', 'true');
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    key="splash-screen"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden"
                >
                    <video
                        src="/splash.webm"
                        autoPlay
                        muted
                        playsInline
                        onEnded={handleComplete}
                        // Fallback in case video fails to load or play
                        onError={handleComplete}
                        className="w-full h-full object-cover"
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
