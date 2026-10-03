import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

const clean = (v, max) => String(v || "").replace(/[\r\n]+/g, " ").trim().slice(0, max);

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const reply = (status, text) =>
      new Response(text, { status, headers: cors });

    if (request.method === "OPTIONS") return reply(204, "");
    if (request.method !== "POST") return reply(405, "Method not allowed");
    if (request.headers.get("Origin") !== env.ALLOWED_ORIGIN) return reply(403, "Forbidden");

    let d;
    try { d = await request.json(); } catch { return reply(400, "Bad request"); }

    // Pułapka na boty: to pole ma być zawsze puste
    if (d.website) return reply(200, "ok");

    const imie = clean(d.imie, 100);
    const email = clean(d.email, 150);
    const telefon = clean(d.telefon, 40);
    if (!imie || (!email && !telefon)) return reply(400, "Brak danych");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, "Zły e-mail");

    const body =
      "Imię: " + imie +
      "\nTelefon: " + telefon +
      "\nE-mail: " + email +
      "\nData wydarzenia: " + clean(d.data, 20) +
      "\nMiejsce: " + clean(d.miejsce, 200) +
      "\nRodzaj wydarzenia: " + clean(d.rodzaj, 100) +
      "\nLiczba gości: " + clean(d.goscie, 10) +
      "\nAtrakcje: " + clean(d.atrakcje, 300) +
      "\n\nWiadomość:\n" + String(d.wiadomosc || "").trim().slice(0, 3000);

    try {
      const msg = createMimeMessage();
      msg.setSender({ name: "Formularz SWEETO", addr: env.FROM });
      msg.setRecipient(env.TO);
      msg.setSubject(clean(d._subject, 200) || "Zapytanie ze strony");
      if (email) msg.setHeader("Reply-To", email);
      msg.addMessage({ contentType: "text/plain", data: body });

      await env.EMAIL.send(new EmailMessage(env.FROM, env.TO, msg.asRaw()));
      return reply(200, "ok");
    } catch (e) {
       console.error("SEND ERROR:", e && e.message ? e.message : e, e && e.stack);
      return reply(500, "Błąd wysyłki: " + (e && e.message ? e.message : String(e)));
    }
  },
};
