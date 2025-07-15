import { ReactNode } from "react";

interface ConfirmationPopupProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

export default function ConfirmationPopup({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = "Yes",
  cancelText = "No",
  confirmButtonClass = "danger",
}: ConfirmationPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="confirmation-popup-overlay">
      <div className="confirmation-popup">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="popup-actions">
          <button
            onClick={onCancel}
            className="cancel"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={confirmButtonClass}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}