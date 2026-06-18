import { useState } from "react";
import { X, Lock, Loader2, CheckCircle } from "lucide-react";
import { useChangePassword } from "@/hooks/useAuthActions";

/** Change the current user's password (POST /auth/change-password). */
export default function ChangePasswordModal({ onClose }) {
  const changePassword = useChangePassword();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.newPassword !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err?.message || "Failed to change password");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Lock size={16} className="text-indigo-600" /> Change password</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {done ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle size={40} className="text-emerald-500" />
            <p className="text-sm font-medium text-slate-700">Password changed</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current password</label>
              <input required type="password" value={form.currentPassword} onChange={(e) => set("currentPassword", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">New password</label>
              <input required type="password" value={form.newPassword} onChange={(e) => set("newPassword", e.target.value)}
                placeholder="Min. 8 chars, 1 letter + 1 digit"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm</label>
              <input required type="password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <button type="submit" disabled={changePassword.isPending}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {changePassword.isPending && <Loader2 size={14} className="animate-spin" />}
              Change
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
