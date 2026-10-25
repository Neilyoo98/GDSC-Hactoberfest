'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, draftPromise } from '@/shared/apiClient';
import { DraftRequestSchema } from '@/shared/draftSchemas';
import type { DraftRequest, DraftResponse, MarketDraft } from '@/shared/types';
import { useKeptActions } from '@/chain/hooks';
import { ConnectWallet } from '@/wallet/ConnectWallet';

const subscribe = () => () => {};

export default function Create() {
  const router = useRouter();
  const { wallet, createMarket } = useKeptActions();
  const [sourceInput, setSourceInput] = useState('');
  const [guidanceInput, setGuidanceInput] = useState('');
  const [response, setResponse] = useState<DraftResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualSourceText, setManualSourceText] = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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

  async function publishDraft() {
    if (!response || response.decision !== 'accept' || !response.draft) return;
    if (!response.source.url) {
      setCreateError(
        'Add a public source URL to publish this draft on-chain. Pasted text can be drafted, but the on-chain record needs a source link.',
      );
      return;
    }
    if (!wallet) {
      setCreateError('Connect a Solana wallet before creating the market.');
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      const { id } = await createMarket({
        ...response.draft,
        sourceUrl: response.source.url,
        sourceHash: response.source.sha256,
      });
      router.push(`/markets/${id}`);
    } catch (cause) {
      setCreateError(
        cause instanceof Error ? cause.message : 'Could not create the market.',
      );
    } finally {
      setCreating(false);
    }
  }

  const draft = response?.decision === 'accept' ? response.draft : null;

  return (
    <>
      <section className="hero compact">
        <h1>Add a promise.</h1>
        <p>
          Start with a public promise. Review the exact words, deadline, and
          criteria before signing.
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
        {loading && (
          <p role="status">
            Reading the source and checking the promise. This may take up to 90
            seconds.
          </p>
        )}
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
          <div className="draft" aria-live="polite">
            <h2>Source record</h2>
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
            <p className="muted">
              <b>SHA-256</b> · <code>{response.source.sha256}</code>
            </p>

            {response.decision === 'reject' ? (
              <div role="status">
                <h2>Promise not accepted</h2>
                <p>{response.explanation}</p>
                <p className="muted">
                  Reason · {response.rejectReason?.replaceAll('_', ' ')}
                </p>
              </div>
            ) : draft ? (
              <>
                <h2>02 / Review AI draft</h2>
                <p role="status">{response.explanation}</p>
                <label>
                  Promiser
                  <input
                    value={draft.promiser}
                    onChange={(event) =>
                      updateDraft('promiser', event.target.value)
                    }
                    maxLength={40}
                  />
                </label>
                <label>
                  Exact promise <small>{draft.promiseText.length}/240</small>
                  <textarea
                    value={draft.promiseText}
                    onChange={(event) =>
                      updateDraft('promiseText', event.target.value)
                    }
                    maxLength={240}
                    rows={3}
                  />
                </label>
                <label>
                  Question
                  <input
                    value={draft.question}
                    onChange={(event) =>
                      updateDraft('question', event.target.value)
                    }
                  />
                </label>
                <label>
                  Deadline
                  <input
                    type="date"
                    value={draft.deadline}
                    onChange={(event) =>
                      updateDraft('deadline', event.target.value)
                    }
                  />
                </label>
                <label>
                  ✓ Kept criteria
                  <textarea
                    value={draft.criteriaKept}
                    onChange={(event) =>
                      updateDraft('criteriaKept', event.target.value)
                    }
                    maxLength={160}
                    rows={3}
                  />
                </label>
                <label>
                  ✕ Broken criteria
                  <textarea
                    value={draft.criteriaBroken}
                    onChange={(event) =>
                      updateDraft('criteriaBroken', event.target.value)
                    }
                    maxLength={160}
                    rows={3}
                  />
                </label>
                <label>
                  Check source
                  <input
                    value={draft.checkSource}
                    onChange={(event) =>
                      updateDraft('checkSource', event.target.value)
                    }
                  />
                </label>
                {draft.assumptions.length > 0 && (
                  <div>
                    <h3>Assumptions</h3>
                    <ul>
                      {draft.assumptions.map((assumption) => (
                        <li key={assumption}>{assumption}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!wallet && <ConnectWallet />}
                {createError && (
                  <p role="alert" className="negative">{createError}</p>
                )}
                <button
                  className="primary"
                  type="button"
                  disabled={!hydrated || creating || !wallet || !response.source.url}
                  onClick={() => void publishDraft()}
                  title={!response.source.url ? 'A public source URL is required for the on-chain record.' : undefined}
                >
                  {creating ? 'Waiting for wallet…' : 'Create on Solana'}
                </button>
                {!response.source.url && (
                  <p className="muted">
                    To publish, start with the source URL (pasted text remains useful as a fallback for an unreadable page).
                  </p>
                )}
              </>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}
