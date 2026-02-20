import { useReducedMotion, type Variants } from "framer-motion";

export const LANDING_EASE = [0.16, 1, 0.3, 1] as const;

export function useLandingReducedMotion(): boolean {
  return Boolean(useReducedMotion());
}

export function fadeUpVariants(
  reducedMotion: boolean,
  offset = 20
): Variants {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, y: 0 },
    };
  }

  return {
    hidden: { opacity: 0, y: offset },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, ease: LANDING_EASE },
    },
  };
}

export function staggerContainerVariants(
  reducedMotion: boolean,
  delayChildren = 0.08
): Variants {
  if (reducedMotion) {
    return {
      hidden: {},
      visible: { transition: { staggerChildren: 0 } },
    };
  }

  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: delayChildren,
        delayChildren: 0.04,
      },
    },
  };
}

export const heroBlobTransition = {
  duration: 18,
  ease: "easeInOut",
  repeat: Infinity,
  repeatType: "mirror",
} as const;
