import React, { useState, useRef } from "react";
import { Reply } from "lucide-react";
import { motion } from "motion/react";

interface SwipeableMessageProps {
  key?: React.Key;
  children: React.ReactNode;
  onSwipeReply: () => void;
  disabled?: boolean;
}

export const SwipeableMessage = React.memo(function SwipeableMessage({ children, onSwipeReply, disabled }: SwipeableMessageProps) {
  const [startX, setStartX] = useState<number | null>(null);
  const [startY, setStartY] = useState<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setStartX(e.touches[0].clientX);
    setStartY(e.touches[0].clientY);
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || startX === null || startY === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX;
    const diffY = currentY - startY;

    if (!isSwiping) {
      // If vertical movement is dominant, ignore swipe to allow normal scrolling
      if (Math.abs(diffY) > Math.abs(diffX)) {
        setStartX(null);
        setStartY(null);
        return;
      }
      if (Math.abs(diffX) > 10) {
        setIsSwiping(true);
      }
    }

    if (isSwiping && diffX > 0) {
      // Swipe right only
      const cappedOffset = Math.min(diffX * 0.6, 90);
      setOffsetX(cappedOffset);
    }
  };

  const handleTouchEnd = () => {
    if (isSwiping && offsetX >= 55) {
      onSwipeReply();
    }
    setStartX(null);
    setStartY(null);
    setIsSwiping(false);
    setOffsetX(0);
  };

  // Mouse handlers for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    // Only track left click
    if (e.button !== 0) return;
    setStartX(e.clientX);
    setStartY(e.clientY);
    setIsSwiping(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled || startX === null || startY === null) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    const diffX = currentX - startX;
    const diffY = currentY - startY;

    if (!isSwiping) {
      if (Math.abs(diffY) > Math.abs(diffX)) {
        setStartX(null);
        setStartY(null);
        return;
      }
      if (Math.abs(diffX) > 10) {
        setIsSwiping(true);
      }
    }

    if (isSwiping && diffX > 0) {
      const cappedOffset = Math.min(diffX * 0.6, 90);
      setOffsetX(cappedOffset);
    }
  };

  const handleMouseUpOrLeave = () => {
    if (startX !== null) {
      if (isSwiping && offsetX >= 55) {
        onSwipeReply();
      }
      setStartX(null);
      setStartY(null);
      setIsSwiping(false);
      setOffsetX(0);
    }
  };

  const opacity = Math.min(offsetX / 55, 1);

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative w-full overflow-hidden select-none shrink-0 flex-shrink-0"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
    >
      {/* Scanline Sweep animation on Mount */}
      <motion.div 
        initial={{ top: "0%" }}
        animate={{ top: "100%", opacity: 0 }}
        transition={{ duration: 0.5, ease: "linear" }}
        className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#00FFFF] to-transparent shadow-[0_0_10px_#00FFFF] pointer-events-none z-20"
      />

      {/* Background Reply icon behind the message on the left */}
      {offsetX > 0 && (
        <div 
          className="absolute left-0 inset-y-0 flex items-center pl-3 pointer-events-none z-10"
          style={{ opacity }}
        >
          <div className="p-1.5 rounded-full bg-[#00BFFF]/10 border border-[#00BFFF]/30 text-[#00BFFF] animate-pulse">
            <Reply className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Message content sliding to the right */}
      <div 
        style={{ 
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className="w-full flex flex-col shrink-0 flex-shrink-0"
      >
        {children}
      </div>
    </motion.div>
  );
});
