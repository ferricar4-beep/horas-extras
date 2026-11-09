import React, { useEffect } from 'react';
import { useSpring, useTransform, motion } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
}

export function AnimatedNumber({ value, decimals = 0, suffix = '' }: AnimatedNumberProps) {
  const spring = useSpring(value, { duration: 0.6, bounce: 0 });
  
  // Custom transform that formats to specific decimal places
  const display = useTransform(spring, (v) => {
    return `${v.toFixed(decimals)}${suffix}`;
  });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}
