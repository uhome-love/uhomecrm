import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePulse, type EmojiType } from "@/hooks/usePulse";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import PulseEventCard from "./PulseEventCard";
import PulseDesafioCard from "./PulseDesafioCard";
import PulseDesafioForm from "./PulseDesafioForm";
import PulseEmptyState from "./PulseEmptyState";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "conquistas", label: "Conquistas" },
];

export default function PulseFeed() {
  const [filter, setFilter] = useState("todos");
  const { events, eventsLoading, activeDesafio, newEventIds, react, createDesafio, isCreatingDesafio } = usePulse(filter);
  const { user } = useAuth();
  const { isGestor, isAdmin } = useUserRole();

  const handleReact = (eventId: string, emoji: EmojiType) => {
    react({ eventId, emoji });
  };

  return (
    <Card className="border-border/60 overflow-hidden relative z-10">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className="text-sm font-bold text-foreground">Pulse</span>
            <span className="inline-flex items-center gap-1 bg-green-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse">
              AO VIVO
            </span>
          </div>
          {(isGestor || isAdmin) && (
            <PulseDesafioForm onSubmit={createDesafio} isLoading={isCreatingDesafio} />
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Desafio Ativo (sticky) */}
        {activeDesafio && (
          <PulseDesafioCard desafio={activeDesafio} />
        )}

        {/* Event List */}
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {eventsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))
          ) : events.length === 0 ? (
            <PulseEmptyState />
          ) : (
            events.map((event) => (
              <PulseEventCard
                key={event.id}
                event={event}
                isNew={newEventIds.has(event.id)}
                currentUserId={user?.id}
                onReact={handleReact}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
