'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { Button, Modal } from '@/components/ui';
import type { StartInterviewResponse } from '@shared/interview';
import { endInterview } from '@/lib/api/interviews';
import { STICKY_UNDER_MOBILE_BAR } from '@/lib/ui/mobile';
import { LiveTranscript, type TranscriptLine } from './LiveTranscript';
import { VoiceOrb, type OrbMode } from './VoiceOrb';

const TARGET_SECONDS = 20 * 60;

function mmss(total: number): string {
  const s = Math.max(0, Math.floor(total));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

interface LiveProps {
  session: StartInterviewResponse;
  firstName: string;
  /** The voice session ended (by the member, the interviewer, or a dropped connection). */
  onEnded: (error?: string) => void;
}

// useConversation must sit inside a ConversationProvider (SDK requirement).
export function InterviewLive(props: LiveProps) {
  return (
    <ConversationProvider>
      <LiveCall {...props} />
    </ConversationProvider>
  );
}

function LiveCall({ session, firstName, onEnded }: LiveProps) {
  const [turns, setTurns] = useState<TranscriptLine[]>([]);
  const [muted, setMuted] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const started = useRef(false);
  const nextId = useRef(0);
  const connectionError = useRef<string | null>(null);

  const conversation = useConversation({
    micMuted: muted,
    // The interviewer's reply streams in parts while it's spoken: show it live, final on "stop".
    onAgentChatResponsePart: (part) => {
      setTurns((prev) => {
        const last = prev.at(-1);
        if (part.type === 'start' || !last || last.role !== 'agent' || last.final)
          return part.type === 'stop' && !part.text
            ? prev
            : [...prev, { id: `a${nextId.current++}`, role: 'agent', text: part.text, final: part.type === 'stop' }];
        return [...prev.slice(0, -1), { ...last, text: last.text + part.text, final: part.type === 'stop' }];
      });
    },
    // Final transcripts: the member's speech, and the agent's full text (replaces the streamed one).
    onMessage: ({ message, role }) => {
      if (!message.trim()) return;
      setTurns((prev) => {
        const last = prev.at(-1);
        if (role === 'agent' && last?.role === 'agent')
          return [...prev.slice(0, -1), { ...last, text: message, final: true }];
        return [...prev, { id: `${role[0]}${nextId.current++}`, role, text: message, final: true }];
      });
    },
    onError: (message) => {
      connectionError.current = message;
      setFailed('The connection had a problem.');
    },
    onDisconnect: (details) =>
      onEnded(details.reason === 'error' ? details.message : (connectionError.current ?? undefined)),
  });

  // React replays effects in development. Defer the SDK start until after that replay;
  // its provider closes pending calls during the temporary cleanup.
  const { startSession } = conversation;
  useEffect(() => {
    if (started.current) return;
    const timer = window.setTimeout(() => {
      started.current = true;
      try {
        startSession({
          conversationToken: session.conversationToken,
          connectionType: 'webrtc',
          dynamicVariables: { session_token: session.sessionToken, first_name: firstName },
          customLlmExtraBody: { sessionToken: session.sessionToken },
        });
      } catch {
        setFailed('We couldn’t connect to the interviewer.');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [startSession, session, firstName]);

  // Timer, plus a client-side hard stop just after the server's budget.
  const connected = conversation.status === 'connected';
  const { endSession } = conversation;
  useEffect(() => {
    if (!connected) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setElapsed(s);
      if (s > session.maxSeconds + 30) endSession();
    }, 1000);
    return () => clearInterval(id);
  }, [connected, endSession, session.maxSeconds]);

  const mode: OrbMode = !connected ? 'connecting' : conversation.isSpeaking ? 'agent' : 'listening';
  const { isSpeaking, getInputVolume, getOutputVolume } = conversation;
  const level = useCallback(
    () => (isSpeaking ? getOutputVolume() : getInputVolume()),
    [isSpeaking, getInputVolume, getOutputVolume]
  );
  const statusText =
    mode === 'connecting' ? 'Connecting…' : mode === 'agent' ? 'Interviewer is speaking' : 'Listening…';
  const timer = `${mmss(elapsed)} / ${mmss(TARGET_SECONDS)}`;

  async function endNow() {
    setEnding(true);
    setConfirmEnd(false);
    try {
      await endInterview();
    } catch {
      // The session still ends below; the server finalises an interview whose call stopped.
    } finally {
      endSession();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
      {/* Below lg: one compact bar pinned under the mobile top bar. */}
      <div
        className={`sticky ${STICKY_UNDER_MOBILE_BAR} z-10 -mx-8 flex items-center gap-3 border-b border-line bg-bg px-8 py-3 max-[720px]:-mx-5 max-[720px]:px-5 lg:hidden`}
      >
        <VoiceOrb mode={mode} level={level} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{statusText}</p>
          <p className="text-caption text-ink-3 tabular-nums">{timer}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          className="min-h-[44px]"
        >
          {muted ? 'Unmute' : 'Mute'}
        </Button>
        <Button size="sm" onClick={() => setConfirmEnd(true)} disabled={ending} className="min-h-[44px]">
          End
        </Button>
      </div>

      {/* lg+: the orb column. */}
      <div className="hidden flex-col items-center justify-center lg:flex">
        <VoiceOrb mode={mode} level={level} />
        <p className="mt-8 text-title text-ink">{statusText}</p>
        <p className="mt-1 text-sm text-ink-3 tabular-nums">{timer}</p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>
            {muted ? 'Unmute' : 'Mute'}
          </Button>
          <Button onClick={() => setConfirmEnd(true)} disabled={ending}>
            End interview
          </Button>
        </div>
        <p className="mt-6 max-w-[320px] text-center text-caption text-ink-3">
          Speak naturally. You can interrupt the interviewer at any time.
        </p>
      </div>

      <div className="h-[calc(100dvh-220px)] min-h-[360px] rounded-2xl border border-line bg-bg-card lg:h-[min(70vh,720px)]">
        <LiveTranscript turns={turns} />
      </div>

      {failed && (
        <p role="alert" className="text-sm text-error lg:col-span-2">
          {failed} If the call dropped, you can reconnect from this page within 24 hours.
        </p>
      )}

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End the interview?">
        <p className="text-ink-3">
          You can only take the interview once. Ending now finishes it, and we’ll prepare your drafts from what we
          covered.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
            Keep going
          </Button>
          <Button onClick={() => void endNow()}>End interview</Button>
        </div>
      </Modal>
    </div>
  );
}
