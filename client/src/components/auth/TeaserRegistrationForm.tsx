import React, { useState } from "react";
import { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import { useTeaser } from "@/contexts/TeaserContext";
import { tokens } from "@/ui/tokens";

interface TeaserRegistrationFormProps {
    email: string;
    name: string;
    artistName: string;
}

export function TeaserRegistrationForm({ email, name, artistName }: TeaserRegistrationFormProps) {
    const [, setLocation] = useLocation();
    const { enableTeaserMode } = useTeaser();

    // States
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Register mutation
    const registerMutation = trpc.auth.register.useMutation({
        onSuccess: (data) => handleSuccess(data),
        onError: (error) => {
            if (error.message.includes("already exists")) {
                toast.error("Account already exists. Please log in.");
                // Optionally redirect to login or show login button highlight
            } else {
                toast.error(error.message || "Registration failed");
            }
            setIsLoading(false);
        }
    });

    // Set Password Mutation (for existing funnel clients)
    const setPasswordMutation = trpc.auth.setPasswordForFunnelClient.useMutation({
        onSuccess: (data) => handleSuccess(data),
        onError: (error) => {
            toast.error(error.message || "Failed to set password");
            setIsLoading(false);
        }
    });

    // Handle successful auth from either mutation
    const handleSuccess = (data: { token: string; user: any }) => {
        // 1. Store auth
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        // 1b. Store artist branding
        localStorage.setItem("calendair_artist_branding", artistName);

        // 2. Enable Teaser Mode
        enableTeaserMode();

        // 3. Notify
        toast.success("Account created! Accessing your dashboard...");

        // 4. Redirect
        setTimeout(() => {
            setLocation("/dashboard");
        }, 500);
    };

    // Check if email exists (Mutation as defined in backend)
    const checkEmailMutation = trpc.auth.checkEmailExists.useMutation();
    const { data: emailStatus, isPending: isCheckingEmail } = checkEmailMutation;

    // Trigger check on mount
    React.useEffect(() => {
        if (email) {
            checkEmailMutation.mutate({ email });
        }
    }, [email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }

        setIsLoading(true);

        if (emailStatus?.exists) {
            if (emailStatus.isFunnelClient) {
                // Determine if we should set password
                setPasswordMutation.mutate({
                    email,
                    password
                });
            } else {
                toast.error("Account already exists. Please log in.");
                setIsLoading(false);
            }
        } else {
            // New User
            registerMutation.mutate({
                name,
                email,
                password,
                role: "client"
            });
        }
    };

    return (
        <Card className="w-full max-w-md bg-white border-0 shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="text-center pt-8 pb-4">
                <CardTitle className="text-2xl font-bold text-gray-900">Create your client account</CardTitle>
                <CardDescription className="text-base text-gray-500">
                    Save your consult and manage your booking
                </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-gray-700">Email</Label>
                        <div className="relative">
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                disabled
                                className="bg-gray-50 border-gray-200 text-gray-500"
                            />
                            {/* Status Indicator */}
                            {isCheckingEmail ? (
                                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground animate-pulse">Checking...</span>
                            ) : emailStatus?.exists ? (
                                emailStatus.isFunnelClient ? (
                                    <span className="absolute right-3 top-2.5 text-xs text-green-600 font-medium">Complete Setup</span>
                                ) : (
                                    <span className="absolute right-3 top-2.5 text-xs text-amber-600 font-medium">Account Exists</span>
                                )
                            ) : null}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-gray-700">
                            {emailStatus?.exists && !emailStatus.isFunnelClient ? "Log in to continue" : "Create Password"}
                        </Label>
                        {!emailStatus?.exists || emailStatus.isFunnelClient ? (
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                    className="pr-10 border-gray-200 focus:border-gray-900 focus:ring-gray-900"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                variant="secondary"
                                className="w-full"
                                onClick={() => setLocation("/login")}
                            >
                                Go to Login
                            </Button>
                        )}
                    </div>

                    {(!emailStatus?.exists || emailStatus.isFunnelClient) && (
                        <Button
                            type="submit"
                            className={tokens.button.hero}
                            disabled={isLoading || isCheckingEmail}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    {emailStatus?.isFunnelClient ? "Setting Password..." : "Creating Account..."}
                                </>
                            ) : (
                                emailStatus?.isFunnelClient ? "Complete Registration" : "Register & View Dashboard"
                            )}
                        </Button>
                    )}
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-100" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-gray-400">
                            Already have an account?
                        </span>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    className="w-full text-primary font-medium hover:bg-primary/5 hover:text-primary"
                    onClick={() => setLocation("/login")}
                >
                    Log In
                </Button>
            </CardContent>
        </Card>
    );
}
