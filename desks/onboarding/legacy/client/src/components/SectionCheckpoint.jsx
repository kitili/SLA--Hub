import { useState } from 'react';
import { Shield } from 'lucide-react';
import { getCheckpointForSection } from '../data/checkpoints';
import { useProgress } from '../hooks/useProgress';
import CheckpointQuiz from './CheckpointQuiz';
import './SectionCheckpoint.css';

export default function SectionCheckpoint({ section, itemsComplete }) {
  const checkpoint = getCheckpointForSection(section.id);
  const { isCheckpointPassed, markCheckpointPassed, resetCheckpoint } = useProgress();
  const [quizFailed, setQuizFailed] = useState(false);

  if (!checkpoint) return null;

  const checkpointId = `section-${section.id}`;
  const passed = isCheckpointPassed(checkpointId);
  const showQuiz = itemsComplete && !passed && !quizFailed;

  if (passed) {
    return (
      <div className="section-checkpoint passed">
        <Shield size={20} />
        <span>Section {section.number} checkpoint passed — section complete!</span>
      </div>
    );
  }

  if (!itemsComplete) {
    return (
      <div className="section-checkpoint locked">
        <Shield size={20} />
        <div>
          <strong>Section Checkpoint</strong>
          <p>
            {section.items.length === 0
              ? 'Documents for this section are not available yet. The checkpoint will unlock once materials are added.'
              : 'Mark all documents above as done to unlock the section quiz (1 question).'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-checkpoint active">
      <div className="section-checkpoint-intro">
        <Shield size={22} />
        <div>
          <strong>Section Checkpoint</strong>
          <p>One question on {section.title} — read carefully before answering.</p>
        </div>
      </div>

      {quizFailed && (
        <div className="section-retry-note">
          Incorrect — review the section documents above, then retake the checkpoint.
        </div>
      )}

      {quizFailed && (
        <button type="button" className="btn-start-section-quiz" onClick={() => setQuizFailed(false)}>
          Retake Section Checkpoint
        </button>
      )}

      {showQuiz && (
        <CheckpointQuiz
          checkpointId={checkpointId}
          checkpoint={checkpoint}
          onPass={(id) => { markCheckpointPassed(id); setQuizFailed(false); }}
          onFail={(id) => { resetCheckpoint(id); setQuizFailed(true); }}
          failed={quizFailed}
        />
      )}
    </div>
  );
}
