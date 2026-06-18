import React from "react";

/**
 * FR : Mise en page commune des écrans d'authentification (Login, mot de passe
 *      oublié, réinitialisation). Reprend le thème du CRM : fond slate-50,
 *      carte blanche arrondie et badge d'icône indigo.
 * EN : Shared layout for the authentication screens (Login, Forgot/Reset
 *      password). Matches the CRM theme: slate-50 background, white rounded
 *      card and an indigo icon badge.
 */
export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-900/20 mb-4">
            <Icon className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-slate-400 mt-2">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-slate-400 mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
