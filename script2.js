const fs=require('fs');
const p='C:/Code/Pulse/frontend/src/features/workflow/components/workflow-shell.tsx';
let c=fs.readFileSync(p,'utf8');
// Remove handleRevise callback
c=c.replace(/\s+const handleRevise = useCallback\(\s+async[^}]+\}\s+\},\s+\[runId, fetchRun\],\s+\);/,'');
// Remove handleReject callback  
c=c.replace(/\s+const handleReject = useCallback\(\s+async[^}]+\}\s+\},\s+\[runId, fetchRun\],\s+\);/,'');
// Remove onRevise and onReject props from ArtifactPanel JSX
c=c.replace('          onRevise={handleRevise}\n','');
c=c.replace('          onReject={handleReject}\n','');
// Fix handleApprove signature - remove notes param
c=c.replace('async (stepKey: string, notes?: string) => {', 'async (stepKey: string) => {');
c=c.replace('await workflowApi.approveStep(runId, stepKey, notes);','await workflowApi.approveStep(runId, stepKey);');
fs.writeFileSync(p,c,'utf8');
console.log('Done. Length:',c.length);
