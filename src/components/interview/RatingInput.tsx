"use client";

import { cn } from "@/lib/utils";

interface RatingInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

export function RatingInput({
  label,
  value,
  onChange,
  max = 5,
}: RatingInputProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="text-sm font-medium text-balance">{label}</span>
        <span className="text-sm font-medium tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "size-8 rounded-md text-xs tabular-nums",
              n <= value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
