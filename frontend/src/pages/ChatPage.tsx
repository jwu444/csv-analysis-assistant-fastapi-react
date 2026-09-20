import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getChatHistory, postChat } from "../api";
import type { ChatDatasetOut, ChatMessageOut } from "../types";
import ChatTurn from "../components/ChatTurn";
import QuestionBox from "../components/QuestionBox";
import ErrorBanner from "../components/ErrorBanner";
import DatasetChips from "../components/DatasetChips";
import AppShell from "../components/AppShell";
import { Skeleton } from "../ui";
import styles from "./ChatPage.module.css";

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const [datasets, setDatasets] = useState<ChatDatasetOut[]>([]);
  const [messages, setMessages] = useState<ChatMessageOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId) return;
    let active = true;
    setLoading(true);
    setLoadError(null);
    getChatHistory(chatId)
      .then((history) => {
        if (!active) return;
        setDatasets(history.datasets);
        setMessages(history.messages);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load chat");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [chatId]);

  async function handleAsk(question: string) {
    if (!chatId) return;
    setPending(true);
    setAskError(null);
    const userTurn: ChatMessageOut = {
      id: `local-${Date.now()}`,
      role: "user",
      content: question,
      charts: [],
      stats: [],
      errors: [],
    };
    try {
      const assistant = await postChat(chatId, question);
      setMessages((prev) => [...prev, userTurn, assistant]);
    } catch (err: unknown) {
      setAskError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className={styles.loading}>
          <Skeleton count={3} />
        </div>
      </AppShell>
    );
  }
  if (loadError) {
    return (
      <AppShell>
        <ErrorBanner message={loadError} />
      </AppShell>
    );
  }

  return (
    <AppShell topbarRight={<DatasetChips datasets={datasets} />}>
      {messages.length === 0 && (
        <p className={styles.empty}>Ask your first question about these datasets.</p>
      )}
      <div className={styles.messages}>
        {messages.map((m) => (
          <ChatTurn key={m.id} message={m} />
        ))}
      </div>
      {askError && <ErrorBanner message={askError} />}
      <QuestionBox onSubmit={handleAsk} pending={pending} />
    </AppShell>
  );
}
