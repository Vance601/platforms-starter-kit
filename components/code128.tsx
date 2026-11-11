"use client";

import { code128Svg } from "@/lib/code128-svg";

export default function Code128({
  value,
  width,
  height,
  className,
}: {
  value: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const svg = code128Svg(value, { width, height, className });
  return <span className="inline-block leading-none" dangerouslySetInnerHTML={{ __html: svg }} />;
}
