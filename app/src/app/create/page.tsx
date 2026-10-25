'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAnswerReveal } from '@/components/kept/useAnswerReveal';
import { AiWorking } from '@/components/kept/AiWorking';
import { ApiError, draftPromise } from '@/shared/apiClient';
import { DraftRequestSchema } from '@/shared/draftSchemas';
import type { DraftRequest, DraftResponse, MarketDraft } from '@/shared/types';

const subscribe = () => () => {};

export default function Create() {
  const [sourceInput, setSourceInput] = useState('');
  const [guidanceInput, setGuidanceInput] = useState('');
  const [response, setResponse] = useState<DraftResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualSourceText, setManualSourceText] = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);

  async function submitDraft(request: DraftRequest) {
    if (activeRequest.current) return;
    const parsed = DraftRequestSchema.safeParse(request);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid source.');
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const next = await draftPromise(parsed.data, controller.signal);
      if (!controller.signal.aborted) {
        setResponse(next);
        setShowManualFallback(false);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not generate a draft.',
        );
        setShowManualFallback(
          Boolean(request.text && request.url) ||
            (cause instanceof ApiError && cause.canPasteSource),
        );
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  function generateDraft() {
    const value = sourceInput.trim();
    if (!value) {
      setError('Paste a public post URL, article URL, or source text first.');
      return;
    }
    setShowManualFallback(false);
    const request: DraftRequest = /^https?:\/\//iu.test(value)
      ? { url: value }
      : { text: value };
    if (guidanceInput.trim()) request.guidance = guidanceInput.trim();
    void submitDraft(request);
  }

  function generateFromManualFallback() {
    if (!manualSourceText.trim()) {
      setError('Paste the relevant text from the linked source first.');
      return;
    }
    const request: DraftRequest = {
      url: sourceInput.trim(),
      text: manualSourceText.trim(),
    };
    if (guidanceInput.trim()) request.guidance = guidanceInput.trim();
    void submitDraft(request);
  }

  function changeSource(value: string) {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
    setSourceInput(value);
    setError(null);
    setResponse(null);
    setManualSourceText('');
    setShowManualFallback(false);
  }

  function updateDraft<K extends keyof MarketDraft>(
    key: K,
    value: MarketDraft[K],
  ) {
    setResponse((current) => {
      if (!current || current.decision !== 'accept' || !current.draft)
        return current;
      return { ...current, draft: { ...current.draft, [key]: value } };
    });
  }

  const draft = response?.decision === 'accept' ? response.draft : null;
  const reveal = useAnswerReveal(response);

  return (
    <>
      <section className="hero compact">
        <h1>Add a promise.</h1>
        <p>
          Paste a link. Let AI find the promise. Review it before you publish.
        </p>
      </section>
      <section className="form panel">
        <h2>01 / The source</h2>
        <label>
          Public post URL, article URL, or original text
          <textarea
            value={sourceInput}
            disabled={!hydrated}
            onChange={(event) => changeSource(event.target.value)}
            placeholder="Paste an X post link, article URL, or promise text"
            maxLength={20_000}
            rows={5}
          />
        </label>
        <label>
          Extra guidance for the AI <small>Optional</small>
          <textarea
            value={guidanceInput}
            disabled={!hydrated || loading}
            onChange={(event) => setGuidanceInput(event.target.value)}
            placeholder="Suggest a particular commitment, deadline, or angle to look for. The source still needs to support it."
            maxLength={2_000}
            rows={3}
          />
        </label>
        <button
          type="button"
          className="primary"
          onClick={generateDraft}
          disabled={!hydrated || loading}
        >
          {!hydrated
            ? 'Loading form…'
            : loading
              ? 'Generating AI draft…'
              : 'Generate AI draft'}
        </button>
        <noscript>
          <p role="alert">
            JavaScript is required to generate a draft. Enable scripts in your
            preview and reload this page.
          </p>
        </noscript>
        {loading && <AiWorking />}
        {loading && (
          <button
            type="button"
            onClick={() => {
              activeRequest.current?.abort();
              activeRequest.current = null;
              setLoading(false);
              setError('Drafting cancelled. You can try again.');
            }}
          >
            Cancel
          </button>
        )}
        {error && (
          <p role="alert" className="negative">
            {error}
          </p>
        )}
        {showManualFallback && (
          <div className="draft">
            <h2>Use the article text directly</h2>
            <p className="muted">
              Keep the URL above, then paste the relevant text from that page
              here. The source link will stay attached to the draft.
            </p>
            <label>
              Text copied from the linked page
              <textarea
                value={manualSourceText}
                onChange={(event) => setManualSourceText(event.target.value)}
                disabled={loading}
                maxLength={20_000}
                rows={6}
              />
            </label>
            <button
              type="button"
              onClick={generateFromManualFallback}
              disabled={!hydrated || loading}
            >
              {loading ? 'Drafting…' : 'Draft from pasted text'}
            </button>
          </div>
        )}

        {response && (
          <div
            className="draft ai-answer"
            onFocusCapture={reveal.finish}
            onPointerDownCapture={reveal.finish}
          >
            {!reveal.complete && (
              <button className="reveal-skip" onClick={reveal.finish}>
                Show full answer
              </button>
            )}
            {response.decision === 'reject' ? (
              <div role="status">
                <h2>Promise not accepted</h2>
                {response.source.url ? (
                  <p>
                    <a
                      href={response.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-link"
                    >
                      Open source ↗
                    </a>
                  </p>
                ) : (
                  <p className="muted">Pasted text source</p>
                )}
                <details>
                  <summary>
                    Read source text (
                    {response.source.text.length.toLocaleString('en-US')}{' '}
                    characters)
                  </summary>
                  <blockquote>{response.source.text}</blockquote>
                </details>

                <p className="answer-text">{reveal.text(0)}</p>
                <p className="muted">
                  Reason · {response.rejectReason?.replaceAll('_', ' ')}
                </p>
              </div>
            ) : draft ? (
              <>
                <div className="answer-heading">
                  <span className="answer-check" aria-hidden="true">
                    ✓
                  </span>
                  <h2>02 / Review AI draft</h2>
                </div>
                <p className="answer-intro">
                  Who promised what, by when, and how to tell if it happened.
                </p>
                {response.source.url && (
                  <a
                    className="text-link answer-source"
                    href={response.source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open source ↗
                  </a>
                )}
                <p className="sr-only" role="status">
                  AI draft ready. Review and edit the fields below.
                </p>
                <label>
                  Who made the promise
                  <span className="reveal-field">
                    <input
                      className={
                        !reveal.complete ? 'revealing-input' : undefined
                      }
                      aria-label="Promiser"
                      value={draft.promiser}
                      onChange={(event) =>
                        updateDraft('promiser', event.target.value)
                      }
                      maxLength={40}
                    />
                    {!reveal.complete && (
                      <span className="reveal-overlay" aria-hidden="true">
                        {reveal.text(1)}
                      </span>
                    )}
                  </span>
                </label>
                <label>
                  The promise <small>{draft.promiseText.length}/240</small>
                  <span className="reveal-field">
                    <textarea
                      className={
                        !reveal.complete ? 'revealing-input' : undefined
                      }
                      aria-label="Exact promise"
                      value={draft.promiseText}
                      onChange={(event) =>
                        updateDraft('promiseText', event.target.value)
                      }
                      maxLength={240}
                      rows={3}
                    />
                    {!reveal.complete && (
                      <span className="reveal-overlay" aria-hidden="true">
                        {reveal.text(2)}
                      </span>
                    )}
                  </span>
                </label>
                <label>
                  Deadline
                  <span className="reveal-field">
                    <input
                      className={
                        !reveal.complete ? 'revealing-input' : undefined
                      }
                      type="date"
                      value={draft.deadline}
                      onChange={(event) =>
                        updateDraft('deadline', event.target.value)
                      }
                    />
                    {!reveal.complete && (
                      <span className="reveal-overlay" aria-hidden="true">
                        {reveal.text(4)}
                      </span>
                    )}
                  </span>
                </label>
                <label>
                  ✓ Kept if
                  <span className="reveal-field">
                    <textarea
                      className={
                        !reveal.complete ? 'revealing-input' : undefined
                      }
                      value={draft.criteriaKept}
                      onChange={(event) =>
                        updateDraft('criteriaKept', event.target.value)
                      }
                      maxLength={160}
                      rows={3}
                    />
                    {!reveal.complete && (
                      <span className="reveal-overlay" aria-hidden="true">
                        {reveal.text(5)}
                      </span>
                    )}
                  </span>
                </label>
                <label>
                  ✕ Broken if
                  <span className="reveal-field">
                    <textarea
                      className={
                        !reveal.complete ? 'revealing-input' : undefined
                      }
                      value={draft.criteriaBroken}
                      onChange={(event) =>
                        updateDraft('criteriaBroken', event.target.value)
                      }
                      maxLength={160}
                      rows={3}
                    />
                    {!reveal.complete && (
                      <span className="reveal-overlay" aria-hidden="true">
                        {reveal.text(6)}
                      </span>
                    )}
                  </span>
                </label>
                <details className="answer-details">
                  <summary>Sources and extra details</summary>{' '}
                  <label>
                    Question
                    <span className="reveal-field">
                      <input
                        className={
                          !reveal.complete ? 'revealing-input' : undefined
                        }
                        value={draft.question}
                        onChange={(event) =>
                          updateDraft('question', event.target.value)
                        }
                      />
                      {!reveal.complete && (
                        <span className="reveal-overlay" aria-hidden="true">
                          {reveal.text(3)}
                        </span>
                      )}
                    </span>
                  </label>
                  <label>
                    Check source
                    <span className="reveal-field">
                      <input
                        className={
                          !reveal.complete ? 'revealing-input' : undefined
                        }
                        value={draft.checkSource}
                        onChange={(event) =>
                          updateDraft('checkSource', event.target.value)
                        }
                      />
                      {!reveal.complete && (
                        <span className="reveal-overlay" aria-hidden="true">
                          {reveal.text(7)}
                        </span>
                      )}
                    </span>
                  </label>
                  {draft.assumptions.length > 0 && (
                    <div>
                      <h3>What the AI assumed</h3>
                      <ul>
                        {draft.assumptions.map((assumption) => (
                          <li key={assumption}>{assumption}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <details>
                    <summary>
                      Read source text (
                      {response.source.text.length.toLocaleString('en-US')}{' '}
                      characters)
                    </summary>
                    <blockquote>{response.source.text}</blockquote>
                  </details>
                </details>
                <button
                  className="primary"
                  disabled
                  title="Publishing will be available when wallet setup is complete."
                >
                  Publish promise · Coming soon
                </button>
              </>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}
