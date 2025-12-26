import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
            width: 360,
            height: 360,
            borderRadius: 96,
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
          }}
        >
          <span
            style={{
              fontSize: 160,
              fontWeight: 700,
              letterSpacing: "-8px",
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
      width: 512,
      height: 512,
    }
  );
}
