"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import SocialLinks from "./SocialLinks";

interface Pipe {
  x: number;
  topHeight: number;
  bottomY: number;
  passed: boolean;
  size: "small" | "medium" | "large";
}

interface GameState {
  botY: number;
  botVelocity: number;
  pipes: Pipe[];
  score: number;
  gameOver: boolean;
  gameStarted: boolean;
  backgroundOffset: number;
  lastPipeTime: number;
}

const BOT_SIZE = 80; // Base size, will be responsive
const PIPE_GAP = 200; // Will be adjusted based on screen size

// Database pipe sizes - all same width
const PIPE_SIZES = {
  small: { width: 60, height: 120 },
  medium: { width: 60, height: 160 },
  large: { width: 60, height: 200 },
};
// Original physics constants (per frame at 60fps)
const GRAVITY = 0.4;
const JUMP_FORCE = -7;
const PIPE_SPEED = 2.5;

export default function FlappyBot() {
  const [gameState, setGameState] = useState<GameState>({
    botY: 400, // Will be updated by windowSize
    botVelocity: 0,
    pipes: [
      // Add one initial pipe visible on screen
      {
        x: 400,
        topHeight: 200,
        bottomY: 450,
        passed: false,
        size: "medium",
      },
    ],
    score: 0,
    gameOver: false,
    gameStarted: false,
    backgroundOffset: 0,
    lastPipeTime: 0,
  });

  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });
  const gameLoopRef = useRef<number | null>(null);
  const lastPipeTimeRef = useRef<number>(0);
  const [refreshRate, setRefreshRate] = useState<number>(60);

  // Detect refresh rate
  useEffect(() => {
    let frameCount = 0;
    let startTime = performance.now();

    function measureFPS() {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - startTime >= 1000) {
        const detectedFPS = Math.round(
          (frameCount * 1000) / (currentTime - startTime)
        );
        setRefreshRate(detectedFPS);
        return;
      }

      requestAnimationFrame(measureFPS);
    }

    requestAnimationFrame(measureFPS);
  }, []);

  // Handle window resize and initial size
  useEffect(() => {
    const handleResize = () => {
      const newSize = { width: window.innerWidth, height: window.innerHeight };
      setWindowSize(newSize);
      setGameState((prev) => ({
        ...prev,
        botY: newSize.height / 2,
      }));
    };

    // Set initial size
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const jump = useCallback(() => {
    if (!gameState.gameStarted) {
      setGameState((prev) => ({ ...prev, gameStarted: true }));
    }

    if (!gameState.gameOver) {
      // Scale jump force based on refresh rate - make it stronger on high refresh rates
      const jumpScale = refreshRate > 90 ? (75 / refreshRate) * 1.2 : 1;

      // Progressive difficulty - jump force also scales with score
      const difficultyMultiplier = 1 + gameState.score * 0.02;
      const maxDifficulty = 2.5;
      const cappedMultiplier = Math.min(difficultyMultiplier, maxDifficulty);

      const adjustedJumpForce = JUMP_FORCE * jumpScale * cappedMultiplier;

      setGameState((prev) => ({
        ...prev,
        botVelocity: adjustedJumpForce,
      }));
    }
  }, [gameState.gameStarted, gameState.gameOver, gameState.score, refreshRate]);

  const resetGame = useCallback(() => {
    setGameState({
      botY: windowSize.height / 2,
      botVelocity: 0,
      pipes: [],
      score: 0,
      gameOver: false,
      gameStarted: false,
      backgroundOffset: 0,
      lastPipeTime: 0,
    });
    lastPipeTimeRef.current = 0;
  }, [windowSize.height]);

  const gameLoop = useCallback(() => {
    setGameState((prev) => {
      if (prev.gameOver || !prev.gameStarted) {
        return prev;
      }

      // Scale physics based on refresh rate (75Hz reference)
      const physicsScale = refreshRate > 90 ? 75 / refreshRate : 1;
      // Make gravity even weaker on high refresh rates
      const gravityScale = refreshRate > 90 ? (75 / refreshRate) * 0.8 : 1;

      // Progressive difficulty - gets faster as score increases
      const difficultyMultiplier = 1 + prev.score * 0.02; // 2% faster per point
      const maxDifficulty = 2.5; // Cap at 2.5x speed
      const cappedMultiplier = Math.min(difficultyMultiplier, maxDifficulty);

      const adjustedGravity = GRAVITY * gravityScale * cappedMultiplier;
      const adjustedPipeSpeed = PIPE_SPEED * physicsScale * cappedMultiplier;

      // Update bot physics
      const newVelocity = prev.botVelocity + adjustedGravity;
      const newBotY = prev.botY + newVelocity;

      // Check ground collision
      if (newBotY + BOT_SIZE > windowSize.height) {
        return { ...prev, gameOver: true };
      }

      // Check ceiling collision
      if (newBotY < 0) {
        return { ...prev, gameOver: true };
      }

      // Generate new pipes
      const now = Date.now();
      let newPipes = [...prev.pipes];
      let pipeGenerated = false;

      if (now - prev.lastPipeTime > 2000) {
        // New pipe every 2 seconds
        const sizes = ["small", "medium", "large"] as const;
        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];

        const gapSize = Math.min(PIPE_GAP, windowSize.height * 0.3); // Responsive gap
        const minBottomSpace = 100; // Ensure at least 100px from bottom
        const maxTopHeight = windowSize.height - gapSize - minBottomSpace;
        const topHeight = Math.random() * (maxTopHeight - 50) + 50;
        newPipes.push({
          x: windowSize.width,
          topHeight,
          bottomY: topHeight + gapSize,
          passed: false,
          size: randomSize,
        });
        pipeGenerated = true;
      }

      // Update pipe positions

      newPipes = newPipes
        .map((pipe) => ({ ...pipe, x: pipe.x - adjustedPipeSpeed }))
        .filter((pipe) => {
          const pipeSize = PIPE_SIZES[pipe.size];
          return pipe.x > -pipeSize.width;
        });

      // Check pipe collisions
      const botLeft = windowSize.width * 0.1; // 10% from left
      const botRight = botLeft + BOT_SIZE;
      const botTop = newBotY + 15; // Add more padding
      const botBottom = newBotY + BOT_SIZE - 15; // Add more padding

      let gameOver = false;
      let newScore = prev.score;

      for (const pipe of newPipes) {
        const pipeSize = PIPE_SIZES[pipe.size];
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + pipeSize.width;

        if (botRight > pipeLeft && botLeft < pipeRight) {
          if (botTop < pipe.topHeight || botBottom > pipe.bottomY) {
            gameOver = true;
          }
        }

        // Score points
        if (!pipe.passed && pipe.x + pipeSize.width < botLeft) {
          pipe.passed = true;
          newScore += 1;
        }
      }

      if (gameOver) {
        return { ...prev, gameOver: true };
      }

      const newState = {
        ...prev,
        botY: newBotY,
        botVelocity: newVelocity,
        pipes: newPipes,
        score: newScore,
        backgroundOffset: prev.backgroundOffset,
        lastPipeTime: pipeGenerated ? now : prev.lastPipeTime,
      };

      return newState;
    });
  }, [windowSize.height, windowSize.width, refreshRate]);

  useEffect(() => {
    if (gameState.gameStarted && !gameState.gameOver) {
      gameLoopRef.current = requestAnimationFrame(function animate() {
        gameLoop();
        gameLoopRef.current = requestAnimationFrame(animate);
      });
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState.gameStarted, gameState.gameOver, gameLoop]);

  // Keyboard support
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        jump();
      } else if (event.code === "Escape") {
        event.preventDefault();
        if (gameState.gameStarted && !gameState.gameOver) {
          setGameState((prev) => ({ ...prev, gameOver: true }));
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [jump, gameState.gameStarted, gameState.gameOver]);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      {/* Top Center Score Display */}
      {gameState.gameStarted && !gameState.gameOver && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20">
          <p
            className="text-6xl font-bold drop-shadow-lg"
            style={{ color: "#22242B" }}
          >
            {gameState.score}
          </p>
        </div>
      )}

      {/* Game Canvas */}
      <div
        className="relative w-full h-full overflow-hidden cursor-pointer"
        onClick={!gameState.gameOver ? jump : undefined}
      >
        {/* Solid Background for Testing */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/background.svg)",
            backgroundSize: "100% auto",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "0% 100%",
            backgroundColor: "#FFFFFF",
          }}
        />

        {gameState.pipes.map((pipe, index) => {
          const pipeSize = PIPE_SIZES[pipe.size];
          return (
            <div key={index}>
              {/* Top pipe */}
              <div
                className="absolute"
                style={{
                  left: pipe.x,
                  top: 0,
                  width: pipeSize.width,
                  height: pipe.topHeight,
                  backgroundColor: "#509EE3",
                  border: "2px solid #4682B4",
                  zIndex: 10,
                }}
              />
              {/* Bottom pipe */}
              <div
                className="absolute"
                style={{
                  left: pipe.x,
                  top: pipe.bottomY,
                  width: pipeSize.width,
                  height: windowSize.height - pipe.bottomY,
                  backgroundColor: "#509EE3",
                  border: "2px solid #4682B4",
                  zIndex: 10,
                }}
              />
            </div>
          );
        })}

        {/* Metabot */}
        <div
          className="absolute z-10"
          style={{
            left: "10%",
            top: gameState.botY,
            width: BOT_SIZE,
            height: BOT_SIZE,
            transform: `rotate(${Math.min(
              Math.max(gameState.botVelocity * 3, -30),
              30
            )}deg)`,
            transformOrigin: "center",
            transition: "transform 0.1s ease-out",
          }}
        >
          <Image
            src="/metabot.svg"
            alt="Metabot"
            width={BOT_SIZE}
            height={BOT_SIZE}
            className="w-full h-full"
          />
        </div>

        {/* Start Screen Modal */}
        {!gameState.gameStarted && (
          <div className="absolute inset-0 flex items-center justify-center z-30 backdrop-blur-[2px]">
            {/* Social Links for Start Screen */}
            <div className="absolute top-4 right-4 z-40">
              <SocialLinks show={true} />
            </div>
            <div
              className="p-8 rounded-2xl text-center max-w-4xl mx-4 backdrop-blur-xl border border-white/20 shadow-2xl"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.6)",
                minWidth: "400px",
                width: "50vw",
                maxWidth: "500px",
              }}
            >
              <h1
                className="text-6xl font-bold mb-4"
                style={{ color: "#22242B" }}
              >
                Flappy Bot
              </h1>
              <p className="text-lg mb-8" style={{ color: "#5A6072" }}>
                Help Metabot navigate through the bar charts!
              </p>
              <button
                onClick={jump}
                className="font-bold py-4 px-8 rounded-lg text-xl text-white drop-shadow-lg hover:scale-105 transition-all duration-200"
                style={{ backgroundColor: "#509EE3" }}
              >
                Start Game
              </button>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {gameState.gameOver && (
          <div className="absolute inset-0 flex items-center justify-center z-30 backdrop-blur-[2px]">
            {/* Social Links for Game Over Screen */}
            <div className="absolute top-4 right-4 z-40">
              <SocialLinks show={true} />
            </div>
            <div
              className="p-8 rounded-2xl text-center max-w-4xl mx-4 backdrop-blur-xl border border-white/20 shadow-2xl"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.6)",
                minWidth: "400px",
                width: "50vw",
                maxWidth: "500px",
              }}
            >
              <h2
                className="text-5xl font-bold mb-4"
                style={{ color: "#22242B" }}
              >
                Game Over!
              </h2>
              <p className="text-2xl mb-8" style={{ color: "#22242B" }}>
                Final Score: {gameState.score}
              </p>
              <button
                onClick={resetGame}
                className="font-bold py-4 px-8 rounded-lg text-xl text-white drop-shadow-lg hover:scale-105 transition-all duration-200"
                style={{ backgroundColor: "#509EE3" }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions - only show on start and game over screens */}
      {(!gameState.gameStarted || gameState.gameOver) && (
        <div className="absolute bottom-4 left-4 z-30">
          <p className="text-sm" style={{ color: "#5A6072" }}>
            Press <strong>SPACEBAR</strong> or <strong>CLICK</strong> to flap
          </p>
        </div>
      )}
    </div>
  );
}
