import { useEffect, useMemo, useState, type RefObject } from "react";

type UseInViewOptions = IntersectionObserverInit & {
  triggerOnce?: boolean;
};

export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  options: UseInViewOptions = { threshold: 0.1, triggerOnce: true }
): boolean {
  const { threshold = 0.1, root = null, rootMargin = "0px", triggerOnce = true } = options;
  const [inView, setInView] = useState(false);
  
  // Memoize threshold to handle array/primitive changes
  const thresholdKey = useMemo(() => JSON.stringify(threshold), [threshold]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (triggerOnce) {
            observer.unobserve(entry.target);
          }
          return;
        }

        if (!triggerOnce) {
          setInView(false);
        }
      },
      {
        threshold,
        root,
        rootMargin,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, thresholdKey, root, rootMargin, triggerOnce];

  return inView;
}
