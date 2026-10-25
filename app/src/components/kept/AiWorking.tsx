// OWNER: P3
export function AiWorking() {
  return (
    <div className="ai-working" role="status">
      <span className="answer-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <div>
        <strong>AI is reviewing your source</strong>
        <p>Looking for a clear promise, deadline, and a way to check it.</p>
        <small>This can take up to 90 seconds.</small>
      </div>
    </div>
  );
}
