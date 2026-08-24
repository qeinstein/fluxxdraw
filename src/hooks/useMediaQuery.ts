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

/** Kept in step with the `--mobile` breakpoint in index.css. */
export const MOBILE_QUERY = "(max-width: 720px)";

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
