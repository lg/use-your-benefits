import React from 'react';
import { Benefit } from '../types';

interface EditModalProps {
  benefit: Benefit | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: { currentUsed: number; notes: string }) => void;
}

export function EditModal({ benefit, isOpen, onClose, onSave }: EditModalProps) {
  const [used, setUsed] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (benefit) {
      setUsed(benefit.currentUsed.toString());
      setNotes(benefit.notes);
    }
  }, [benefit]);

  if (!isOpen || !benefit) return null;

  const usedInputId = `benefit-used-${benefit.id}`;
  const notesInputId = `benefit-notes-${benefit.id}`;

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleOverlayKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  };

  const handleSave = () => {
    const usedValue = parseFloat(used) || 0;
    onSave(benefit.id, { currentUsed: usedValue, notes });
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="presentation"
      tabIndex={0}
    >
      <div className="modal-content" role="dialog" aria-modal="true">
        <h2 className="text-xl font-bold mb-4">Edit {benefit.name}</h2>
        
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1" htmlFor={usedInputId}>
            Amount Used (${benefit.creditAmount} total)
          </label>
          <input
            id={usedInputId}
            type="number"
            value={used}
            onChange={e => setUsed(e.target.value)}
            className="input-field"
            min="0"
            max={benefit.creditAmount}
            step="0.01"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <button
              type="button"
              onClick={() => setUsed('0')}
              className="text-blue-400 hover:text-blue-300"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setUsed(benefit.creditAmount.toString())}
              className="text-blue-400 hover:text-blue-300"
            >
              Full Amount
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1" htmlFor={notesInputId}>
            Notes
          </label>
          <textarea
            id={notesInputId}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="input-field h-24 resize-none"
            placeholder="How did you use this benefit?"
          />
        </div>


        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
