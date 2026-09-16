import { useState } from "react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { Action, Tabs } from "@/app-v3/design/primitives";

interface EditBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  client?: any;
  onSuccess: () => void;
}

export function EditBookingModal({
  isOpen,
  onClose,
  appointment,
  client,
  onSuccess,
}: EditBookingModalProps) {
  // Mount the editor for each appointment so defaults never leak between clients.
  return appointment && isOpen ? (
    <BookingEditor
      key={appointment.id}
      {...{ onClose, appointment, client, onSuccess }}
    />
  ) : null;
}
function BookingEditor({
  onClose,
  appointment,
  client,
  onSuccess,
}: Omit<EditBookingModalProps, "isOpen">) {
  const [tab, setTab] = useState<"Contact" | "Service & cost" | "Reschedule">(
    "Contact"
  );
  const [name, setName] = useState(
    client?.name || appointment.clientName || ""
  );
  const [phone, setPhone] = useState(client?.phone || "");
  const [serviceName, setServiceName] = useState(appointment.serviceName || "");
  const [newServiceName, setNewServiceName] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState(
    String(
      appointment.totalExpectedAmountCents != null
        ? appointment.totalExpectedAmountCents / 100
        : (appointment.price ?? "")
    )
  );
  const [applyToAll, setApplyToAll] = useState(false);
  const [date, setDate] = useState(
    appointment.startTime
      ? format(new Date(appointment.startTime), "yyyy-MM-dd")
      : ""
  );
  const [time, setTime] = useState(
    appointment.startTime
      ? format(new Date(appointment.startTime), "HH:mm")
      : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const settings = trpc.artistSettings.getPublicByArtistId.useQuery(
    { artistId: appointment.artistId },
    { enabled: !!appointment.artistId }
  );
  let services: any[] = [];
  let invalidServices = false;
  try {
    const value =
      typeof settings.data?.services === "string"
        ? JSON.parse(settings.data.services)
        : settings.data?.services;
    if (value != null && !Array.isArray(value)) invalidServices = true;
    else services = value || [];
  } catch {
    invalidServices = true;
  }
  const updateProfile = trpc.clientProfile.updateClientProfile.useMutation();
  const update = trpc.appointments.update.useMutation();
  const batch = trpc.appointments.batchUpdateClientPrices.useMutation();
  const saveSettings = trpc.artistSettings.upsert.useMutation();
  const utils = trpc.useUtils();
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (tab === "Contact") {
        const clientId = client?.id || appointment.clientId;
        if (!clientId)
          throw new Error("This booking has no linked client profile.");
        await updateProfile.mutateAsync({
          clientId,
          name: name.trim(),
          phone: phone.trim(),
        });
      } else if (tab === "Service & cost") {
        const amount = Number(price);
        if (!price.trim() || !Number.isFinite(amount) || amount < 0)
          throw new Error("Enter a valid non-negative price.");
        let service = serviceName;
        if (service === "__NEW__") {
          if (settings.isLoading || settings.error || invalidServices)
            throw new Error(
              "Service settings could not be loaded. Try again before adding a service."
            );
          const minutes = Number(duration);
          if (
            !newServiceName.trim() ||
            !Number.isInteger(minutes) ||
            minutes < 1 ||
            minutes > 1440
          )
            throw new Error(
              "Enter a service name and a duration from 1 to 1440 minutes."
            );
          service = newServiceName.trim();
          await saveSettings.mutateAsync({
            services: JSON.stringify([
              ...services,
              {
                name: service,
                duration: minutes,
                price: amount,
                sittings: 1,
                showInFunnel: true,
              },
            ]),
          });
        }
        if (applyToAll && appointment.clientId) {
          await batch.mutateAsync({
            appointmentId: appointment.id,
            clientId: appointment.clientId,
            artistId: appointment.artistId,
            price: amount,
            serviceName: service || undefined,
          });
        } else {
          await update.mutateAsync({
            id: appointment.id,
            price: amount,
            serviceName: service || undefined,
          });
        }
      } else {
        const start = new Date(`${date}T${time}`);
        const originalStart = new Date(appointment.startTime).getTime();
        const originalEnd = appointment.endTime
          ? new Date(appointment.endTime).getTime()
          : originalStart + 3600000;
        const durationMs = originalEnd - originalStart;
        if (
          !date ||
          !time ||
          !Number.isFinite(start.getTime()) ||
          !Number.isFinite(durationMs) ||
          durationMs <= 0
        )
          throw new Error("Choose a valid date and time.");
        await update.mutateAsync({
          id: appointment.id,
          startTime: start.toISOString(),
          endTime: new Date(start.getTime() + durationMs).toISOString(),
        });
      }
      void utils.appointments.invalidate();
      void utils.clientProfile.invalidate();
      void utils.artistSettings.invalidate();
      void utils.feed.invalidate();
      onSuccess();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t save. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SheetShell
      isOpen
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Edit booking"
      description={
        appointment.title || appointment.serviceName || "Session details"
      }
    >
      <Tabs
        items={["Contact", "Service & cost", "Reschedule"] as const}
        value={tab}
        onChange={value => {
          if (!busy) {
            setTab(value);
            setError("");
          }
        }}
        label="Booking editor sections"
      />
      <form
        className="v3-form"
        onSubmit={event => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy} className="v3-form">
          {tab === "Contact" && (
            <>
              <label>
                Client name
                <input
                  required
                  value={name}
                  onChange={event => setName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                Phone number
                <input
                  type="tel"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  autoComplete="tel"
                />
              </label>
              <p className="v3-muted">
                These details update the client’s profile across their bookings.
              </p>
            </>
          )}
          {tab === "Service & cost" && (
            <>
              <label>
                Service
                <select
                  aria-label="Service"
                  value={serviceName}
                  onChange={event => setServiceName(event.target.value)}
                >
                  <option value="">Keep current service</option>
                  {serviceName &&
                    serviceName !== "__NEW__" &&
                    !services.some(service => service.name === serviceName) && (
                      <option value={serviceName}>{serviceName}</option>
                    )}
                  {services.map((service, index) => (
                    <option key={index} value={service.name}>
                      {service.name}
                    </option>
                  ))}
                  <option value="__NEW__">Add a new service</option>
                </select>
              </label>
              {serviceName === "__NEW__" && (
                <>
                  <label>
                    New service name
                    <input
                      required
                      value={newServiceName}
                      onChange={event => setNewServiceName(event.target.value)}
                    />
                  </label>
                  <label>
                    Duration in minutes
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      step="1"
                      required
                      value={duration}
                      onChange={event => setDuration(event.target.value)}
                    />
                  </label>
                </>
              )}
              <label>
                Price per session · AUD
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={price}
                  onChange={event => setPrice(event.target.value)}
                />
              </label>
              <label className="v3-check-list">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={event => setApplyToAll(event.target.checked)}
                  disabled={!appointment.clientId}
                />
                Apply to all upcoming bookings for this client
              </label>
            </>
          )}
          {tab === "Reschedule" && (
            <>
              <label>
                Date
                <input
                  type="date"
                  required
                  value={date}
                  onChange={event => setDate(event.target.value)}
                />
              </label>
              <label>
                Time
                <input
                  type="time"
                  required
                  value={time}
                  onChange={event => setTime(event.target.value)}
                />
              </label>
              <p className="v3-muted">
                The session duration stays the same. Times use this device’s
                local timezone.
              </p>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <Action type="submit">
            {busy
              ? "Saving…"
              : tab === "Contact"
                ? "Save details"
                : tab === "Reschedule"
                  ? "Confirm reschedule"
                  : "Save updates"}
          </Action>
        </fieldset>
      </form>
    </SheetShell>
  );
}
