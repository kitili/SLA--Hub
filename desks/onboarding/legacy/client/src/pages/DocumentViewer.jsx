import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, FileWarning } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { getViewApiUrl, getFileName, getDocumentType } from '../utils/documents';
import { useHubContent } from '../context/HubContentContext';
import { useProgress } from '../hooks/useProgress';
import './DocumentViewer.css';

export default function DocumentViewer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const docPath = searchParams.get('doc');
  const itemId = searchParams.get('item');
  const docxRef = useRef(null);
  const { getAllItems } = useHubContent();
  const { isItemRead, markItemRead } = useProgress();

  const [docxError, setDocxError] = useState(null);
  const [docxLoading, setDocxLoading] = useState(false);

  const item = itemId ? getAllItems().find((i) => i.id === itemId) : null;
  const backLink = item ? `/section/${item.sectionId}?resume=${itemId}` : '/';

  useEffect(() => {
    if (!docPath || getDocumentType(docPath) !== 'docx') return;

    let cancelled = false;
    setDocxLoading(true);
    setDocxError(null);

    const loadDocx = () => {
      const container = docxRef.current;
      if (!container) return false;
      container.innerHTML = '';

      fetch(getViewApiUrl(docPath))
        .then((res) => {
          if (!res.ok) throw new Error('Could not load document');
          return res.blob();
        })
        .then((blob) => {
          if (cancelled || !docxRef.current) return;
          return renderAsync(blob, docxRef.current, undefined, {
            className: 'docx-preview-content',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
          });
        })
        .catch((err) => {
          if (!cancelled) setDocxError(err.message);
        })
        .finally(() => {
          if (!cancelled) setDocxLoading(false);
        });
      return true;
    };

    if (!loadDocx()) {
      const frame = requestAnimationFrame(() => {
        if (!cancelled) loadDocx();
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }

    return () => { cancelled = true; };
  }, [docPath]);

  if (!docPath) {
    return (
      <div className="viewer-empty">
        <p>No document selected.</p>
        <Link to="/">Back to Dashboard</Link>
      </div>
    );
  }

  const docType = getDocumentType(docPath);
  const viewUrl = getViewApiUrl(docPath);
  const title = item?.title || getFileName(docPath);
  const isPublicHost = !['localhost', '127.0.0.1'].includes(window.location.hostname)
    && !viewUrl.includes('localhost');
  const read = itemId ? isItemRead(itemId) : false;

  const handleMarkDone = () => {
    if (!itemId || read) return;
    markItemRead(itemId);
    navigate(backLink);
  };

  return (
    <div className="document-viewer-page">
      <header className="viewer-toolbar">
        <button type="button" className="viewer-back" onClick={() => navigate(backLink)}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div className="viewer-title-wrap">
          <h1>{title}</h1>
          <span className="viewer-filename">{getFileName(docPath)}</span>
        </div>
        {itemId && (
          read ? (
            <span className="viewer-done-badge">
              <CheckCircle size={14} />
              Done
            </span>
          ) : (
            <button type="button" className="viewer-done-btn" onClick={handleMarkDone}>
              <CheckCircle size={16} />
              Mark as done
            </button>
          )
        )}
        <span className="viewer-badge">View only</span>
      </header>

      <div className="viewer-notice">
        Read the document, then press <strong>Mark as done</strong> when you have finished.
      </div>

      <div className="viewer-frame-wrap" onContextMenu={(e) => e.preventDefault()}>
        {docType === 'pdf' && (
          <iframe
            src={`${viewUrl}#toolbar=0&navpanes=0`}
            title={title}
            className="viewer-iframe"
          />
        )}

        {docType === 'video' && (
          <video
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            className="viewer-video"
            src={viewUrl}
          >
            Your browser does not support video playback.
          </video>
        )}

        {docType === 'image' && (
          <div className="viewer-image-wrap">
            <img src={viewUrl} alt={title} className="viewer-image" draggable={false} />
          </div>
        )}

        {docType === 'docx' && (
          <div className="viewer-docx-wrap">
            {docxLoading && <p className="viewer-loading">Loading document…</p>}
            {docxError && (
              <div className="viewer-fallback">
                <FileWarning size={32} />
                <p>Could not preview this document in the browser.</p>
              </div>
            )}
            <div ref={docxRef} className="viewer-docx" />
          </div>
        )}

        {docType === 'pptx' && (
          <div className="viewer-pptx-wrap">
            {isPublicHost ? (
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewUrl)}`}
                title={title}
                className="viewer-iframe"
              />
            ) : (
              <div className="viewer-fallback viewer-pptx-local">
                <FileWarning size={32} />
                <p><strong>{getFileName(docPath)}</strong></p>
                <p>Presentation preview requires the hub to be deployed on a public URL.</p>
                <p className="viewer-pptx-local-hint">Please ask your onboarding lead if you need access to this file on a school device.</p>
              </div>
            )}
          </div>
        )}

        {docType === 'unknown' && (
          <div className="viewer-fallback">
            <FileWarning size={32} />
            <p>This file type cannot be previewed in the browser.</p>
          </div>
        )}
      </div>
    </div>
  );
}
