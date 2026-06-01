const HexLogo = ({ size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'text-3xl',
    md: 'text-5xl',
    lg: 'text-7xl',
    xl: 'text-9xl',
  };

  return (
    <span
      className={`${sizeMap[size] || sizeMap.md} select-none tracking-tight ${className}`}
      style={{ fontFamily: "'Google Sans Flex', 'Inter', sans-serif", fontWeight: 800, color: '#0052FF' }}
    >
       NexaBit
    </span>
  );
};

export default HexLogo;
