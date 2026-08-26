import { useState, useEffect, useRef } from "react";
import {
  collab,
  generateCollaborationLink,
  type PeerPresence,
} from "../io/collaboration";
import { IconClose, IconUsers } from "./icons";
export function JoinDialog({ 
  room, 
  onJoin, 
  onCancel 
}: { 
  room: string; 
  onJoin: () => void; 
  onCancel: () => void; 
}) {
  const [name, setName] = useState(() => localStorage.getItem("fluxx_collab_name") || "");

  const handleJoin = () => {
    const finalName = name.trim() || "Anonymous Fox";
    localStorage.setItem("fluxx_collab_name", finalName);
    
    // Assign a random color
    const colors = ["#ff8787", "#69db7c", "#74c0fc", "#ffd43b", "#b2f2bb", "#a5d8ff"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    collab.joinSession(room, finalName, color);
    
    // Remove session ID from URL without reloading
    window.history.replaceState(null, "", window.location.pathname.replace(/\/session\/[A-Za-z0-9]+/, ''));
    onJoin();
  };

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog compact" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <header>
          <h2>Join Session</h2>
          <button className="icon-button" aria-label="Close" onClick={onCancel}>
            <IconClose />
          </button>
        </header>
        <div className="dialog-body" style={{ padding: '16px 20px' }}>
          <p style={{ color: 'var(--fg-muted)', fontSize: '13px', margin: '0 0 16px' }}>
            Someone invited you to collaborate on this drawing.
          </p>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 550, color: 'var(--fg-muted)', marginBottom: '6px' }}>
            Your name
          </label>
          <input 
            autoFocus
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Anonymous Fox"
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            style={{ 
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--line)', background: 'var(--surface-sunken)',
              color: 'var(--fg)', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <footer>
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={handleJoin}>Join Session</button>
        </footer>
      </div>
    </div>
  );
}

