const fs=require('fs');
const p='C:/Code/Pulse/frontend/src/features/workflow/components/artifact-panel.tsx';
let c=fs.readFileSync(p,'utf8');
// Remove onRevise and onReject from interface
c=c.replace('  onApprove: (stepKey: string, notes?: string) => void;\n  onRevise: (stepKey: string, notes: string) => void;\n  onReject: (stepKey: string, notes: string) => void;','  onApprove: (stepKey: string) => void;');
// Remove from destructuring
c=c.replace('  onApprove,\n  onRevise,\n  onReject,\n  onRerun,','  onApprove,\n  onRerun,');
// Remove notes/showNotes state
c=c.replace("  const [notes, setNotes] = useState('');\n",'');
c=c.replace('  const [showNotes, setShowNotes] = useState(false);\n','');
const oldFooterContent=`          {showNotes && (
            <div className="mb-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for this decision..."
                className="input min-h-[60px] resize-y"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowNotes((prev) => !prev)}
              className="btn-ghost text-[12px]"
            >
              {showNotes ? 'Hide notes' : 'Add notes'}
            </button>

            <div className="flex items-center gap-2">
              {showRerunButton && (
                <button
                  type="button"
                  onClick={() => setRerunConfirm(true)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                    'border border-blue-500/30 text-blue-400 hover:bg-blue-500/10',
                  )}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-run
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!notes.trim()) {
                    setShowNotes(true);
                    return;
                  }
                  onReject(step.stepKey, notes);
                  setNotes('');
                  setShowNotes(false);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  'border border-red-500/30 text-red-400 hover:bg-red-500/10',
                )}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!notes.trim()) {
                    setShowNotes(true);
                    return;
                  }
                  onRevise(step.stepKey, notes);
                  setNotes('');
                  setShowNotes(false);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  'border border-orange-500/30 text-orange-400 hover:bg-orange-500/10',
                )}
              >
                Revise
              </button>
              <button
                type="button"
                onClick={() => {
                  onApprove(step.stepKey, notes || undefined);
                  setNotes('');
                  setShowNotes(false);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  'bg-emerald-600 text-white hover:bg-emerald-700',
                )}
              >
                Approve
              </button>
            </div>
          </div>`;
const newFooterContent=`          <div className="flex items-center justify-end gap-2">
            {showRerunButton && (
              <button
                type="button"
                onClick={() => setRerunConfirm(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  'border border-blue-500/30 text-blue-400 hover:bg-blue-500/10',
                )}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-run
              </button>
            )}
            <button
              type="button"
              onClick={() => onApprove(step.stepKey)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                'bg-emerald-600 text-white hover:bg-emerald-700',
              )}
            >
              Approve
            </button>
          </div>`;
c=c.replace(oldFooterContent,newFooterContent);
fs.writeFileSync(p,c,'utf8');
console.log('Done. Length:',c.length);
