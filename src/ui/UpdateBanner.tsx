export function UpdateBanner({ onUpdate }: { onUpdate: () => void }) {
  return (
    <div className="update-banner" role="status">
      <span>New version available</span>
      <button onClick={onUpdate}>Reload</button>
    </div>
  );
}