export function CollaborationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [peers, setPeers] = useState<Map<number, PeerPresence>>(new Map());
  const [state, setState] = useState(collab.state);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateState = () => {
      setState(collab.state);
      setPeers(new Map(collab.getPeers()));
    };

    const interval = setInterval(updateState, 500);
    
    if (collab.provider) {
      collab.provider.awareness.on("change", updateState);
      updateState();
    }

    return () => {
      clearInterval(interval);
      if (collab.provider) collab.provider.awareness.off("change", updateState);
    };
  }, [isOpen, collab.room, collab.state]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleStart = () => {
    const { room } = generateCollaborationLink();
    const name = localStorage.getItem("fluxx_collab_name") || "Host Fox";
    const colors = ["#ff8787", "#69db7c", "#74c0fc", "#ffd43b", "#b2f2bb", "#a5d8ff"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    collab.startSession(room, name, color);
    window.history.replaceState(null, "", `/session/${room}`);
  };

  const handleJoin = () => {
    if (!code.trim()) return;
    const name = localStorage.getItem("fluxx_collab_name") || "Anonymous Fox";
    const colors = ["#ff8787", "#69db7c", "#74c0fc", "#ffd43b", "#b2f2bb", "#a5d8ff"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    collab.joinSession(code.trim(), name, color);
  };

  const handleCopyLink = () => {
    if (collab.shareUrl) {
      navigator.clipboard.writeText(collab.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyCode = () => {
    if (collab.room) {
      navigator.clipboard.writeText(collab.room);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeave = () => {
    if (collab.isHost) {
      collab.endSession();
    } else {
      collab.leaveSession();
    }
    setIsOpen(false);
  };

  const isCollaborating = state !== "LOCAL";

  return (
    <div className="collab-menu-container" ref={menuRef} style={{ position: 'relative' }}>
      <button 
        className={`icon-button ${isCollaborating ? "active" : ""}`}
        aria-label="Collaboration menu"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '6px',
          color: isCollaborating ? 'var(--fg)' : '#e03131',
          padding: isCollaborating ? '4px 10px 4px 6px' : undefined,
          borderRadius: isCollaborating ? '100px' : undefined,
          background: isCollaborating ? 'var(--surface-sunken)' : undefined,
        }}
      >
        {isCollaborating && (
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            {Array.from(peers.values()).slice(0, 2).map((peer, i) => (
              <div 
                key={i} 
                className="avatar" 
                title={peer.name}
                style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  backgroundColor: peer.color, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#000', fontSize: '10px', fontWeight: 'bold'
                }}
              >
                {peer.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {peers.size > 2 && (
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--fg-muted)', margin: '0 4px' }}>
                +{peers.size - 2}
              </div>
            )}
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: collab.provider?.wsconnected ? '#40c057' : '#fd7e14',
                marginLeft: peers.size === 0 ? '0' : '4px',
              }}
              title={collab.provider?.wsconnected ? "Connected" : "Connecting"}
            />
          </div>
        )}
        <IconUsers />
      </button>

      {isOpen && (
        <div 
          className="collab-popover"
          style={{
            position: 'absolute', top: '100%', right: '0', marginTop: '8px',
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            width: '260px', zIndex: 100, padding: '12px', display: 'flex',
            flexDirection: 'column', gap: '12px',
          }}
        >
          {state === "LOCAL" ? (
            <>
              <div>
                <button className="primary" onClick={handleStart} style={{ width: '100%' }}>
                  Start Session
                </button>
                <p style={{ fontSize: '11px', color: 'var(--fg-muted)', margin: '6px 0 0', textAlign: 'center' }}>
                  Share your current canvas with others.
                </p>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0' }} />
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 550, color: 'var(--fg-muted)', marginBottom: '4px' }}>
                  Join with Code
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. abc123xy"
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    style={{
                      flex: 1, padding: '6px 8px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--line)', background: 'var(--surface-sunken)',
                      color: 'var(--fg)', fontSize: '12px', outline: 'none',
                      minWidth: 0, textTransform: 'lowercase',
                    }}
                  />
                  <button onClick={handleJoin} disabled={!code.trim()} style={{ padding: '6px 12px' }}>
                    Join
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 550 }}>Session Code</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', background: 'var(--surface-sunken)', padding: '2px 6px', borderRadius: '4px' }}>
                    {collab.room}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={handleCopyLink} style={{ flex: 1, fontSize: '11px', padding: '6px' }}>
                    {copied ? "Copied Link!" : "Copy Link"}
                  </button>
                  <button onClick={handleCopyCode} style={{ flex: 1, fontSize: '11px', padding: '6px' }}>
                    Copy Code
                  </button>
                </div>
              </div>
              
              <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0' }} />
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 550, color: 'var(--fg-muted)', marginBottom: '6px' }}>
                  My Name
                </label>
                <input
                  type="text"
                  defaultValue={collab.provider?.awareness.getLocalState()?.name || localStorage.getItem("fluxx_collab_name") || "Anonymous Fox"}
                  onChange={(e) => {
                    const newName = e.target.value.trim() || "Anonymous Fox";
                    collab.updatePresence({ name: newName });
                    localStorage.setItem("fluxx_collab_name", newName);
                  }}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--line)', background: 'var(--surface-sunken)',
                    color: 'var(--fg)', fontSize: '12px', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              {peers.size > 0 && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0' }} />
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 550, color: 'var(--fg-muted)', marginBottom: '8px' }}>
                      Participants ({peers.size})
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                      {Array.from(peers.values()).map((peer, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%',
                            backgroundColor: peer.color, flexShrink: 0
                          }} />
                          <span style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {peer.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0' }} />
              <button 
                onClick={handleLeave} 
                className="ghost-button" 
                style={{ color: 'var(--danger)', width: '100%', padding: '6px', fontSize: '12px' }}
              >
                {collab.isHost ? "End Session" : "Leave Session"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
