type Session = {
  id?: number;
  status: string;
  paymentStatus: string | null;
  remainingCents: number;
};
export function projectNextStep(
  data: {
    sessions: Session[];
    plans: { status: string }[];
    forms: { appointmentId: number | null; status: string }[];
  },
  artist: boolean
) {
  if (data.plans.some(p => p.status === "pending"))
    return {
      title: artist ? "Waiting for your client" : "Your proposal is ready",
      body: artist
        ? "Your client needs to review the proposed dates and deposit."
        : "Review the dates, price and deposit in your conversation before accepting.",
      action: "Review proposal",
    };
  const active = data.sessions.filter(
    s => !["cancelled", "canceled", "no-show", "completed"].includes(s.status)
  );
  if (
    active.some(s =>
      ["pending_deposit", "unpaid"].includes(s.paymentStatus || "")
    )
  )
    return {
      title: artist ? "Deposit needs attention" : "Check your deposit",
      body: artist
        ? "Review the payment request and recorded status before following up with your client."
        : "Review the payment request and recorded status with your artist before making another payment.",
      action: "Review payment",
    };
  if (active.length) {
    const activeIds = new Set(active.map(s => s.id));
    const unsigned = data.forms.filter(
      f => activeIds.has(f.appointmentId ?? undefined) && f.status === "pending"
    ).length;
    if (unsigned)
      return {
        title: artist
          ? "Client forms outstanding"
          : "Your forms need completing",
        body: `${unsigned} form${unsigned === 1 ? " is" : "s are"} waiting for completion before the appointment. Review and sign the forms here in your project.`,
        action: artist ? "Message client" : "Review forms",
      };
    if (active.some(s => s.status === "confirmed"))
      return {
        title: "Your next session is confirmed",
        body: "Review the time and location below. Use the conversation if you need to arrange a change.",
        action: artist ? "Message client" : "Message artist",
      };
    return {
      title: "Session needs confirmation",
      body: "Check the proposed arrangements in your conversation. A pending session is not yet confirmed.",
      action: "Review conversation",
    };
  }
  if (data.sessions.some(s => s.status === "completed" && s.remainingCents > 0))
    return {
      title: "Balance needs attention",
      body: "A completed session still has a recorded balance. Review the payment history before requesting or making another payment.",
      action: "Review balance",
    };
  if (data.sessions.length)
    return {
      title: "Review your project history",
      body: "Your previous sessions and payments are below. Discuss any further work in the conversation.",
      action: "Open conversation",
    };
  return {
    title: artist ? "Review this enquiry" : "Your request is with your artist",
    body: artist
      ? "Read the brief and references, then reply with questions or propose sessions."
      : "Your artist will discuss your request here. No appointment is confirmed until the booking steps are complete.",
    action: artist ? "Reply to client" : "Open conversation",
  };
}
