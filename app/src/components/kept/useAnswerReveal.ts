'use client';
// OWNER: P3. Reveal the completed API response locally; no simulated network streaming.
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { DraftResponse } from '@/shared/types';
const fields = [
  'promiser',
  'promiseText',
  'question',
  'deadline',
  'criteriaKept',
  'criteriaBroken',
  'checkSource',
] as const;
export function useAnswerReveal(response: DraftResponse | null) {
  const [characters, setCharacters] = useState(0);
  const [complete, setComplete] = useState(false);
  const edited = useRef(false);
  const values = [
    response?.decision === 'reject' ? response.explanation : '',
    ...fields.map((key) =>
      ['question', 'checkSource'].includes(key)
        ? ''
        : (response?.draft?.[key] ?? ''),
    ),
  ];
  const total = values.reduce((sum, text) => sum + text.length, 0);
  useEffect(() => {
    if (!response) {
      edited.current = false;
      return;
    }
    if (edited.current) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      const timer = window.setTimeout(() => setComplete(true), 0);
      return () => window.clearTimeout(timer);
    }
    let shown = 0;
    const resetTimer = window.setTimeout(() => {
      setCharacters(0);
      setComplete(false);
    }, 0);
    const timer = window.setInterval(() => {
      shown = Math.min(total, shown + 2);
      setCharacters(shown);
      if (shown >= total) {
        setComplete(true);
        window.clearInterval(timer);
      }
    }, 35);
    const reduceMotion = () => {
      if (media.matches) {
        setComplete(true);
        window.clearInterval(timer);
      }
    };
    media.addEventListener('change', reduceMotion);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearInterval(timer);
      media.removeEventListener('change', reduceMotion);
    };
  }, [response, total]);
  function finish() {
    edited.current = true;
    flushSync(() => setComplete(true));
  }
  function text(index: number) {
    if (index === 3) return response?.draft?.question ?? '';
    if (index === 7) return response?.draft?.checkSource ?? '';
    if (complete) return values[index];
    const start = values
      .slice(0, index)
      .reduce((sum, value) => sum + value.length, 0);
    const remaining = Math.max(0, characters - start);
    // Date inputs only accept complete dates.
    return index === 4
      ? remaining >= values[index].length
        ? values[index]
        : ''
      : values[index].slice(0, remaining);
  }
  return { text, finish, complete };
}
