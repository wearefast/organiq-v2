'use client';

import { useState, useEffect } from 'react';
import {
  getScheduledWorkflows,
  createScheduledWorkflow,
  updateScheduledWorkflow,
  deleteScheduledWorkflow,
  type ScheduledWorkflow,
  type CreateWorkflowPayload,
} from '../services/scheduled-workflows.service';

interface WorkflowBuilderProps {
  projectId: string;
}

const TEMPLATES: Array<CreateWorkflowPayload & { description: string }> = [
  {
    name: 'Weekly AI Search Summary',
    agentType: 'ai-search-visibility',
    prompt: 'Provide a weekly summary of my AI search visibility performance.',
    scheduleCron: '0 9 * * 1',
    deliveryChannel: 'email',
    deliveryTarget: '',
    description: 'Every Monday at 9am',
  },
  {
    name: 'Monthly Content Refresh Report',
    agentType: 'content-refresh',
    prompt: 'Which pages need to be refreshed this month?',
    scheduleCron: '0 9 1 * *',
    deliveryChannel: 'email',
    deliveryTarget: '',
    description: '1st of every month',
  },
  {
    name: 'Weekly Keyword Decay Alert',
    agentType: 'keyword-decay',
    prompt: 'Which keywords declined this week?',
    scheduleCron: '0 9 * * 5',
    deliveryChannel: 'slack',
    deliveryTarget: '',
    description: 'Every Friday at 9am',
  },
  {
    name: 'Technical Issues Digest',
    agentType: 'technical-issues',
    prompt: 'What are the most critical technical issues right now?',
    scheduleCron: '0 9 * * 1',
    deliveryChannel: 'email',
    deliveryTarget: '',
    description: 'Every Monday at 9am',
  },
  {
    name: 'New Content Opportunities',
    agentType: 'keyword-opportunity',
    prompt: 'What content should I write next?',
    scheduleCron: '0 9 1,15 * *',
    deliveryChannel: 'email',
    deliveryTarget: '',
    description: 'Every 2 weeks',
  },
];

export function WorkflowBuilder({ projectId }: WorkflowBuilderProps) {
  const [workflows, setWorkflows] = useState<ScheduledWorkflow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateWorkflowPayload>({
    name: '',
    agentType: 'content-refresh',
    prompt: '',
    scheduleCron: '0 9 * * 1',
    deliveryChannel: 'email',
    deliveryTarget: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, [projectId]);

  async function loadWorkflows() {
    const data = await getScheduledWorkflows(projectId);
    setWorkflows(data);
  }

  async function handleCreate() {
    if (!form.name || !form.prompt || !form.deliveryTarget) return;
    setSaving(true);
    try {
      await createScheduledWorkflow(projectId, form);
      setShowForm(false);
      setForm({ name: '', agentType: 'content-refresh', prompt: '', scheduleCron: '0 9 * * 1', deliveryChannel: 'email', deliveryTarget: '' });
      await loadWorkflows();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(workflow: ScheduledWorkflow) {
    await updateScheduledWorkflow(projectId, workflow.id, { isActive: !workflow.isActive });
    await loadWorkflows();
  }

  async function handleDelete(workflowId: string) {
    if (!confirm('Delete this scheduled workflow?')) return;
    await deleteScheduledWorkflow(projectId, workflowId);
    await loadWorkflows();
  }

  function useTemplate(template: CreateWorkflowPayload & { description: string }) {
    setForm({
      name: template.name,
      agentType: template.agentType,
      prompt: template.prompt,
      scheduleCron: template.scheduleCron,
      deliveryChannel: template.deliveryChannel,
      deliveryTarget: '',
    });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Scheduled Workflows</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          + New Workflow
        </button>
      </div>

      {/* Templates */}
      {!showForm && workflows.length === 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-3">Quick-start with a template:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => useTemplate(t)}
                className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="font-medium text-sm text-gray-800">{t.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <input
            type="text"
            placeholder="Workflow name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <select
            value={form.agentType}
            onChange={(e) => setForm({ ...form, agentType: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="content-refresh">Content Refresh Analyzer</option>
            <option value="ai-search-visibility">AI Search Visibility Auditor</option>
            <option value="technical-issues">Technical Issues Summarizer</option>
            <option value="keyword-opportunity">Keyword Opportunity Finder</option>
            <option value="google-vs-ai">Google vs AI Comparator</option>
            <option value="keyword-decay">Keyword Decay Monitor</option>
            <option value="competitor-analysis">Competitor Analysis</option>
          </select>
          <textarea
            placeholder="Prompt for the agent"
            value={form.prompt}
            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Cron expression (e.g. 0 9 * * 1)"
              value={form.scheduleCron}
              onChange={(e) => setForm({ ...form, scheduleCron: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <select
              value={form.deliveryChannel}
              onChange={(e) => setForm({ ...form, deliveryChannel: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="email">Email</option>
              <option value="slack">Slack</option>
            </select>
          </div>
          <input
            type="text"
            placeholder={form.deliveryChannel === 'slack' ? 'Slack webhook URL' : 'Email address'}
            value={form.deliveryTarget}
            onChange={(e) => setForm({ ...form, deliveryTarget: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.name || !form.prompt || !form.deliveryTarget}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Workflow'}
            </button>
          </div>
        </div>
      )}

      {/* Workflows list */}
      {workflows.length > 0 && (
        <div className="space-y-2">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3"
            >
              <div>
                <div className="font-medium text-sm text-gray-800">{wf.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {wf.agentType} · {wf.deliveryChannel} · Next: {wf.nextRunAt ? new Date(wf.nextRunAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(wf)}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    wf.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {wf.isActive ? 'Active' : 'Paused'}
                </button>
                <button
                  onClick={() => handleDelete(wf.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
