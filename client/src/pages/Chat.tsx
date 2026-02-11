// Chat.tsx
import { PageShell, PageHeader } from "@/components/ui/ssot"; // Reuse SSOT
import { useParams } from "wouter";
import { ChatInterface } from "@/features/chat/components/ChatInterface";
import { ConversationsList } from "@/features/chat/components/ConversationsList";
import { cn } from "@/lib/utils";

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const conversationId = parseInt(id || "0");

  return (
    <PageShell>
      {/* Mobile: Full Chat */}
      <div className="md:hidden h-full">
        <ChatInterface conversationId={conversationId} />
      </div>

      {/* iPad/Desktop: Split View */}
      <div className="hidden md:flex h-full overflow-hidden">
        {/* Left Panel: List (50%) */}
        <div className="w-1/2 border-r border-white/5 flex flex-col h-full">
          <PageHeader title="Messages" />
          <ConversationsList
            className="bg-transparent"
            activeId={conversationId}
          />
        </div>

        {/* Right Panel: Chat Interface */}
        <div className="flex-1 flex flex-col h-full relative">
          <ChatInterface
            conversationId={conversationId}
            className="bg-transparent"
            onBack={() => {
              // On iPad, back might mean deselect? 
              // But actually we probably don't show the back button on iPad (handled in ChatInterface logic md:hidden)
              // If we did, it would likely go back to /conversations
              window.history.back();
            }}
          />
        </div>
      </div>
    </PageShell>
  );
}
