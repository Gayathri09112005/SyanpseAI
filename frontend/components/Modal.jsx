'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Design modal: blurred scrim, floating glass sheet, popin entrance; exit handled by Framer Motion.
 * Portalled to <body>: any ancestor with backdrop-filter (every glass panel) would otherwise become
 * the containing block for position:fixed and trap the dialog inside it.
 */
export function Modal({ open, onClose, title, subtitle, children, footer, width = 620 }) {
  const panelRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="modal-scrim"
          style={{
            position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(6,8,12,.45)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            style={{
              width: `min(${width}px, 100%)`, maxHeight: '84vh', overflow: 'auto', outline: 'none',
              border: '1px solid var(--line2)', background: 'var(--gf)',
              backdropFilter: 'blur(30px) saturate(1.5)', WebkitBackdropFilter: 'blur(30px) saturate(1.5)',
              borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh),inset 0 1px 0 var(--hl)',
              padding: 26, display: 'grid', gap: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div className="disp" style={{ fontSize: 22, letterSpacing: '-.02em' }}>{title}</div>
                {subtitle ? <div style={{ fontSize: 14, color: 'var(--fg2)', marginTop: 3 }}>{subtitle}</div> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="to-fg"
                style={{ width: 36, height: 36, borderRadius: 11, border: '1px solid var(--line)', background: 'var(--g2)', color: 'var(--fg2)', cursor: 'pointer', transition: 'transform var(--spring)', flex: 'none' }}
              >
                ✕
              </button>
            </div>
            {children}
            {footer ? <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
