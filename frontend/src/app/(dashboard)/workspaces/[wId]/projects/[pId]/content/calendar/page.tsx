'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken, apiFetch } from '@/shared/utils/api';
import { fetchContent, type ContentPiece } from '@/features/content/services/content.service';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-600 text-zinc-200',
  review: 'bg-yellow-600/80 text-yellow-100',
  approved: 'bg-green-600/80 text-green-100',
  published: 'bg-blue-600/80 text-blue-100',
};

function scheduleContent(projectId: string, id: string, date: string | null) {
  return apiFetch<ContentPiece>(`/projects/${projectId}/content/${id}/schedule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledPublishAt: date }),
  });
}

export default function CalendarPage() {
  const params = useParams();
  const projectId = params.pId as string;
  const { getToken } = useAuth();

  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [scheduling, setScheduling] = useState<{ piece: ContentPiece; date: string } | null>(null);

  useEffect(() => { loadData(); }, [projectId]);

  async function loadData() {
    setLoading(true);
    try {
      setAuthToken(await getToken());
      setPieces(await fetchContent(projectId));
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSchedule(pieceId: string, date: string | null) {
    try {
      setAuthToken(await getToken());
      const updated = await scheduleContent(projectId, pieceId, date);
      setPieces((prev) => prev.map((p) => (p.id === pieceId ? { ...p, ...updated } : p)));
    } catch (err) {
      console.error('Failed to schedule:', err);
    }
    setScheduling(null);
  }

  // Build day → pieces map for the current month
  const calendarMap = useMemo(() => {
    const map: Record<number, ContentPiece[]> = {};
    for (const piece of pieces) {
      const dateStr = piece.scheduledPublishAt ?? piece.updatedAt;
      const d = new Date(dateStr);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(piece);
      }
    }
    return map;
  }, [pieces, year, month]);

  // Unscheduled approved/published pieces
  const unscheduled = pieces.filter((p) => !p.scheduledPublishAt && (p.status === 'approved' || p.status === 'draft'));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' });

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Content Calendar</h1>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700">←</button>
          <span className="text-sm font-semibold text-zinc-100 w-36 text-center">{monthName} {year}</span>
          <button onClick={nextMonth} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700">→</button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-zinc-700">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {/* Empty cells before month starts */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-zinc-800" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayPieces = calendarMap[day] ?? [];
            const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
            const col = (firstDayOfWeek + i) % 7;

            return (
              <div
                key={day}
                className={`min-h-[80px] border-b border-zinc-800 p-1.5 ${col < 6 ? 'border-r' : ''} ${isToday ? 'bg-zinc-800/60' : ''}`}
              >
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-zinc-400'}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayPieces.map((p) => (
                    <div
                      key={p.id}
                      title={p.title}
                      className={`rounded px-1 py-0.5 text-[10px] truncate cursor-default ${STATUS_COLORS[p.status]}`}
                    >
                      {p.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled queue */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">
          Schedule Queue <span className="text-zinc-500 font-normal">— drag or click to assign a publish date</span>
        </h2>
        {unscheduled.length === 0 ? (
          <p className="text-sm text-zinc-500">All content is scheduled.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unscheduled.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">{p.title}</p>
                  <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                </div>
                <button
                  onClick={() => setScheduling({ piece: p, date: '' })}
                  className="shrink-0 rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500"
                >
                  Schedule
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule modal */}
      {scheduling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setScheduling(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white">Schedule Publish Date</h3>
            <p className="text-xs text-zinc-400 truncate">{scheduling.piece.title}</p>
            <input
              type="date"
              value={scheduling.date}
              onChange={(e) => setScheduling((s) => s ? { ...s, date: e.target.value } : s)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <div className="flex gap-2">
              <button
                disabled={!scheduling.date}
                onClick={() => handleSchedule(scheduling.piece.id, scheduling.date ? new Date(scheduling.date).toISOString() : null)}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Confirm
              </button>
              <button onClick={() => setScheduling(null)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
