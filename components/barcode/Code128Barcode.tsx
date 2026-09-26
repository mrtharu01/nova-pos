"use client";

import * as React from "react";

import {
  encodeCode128B,
} from "@/lib/barcode/code128";

type Code128BarcodeProps = {
  id?: string;
  value: string;
  className?: string;
  height?: number;
  title?: string;
};

export function Code128Barcode({
  id,
  value,
  className,
  height = 70,
  title,
}: Code128BarcodeProps) {
  const layout =
    React.useMemo(
      () =>
        encodeCode128B(
          value,
        ),
      [
        value,
      ],
    );

  return (
    <svg
      id={id}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={
        title ??
        value
      }
      className={
        className
      }
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      <rect
        width={layout.width}
        height={layout.height}
        fill="#ffffff"
      />

      {layout.bars.map(
        (
          bar,
          index,
        ) => (
          <rect
            key={
              `${bar.x}-${index}`
            }
            x={bar.x}
            y={0}
            width={bar.width}
            height={height}
            fill="#000000"
          />
        ),
      )}
    </svg>
  );
}
