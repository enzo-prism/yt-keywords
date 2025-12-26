import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ff7a3d, #ff2d55)",
        }}
      >
        <div
          style={{
            width: 128,
            height: 128,
            borderRadius: 36,
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
          }}
        >
          <span
            style={{
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: "-4px",
              color: "#ffffff",
              fontFamily: "Arial, sans-serif",
            }}
          >
            hc
          </span>
        </div>
      </div>
    ),
    {
      width: 180,
      height: 180,
    }
  );
}
