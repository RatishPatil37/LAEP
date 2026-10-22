import { useEffect } from 'react';

/**
 * useScrollReveal — Light-weight IntersectionObserver hook
 * Automatically adds the 'is-visible' class to all elements matching selector
 * when they enter the viewport.
 */
export function useScrollReveal(selector = '.scroll-appear', deps = []) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      // Fallback for environments without IntersectionObserver
      document.querySelectorAll(selector).forEach((el) => {
        el.classList.add('is-visible');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            // Unobserve after appearing once
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '0px 0px -60px 0px',
        threshold: 0.12,
      }
    );

    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, deps);
}
