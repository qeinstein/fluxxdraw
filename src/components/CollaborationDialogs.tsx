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

  useEffect(() => {
    // If not in a room, start one
    if (!collab.room) {
      const { room, key, url } = generateCollaborationLink();
      const name = localStorage.getItem("fluxx_collab_name") || "Host Fox";
      const colors = ["#ff8787", "#69db7c", "#74c0fc", "#ffd43b", "#b2f2bb", "#a5d8ff"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      collab.joinRoom(room, key, name, color);
      setLink(url);
    } else {
      // Re-construct the link for the current room
      // For v1, let's assume we store the link/key in collabManager if needed, or we just show "Already collaborating"
      setLink(window.location.href);
    }
  }, []);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog share-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Start Collaboration</h2>
        <div className="dialog-content">
          <p>Anyone with this link can edit.</p>
          <input readOnly value={link} onClick={(e) => e.currentTarget.select()} />
        </div>
        <div className="dialog-actions">
          <button onClick={() => {
            navigator.clipboard.writeText(link);
          }}>Copy link</button>
          <button className="primary" onClick={onClose}>Done</button>
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
