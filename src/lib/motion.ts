import type { Variants } from "framer-motion";

// Shared stagger entrance for trip grids (Home, My Journeys, Explore,
// Community) -- cards cascade in instead of popping in all at once.
// Delay kept short (Emil Kowalski's animation guidance: 30-80ms/item) so it
// reads as a ripple, not a slow reveal.
export const staggerGrid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } },
};
