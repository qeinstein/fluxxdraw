import type { ReactNode } from "react";

/**
 * A single 20×20 stroke-icon set. Everything is drawn on the same grid with the
 * same stroke weight so the toolbar reads as one family, and `currentColor`
 * lets icons inherit hover/active/disabled states from their button.
 */
const Icon = ({ children, filled }: { children: ReactNode; filled?: boolean }) => (
  <svg
    className="icon"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const IconSelection = () => (
  <Icon>
    <path d="M4.5 3.2l11 5.4-4.7 1.4-1.9 4.6z" />
  </Icon>
);

export const IconHand = () => (
  <Icon>
    <path d="M7 9V4.8a1.15 1.15 0 012.3 0V9m0-.7V4a1.15 1.15 0 012.3 0v4.9m0-.6a1.15 1.15 0 012.3 0V12" />
    <path d="M7 9.4V7.6a1.15 1.15 0 00-2.3 0v4.1a5 5 0 005 5h1.6a4.3 4.3 0 004.3-4.3" />
  </Icon>
);

export const IconRectangle = () => (
  <Icon>
    <rect x="3.2" y="4.6" width="13.6" height="10.8" rx="2" />
  </Icon>
);

export const IconDiamond = () => (
  <Icon>
    <path d="M10 3.2l6.8 6.8-6.8 6.8L3.2 10z" />
  </Icon>
);

export const IconEllipse = () => (
  <Icon>
    <ellipse cx="10" cy="10" rx="7.2" ry="5.8" />
  </Icon>
);

export const IconArrow = () => (
  <Icon>
    <path d="M3.5 14.5L15 3.8" />
    <path d="M9.6 3.8H15v5.4" />
  </Icon>
);

export const IconLine = () => (
  <Icon>
    <path d="M3.5 15L16 4.4" />
  </Icon>
);

export const IconDraw = () => (
  <Icon>
    <path d="M3.6 16.4l1-3.2 8.6-8.6a1.7 1.7 0 012.4 2.4l-8.6 8.6z" />
    <path d="M11.8 5.8l2.4 2.4" />
  </Icon>
);

export const IconText = () => (
  <Icon>
    <path d="M4.6 5.2V3.8h10.8v1.4M10 3.8v12.4M7.4 16.2h5.2" />
  </Icon>
);

export const IconImage = () => (
  <Icon>
    <rect x="3.2" y="4.4" width="13.6" height="11.2" rx="2" />
    <circle cx="7.6" cy="8.4" r="1.2" />
    <path d="M3.6 13.4l3.6-3.2 3.2 2.8 2.6-2.2 3.4 3" />
  </Icon>
);

export const IconFrame = () => (
  <Icon>
    <path d="M6.4 2.8v14.4M13.6 2.8v14.4M2.8 6.4h14.4M2.8 13.6h14.4" />
  </Icon>
);

export const IconEmbed = () => (
  <Icon>
    <path d="M8.4 11.6a2.8 2.8 0 004.2.3l2.2-2.2a2.8 2.8 0 00-4-4l-1.2 1.2" />
    <path d="M11.6 8.4a2.8 2.8 0 00-4.2-.3L5.2 10.3a2.8 2.8 0 004 4l1.2-1.2" />
  </Icon>
);

export const IconEraser = () => (
  <Icon>
    <path d="M8.9 15.4l-3.6-3.6a1.6 1.6 0 010-2.3l5-5a1.6 1.6 0 012.3 0l2.7 2.7a1.6 1.6 0 010 2.3l-5.9 5.9z" />
    <path d="M6.2 15.4h9" />
  </Icon>
);

export const IconLaser = () => (
  <Icon>
    <circle cx="10" cy="10" r="2.2" fill="currentColor" />
    <path d="M10 2.6v2.2M10 15.2v2.2M2.6 10h2.2M15.2 10h2.2M5 5l1.5 1.5M13.5 13.5L15 15M15 5l-1.5 1.5M6.5 13.5L5 15" />
  </Icon>
);

export const IconLockOpen = () => (
  <Icon>
    <rect x="4.6" y="8.8" width="10.8" height="7.4" rx="1.8" />
    <path d="M7 8.8V6.6a3 3 0 015.6-1.5" />
  </Icon>
);

export const IconLockClosed = () => (
  <Icon>
    <rect x="4.6" y="8.8" width="10.8" height="7.4" rx="1.8" />
    <path d="M7 8.8V6.6a3 3 0 016 0v2.2" />
  </Icon>
);

export const IconMenu = () => (
  <Icon>
    <path d="M4 10h12M4 5h12M4 15h12" />
  </Icon>
);

export const IconUndo = () => (
  <Icon>
    <path d="M7.4 6.2L4 9.6l3.4 3.4" />
    <path d="M4 9.6h7.6a4.4 4.4 0 010 8.8" />
  </Icon>
);

export const IconRedo = () => (
  <Icon>
    <path d="M12.6 6.2L16 9.6l-3.4 3.4" />
    <path d="M16 9.6H8.4a4.4 4.4 0 000 8.8" />
  </Icon>
);

export const IconPlus = () => (
  <Icon>
    <path d="M10 4.6v10.8M4.6 10h10.8" />
  </Icon>
);

export const IconMinus = () => (
  <Icon>
    <path d="M4.6 10h10.8" />
  </Icon>
);

export const IconFit = () => (
  <Icon>
    <path d="M7.4 3.4H3.4v4M12.6 3.4h4v4M12.6 16.6h4v-4M7.4 16.6h-4v-4" />
  </Icon>
);

export const IconClose = () => (
  <Icon>
    <path d="M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2" />
  </Icon>
);

export const IconTrash = () => (
  <Icon>
    <path d="M3.8 5.8h12.4M8.2 5.8V4.4a1 1 0 011-1h1.6a1 1 0 011 1v1.4" />
    <path d="M5.4 5.8l.7 9.6a1.4 1.4 0 001.4 1.3h5a1.4 1.4 0 001.4-1.3l.7-9.6" />
  </Icon>
);

export const IconDuplicate = () => (
  <Icon>
    <rect x="3.4" y="3.4" width="9.2" height="9.2" rx="1.6" />
    <path d="M7.4 16.6h7.6a1.6 1.6 0 001.6-1.6V7.4" />
  </Icon>
);

export const IconGroup = () => (
  <Icon>
    <rect x="3.2" y="3.2" width="6.4" height="6.4" rx="1.2" />
    <rect x="10.4" y="10.4" width="6.4" height="6.4" rx="1.2" />
    <path d="M10.4 6.4h6.4M6.4 10.4v6.4" strokeDasharray="2 2" />
  </Icon>
);

export const IconUngroup = () => (
  <Icon>
    <rect x="3.2" y="3.2" width="6" height="6" rx="1.2" />
    <rect x="10.8" y="10.8" width="6" height="6" rx="1.2" />
  </Icon>
);

export const IconFolder = () => (
  <Icon>
    <path d="M3.2 15.2V5.6a1.4 1.4 0 011.4-1.4h3.1l1.7 2.1h5.9a1.4 1.4 0 011.4 1.4v7.5a1.4 1.4 0 01-1.4 1.4H4.6a1.4 1.4 0 01-1.4-1.4z" />
  </Icon>
);

// --- layer order ----------------------------------------------------------

export const IconSendToBack = () => (
  <Icon>
    <rect x="6.4" y="6.4" width="7.2" height="7.2" rx="1.2" strokeDasharray="2 2" />
    <path d="M10 16.6V13M7.8 14.6L10 16.8l2.2-2.2" />
  </Icon>
);

export const IconSendBackward = () => (
  <Icon>
    <rect x="6.4" y="3.6" width="7.2" height="7.2" rx="1.2" />
    <path d="M10 13v3.6M7.8 14.6L10 16.8l2.2-2.2" />
  </Icon>
);

export const IconBringForward = () => (
  <Icon>
    <rect x="6.4" y="9.2" width="7.2" height="7.2" rx="1.2" />
    <path d="M10 7V3.4M7.8 5.4L10 3.2l2.2 2.2" />
  </Icon>
);

export const IconBringToFront = () => (
  <Icon>
    <rect x="6.4" y="6.4" width="7.2" height="7.2" rx="1.2" strokeDasharray="2 2" />
    <path d="M10 3.4V7M7.8 5.4L10 3.2l2.2 2.2" />
  </Icon>
);

// --- alignment ------------------------------------------------------------

export const IconAlignLeft = () => (
  <Icon>
    <path d="M3.4 3.2v13.6" />
    <rect x="6.2" y="5" width="9.4" height="3.4" rx="1" />
    <rect x="6.2" y="11.6" width="6.2" height="3.4" rx="1" />
  </Icon>
);

export const IconAlignCentreX = () => (
  <Icon>
    <path d="M10 3.2v13.6" />
    <rect x="4" y="5" width="12" height="3.4" rx="1" />
    <rect x="6.4" y="11.6" width="7.2" height="3.4" rx="1" />
  </Icon>
);

export const IconAlignRight = () => (
  <Icon>
    <path d="M16.6 3.2v13.6" />
    <rect x="4.4" y="5" width="9.4" height="3.4" rx="1" />
    <rect x="7.6" y="11.6" width="6.2" height="3.4" rx="1" />
  </Icon>
);

export const IconAlignTop = () => (
  <Icon>
    <path d="M3.2 3.4h13.6" />
    <rect x="5" y="6.2" width="3.4" height="9.4" rx="1" />
    <rect x="11.6" y="6.2" width="3.4" height="6.2" rx="1" />
  </Icon>
);

export const IconAlignCentreY = () => (
  <Icon>
    <path d="M3.2 10h13.6" />
    <rect x="5" y="4" width="3.4" height="12" rx="1" />
    <rect x="11.6" y="6.4" width="3.4" height="7.2" rx="1" />
  </Icon>
);

export const IconAlignBottom = () => (
  <Icon>
    <path d="M3.2 16.6h13.6" />
    <rect x="5" y="4.4" width="3.4" height="9.4" rx="1" />
    <rect x="11.6" y="7.6" width="3.4" height="6.2" rx="1" />
  </Icon>
);

export const IconDistributeX = () => (
  <Icon>
    <path d="M3.4 3.6v12.8M16.6 3.6v12.8" />
    <rect x="8.2" y="6.4" width="3.6" height="7.2" rx="1" />
  </Icon>
);

export const IconDistributeY = () => (
  <Icon>
    <path d="M3.6 3.4h12.8M3.6 16.6h12.8" />
    <rect x="6.4" y="8.2" width="7.2" height="3.6" rx="1" />
  </Icon>
);

// --- text alignment -------------------------------------------------------

export const IconTextLeft = () => (
  <Icon>
    <path d="M3.8 5.4h12.4M3.8 10h7.6M3.8 14.6h10" />
  </Icon>
);

export const IconTextCentre = () => (
  <Icon>
    <path d="M3.8 5.4h12.4M6.2 10h7.6M5 14.6h10" />
  </Icon>
);

export const IconTextRight = () => (
  <Icon>
    <path d="M3.8 5.4h12.4M8.6 10h7.6M6.2 14.6h10" />
  </Icon>
);

// --- shape style ----------------------------------------------------------

export const IconEdgeSharp = () => (
  <Icon>
    <path d="M4 16V7.4A3.4 3.4 0 017.4 4H16" />
  </Icon>
);

export const IconEdgeRound = () => (
  <Icon>
    <path d="M4 16V11a7 7 0 017-7h5" />
  </Icon>
);

export const IconFillHachure = () => (
  <Icon>
    <rect x="3.4" y="3.4" width="13.2" height="13.2" rx="1.6" />
    <path d="M5.4 12.6l7.2-7.2M8.6 15.4l6.8-6.8" strokeWidth="1.1" />
  </Icon>
);

export const IconFillCross = () => (
  <Icon>
    <rect x="3.4" y="3.4" width="13.2" height="13.2" rx="1.6" />
    <path d="M5.4 12.6l7.2-7.2M8.6 15.4l6.8-6.8M12.6 14.6l-7.2-7.2" strokeWidth="1.1" />
  </Icon>
);

export const IconFillSolid = () => (
  <Icon>
    <rect x="3.4" y="3.4" width="13.2" height="13.2" rx="1.6" fill="currentColor" />
  </Icon>
);

export const IconFillZigzag = () => (
  <Icon>
    <rect x="3.4" y="3.4" width="13.2" height="13.2" rx="1.6" />
    <path d="M5.4 8l3-2.6 3 5 3-2.6" strokeWidth="1.1" />
    <path d="M5.4 13.4l3-2.6 3 5" strokeWidth="1.1" />
  </Icon>
);

export const IconStrokeSolid = () => (
  <Icon>
    <path d="M3.4 10h13.2" strokeWidth="2" />
  </Icon>
);

export const IconStrokeDashed = () => (
  <Icon>
    <path d="M3.4 10h13.2" strokeWidth="2" strokeDasharray="4 3" />
  </Icon>
);

export const IconStrokeDotted = () => (
  <Icon>
    <path d="M3.4 10h13.2" strokeWidth="2" strokeDasharray="0.5 3.2" />
  </Icon>
);

export const IconWidthThin = () => (
  <Icon>
    <path d="M3.4 10h13.2" strokeWidth="1.2" />
  </Icon>
);

export const IconWidthBold = () => (
  <Icon>
    <path d="M3.4 10h13.2" strokeWidth="2.4" />
  </Icon>
);

export const IconWidthExtraBold = () => (
  <Icon>
    <path d="M3.4 10h13.2" strokeWidth="4" />
  </Icon>
);

export const IconCheck = () => (
  <Icon>
    <path d="M4.4 10.4l3.6 3.6 7.6-8" />
  </Icon>
);

export const IconLibrary = () => (
  <Icon>
    <path d="M10 3L3 7h14L10 3z" />
    <path d="M5 7v8M10 7v8M15 7v8" />
    <path d="M2 16h16" />
  </Icon>
);

export const IconMore = () => (
  <Icon>
    <circle cx="4.6" cy="10" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15.4" cy="10" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconSliders = () => (
  <Icon>
    <path d="M3.5 6h13M3.5 14h13" />
    <circle cx="7.5" cy="6" r="2" />
    <circle cx="12.5" cy="14" r="2" />
  </Icon>
);

export const IconSticky = () => (
  <Icon>
    <path d="M3.4 4.2a1.4 1.4 0 011.4-1.4h10.4a1.4 1.4 0 011.4 1.4v7.4l-5 5.6H4.8a1.4 1.4 0 01-1.4-1.4z" />
    <path d="M16.6 11.6h-4a1.4 1.4 0 00-1.4 1.4v4.2" />
  </Icon>
);
// --- Arrowheads (pointing right) --------------------------------------------

export const IconArrowheadNone = () => (
  <Icon>
    <path d="M4 10h12" strokeWidth="1.5" />
  </Icon>
);

export const IconArrowheadArrow = () => (
  <Icon>
    <path d="M4 10h11.5M11.5 5.5L16 10l-4.5 4.5" strokeWidth="1.5" />
  </Icon>
);

export const IconArrowheadTriangle = () => (
  <Icon>
    <path d="M4 10h8" strokeWidth="1.5" />
    <path d="M12 6l5 4-5 4z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
  </Icon>
);

export const IconArrowheadTriangleOutline = () => (
  <Icon>
    <path d="M4 10h8" strokeWidth="1.5" />
    <path d="M12 6l5 4-5 4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
  </Icon>
);

export const IconArrowheadBar = () => (
  <Icon>
    <path d="M4 10h12M15 5v10" strokeWidth="1.5" />
  </Icon>
);

export const IconArrowheadDot = () => (
  <Icon>
    <path d="M4 10h9.5" strokeWidth="1.5" />
    <circle cx="15.5" cy="10" r="2" fill="currentColor" stroke="none" />
  </Icon>
);

// --- Arrowheads (pointing left, for start arrowheads) -----------------------

export const IconArrowheadNoneLeft = () => (
  <Icon>
    <path d="M4 10h12" strokeWidth="1.5" />
  </Icon>
);

export const IconArrowheadArrowLeft = () => (
  <Icon>
    <path d="M4.5 10H16M8.5 5.5L4 10l4.5 4.5" strokeWidth="1.5" />
  </Icon>
);

export const IconArrowheadTriangleLeft = () => (
  <Icon>
    <path d="M12 10H16" strokeWidth="1.5" />
    <path d="M8 6l-5 4 5 4z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
  </Icon>
);

export const IconArrowheadTriangleOutlineLeft = () => (
  <Icon>
    <path d="M12 10H16" strokeWidth="1.5" />
    <path d="M8 6l-5 4 5 4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
  </Icon>
);

export const IconArrowheadBarLeft = () => (
  <Icon>
    <path d="M4 10h12M5 5v10" strokeWidth="1.5" />
  </Icon>
);

export const IconArrowheadDotLeft = () => (
  <Icon>
    <path d="M6.5 10H16" strokeWidth="1.5" />
    <circle cx="4.5" cy="10" r="2" fill="currentColor" stroke="none" />
  </Icon>
);

// --- Routing ----------------------------------------------------------------

export const IconRouteStraight = () => (
  <Icon>
    <path d="M4 16L16 4" strokeWidth="1.5" />
  </Icon>
);

export const IconRouteCurved = () => (
  <Icon>
    <path d="M4 16 C 4 8, 16 12, 16 4" strokeWidth="1.5" />
  </Icon>
);

export const IconRouteElbow = () => (
  <Icon>
    <path d="M4 16 V 11.5 A 1.5 1.5 0 0 1 5.5 10 H 14.5 A 1.5 1.5 0 0 0 16 8.5 V 4" strokeWidth="1.5" />
  </Icon>
);

// --- Sloppiness -------------------------------------------------------------

export const IconSloppinessArchitect = () => (
  <Icon>
    <path d="M3 10h14" strokeWidth="1.5" />
  </Icon>
);

export const IconSloppinessArtist = () => (
  <Icon>
    <path d="M3 10 Q 6.5 7, 10 10 T 17 10" strokeWidth="1.5" />
  </Icon>
);

export const IconSloppinessCartoonist = () => (
  <Icon>
    <path d="M3 10 L 6.5 6 L 10 13 L 13.5 7 L 17 10" strokeWidth="1.5" strokeLinejoin="miter" />
  </Icon>
);

// --- Font Size --------------------------------------------------------------

export const IconFontSizeS = () => (
  <Icon>
    <text x="10" y="14" fontSize="10" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="bold">S</text>
  </Icon>
);

export const IconFontSizeM = () => (
  <Icon>
    <text x="10" y="14.5" fontSize="12" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="bold">M</text>
  </Icon>
);

export const IconFontSizeL = () => (
  <Icon>
    <text x="10" y="15" fontSize="14" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="bold">L</text>
  </Icon>
);

export const IconFontSizeXL = () => (
  <Icon>
    <text x="10" y="15.5" fontSize="16" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="bold">XL</text>
  </Icon>
);
// --- Menu Icons -------------------------------------------------------------

export const IconSave = () => (
  <Icon>
    <path d="M4.5 4.5h8L16 8v7.5a1 1 0 01-1 1h-10a1 1 0 01-1-1v-11a1 1 0 011-1z" strokeWidth="1.5" />
    <path d="M7.5 16.5v-4h5v4" strokeWidth="1.5" />
  </Icon>
);

export const IconInstall = () => (
  <Icon>
    <path d="M10 4v8M6.5 8.5L10 12l3.5-3.5" strokeWidth="1.5" />
    <path d="M4.5 14v1.5a1 1 0 001 1h9a1 1 0 001-1V14" strokeWidth="1.5" />
  </Icon>
);

export const IconHistory = () => (
  <Icon>
    <path d="M10 4.5a5.5 5.5 0 105.5 5.5" strokeWidth="1.5" />
    <path d="M10 7v3l2 2" strokeWidth="1.5" />
    <path d="M15.5 4.5v3h-3" strokeWidth="1.5" />
  </Icon>
);

export const IconPresent = () => (
  <Icon>
    <path d="M4 6h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" strokeWidth="1.5" />
    <path d="M8 14v3M12 14v3M6 17h8" strokeWidth="1.5" />
  </Icon>
);

export const IconServices = () => (
  <Icon>
    <rect x="4" y="4" width="12" height="3" rx="0.5" strokeWidth="1.5" />
    <rect x="4" y="8.5" width="12" height="3" rx="0.5" strokeWidth="1.5" />
    <rect x="4" y="13" width="12" height="3" rx="0.5" strokeWidth="1.5" />
    <path d="M7 5.5h.01M7 10h.01M7 14.5h.01" strokeWidth="1.5" strokeLinecap="round" />
  </Icon>
);

export const IconTidy = () => (
  <Icon>
    <path d="M7.5 12.5l8-8a1 1 0 011.5 1.5l-8 8-3 1 1.5-2.5z" strokeWidth="1.5" />
    <path d="M6 7l-1-1M5 4l-1-1M13 14l1 1M16 15l1 1M4.5 10l-1.5.5M10 4.5l.5-1.5" strokeWidth="1.5" />
  </Icon>
);

export const IconGrid = () => (
  <Icon>
    <rect x="4" y="4" width="12" height="12" rx="1" strokeWidth="1.5" />
    <path d="M4 8h12M4 12h12M8 4v12M12 4v12" strokeWidth="1.5" />
  </Icon>
);

export const IconMagnet = () => (
  <Icon>
    <path d="M6 8v3a4 4 0 008 0V8M6 8V5M14 8V5M4 8h4M12 8h4" strokeWidth="1.5" />
  </Icon>
);

export const IconMoon = () => (
  <Icon>
    <path d="M14 11A5 5 0 119 6 4 4 0 0014 11z" strokeWidth="1.5" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconSun = () => (
  <Icon>
    <circle cx="10" cy="10" r="3" strokeWidth="1.5" fill="none" />
    <path d="M10 4V3M10 17v-1M4 10H3M17 10h-1M5.5 5.5l-.5-.5M15 15l-.5-.5M5.5 14.5l-.5.5M15 5l-.5.5" strokeWidth="1.5" />
  </Icon>
);

export const IconHelp = () => (
  <Icon>
    <circle cx="10" cy="10" r="7" strokeWidth="1.5" />
    <path d="M8 8a2 2 0 113 1.5c-1 .5-1 1.5-1 1.5M10 14h.01" strokeWidth="1.5" />
  </Icon>
);

export const IconEye = () => (
  <Icon>
    <path d="M2.5 10S5 5.5 10 5.5 17.5 10 17.5 10 15 14.5 10 14.5 2.5 10 2.5 10z" />
    <circle cx="10" cy="10" r="1.8" />
  </Icon>
);

export const IconEyeOff = () => (
  <Icon>
    <path d="M4 4l12 12" />
    <path d="M7.7 6A9.6 9.6 0 0110 5.5c5 0 7.5 4.5 7.5 4.5a13 13 0 01-2.3 2.9" />
    <path d="M5 7.2A12.4 12.4 0 002.5 10S5 14.5 10 14.5a9 9 0 003-.5" />
  </Icon>
);

export const IconGithub = () => (
  <Icon>
    <path d="M10 3a7 7 0 00-2.2 13.6c.3.1.5-.1.5-.3v-1.2c-2 .4-2.4-.9-2.4-.9-.3-.8-.8-1-.8-1-.6-.4.1-.4.1-.4.7.1 1.1.7 1.1.7.6 1.1 1.7.8 2.1.6 0-.5.2-.8.5-1-1.6-.2-3.2-.8-3.2-3.4 0-.8.3-1.4.7-1.9 0-.2-.3-.9.1-1.9 0 0 .6-.2 2 .8a7 7 0 013.6 0c1.4-1 2-.8 2-.8.4 1 .1 1.7.1 1.9.4.5.7 1.1.7 1.9 0 2.6-1.6 3.2-3.2 3.4.3.3.6.8.6 1.5v2.2c0 .3.2.4.5.3A7 7 0 0010 3z" strokeWidth="1.2" fill="none" />
  </Icon>
);

export const IconMinimap = () => (
  <Icon>
    <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="2" />
    <path d="M6 12l3-3 2.5 2.5L15 8" />
  </Icon>
);

export const IconCommand = () => (
  <Icon>
    <path d="M7.5 7A1.5 1.5 0 116 8.5H4.75V7zM7.5 7a1.5 1.5 0 10-2.75-.75V7zm0 6A1.5 1.5 0 106 11.5h1.25V13zm0 0a1.5 1.5 0 102.75.75V13z" />
    <path d="M12.5 7A1.5 1.5 0 1114 8.5h1.25V7zM12.5 7a1.5 1.5 0 102.75-.75V7zm0 6a1.5 1.5 0 101.5-1.5h-1.25V13zm0 0a1.5 1.5 0 10-2.75.75V13z" />
  </Icon>
);
