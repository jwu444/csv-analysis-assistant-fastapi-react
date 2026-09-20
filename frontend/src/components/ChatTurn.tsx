import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessageOut } from "../types";
import ChartList from "./ChartList";
import StatsDetails from "./StatsDetails";
import ErrorBanner from "./ErrorBanner";
import styles from "./ChatTurn.module.css";
import PassTrace from "./PassTrace";

interface Props {
  message: ChatMessageOut;
}

export default function ChatTurn({ message }: Props) {
  return (
    <div className={styles.turn} data-role={message.role}>
      <span className={styles.role}>{message.role}</span>
      {message.content &&
        (message.role === "assistant" ? (
          // Assistant prose is Markdown; user questions are shown verbatim.
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <p>{message.content}</p>
        ))}
      <ChartList charts={message.charts} />
      {message.errors.map((e, i) => (
        <ErrorBanner key={i} message={e} />
      ))}
      <StatsDetails stats={message.stats} />
      <PassTrace trace={message.trace} />
    </div>
  );
}
