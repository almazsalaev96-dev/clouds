import { ImageResponse } from "next/og";

/**
 * The card a link to Armi becomes when it is pasted into a chat, a post or
 * a message: the name, the one line, and the three things it does, drawn
 * at request time rather than kept as a picture that drifts from the copy.
 * Applies to every page, so /why and / share it.
 */
export const alt = "Armi — several AIs working your question together, in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0b101c 0%, #111a2e 60%, #0b2a3a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#0A7CFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700 }}>A</div>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>Armi</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2, maxWidth: 1000 }}>
            Several AIs work your question together.
          </div>
          <div style={{ fontSize: 30, color: "#b9c6dc", lineHeight: 1.3, maxWidth: 980 }}>
            One writes, another company's model checks, and the answer becomes cards, a lesson, a PowerPoint, a PDF or an app — kept in your browser.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "#dfe7f5" }}>
          {["Study", "Tutor", "Notebook", "Studio", "Free with your keys · Plus $1 a month"].map((t) => (
            <div key={t} style={{ padding: "10px 18px", borderRadius: 999, border: "2px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.06)" }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
