import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence } from "framer-motion";
import { ArrowDownIcon } from "lucide-react";
import { memo, useEffect } from "react";
import { useMessages } from "@/hooks/use-messages";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import { Conversation, ConversationContent } from "./elements/conversation";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

type MessagesProps = {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  selectedModelId: string;
  isDebugMode: boolean;
};

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  // We currently don't need selectedModelId here,
  // but keep it in the signature for future use.
  selectedModelId: _selectedModelId,
  isDebugMode,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
  } = useMessages({
    status,
  });

  const { stage, reset, setStage } = usePaymentStatus();

  const { dataStream } = useDataStream();

  useEffect(() => {
    if (status === "submitted") {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  }, [status, messagesContainerRef]);

  // When we start streaming an AI response after querying the tool,
  // promote the status to the generic "Thinking..." stage.
  useEffect(() => {
    if (status === "submitted" && stage === "querying-tool") {
      setStage("thinking");
    }
    if (
      status === "streaming" &&
      (stage === "executing" || stage === "thinking" || stage === "planning")
    ) {
      // FIX: "Executing..." Visibility
      // Only reset to idle if we actually have text content from the assistant.
      // The 'status' can be 'streaming' just because we received data parts (like debugCode/toolStatus),
      // so we must check if text has started to arrive.
      const lastMessage = messages.at(-1);
      const hasTextContent =
        lastMessage?.role === "assistant" &&
        lastMessage.parts?.some(
          (p) => p.type === "text" && p.text && p.text.length > 0
        );

      if (hasTextContent) {
        // Once we start receiving text delta, we are done executing/planning.
        // Reset the full payment status (including streaming code and debug result)
        // to hide the thinking accordion.
        reset();
      }
    }
  }, [reset, setStage, stage, status, messages]);

  // When the AI response has finished and we were in the "thinking" stage,
  // reset the payment status so the status bubble disappears.
  useEffect(() => {
    const isModelIdle = status !== "submitted" && status !== "streaming";
    if (isModelIdle && (stage === "thinking" || stage === "executing")) {
      reset();
    }
  }, [reset, stage, status]);

  const shouldShowThinking = status === "submitted" || stage !== "idle";

  if (process.env.NODE_ENV === "development") {
    // Lightweight client-side debug for message list evolution.
    // eslint-disable-next-line no-console
    console.log("[chat-client] messages snapshot", {
      status,
      stage,
      count: messages.length,
      lastMessage: messages.length
        ? {
            id: messages.at(-1)?.id,
            role: messages.at(-1)?.role,
            partTypes: messages.at(-1)?.parts?.map((part) => part.type),
          }
        : null,
    });
  }

  return (
    <div
      className="overscroll-behavior-contain -webkit-overflow-scrolling-touch flex-1 touch-pan-y overflow-y-scroll"
      ref={messagesContainerRef}
      style={{ overflowAnchor: "none" }}
    >
      <Conversation className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 md:gap-6">
        <ConversationContent className="flex flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
          {messages.length === 0 && stage === "idle" && <Greeting />}

          {messages.map((message, index) => {
            // FIX: Ghost Bubble
            // Hide the last message if it's an empty assistant message AND we are still showing the thinking bubble.
            // This prevents the "Ghost" avatar from appearing above the "Thinking..." bubble.
            const isLast = index === messages.length - 1;
            const isGhost =
              isLast &&
              message.role === "assistant" &&
              (!message.parts ||
                message.parts.length === 0 ||
                (message.parts.length === 1 &&
                  message.parts[0].type === "text" &&
                  (!message.parts[0].text ||
                    message.parts[0].text.length === 0)));

            const hasOnlyDataParts =
              message.role === "assistant" &&
              message.parts &&
              message.parts.length > 0 &&
              message.parts.every((part) => part.type.startsWith("data-"));

            // Never render pure data-only assistant messages or empty "ghost" messages.
            if (isGhost || hasOnlyDataParts) {
              return null;
            }

            return (
                <PreviewMessage
                  chatId={chatId}
                  // Developer Mode now relies on the inline markdown emitted by
                  // the final assistant response. We keep the flag so UI pieces
                  // that care about the mode (e.g. sidebar toggle) still work,
                  // but we no longer thread separate debugCode/debugResult
                  // streams into the message component.
                  isDebugMode={isDebugMode}
                  isLoading={
                    status === "streaming" && messages.length - 1 === index
                  }
                  isReadonly={isReadonly}
                  key={message.id}
                  message={message}
                  regenerate={regenerate}
                  requiresScrollPadding={
                    // Don't apply scroll padding if ThinkingMessage is showing below,
                    // as that would create extra whitespace between the last message
                    // and the thinking indicator
                    hasSentMessage && index === messages.length - 1 && !shouldShowThinking
                  }
                  setMessages={setMessages}
                  vote={
                    votes
                      ? votes.find((vote) => vote.messageId === message.id)
                      : undefined
                  }
                />
            );
          })}

          <AnimatePresence mode="wait">
            {shouldShowThinking && (
              <ThinkingMessage isDebugMode={isDebugMode} key="thinking" />
            )}
          </AnimatePresence>

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </ConversationContent>
      </Conversation>

      {!isAtBottom && (
        <button
          aria-label="Scroll to bottom"
          className="-translate-x-1/2 absolute bottom-40 left-1/2 z-10 rounded-full border bg-background p-2 shadow-lg transition-colors hover:bg-muted"
          onClick={() => scrollToBottom("smooth")}
          type="button"
        >
          <ArrowDownIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isDebugMode !== nextProps.isDebugMode) {
    return false;
  }
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) {
    return true;
  }

  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.selectedModelId !== nextProps.selectedModelId) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }
  if (!equal(prevProps.votes, nextProps.votes)) {
    return false;
  }

  return false;
});
