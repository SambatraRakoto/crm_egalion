import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useRoles, useCreateUser, useUpdateUser, useSetUserRoles } from "@/hooks/useUsers";

/**
 * Create or edit a user. Create → POST /auth/register (admin). Edit → PUT /users/:id
 * for the profile plus PATCH /users/:id/roles when the role selection changes.
 */
export default function UserFormModal({ user, onClose }) {
  const isEdit = !!user;
  const { data: roles = [] } = useRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const setUserRoles = useSetUserRoles();

  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    password: "",
    roles: user?.roles || [],
  });
  const [error, setError] = useState("");

  const saving = createUser.isPending || updateUser.isPending || setUserRoles.isPending;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleRole = (slug) =>
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(slug) ? f.roles.filter((r) => r !== slug) : [...f.roles, slug],
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isEdit) {
        await updateUser.mutateAsync({ id: user.id, payload: { fullName: form.fullName, phone: form.phone } });
        const before = [...(user.roles || [])].sort().join(",");
        const after = [...form.roles].sort().join(",");
        if (form.roles.length && before !== after) {
          await setUserRoles.mutateAsync({ id: user.id, roles: form.roles });
        }
      } else {
        await createUser.mutateAsync({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          roles: form.roles.length ? form.roles : undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to save");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md z-10 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">{isEdit ? "Edit user" : "New user"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full name <span className="text-rose-500">*</span></label>
              <input required value={form.fullName} onChange={(e) => set("fullName", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email <span className="text-rose-500">*</span></label>
              <input required type="email" value={form.email} disabled={isEdit}
                onChange={(e) => set("email", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-400" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)}
                placeholder="+233…"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>

            {!isEdit && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password <span className="text-rose-500">*</span></label>
                <input required type="password" value={form.password} onChange={(e) => set("password", e.target.value)}
                  placeholder="Min. 8 chars, 1 letter + 1 digit"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Roles</label>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <button type="button" key={r.slug} onClick={() => toggleRole(r.slug)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      form.roles.includes(r.slug)
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}>
                    {r.name || r.slug}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 px-5 py-4 border-t border-slate-100">
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {isEdit ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
