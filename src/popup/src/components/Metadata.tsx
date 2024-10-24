import { Badge } from "@hls-downloader/design-system";
import React from "react";

type Props = {
  metadata: {
    type: string;
    width?: number;
    height?: number;
    bitrate?: number;
    fps?: number;
    duration?: number
  };
};

export function Metadata({
  metadata: { type, width, height, bitrate, fps, duration },
}: Props) {
  if (type === "stream") {
    return (
      <div className="flex space-x-2">
        {width && (
          <Badge variant="secondary">
            {width}×{height}
          </Badge>
        )}

        {duration && (
          <Badge variant="secondary">
            {(duration / 60).toFixed(0)} min
          </Badge>
        )}

        {bitrate && (
          <Badge variant="secondary">
            {(bitrate / 1024 / 1024).toFixed(1)} mbps
          </Badge>
        )}

        {duration && bitrate && ((size) =>
          <Badge variant="secondary">
            ≈ {size < 1_000_000_000
                ? (size / 1024 / 1024).toFixed(2).replace(/[\.]?0+$/, '') + `Mb`
                : (size / 1024 / 1024 / 1024).toFixed(2).replace(/[\.]?0+$/, '') + `Gb`}
          </Badge>
          // sec * bps
        )(duration * bitrate)}

        {fps && <Badge variant="secondary">{fps}</Badge>}
      </div>
    );
  }

  return null;
}
