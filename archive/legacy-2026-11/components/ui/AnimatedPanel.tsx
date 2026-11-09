import { motion, type Variants } from 'framer-motion';

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
  hover: {
    y: -6,
    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,211,238,0.25)',
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  },
  tap: { scale: 0.98 },
};

export const staggeredChildren: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};
