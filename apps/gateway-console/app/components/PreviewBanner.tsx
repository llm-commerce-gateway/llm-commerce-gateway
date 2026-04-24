import type { JSX } from "react";

interface PreviewBannerProps {
  panelName: string;
}

export function PreviewBanner({ panelName }: PreviewBannerProps): JSX.Element {
  return (
    <div
      className="mb-4 rounded-md border px-4 py-3 text-sm"
      style={{
        borderColor: "#fde68a",
        backgroundColor: "#fffbeb",
        color: "#92400e",
      }}
    >
      <strong>{panelName}</strong> is in preview mode. Configuration UI available in v1.1.
    </div>
  );
}
