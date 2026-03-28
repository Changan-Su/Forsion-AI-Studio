import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transition } from 'framer-motion';

// ---------------------------------------------------------------------------
// Shared spring configs — Apple-style physics
// ---------------------------------------------------------------------------

export const appleSpring: Transition = {
  type: 'spring',
  stiffness: 350,
  damping: 30,
  mass: 0.8,
};

export const gentleSpring: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 24,
  mass: 0.9,
};

export const snappySpring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 28,
};

const quickFade: Transition = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] };

// ---------------------------------------------------------------------------
// AnimatedModal — backdrop fade + content scale/opacity spring
// ---------------------------------------------------------------------------

interface AnimatedModalBackdropProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  zIndex?: number;
}

export const AnimatedModalBackdrop: React.FC<AnimatedModalBackdropProps> = ({
  children,
  onClose,
  className = '',
  zIndex = 50,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={quickFade}
    className={`fixed inset-0 flex items-center justify-center p-4 ${className}`}
    style={{ zIndex }}
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose?.();
    }}
  >
    {children}
  </motion.div>
);

interface AnimatedModalContentProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimatedModalContent: React.FC<AnimatedModalContentProps> = ({
  children,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.96, y: 8 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.97, y: 4 }}
    transition={appleSpring}
    className={className}
  >
    {children}
  </motion.div>
);

// ---------------------------------------------------------------------------
// AnimatedPanel — slides in from left or right
// ---------------------------------------------------------------------------

interface AnimatedPanelProps {
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
}

export const AnimatedPanel: React.FC<AnimatedPanelProps> = ({
  children,
  side = 'right',
  className = '',
}) => {
  const xOffset = side === 'right' ? '100%' : '-100%';
  return (
    <motion.div
      initial={{ x: xOffset, opacity: 0.5 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: xOffset, opacity: 0.5 }}
      transition={gentleSpring}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// AnimatedOverlay — a simple fade backdrop for mobile sidebars, etc.
// ---------------------------------------------------------------------------

interface AnimatedOverlayProps {
  onClick?: () => void;
  className?: string;
}

export const AnimatedOverlay: React.FC<AnimatedOverlayProps> = ({
  onClick,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
    className={`fixed inset-0 ${className}`}
    onClick={onClick}
  />
);

// ---------------------------------------------------------------------------
// AnimatedDropdown — scale + opacity from transform origin
// ---------------------------------------------------------------------------

interface AnimatedDropdownProps {
  children: React.ReactNode;
  className?: string;
  origin?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom';
}

const originMap: Record<string, string> = {
  'top-left': '0% 0%',
  'top-right': '100% 0%',
  'bottom-left': '0% 100%',
  'bottom-right': '100% 100%',
  top: '50% 0%',
  bottom: '50% 100%',
};

export const AnimatedDropdown: React.FC<AnimatedDropdownProps> = ({
  children,
  className = '',
  origin = 'top-left',
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95, y: origin.startsWith('bottom') ? 4 : -4 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95, y: origin.startsWith('bottom') ? 4 : -4 }}
    transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
    style={{ transformOrigin: originMap[origin] }}
    className={className}
  >
    {children}
  </motion.div>
);

// ---------------------------------------------------------------------------
// AnimatedListItem — fade-in + slide up, with optional stagger index
// ---------------------------------------------------------------------------

interface AnimatedListItemProps {
  children: React.ReactNode;
  index?: number;
  className?: string;
  /** Only animate if this is true (e.g., "is the latest message") */
  shouldAnimate?: boolean;
}

export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  index = 0,
  className = '',
  shouldAnimate = true,
}) => {
  if (!shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ...gentleSpring,
        delay: Math.min(index * 0.04, 0.3),
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// AnimatedCollapse — smooth height animation for expand/collapse sections
// ---------------------------------------------------------------------------

interface AnimatedCollapseProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

export const AnimatedCollapse: React.FC<AnimatedCollapseProps> = ({
  isOpen,
  children,
  className = '',
}) => (
  <AnimatePresence initial={false}>
    {isOpen && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ overflow: 'hidden' }}
        className={className}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

// ---------------------------------------------------------------------------
// Re-export AnimatePresence for convenience
// ---------------------------------------------------------------------------
export { AnimatePresence, motion };
