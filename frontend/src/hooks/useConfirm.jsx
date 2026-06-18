import { useCallback, useState } from "react";
import ConfirmModal from "@/components/feedback/ConfirmModal";

/**
 * FR : Remplaçant basé sur des promesses de window.confirm / window.alert, rendu
 *      sous forme de modal in-app.
 * EN : Promise-based replacement for window.confirm / window.alert, rendered as
 *      an in-app modal.
 *
 *   const { confirm, alert, dialog } = useConfirm();
 *   if (await confirm({ title, message, variant: "danger", confirmLabel: "Delete" })) { … }
 *   await alert("Something went wrong");           // or alert({ title, message })
 *   return (<>… {dialog}</>);   // render the modal element somewhere
 */
export function useConfirm() {
  const [state, setState] = useState(null);

  const open = useCallback(
    (opts) => new Promise((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const confirm = useCallback((opts) => open({ mode: "confirm", ...opts }), [open]);

  const alert = useCallback(
    (opts) => open({ mode: "alert", variant: "danger", ...(typeof opts === "string" ? { message: opts } : opts) }),
    [open],
  );

  const close = (result) => {
    setState((s) => {
      if (s) s.resolve(result);
      return null;
    });
  };

  const dialog = state ? (
    <ConfirmModal {...state} onConfirm={() => close(true)} onCancel={() => close(false)} />
  ) : null;

  return { confirm, alert, dialog };
}

export default useConfirm;
