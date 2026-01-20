import { useState, useEffect, useCallback, cloneElement, memo, type ReactNode, type ReactElement, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children?: ReactElement;
  inline?: boolean;
}

function TooltipComponent({ content, children, inline }: TooltipProps) {
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

  const tooltipPortal = visible && position !== null && createPortal(
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
  );

  // For inline mode, clone the child and attach handlers directly (no wrapper)
  if (inline && children) {
    return (
      <>
        {cloneElement(children, {
          onMouseEnter: handleMouseEnter,
          onMouseLeave: handleMouseLeave,
        })}
        {tooltipPortal}
      </>
    );
  }

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {tooltipPortal}
    </div>
  );
}

export const Tooltip = memo(TooltipComponent);
