import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { speak } from "../lib/tts";
import { CountryMapHighlight } from "./CountryMapHighlight";

type FeedbackType = "correct" | "try-again" | "failed";

const feedbackCopy: Record<FeedbackType, { title: string; emoji: string; color: string }> = {
  correct: { title: "Well done!", emoji: "👍", color: "bg-green-500/90" },
  "try-again": { title: "Try again!", emoji: "🙂", color: "bg-yellow-500/90" },
  failed: { title: "Next time!", emoji: "💡", color: "bg-red-500/90" },
};

interface FeedbackOverlayProps {
  feedback: FeedbackType | null;
  onContinue: () => void;
  correctAnswerCode?: string;
  correctAnswerName?: string; // optional human readable name if available
  highlightLatitude?: number | null;
  highlightLongitude?: number | null;
}

export function FeedbackOverlay({
  feedback,
  onContinue,
  correctAnswerCode,
  correctAnswerName,
  highlightLatitude,
  highlightLongitude,
}: FeedbackOverlayProps) {
  useEffect(() => {
    if (feedback) {
      let base = feedbackCopy[feedback].title;
      if (feedback === "failed" && (correctAnswerName || correctAnswerCode)) {
        const answerText = correctAnswerName ?? correctAnswerCode;
        base = `${base} It was ${answerText}.`;
      }
      speak(base);
    }
  }, [feedback, correctAnswerCode, correctAnswerName]);

  return (
    <AnimatePresence>
      {feedback && (
        <motion.div
          key={feedback}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className={`px-10 py-8 rounded-3xl text-center text-white shadow-2xl max-w-md w-[90%] ${feedbackCopy[feedback].color}`}
          >
            <div className="text-6xl drop-shadow-xl mb-4">{feedbackCopy[feedback].emoji}</div>
            <h2 className="text-3xl font-extrabold mb-4">{feedbackCopy[feedback].title}</h2>
            {feedback === "failed" && (correctAnswerName || correctAnswerCode) && (
              <p className="text-xl font-semibold mb-6">
                Correct country: {correctAnswerName || correctAnswerCode}
              </p>
            )}
            {(feedback === "correct" || feedback === "failed") && (
              <CountryMapHighlight
                countryCode={correctAnswerCode}
                latitude={highlightLatitude}
                longitude={highlightLongitude}
                outcome={feedback === "correct" ? "correct" : "failed"}
              />
            )}
            <button
              type="button"
              onClick={onContinue}
              className="bg-white text-dark font-bold text-xl px-6 py-3 rounded-full shadow-lg hover:shadow-2xl transition-transform hover:-translate-y-1"
            >
              {feedback === "try-again" ? "Give it another go" : "Next crossing"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
