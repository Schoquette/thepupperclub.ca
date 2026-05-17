import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import MemberSafetyMenu from '@/components/MemberSafetyMenu';

interface ChatMessage {
  id: number;
  sender_id: number;
  is_self: boolean;
  body: string;
  created_at: string | null;
  read_at?: string | null;
}

interface ThreadResponse {
  conversation: { id: number; other_id: number; other_name: string };
  messages: ChatMessage[];
}

export default function ConversationPage() {
  const { otherId } = useParams<{ otherId: string }>();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [data, setData] = useState<ThreadResponse | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setError('');
    try {
      const res = await api.get<ThreadResponse>(`/community/conversations/${otherId}`);
      setData(res.data);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: any) {
      if (err.response?.status === 404) {
        navigate('/messages', { replace: true });
        return;
      }
      setError(err.response?.data?.message ?? 'Couldn’t open this conversation.');
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [otherId]);

  // Light polling so incoming messages appear within a few seconds.
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherId]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !otherId) return;
    setSending(true);
    setError('');
    try {
      const res = await api.post<{ data: ChatMessage }>(
        `/community/conversations/${otherId}/messages`,
        { body: text.trim() },
      );
      setData((prev) => prev ? { ...prev, messages: [...prev.messages, res.data.data] } : prev);
      setText('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Couldn’t send that message.');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(e as unknown as FormEvent);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-8 py-8">
      <header className="max-w-2xl mx-auto w-full flex items-center justify-between mb-6">
        <Link to="/messages" className="label-caps text-taupe hover:text-espresso">
          &larr; Messages
        </Link>
        <button onClick={signOut} className="label-caps text-taupe hover:text-espresso">Sign Out</button>
      </header>

      <main className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        {!data ? (
          <p className="text-sm text-taupe text-center py-12">Loading...</p>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="label-caps text-blue">Conversation with</p>
                <h1 className="font-display text-2xl text-espresso">{data.conversation.other_name}</h1>
              </div>
              <MemberSafetyMenu
                memberId={data.conversation.other_id}
                memberName={data.conversation.other_name}
                onBlocked={() => navigate('/messages', { replace: true })}
              />
            </div>

            {/* Gentle persistent first-meeting reminder. Per the spec. */}
            <div className="bg-blue/8 border border-blue/20 rounded-xl px-4 py-3 text-sm text-espresso/90 mb-6 leading-relaxed">
              <span className="font-semibold">First time meeting in person?</span> We recommend
              somewhere public &mdash; a park, a café, the lobby of your building.
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
              {data.messages.length === 0 ? (
                <p className="text-sm text-taupe italic text-center py-12">
                  Say hi to {data.conversation.other_name.split(' ')[0]}.
                </p>
              ) : (
                data.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.is_self ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.is_self
                          ? 'bg-blue text-white rounded-br-sm'
                          : 'bg-white border border-cream text-espresso rounded-bl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          m.is_self ? 'text-white/70 text-right' : 'text-taupe'
                        }`}
                      >
                        {m.created_at ? format(new Date(m.created_at), 'h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="bg-white border border-taupe/30 rounded-xl flex items-center gap-2 p-2">
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type a message..."
                className="flex-1 resize-none border-0 focus:outline-none text-sm text-espresso placeholder-taupe px-3 py-2"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="btn-blue disabled:opacity-50"
                style={{ padding: '8px 18px', fontSize: 12 }}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
