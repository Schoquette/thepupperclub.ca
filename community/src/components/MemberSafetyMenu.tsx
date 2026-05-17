import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';

type ReportCategory =
  | 'uncomfortable'
  | 'harassment'
  | 'spam_or_scam'
  | 'animal_safety'
  | 'other';

const REPORT_OPTIONS: { value: ReportCategory; label: string }[] = [
  { value: 'uncomfortable', label: 'Someone making me uncomfortable' },
  { value: 'harassment',    label: 'Harassment or hostile behaviour' },
  { value: 'spam_or_scam',  label: 'Spam or scam' },
  { value: 'animal_safety', label: 'Concern for an animal’s safety' },
  { value: 'other',         label: 'Something else' },
];

interface Props {
  memberId: number;
  memberName: string;
  /** Called after a block — parent can navigate away. */
  onBlocked?: () => void;
}

export default function MemberSafetyMenu({ memberId, memberName, onBlocked }: Props) {
  const [open, setOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-taupe hover:text-espresso px-2 py-1 text-lg leading-none"
        aria-label="More"
      >
        &middot;&middot;&middot;
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-taupe/30 rounded-lg shadow-lg z-10 overflow-hidden">
          <button
            onClick={() => { setOpen(false); setShowReport(true); }}
            className="block w-full text-left px-4 py-2.5 text-sm text-espresso hover:bg-cream"
          >
            Report
          </button>
          <button
            onClick={() => { setOpen(false); setShowBlock(true); }}
            className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-cream"
          >
            Block
          </button>
        </div>
      )}

      {showReport && (
        <ReportModal
          memberId={memberId}
          memberName={memberName}
          onClose={() => setShowReport(false)}
        />
      )}
      {showBlock && (
        <BlockModal
          memberId={memberId}
          memberName={memberName}
          onClose={() => setShowBlock(false)}
          onBlocked={() => { setShowBlock(false); onBlocked?.(); }}
        />
      )}
    </div>
  );
}

function ReportModal({
  memberId, memberName, onClose,
}: { memberId: number; memberName: string; onClose: () => void }) {
  const [category, setCategory] = useState<ReportCategory>('uncomfortable');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const send = async () => {
    setSending(true);
    setErr('');
    try {
      await api.post('/community/reports', {
        member_id: memberId,
        category,
        details: details.trim() || null,
      });
      setDone(true);
    } catch (e: any) {
      setErr(e.response?.data?.message ?? 'Couldn’t send that report.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-7" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <p className="label-caps text-blue mb-3">Report sent</p>
            <h2 className="font-display text-xl text-espresso mb-3">Thanks for letting us know.</h2>
            <p className="text-sm text-espresso/80 leading-relaxed mb-6">
              A moderator will review this within a day. If anything urgent
              is happening right now, please reach out to local authorities
              directly.
            </p>
            <div className="text-right">
              <button onClick={onClose} className="btn-blue">Done</button>
            </div>
          </>
        ) : (
          <>
            <p className="label-caps text-blue mb-3">Report {memberName}</p>
            <h2 className="font-display text-xl text-espresso mb-4">What happened?</h2>
            <div className="space-y-2 mb-5">
              {REPORT_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    value={o.value}
                    checked={category === o.value}
                    onChange={() => setCategory(o.value)}
                    className="text-blue focus:ring-blue"
                  />
                  <span className="text-sm text-espresso">{o.label}</span>
                </label>
              ))}
            </div>

            <label className="field-label" htmlFor="details">Anything else? (optional)</label>
            <textarea
              id="details"
              rows={4}
              maxLength={2000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="field-input resize-none mb-2"
            />
            <p className="text-xs text-taupe mb-4 leading-relaxed">
              Only the moderation team sees this. The person you&rsquo;re
              reporting is never told.
            </p>

            {err && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{err}</div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button onClick={onClose} className="label-caps text-taupe hover:text-espresso px-3">Cancel</button>
              <button onClick={send} disabled={sending} className="btn-blue disabled:opacity-60">
                {sending ? 'Sending...' : 'Send Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BlockModal({
  memberId, memberName, onClose, onBlocked,
}: { memberId: number; memberName: string; onClose: () => void; onBlocked: () => void }) {
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState('');

  const confirm = async () => {
    setWorking(true);
    setErr('');
    try {
      await api.post('/community/blocks', {
        member_id: memberId,
        reason: reason.trim() || null,
      });
      onBlocked();
    } catch (e: any) {
      setErr(e.response?.data?.message ?? 'Couldn’t block that neighbour.');
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-7" onClick={(e) => e.stopPropagation()}>
        <p className="label-caps text-red-600 mb-3">Block {memberName}</p>
        <h2 className="font-display text-xl text-espresso mb-3">This is silent and immediate.</h2>
        <p className="text-sm text-espresso/80 leading-relaxed mb-5">
          They won&rsquo;t be told you blocked them. They&rsquo;ll just stop
          appearing in your discovery, network, and messages &mdash; and you
          won&rsquo;t appear in theirs.
        </p>

        <label className="field-label" htmlFor="reason">Note for yourself (optional)</label>
        <textarea
          id="reason"
          rows={2}
          maxLength={280}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Only you can see this — it helps you remember why later."
          className="field-input resize-none mb-4"
        />

        {err && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{err}</div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="label-caps text-taupe hover:text-espresso px-3">Cancel</button>
          <button onClick={confirm} disabled={working} className="btn-blue disabled:opacity-60">
            {working ? 'Blocking...' : 'Block'}
          </button>
        </div>
      </div>
    </div>
  );
}
