export function LoadingOverlay() {
  return (
    <div className="fsloader">
      <iframe
        onLoad={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        style={{ opacity: 0 }}
        src="/loader.html"
        sandbox="allow-scripts allow-same-origin"
        title="Loading"
      ></iframe>
    </div>
  );
}
