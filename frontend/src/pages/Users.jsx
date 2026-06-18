import { useState, useMemo } from "react";
import { Search, Plus, Edit3, Trash2, UserCheck, UserX, ShieldCheck } from "lucide-react";
import { useUsers, useSetUserActive, useDeleteUser } from "@/hooks/useUsers";
import { useAuth } from "@/lib/AuthContext";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useConfirm } from "@/hooks/useConfirm";
import UserFormModal from "@/components/users/UserFormModal";

const ROLE_BADGE = {
  super_admin: "bg-purple-100 text-purple-700",
  admin: "bg-indigo-100 text-indigo-700",
  manager: "bg-blue-100 text-blue-700",
  finance: "bg-emerald-100 text-emerald-700",
  agent: "bg-amber-100 text-amber-700",
};

function fmtDate(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const { data: users = [], isLoading, isError, error, refetch } = useUsers();
  const setActive = useSetUserActive();
  const deleteUser = useDeleteUser();
  const { confirm, dialog } = useConfirm();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q),
    );
  }, [users, search]);

  const isSelf = (u) => currentUser && String(currentUser.id) === String(u.id);

  const handleDelete = async (u) => {
    if (isSelf(u)) return;
    const ok = await confirm({
      title: "Delete user",
      message: `Delete user ${u.fullName}? This cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete",
    });
    if (ok) deleteUser.mutate(u.id);
  };

  if (isLoading) return <LoadingState label="Loading users…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} title="Could not load users" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Users</h2>
          <p className="text-sm text-slate-400">{filtered.length} account(s) · access & role management</p>
        </div>
        <button onClick={() => { setEditUser(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 shadow-sm w-fit">
          <Plus size={15} /> New user
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">User</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Phone</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Roles</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Last login</th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><EmptyState title="No users" /></td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(u.fullName || "U").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 leading-tight">{u.fullName}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{u.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles || []).map((r) => (
                        <span key={r} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[r] || "bg-slate-100 text-slate-600"}`}>
                          <ShieldCheck size={10} /> {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => { setEditUser(u); setShowForm(true); }} title="Edit"
                        className="p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600">
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => setActive.mutate({ id: u.id, isActive: !u.isActive })}
                        disabled={isSelf(u)} title={u.isActive ? "Deactivate" : "Activate"}
                        className="p-1.5 rounded-lg hover:bg-amber-100 text-slate-400 hover:text-amber-600 disabled:opacity-30">
                        {u.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                      </button>
                      <button onClick={() => handleDelete(u)} disabled={isSelf(u)} title="Delete"
                        className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-500 disabled:opacity-30">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <UserFormModal user={editUser} onClose={() => { setShowForm(false); setEditUser(null); }} />
      )}
      {dialog}
    </div>
  );
}
