import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Play, CheckCircle, Lock, Eye } from 'lucide-react';
import { getViewerPath, getViewApiUrl, getFileName } from '../utils/documents';
import { useProgress } from '../hooks/useProgress';
import './DocumentCard.css';

function getFileIcon(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  if (['mp4', 'mov', 'webm'].includes(ext)) return Play;
  return FileText;
}

function isVideoItem(item) {
  return item.type === 'video' || item.files?.some((f) => f.endsWith('.mp4'));
}

export default function DocumentCard({ item, index, locked = false }) {
  const location = useLocation();
  const { isItemRead, markItemRead } = useProgress();

  const read = isItemRead(item.id);
  const hasFiles = item.files && item.files.length > 0;
  const showVideo = isVideoItem(item) && item.files?.[0];

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('resume') !== item.id) return;
    requestAnimationFrame(() => {
      document.getElementById(`doc-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.search, item.id]);

  const handleMarkDone = () => {
    if (locked || read) return;
    markItemRead(item.id);
  };

  return (
    <div id={`doc-${item.id}`} className={`document-card ${read ? 'complete' : ''} ${locked ? 'locked' : ''}`}>
      <div className="document-header">
        <span className="document-number">{index}</span>
        <div className="document-info">
          <h3 className="document-title">{item.title}</h3>
          {item.note && <p className="document-note">{item.note}</p>}
        </div>
        {read ? (
          <span className="complete-badge">
            <CheckCircle size={16} />
            Complete
          </span>
        ) : locked ? (
          <span className="locked-badge">
            <Lock size={14} />
            Open previous first
          </span>
        ) : (
          <span className="quiz-ready-badge">Not done yet</span>
        )}
      </div>

      {locked ? (
        <p className="locked-message">Open and read the previous document to unlock this one.</p>
      ) : (
        <>
          {hasFiles && (
            <div className="document-files">
              {item.files.map((file) => {
                const Icon = getFileIcon(file);
                return (
                  <Link
                    key={file}
                    to={getViewerPath(file, item.id)}
                    className="file-link"
                  >
                    <Icon size={16} />
                    <span className="file-name">{getFileName(file)}</span>
                    <Eye size={14} className="view-icon" />
                    <span className="view-label">Open</span>
                  </Link>
                );
              })}
            </div>
          )}

          {showVideo && (
            <div className="video-preview" onContextMenu={(e) => e.preventDefault()}>
              <video
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                preload="metadata"
                className="welcome-video"
              >
                <source src={getViewApiUrl(item.files[0])} type="video/mp4" />
                Your browser does not support video playback.
              </video>
            </div>
          )}

          {!read && (
            <div className="read-actions">
              <button type="button" className="btn-mark-read" onClick={handleMarkDone}>
                <CheckCircle size={16} />
                Mark as done
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
