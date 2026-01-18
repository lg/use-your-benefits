import { useState, useEffect, useCallback, memo, type ReactNode, type ReactElement, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children?: ReactElement;
}

function TooltipComponent({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [visible]);

  const handleMouseEnter = useCallback((e: ReactMouseEvent) => {
    // Set initial position from the enter event to avoid flash at (0,0)
    setPosition({ x: e.clientX, y: e.clientY });
    setVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setVisible(false);
    setPosition(null);
  }, []);

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && position !== null && createPortal(
        <div
          className="fixed z-50 bg-slate-800 border border-slate-600 shadow-lg rounded text-xs text-white text-left leading-tight px-2 py-1 pointer-events-none whitespace-pre-line"
          style={{
            left: position.x,
            bottom: window.innerHeight - position.y
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
}

export const Tooltip = memo(TooltipComponent);
