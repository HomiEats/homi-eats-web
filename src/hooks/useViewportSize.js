import { useEffect, useState } from 'react';

// Breakpoint constants
const MOBILE_MAX_WIDTH = 767;
const TABLET_MIN_WIDTH = 768;
const TABLET_MAX_WIDTH = 1023;
const DESKTOP_MIN_WIDTH = 1024;

/**
 * Hook to handle window resize and get current viewport size
 * Returns viewport dimensions and convenient device type flags
 */
const useViewportSize = () => {
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Add event listener with debouncing
    let timeoutId;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Convenient device type flags
  const isMobile = viewportSize.width <= MOBILE_MAX_WIDTH;
  const isTablet = viewportSize.width >= TABLET_MIN_WIDTH && viewportSize.width <= TABLET_MAX_WIDTH;
  const isDesktop = viewportSize.width >= DESKTOP_MIN_WIDTH;

  return {
    ...viewportSize,
    isMobile,
    isTablet,
    isDesktop,
  };
};

export default useViewportSize;
