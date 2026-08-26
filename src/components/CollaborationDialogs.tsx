import { useState, useEffect } from "react";
import {
  collab,
  generateCollaborationLink,
  yMeta,
  type PeerPresence,
} from "../io/collaboration";
import { store } from "../store";
import { IconClose } from "./icons";

export function JoinDialog({ 
  room, 
  collabKey, 
  onJoin, 
  onCancel 
}: { 
  room: string; 
  collabKey: string; 
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
    
    collab.joinRoom(room, collabKey, finalName, color, false);
    
    // Remove hash from URL without reloading
    window.history.replaceState(null, "", window.location.pathname);
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

export function ShareDialog({ 
  onClose 
}: { 
  onClose: () => void;
}) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (collab.room && collab.shareUrl) {
      // Already in a room — just show the stored link
      setLink(collab.shareUrl);
    } else {
      // Start a new room
      const { room, key } = generateCollaborationLink();
      const name = localStorage.getItem("fluxx_collab_name") || "Host Fox";
      const colors = ["#ff8787", "#69db7c", "#74c0fc", "#ffd43b", "#b2f2bb", "#a5d8ff"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      collab.joinRoom(room, key, name, color, true);
      yMeta.set("ended", false);
      store.publishScene();
      setLink(collab.shareUrl!);
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnd = () => {
    if (collab.isHost) {
      yMeta.set("ended", true);
    }
    
    // Give Yjs a moment to broadcast the 'ended' message before destroying the provider
    setTimeout(() => {
      collab.leaveRoom();
      window.history.replaceState(null, "", window.location.pathname);
    }, 1000);
    
    onClose();
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog compact" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <header>
          <h2>Collaboration</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <IconClose />
          </button>
        </header>
        <div className="dialog-body" style={{ padding: '16px 20px' }}>
          <p style={{ color: 'var(--fg-muted)', fontSize: '13px', margin: '0 0 16px' }}>
            Share this link to let others join and edit in real-time.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              readOnly 
              value={link} 
              onClick={(e) => e.currentTarget.select()} 
              style={{ 
                flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--line)', background: '#ffffff',
                color: '#000000', fontSize: '12px', outline: 'none',
                minWidth: 0,
              }}
            />
            <button 
              onClick={handleCopy}
              style={{ 
                padding: '7px 14px', fontSize: '12.5px', fontWeight: 550,
                borderRadius: 'var(--radius-md)', background: '#ffffff',
                color: '#000000', border: '1px solid var(--line)', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <footer style={{ justifyContent: 'space-between' }}>
          <button 
            onClick={handleEnd} 
            className="ghost-button" 
            style={{ color: 'var(--danger)', padding: 0 }}
          >
            {collab.isHost ? "End Session" : "Leave Session"}
          </button>
          <button className="primary" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  );
}

export function CollaborationAvatars() {
  const [peers, setPeers] = useState<Map<number, PeerPresence>>(new Map());
  const [room] = useState(collab.room);

  useEffect(() => {
    if (!room) return;
    if (!collab.provider) return;

    const updatePeers = () => {
      setPeers(new Map(collab.getPeers()));
    };
    
    collab.provider.awareness.on("change", updatePeers);
    // Initial fetch
    updatePeers();
    return () => {
      if (collab.provider) collab.provider.awareness.off("change", updatePeers);
    }
  }, [room]);

  if (!room) return null;

  return (
    <div className="collab-avatars" style={{ display: 'flex', gap: '4px', alignItems: 'center', marginRight: '8px' }}>
      {Array.from(peers.values()).slice(0, 3).map((peer, i) => (
        <div 
          key={i} 
          className="avatar" 
          title={peer.name}
          style={{
            width: '24px', height: '24px', borderRadius: '50%',
            backgroundColor: peer.color, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#000', fontSize: '12px', fontWeight: 'bold'
          }}
        >
          {peer.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {peers.size > 3 && <div className="avatar-more" style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fg-muted)' }}>+{peers.size - 3}</div>}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: collab.provider?.wsconnected ? '#40c057' : '#fd7e14',
          marginLeft: '4px',
        }}
        title={collab.provider?.wsconnected ? "Connected" : "Connecting"}
      />
    </div>
  );
}
