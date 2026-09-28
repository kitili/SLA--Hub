import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { PASS_THRESHOLD } from '../data/checkpoints';
import './CheckpointQuiz.css';

export default function CheckpointQuiz({
  checkpointId,
  checkpoint,
  onPass,
  onFail,
  failed = false,
}) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);

  const questions = checkpoint.questions;

  const handleSelect = (questionId, optionIndex) => {
    if (submitted && score !== null && score >= PASS_THRESHOLD) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = () => {
    const answered = questions.every((q) => answers[q.id] !== undefined);
    if (!answered) return;

    const correct = questions.filter((q) => answers[q.id] === q.correct).length;
    const result = correct / questions.length;
    setScore(result);
    setSubmitted(true);

    if (result >= PASS_THRESHOLD) {
      onPass(checkpointId);
    } else {
      onFail(checkpointId);
    }
  };

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);
  const passed = submitted && score !== null && score >= PASS_THRESHOLD;
  const failedAttempt = submitted && score !== null && score < PASS_THRESHOLD;

  return (
    <div className={`checkpoint-quiz ${passed ? 'passed' : ''} ${failedAttempt || failed ? 'failed' : ''}`}>
      <div className="checkpoint-header">
        <span className="checkpoint-label">📋 Checkpoint</span>
        <h4>{checkpoint.title}</h4>
        <p className="checkpoint-hint">One quick question to confirm you read the material.</p>
      </div>

      {(failedAttempt || failed) && !passed && (
        <div className="checkpoint-fail-banner">
          <AlertTriangle size={18} />
          <div>
            <strong>Not quite — please re-read the material above and try again.</strong>
            <p>You need all answers correct to pass this checkpoint.</p>
          </div>
        </div>
      )}

      {passed && (
        <div className="checkpoint-pass-banner">
          <CheckCircle size={18} />
          <span>Checkpoint passed! Well done.</span>
        </div>
      )}

      <div className="questions-list">
        {questions.map((q, qi) => {
          const selected = answers[q.id];
          const isWrong = submitted && selected !== undefined && selected !== q.correct;

          return (
            <div key={q.id} className="question-block">
              <p className="question-text">
                <span className="q-num">{qi + 1}.</span> {q.text}
              </p>
              <div className="options-list">
                {q.options.map((opt, oi) => {
                  let optClass = 'option-btn';
                  if (selected === oi) optClass += ' selected';
                  if (submitted && oi === q.correct) optClass += ' correct';
                  if (isWrong && selected === oi) optClass += ' wrong';

                  return (
                    <button
                      key={oi}
                      type="button"
                      className={optClass}
                      onClick={() => handleSelect(q.id, oi)}
                      disabled={passed}
                    >
                      {submitted && oi === q.correct && <CheckCircle size={14} className="opt-icon" />}
                      {isWrong && selected === oi && <XCircle size={14} className="opt-icon" />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="checkpoint-actions">
        {!passed && !failedAttempt && (
          <button
            type="button"
            className="btn-submit-checkpoint"
            onClick={handleSubmit}
            disabled={!allAnswered}
          >
            Submit Answers
          </button>
        )}
      </div>
    </div>
  );
}
