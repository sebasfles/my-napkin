export type ByteUnit = "b" | "kb" | "mb";

export interface ByteSize {
  value: number;
  unit: ByteUnit;
}

const step = 1000;

export function byteSize(bytes: number): ByteSize {
  if (bytes < step) return { value: bytes, unit: "b" };
  if (bytes < step * step) return { value: bytes / step, unit: "kb" };
  return { value: bytes / (step * step), unit: "mb" };
}
