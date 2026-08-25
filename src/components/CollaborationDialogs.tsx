import { useState, useEffect } from "react";
import { collab, generateCollaborationLink, type PeerPresence } from "../io/collaboration";

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
    
    collab.joinRoom(room, collabKey, finalName, color);
    
    // Remove hash from URL without reloading
    window.history.replaceState(null, "", window.location.pathname);
    onJoin();
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog join-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Join Collaboration</h2>
        <div className="dialog-content">
          <label>Your name</label>
          <input 
            autoFocus
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Anonymous Fox"
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
        </div>
        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={handleJoin}>Join Session</button>
        </div>
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
      
      collab.joinRoom(room, key, name, color);
      setLink(collab.shareUrl!);
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnd = () => {
    collab.leaveRoom();
    // Remove hash from URL to clean up
    window.history.replaceState(null, "", window.location.pathname);
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose} style={{ backdropFilter: 'blur(2px)' }}>
      <div 
        className="dialog share-dialog" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '400px', 
          textAlign: 'center',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          padding: '32px'
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Collaboration</h2>
        <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
          Share this link to let others join your session and edit in real-time.
        </p>
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          <input 
            readOnly 
            value={link} 
            onClick={(e) => e.currentTarget.select()} 
            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#f9f9f9', outline: 'none' }}
          />
          <button 
            className="primary" 
            onClick={handleCopy}
            style={{ padding: '0 20px', borderRadius: '8px', whiteSpace: 'nowrap' }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={handleEnd} 
            style={{ 
              background: 'none', border: 'none', color: '#e03131', 
              fontWeight: 'bold', cursor: 'pointer', padding: '8px 0' 
            }}
          >
            End Session
          </button>
          <button 
            onClick={onClose}
            style={{ 
              background: '#f1f3f5', border: 'none', padding: '8px 24px', 
              borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' 
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function CollaborationAvatars() {
  const [peers, setPeers] = useState<Map<number, PeerPresence>>(new Map());
  // Force a re-render periodically or subscribe to changes
  useEffect(() => {
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
  }, [collab.provider]);

  // We need to re-render when collab.room changes
  const [inRoom, setInRoom] = useState(!!collab.room);
  useEffect(() => {
    const interval = setInterval(() => {
      if (!!collab.room !== inRoom) setInRoom(!!collab.room);
    }, 1000);
    return () => clearInterval(interval);
  }, [inRoom]);

  if (!inRoom) return null;

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
      {peers.size > 3 && <div className="avatar-more" style={{ fontSize: '12px', fontWeight: 'bold' }}>+{peers.size - 3}</div>}
      <div className="connection-status" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#40c057', marginLeft: '4px' }} title="Connected"></div>
    </div>
  );
}
