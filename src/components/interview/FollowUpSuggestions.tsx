"use client";

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export function FollowUpSuggestions({
  suggestions,
  onSelect,
}: FollowUpSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="px-4 pb-2">
      <p className="text-xs text-muted-foreground mb-2">深掘り候補:</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSelect(suggestion)}
            className="flex-shrink-0 px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-md border border-border transition-colors whitespace-nowrap"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
