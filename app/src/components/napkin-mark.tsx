import { cn } from "@/lib/utils";

export function NapkinMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-4", className)}
    >
      <path d="M4.6 5.3c0-.6.4-1 1-1.05 4.3-.3 8.6-.3 12.9 0 .6.05 1 .45 1 1.05.15 2.9.17 5.8.05 8.7l-5.6 5.65c-2.7.2-5.5.2-8.3 0-.6-.05-1-.45-1.02-1.05C4.4 14.2 4.4 9.75 4.6 5.3Z" />
      <path d="M19.55 14c-1.7-.15-3.4-.12-5.1.1-.5.07-.85.42-.9.92-.2 1.55-.22 3.1-.1 4.63" />
    </svg>
  );
}
