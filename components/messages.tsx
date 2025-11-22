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
import { CodeBlock } from "./elements/code-block";

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
      const lastMessage = messages[messages.length - 1];
      const hasTextContent =
        lastMessage?.role === "assistant" &&
        ((lastMessage.content && lastMessage.content.length > 0) ||
          lastMessage.parts?.some(
            (p) => p.type === "text" && p.text.length > 0
          ));

      if (hasTextContent) {
        // Once we start receiving text delta, we are done executing/planning and back to "Thinking"
        // (or just showing the stream, which implies thinking/typing).
        // Clear the payment status stage to hide the bubble.
        setStage("idle");
      }
    }
  }, [setStage, stage, status, messages]);

  // When the AI response has finished and we were in the "thinking" stage,
  // reset the payment status so the status bubble disappears.
  useEffect(() => {
    const isModelIdle = status !== "submitted" && status !== "streaming";
    if (isModelIdle && (stage === "thinking" || stage === "executing")) {
      reset();
    }
  }, [reset, stage, status]);

  const shouldShowThinking = status === "submitted" || stage !== "idle";

  // Helper to find latest debug info
  const lastDebugCode = dataStream
    .slice()
    .reverse()
    .find((p) => p.type === "debugCode")?.data;
  const lastDebugResult = dataStream
    .slice()
    .reverse()
    .find((p) => p.type === "debugResult")?.data;

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
              (message.content === undefined || message.content.length === 0) &&
              (!message.parts ||
                message.parts.length === 0 ||
                (message.parts.length === 1 &&
                  message.parts[0].type === "text" &&
                  message.parts[0].text === ""));

            if (shouldShowThinking && isGhost) {
              return null;
            }

            return (
              <PreviewMessage
                chatId={chatId}
                isLoading={
                  status === "streaming" && messages.length - 1 === index
                }
                isReadonly={isReadonly}
                key={message.id}
                message={message}
                regenerate={regenerate}
                requiresScrollPadding={
                  hasSentMessage && index === messages.length - 1
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

          {/* Debug Mode Rendering */}
          {isDebugMode && shouldShowThinking && (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-lg border bg-muted/50 p-4 text-xs font-mono">
              {lastDebugCode && (
                <div className="flex flex-col gap-1">
                  <div className="font-semibold text-muted-foreground">
                    Generated Code:
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded bg-background p-2">
                    <CodeBlock
                      language="typescript"
                      value={lastDebugCode as string}
                    />
                  </div>
                </div>
              )}
              {lastDebugResult && (
                <div className="flex flex-col gap-1 border-t pt-2">
                  <div className="font-semibold text-muted-foreground">
                    Execution Result:
                  </div>
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-background p-2">
                    {lastDebugResult as string}
                  </pre>
                </div>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            {shouldShowThinking && <ThinkingMessage key="thinking" />}
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
