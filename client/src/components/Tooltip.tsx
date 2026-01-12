import { useState, useEffect, type ReactNode, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children?: ReactElement;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      className="relative inline-block w-full h-full"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && createPortal(
        <div
          className="fixed z-50 bg-slate-800 border border-slate-600 shadow-lg rounded text-xs text-white text-left leading-tight px-2 py-1 pointer-events-none whitespace-nowrap"
          style={{
            left: position.x + 12,
            top: position.y + 12
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
}
