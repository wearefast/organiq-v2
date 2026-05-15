'use client';


import { useUser, useOrganization } from '@clerk/nextjs';
import {
  Settings,
  User,
  Building2,
  Shield,
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useUser();
  const { organization } = useOrganization();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-zinc-400" />
        <h1 className="text-2xl font-bold text-white">Settings</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300">Profile</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Name</p>
              <p className="text-sm text-white">{user?.fullName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Email</p>
              <p className="text-sm text-white">{user?.primaryEmailAddress?.emailAddress ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">User ID</p>
              <p className="text-xs font-mono text-zinc-400">{user?.id ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Organization */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300">Organization</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Organization Name</p>
              <p className="text-sm text-white">{organization?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Organization ID</p>
              <p className="text-xs font-mono text-zinc-400">{organization?.id ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Members</p>
              <p className="text-sm text-white">{organization?.membersCount ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300">Security</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Authentication</p>
              <p className="text-sm text-white">Clerk SSO</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Session</p>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-sm text-emerald-400">Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div className="col-span-full rounded-xl border border-zinc-700 bg-zinc-800/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Settings className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300">API Configuration</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-zinc-500">API Endpoint</p>
              <p className="text-xs font-mono text-zinc-400">
                {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Environment</p>
              <p className="text-sm text-zinc-300">
                {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Version</p>
              <p className="text-sm text-zinc-300">ORGANIQ v1.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
