const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");

admin.initializeApp();

/**
 * Se dispara cuando la equipa confirma uma visita.
 * Pedidos públicos permanecem pendentes e não criam eventos no calendário.
 */
exports.createCalendarEvent = functions.firestore
  .document("visits/{visitId}")
  .onUpdate(async (change, context) => {
    const previous = change.before.data();
    const visit = change.after.data();
    if (previous.status === "confirmed" || visit.status !== "confirmed") {
      return null;
    }
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
      await change.after.ref.update({ calendarEventId: res.data.id, calendarSyncedAt: new Date().toISOString() });
      console.log(`✅ Evento creado en Calendar para visita ${context.params.visitId}:`, res.data.id);
      return null;
    } catch (err) {
      console.error("❌ Error creando evento en Calendar:", err);
      await change.after.ref.update({ calendarSyncError: String(err) });
      return null;
    }
  });


/**
 * Revisión mensual de la tabla de precios.
 * Notifica a los administradores el primer día de cada mes;
 * no modifica precios automáticamente ni inventa valores.
 */
exports.priceTableMonthlyReview = functions.pubsub
  .schedule("0 8 1 * *")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const period = now.toISOString().slice(0, 7);
    const adminDocs = await db.collection("admins").get();
    const recipients = new Set(["safeness.c.a@gmail.com"]);
    adminDocs.forEach((snapshot) => {
      const data = snapshot.data() || {};
      const email = String(data.email || snapshot.id || "").toLowerCase();
      if (email.includes("@")) recipients.add(email);
    });
    const activePrices = await db.collection("price_table").get();
    const expired = activePrices.docs.filter((d) => {
      const value = String(d.data().priceValidUntil || "");
      return value && value < now.toISOString().slice(0, 10);
    }).length;
    const missingValidity = activePrices.docs.filter((d) => !d.data().priceValidUntil).length;
    const batch = db.batch();
    for (const email of recipients) {
      const id = "price-monthly-review-" + period.replace("-", "") + "-" + Buffer.from(email).toString("hex");
      const ref = db.collection("notifications").doc(id);
      const existing = await ref.get();
      if (existing.exists) continue;
      batch.create(ref, {
        type: "price_monthly_review",
        targetEmail: email,
        title: "Revisão mensal da tabela de preços",
        message: "Revise os valores com as tabelas vigentes dos fornecedores. " + expired + " preço(s) vencido(s) e " + missingValidity + " sem data de validade. Nenhum valor foi alterado automaticamente.",
        createdAt: now.toISOString(),
        read: false,
        period,
      });
    }
    await batch.commit();
    return null;
  });

/**
 * Aviso diario de precios que vencen en los próximos 15 días.
 * La clave determinista evita enviar repetidamente el mismo aviso.
 */
exports.priceTableExpiryAlerts = functions.pubsub
  .schedule("0 8 * * *")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const db = admin.firestore();
    const today = new Date();
    const dateOnly = today.toISOString().slice(0, 10);
    const until = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sourceNames = ["price_table", "registry_items", "supplier_catalog", "catalog"];
    const snapshots = await Promise.all(sourceNames.map((name) =>
      db.collection(name).where("priceValidUntil", ">=", dateOnly).where("priceValidUntil", "<=", until).get()
    ));
    const adminDocs = await db.collection("admins").get();
    const recipients = new Set(["safeness.c.a@gmail.com"]);
    adminDocs.forEach((snapshot) => {
      const data = snapshot.data() || {};
      const email = String(data.email || snapshot.id || "").toLowerCase();
      if (email.includes("@")) recipients.add(email);
    });
    const notifications = [];
    for (let index = 0; index < snapshots.length; index++) {
      for (const item of snapshots[index].docs) {
        const data = item.data() || {};
        const expiry = String(data.priceValidUntil || "");
        for (const email of recipients) {
          const id = "price-expiry-" + sourceNames[index] + "-" + item.id + "-" + expiry.replace(/[^0-9]/g, "") + "-" + Buffer.from(email).toString("hex");
          const ref = db.collection("notifications").doc(id);
          const existing = await ref.get();
          if (existing.exists) continue;
          notifications.push({ ref, data: {
            type: "price_expiry",
            targetEmail: email,
            title: "Preço próximo do vencimento",
            message: String(data.name || "Item sem nome") + " vence em " + expiry + ". Atualize o preço com a tabela vigente do fornecedor.",
            itemId: item.id,
            itemCollection: sourceNames[index],
            validUntil: expiry,
            createdAt: today.toISOString(),
            read: false,
          }});
        }
      }
    }
    for (let offset = 0; offset < notifications.length; offset += 450) {
      const batch = db.batch();
      notifications.slice(offset, offset + 450).forEach((entry) => batch.create(entry.ref, entry.data));
      await batch.commit();
    }
    return null;
  });
