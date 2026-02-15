"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface InterviewNotesProps {
  notes: Note[];
  onAddNote: (content: string) => Promise<void>;
}

export function InterviewNotes({ notes, onAddNote }: InterviewNotesProps) {
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsAdding(true);
    try {
      await onAddNote(newNote);
      setNewNote("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="メモを入力..."
          className="min-h-[80px]"
        />
        <Button
          size="sm"
          className="h-8 text-xs px-3"
          onClick={handleAddNote}
          disabled={!newNote.trim() || isAdding}
        >
          {isAdding ? "追加中..." : "メモを追加"}
        </Button>
      </div>
      {notes.length > 0 && (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {notes.map((note) => (
            <div key={note.id} className="p-2 bg-secondary rounded-md text-sm">
              <p className="text-sm text-pretty">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {new Date(note.createdAt).toLocaleString("ja-JP")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
