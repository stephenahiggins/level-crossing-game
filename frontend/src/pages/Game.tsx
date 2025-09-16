import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FlagButton } from "../components/FlagButton";
import { FeedbackOverlay } from "../components/FeedbackOverlay";
import { Timer } from "../components/Timer";
import { CountryInput } from "../components/CountryInput";
import { GameConfig } from "../lib/config";
import { getCountryName } from "../lib/countries";
import { getFlagBase64 } from "../lib/flags";
import { hasCrossingsData, setCrossingsData } from "../lib/roundGenerator";
import type { GameMode } from "../lib/types";
import { Leaderboard } from "../components/Leaderboard";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  nextRound,
  setFeedbackAcknowledged,
  startGame,
  submitAnswer,
  tickTimer,
  resetGame,
} from "../store/gameSlice";
import { recordLocalScore } from "../store/leaderboardSlice";
import { useGetCrossingsQuery, usePostScoreMutation } from "../store/api";

const MODE_VALUES: GameMode[] = ["easy", "medium", "hard"];

export function Game() {
  const { mode: modeParam } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const mode = MODE_VALUES.includes(modeParam as GameMode) ? (modeParam as GameMode) : null;

  useEffect(() => {
    if (!mode) {
      navigate("/");
    }
  }, [mode, navigate]);

  const {
    data: crossingData,
    isLoading: crossingsLoading,
    isError: crossingsError,
    error: crossingsFetchError,
    refetch: refetchCrossings,
  } = useGetCrossingsQuery();

  const [crossingsReady, setCrossingsReady] = useState(hasCrossingsData());
  const [crossingsMessage, setCrossingsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (crossingData) {
      setCrossingsData(crossingData);
    }
    const ready = hasCrossingsData();
    setCrossingsReady(ready);
    console.log("LOG ready:", { ready, crossingData, crossingsLoading, crossingsError });
    if (ready) {
      setCrossingsMessage(null);
    } else if (!crossingsLoading && !crossingsError) {
      setCrossingsMessage(
        'No level crossing data found. Run "node scripts/export_crossings.mjs --target backend" after running the scraper to populate assets.'
      );
    }
  }, [crossingData, crossingsLoading, crossingsError]);

  useEffect(() => {
    if (crossingsError) {
      setCrossingsMessage(
        "Unable to load level crossing images from the server. Check that the backend has exported the assets."
      );
      setCrossingsReady(hasCrossingsData());
    }
  }, [crossingsError]);

  useEffect(() => {
    if (crossingsError && crossingsFetchError) {
      console.error("Failed to load level crossings", crossingsFetchError);
    }
  }, [crossingsError, crossingsFetchError]);

  useEffect(() => {
    if (!mode || !crossingsReady) {
      return;
    }
    dispatch(resetGame());
    dispatch(startGame({ mode }));
    return () => {
      dispatch(resetGame());
    };
  }, [dispatch, mode, crossingsReady]);

  if (!mode) {
    return null;
  }

  const {
    mode: activeMode,
    status,
    timer,
    round,
    feedback,
    score,
    correctCount,
    failedRounds,
    totalCorrectTime,
    roundStartedAt,
  } = useAppSelector((state) => state.game);
  const { user } = useAppSelector((state) => state.auth);

  const [postScore, { isLoading: posting, isSuccess: submitted, isError: submitError }] =
    usePostScoreMutation();
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (status !== "gameover") {
      setScoreSubmitted(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === "playing") {
      const interval = window.setInterval(() => {
        dispatch(tickTimer());
      }, 1000);
      return () => window.clearInterval(interval);
    }
    return undefined;
  }, [dispatch, status]);

  useEffect(() => {
    if (status !== "gameover") {
      recordedRef.current = false;
    }
    if (status === "gameover" && !recordedRef.current && activeMode) {
      const avgTime = correctCount > 0 ? totalCorrectTime / correctCount : 0;
      if (score > 0) {
        dispatch(
          recordLocalScore({
            mode: activeMode,
            score: {
              id: `${Date.now()}`,
              score,
              correctCount,
              duration: GameConfig.gameSeconds - timer,
              avgTimePerCorrect: avgTime,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }
      recordedRef.current = true;
    }
  }, [activeMode, correctCount, dispatch, score, status, timer, totalCorrectTime]);

  const handleAnswer = (answerCode: string) => {
    if (!round || status !== "playing") return;
    const now = Date.now();
    const started = roundStartedAt ?? now;
    const timeTaken = Math.max(0.5, (now - started) / 1000);
    dispatch(submitAnswer({ answer: answerCode, timeTaken }));
  };

  const handleHardSubmit = (answerCode: string) => {
    handleAnswer(answerCode);
  };

  const handleFeedbackContinue = () => {
    if (!feedback) return;
    if (feedback === "try-again") {
      dispatch(setFeedbackAcknowledged());
    } else {
      dispatch(nextRound());
    }
  };

  const submitGlobalScore = async () => {
    if (!activeMode) return;
    const duration = GameConfig.gameSeconds - timer;
    const avgTime = correctCount > 0 ? totalCorrectTime / correctCount : 0;
    try {
      await postScore({
        mode: activeMode,
        score,
        duration,
        correctCount,
        avgTimePerCorrect: Number(avgTime.toFixed(2)),
      }).unwrap();
      setScoreSubmitted(true);
    } catch (error) {
      console.error("Failed to submit score", error);
    }
  };

  const backgroundImage = useMemo(
    () => round?.crossing.imagePath ?? "",
    [round?.crossing.imagePath]
  );

  const showGameOver = status === "gameover";

  if (!crossingsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="bg-black/70 text-white rounded-3xl shadow-2xl p-8 max-w-xl text-center space-y-4">
          <h2 className="text-3xl font-extrabold">Preparing level crossings…</h2>
          <p className="text-lg leading-relaxed">
            {crossingsLoading
              ? "Loading level crossing photos from the server."
              : crossingsMessage ??
                "No level crossings are available yet. Export the assets and refresh this page."}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {crossingsError && (
              <button
                type="button"
                onClick={() => refetchCrossings()}
                className="bg-secondary text-dark font-semibold px-5 py-2 rounded-full shadow-md hover:-translate-y-0.5 transition"
              >
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="bg-white/80 text-dark font-semibold px-5 py-2 rounded-full shadow-md hover:-translate-y-0.5 transition"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {backgroundImage && (
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center blur-sm opacity-70"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}
      <div className="bg-black/40 rounded-3xl p-4 md:p-8 text-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Timer seconds={Math.max(0, timer)} />
          <div className="flex flex-wrap gap-3 text-lg font-semibold">
            <div className="bg-white/10 px-4 py-2 rounded-full">Score: {score}</div>
            <div className="bg-white/10 px-4 py-2 rounded-full">Correct: {correctCount}</div>
            <div className="bg-white/10 px-4 py-2 rounded-full">Missed: {failedRounds}</div>
          </div>
        </div>

        {round && !showGameOver && (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1 w-full">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/40">
                <img
                  src={round.crossing.imagePath}
                  alt="Level crossing"
                  className="w-full h-[320px] md:h-[420px] object-cover"
                />
              </div>
            </div>
            <div className="flex-1 w-full">
              {activeMode === "hard" ? (
                <CountryInput onSubmit={handleHardSubmit} disabled={status !== "playing"} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {round.options.map((option) => (
                    <FlagButton
                      key={option.code}
                      base64={getFlagBase64(option.code)}
                      label={getCountryName(option.code)}
                      withLabel={activeMode === "easy"}
                      onClick={() => handleAnswer(option.code)}
                      disabled={status !== "playing"}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showGameOver && (
          <div className="text-center py-12">
            <h2 className="text-4xl font-black mb-4">Time&apos;s up!</h2>
            <p className="text-2xl mb-6">
              You scored {score} with {correctCount} correct crossings.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mb-6">
              <button
                type="button"
                onClick={() => mode && dispatch(startGame({ mode }))}
                className="bg-secondary text-dark font-extrabold px-6 py-3 rounded-full shadow-lg hover:-translate-y-1 transition"
              >
                Play again
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="bg-white/80 text-dark font-bold px-6 py-3 rounded-full shadow-lg hover:-translate-y-1 transition"
              >
                Home
              </button>
              {user && score > 0 && (
                <button
                  type="button"
                  disabled={posting || scoreSubmitted || submitted}
                  onClick={submitGlobalScore}
                  className="bg-primary text-white font-bold px-6 py-3 rounded-full shadow-lg hover:-translate-y-1 transition disabled:opacity-60"
                >
                  {scoreSubmitted || submitted
                    ? "Score submitted!"
                    : posting
                    ? "Submitting…"
                    : "Submit to global leaderboard"}
                </button>
              )}
            </div>
            {submitError && (
              <div className="text-red-200">Could not submit score. Try again later.</div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8">
        <Leaderboard mode={activeMode ?? "easy"} />
      </div>

      <FeedbackOverlay feedback={feedback} onContinue={handleFeedbackContinue} />
    </div>
  );
}
