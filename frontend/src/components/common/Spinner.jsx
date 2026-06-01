import { motion } from 'framer-motion';

const Spinner = () => (
  <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
    <motion.span
      className="text-[#0052FF] text-7xl select-none"
      style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    >
       NexaBit
</motion.span>
  </div>
);

export default Spinner;
