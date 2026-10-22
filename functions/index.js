const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");

admin.initializeApp();

/**
 * Se dispara al crear un documento en la colección "visits".
 * Crea un evento en Google Calendar usando una cuenta de servicio.
 */
exports.createCalendarEvent = functions.firestore
  .document("visits/{visitId}")
  .onCreate(async (snap, context) => {
    const visit = snap.data();
    if (!visit.preferDate || !visit.preferTime) {
      console.warn("Visita sin fecha/hora, se omite Calendar:", context.params.visitId);
      return null;
    }

    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/calendar"],
      });
      const calendar = google.calendar({ version: "v3", auth });

      // Duración por defecto: 1 hora
      const startDateTime = `${visit.preferDate}T${visit.preferTime}:00`;
      const endHour = String(parseInt(visit.preferTime.split(":")[0], 10) + 1).padStart(2, "0");
      const endDateTime = `${visit.preferDate}T${endHour}:${visit.preferTime.split(":")[1]}:00`;

      const event = {
        summary: `Visita Técnica — ${visit.name}`,
        description: [
          `Cliente: ${visit.name}`,
          `Telefone: ${visit.phone}`,
          visit.email ? `Email: ${visit.email}` : "",
          `Serviço: ${visit.service}`,
          `Endereço: ${visit.address}`,
          visit.notes ? `Notas: ${visit.notes}` : "",
        ].filter(Boolean).join("\n"),
        location: visit.address,
        start: { dateTime: startDateTime, timeZone: "America/Sao_Paulo" },
        end: { dateTime: endDateTime, timeZone: "America/Sao_Paulo" },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 60 },
          ],
        },
      };

      const calendarId = functions.config().google?.calendar_id || "primary";
      const res = await calendar.events.insert({ calendarId, requestBody: event });

      // Guardar el ID del evento en Firestore para futuras actualizaciones
      await snap.ref.update({ calendarEventId: res.data.id, calendarSyncedAt: new Date().toISOString() });
      console.log(`✅ Evento creado en Calendar para visita ${context.params.visitId}:`, res.data.id);
      return null;
    } catch (err) {
      console.error("❌ Error creando evento en Calendar:", err);
      await snap.ref.update({ calendarSyncError: String(err) });
      return null;
    }
  });
