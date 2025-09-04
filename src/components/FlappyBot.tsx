"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

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

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 800;
const BOT_SIZE = 80; // Base size, will be responsive
const PIPE_WIDTH = 60;
const PIPE_GAP = 200; // Will be adjusted based on screen size

// Database pipe sizes - all same width
const PIPE_SIZES = {
  small: { width: 60, height: 120 },
  medium: { width: 60, height: 160 },
  large: { width: 60, height: 200 },
};
const GRAVITY = 0.5;
const JUMP_FORCE = -8;
const PIPE_SPEED = 3;

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
  const gameLoopRef = useRef<number>();
  const lastPipeTimeRef = useRef<number>(0);

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
      setGameState((prev) => ({
        ...prev,
        botVelocity: JUMP_FORCE,
      }));
    }
  }, [gameState.gameStarted, gameState.gameOver]);

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
  }, []);

  const gameLoop = useCallback(() => {
    setGameState((prev) => {
      if (prev.gameOver || !prev.gameStarted) {
        return prev;
      }

      console.log(
        `🔄 Game loop: pipes=${prev.pipes.length}, lastPipeTime=${prev.lastPipeTime}`
      );
      // Update bot physics
      const newVelocity = prev.botVelocity + GRAVITY;
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
        const pipeSize = PIPE_SIZES[randomSize];

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
        console.log(
          `🆕 Generated pipe #${newPipes.length} at x:${windowSize.width}`
        );
      }

      // Update pipe positions
      if (newPipes.length > 0) {
        console.log(
          `📍 Before move: pipes at positions:`,
          newPipes.map((p) => `${p.x}`).join(", ")
        );
      }

      newPipes = newPipes
        .map((pipe) => ({ ...pipe, x: pipe.x - PIPE_SPEED }))
        .filter((pipe) => {
          const pipeSize = PIPE_SIZES[pipe.size];
          const shouldKeep = pipe.x > -pipeSize.width;
          if (!shouldKeep) {
            console.log(
              `🗑️ Removing pipe at x:${pipe.x}, width:${pipeSize.width}`
            );
          }
          return shouldKeep;
        });

      if (newPipes.length > 0) {
        console.log(
          `📍 After move: pipes at positions:`,
          newPipes.map((p) => `${p.x}`).join(", ")
        );
      }

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
            console.log(
              `💥 Collision detected! Bot: top=${botTop}, bottom=${botBottom}, Pipe: top=${pipe.topHeight}, bottom=${pipe.bottomY}`
            );
          }
        }

        // Score points
        if (!pipe.passed && pipe.x + pipeSize.width < botLeft) {
          pipe.passed = true;
          newScore += 1;
          console.log(
            `🎯 Scored! Pipe at x:${pipe.x}, botLeft:${botLeft}, newScore:${newScore}`
          );
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

      console.log(
        `📊 State update: pipes ${prev.pipes.length} → ${newPipes.length}${
          pipeGenerated ? " (NEW PIPE!)" : ""
        }`
      );
      return newState;
    });
  }, []);

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
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [jump]);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ backgroundColor: "#c6c9d2" }}
    >
      {/* Top Center Score Display */}
      {gameState.gameStarted && !gameState.gameOver && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20">
          <p className="text-6xl font-bold text-white drop-shadow-lg">
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
            backgroundColor: "#c6c9d2",
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
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="bg-white p-8 rounded-lg text-center max-w-md mx-4">
              <h1
                className="text-6xl font-bold mb-8"
                style={{ color: "#22242B" }}
              >
                Flappy Bot
              </h1>
              <button
                onClick={jump}
                className="text-white font-bold py-4 px-8 rounded-lg text-xl"
                style={{ backgroundColor: "#509EE3" }}
              >
                Start Game
              </button>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {gameState.gameOver && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="bg-white p-8 rounded-lg text-center max-w-md mx-4">
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
                className="text-white font-bold py-4 px-8 rounded-lg text-xl"
                style={{ backgroundColor: "#509EE3" }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {gameState.gameStarted && !gameState.gameOver && (
        <div className="absolute bottom-4 left-4 z-20 text-gray-800 text-sm">
          <p>Click or press space to jump</p>
        </div>
      )}
    </div>
  );
}
