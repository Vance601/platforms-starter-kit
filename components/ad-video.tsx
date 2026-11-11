// Shared HTML5 player for the public 62s Battery City ad.
// No autoplay (and therefore no autoplay-with-sound). Callers pass a poster.
export default function AdVideo({
  layout = "responsive",
}: {
  layout?: "responsive" | "wide";
}) {
  const wide = (
    <video
      controls
      playsInline
      preload="metadata"
      poster="/battery-city-ad-poster.jpg"
      aria-label="Battery City in 60 seconds"
      style={{
        width: "100%",
        height: "auto",
        aspectRatio: "16 / 9",
        borderRadius: 14,
        background: "#000",
        display: "block",
      }}
    >
      <source src="/battery-city-ad.mp4" type="video/mp4" />
    </video>
  );

  const vertical = (
    <video
      controls
      playsInline
      preload="metadata"
      poster="/battery-city-ad-poster-vertical.jpg"
      aria-label="Battery City in 60 seconds"
      style={{
        width: "100%",
        height: "auto",
        aspectRatio: "9 / 16",
        maxHeight: "70vh",
        borderRadius: 14,
        background: "#000",
        display: "block",
      }}
    >
      <source src="/battery-city-ad-vertical.mp4" type="video/mp4" />
    </video>
  );

  if (layout === "wide") return wide;

  return (
    <>
      <div className="hidden md:block">{wide}</div>
      <div className="md:hidden" style={{ maxWidth: 420, margin: "0 auto" }}>
        {vertical}
      </div>
    </>
  );
}
