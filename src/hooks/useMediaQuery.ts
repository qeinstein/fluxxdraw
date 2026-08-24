import { useEffect, useState } from "react";

/** Live subscription to a CSS media query, so JS layout matches the stylesheet. */
export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
};

/**
 * Kept in step with the mobile breakpoint in index.css.
 *
 * Width alone isn't enough: a phone in landscape is often wider than 720px but
 * still wants the phone layout, and a touch laptop is wide with a coarse
 * pointer. Matching either a narrow window or a coarse pointer on a
 * tablet-sized screen covers both without mistaking a desktop for a phone.
 */
export const MOBILE_QUERY =
  "(max-width: 720px), (pointer: coarse) and (max-width: 1024px)";

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
