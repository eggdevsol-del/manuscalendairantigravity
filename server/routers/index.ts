import { router } from "../_core/trpc";
import { appointmentsRouter } from "./appointments";
import { artistSettingsRouter } from "./artistSettings";
import { authRouter } from "./auth";
import { consultationsRouter } from "./consultations";
import { conversationsRouter } from "./conversations";
import { messagesRouter } from "./messages";
import { notificationTemplatesRouter } from "./notificationTemplates";
import { policiesRouter } from "./policies";
import { quickActionsRouter } from "./quickActions";
import { systemRouter } from "./system";
import { uploadRouter } from "./upload";

import { bookingRouter } from "./booking";
import { clientProfileRouter } from "./clientProfile";
import { dashboardRouter } from "./dashboard";
import { dashboardTasksRouter } from "./dashboardTasks";
import { funnelRouter } from "./funnel";
import { portfolioRouter } from "./portfolio";
import { walletRouter } from "./wallet";
import { promotionsRouter } from "./promotions";
import { pushRouter } from "./push";
import { paymentMethodSettingsRouter } from "./paymentMethodSettings";
import { formsRouter } from "./forms";

export const appRouter = router({
    appointments: appointmentsRouter,
    artistSettings: artistSettingsRouter,
    auth: authRouter,
    booking: bookingRouter,
    clientProfile: clientProfileRouter,
    consultations: consultationsRouter,
    conversations: conversationsRouter,
    dashboard: dashboardRouter,
    dashboardTasks: dashboardTasksRouter,
    funnel: funnelRouter,
    messages: messagesRouter,
    notifications: notificationTemplatesRouter,
    policies: policiesRouter,
    portfolio: portfolioRouter,
    quickActions: quickActionsRouter,
    system: systemRouter,
    upload: uploadRouter,
    wallet: walletRouter,
    promotions: promotionsRouter,
    push: pushRouter,
    paymentMethodSettings: paymentMethodSettingsRouter,
    forms: formsRouter,
});

export type AppRouter = typeof appRouter;
