"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { useMenuContext } from "@/components/context/MenuContext";
import {
  activateImmersiveMode,
  canUseImmersiveMode,
  deactivateImmersiveMode,
} from "@/lib/immersive/immersiveMode";

const REQUIRED_FINGERS = 3;
const REQUIRED_TAPS = 5;
/** Max time between the first and last three-finger tap in a sequence. */
const TAP_SEQUENCE_MS = 4000;
/** Max duration of a single three-finger tap. */
const TAP_MAX_DURATION_MS = 450;
/** Max pointer travel (px) still counted as a tap. */
const TAP_MAX_MOVE_PX = 40;

/**
 * When POS is enabled on native Android: enter immersive (hide system bars),
 * re-apply on resume, and open Exit/Cancel after five three-finger taps.
 */
export default function PosImmersiveHost() {
  const { menuConfig } = useMenuContext();
  const posEnabled = Boolean(menuConfig?.posEnabled);
  const enabled = posEnabled && canUseImmersiveMode();

  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const exitDialogOpenRef = useRef(false);
  const pointersRef = useRef(new Map());
  const originsRef = useRef(new Map());
  const gestureMaxFingersRef = useRef(0);
  const gestureStartRef = useRef(0);
  const maxTravelRef = useRef(0);
  const tapCountRef = useRef(0);
  const tapWindowStartRef = useRef(0);

  useEffect(() => {
    exitDialogOpenRef.current = exitDialogOpen;
  }, [exitDialogOpen]);

  useEffect(() => {
    if (!enabled) {
      deactivateImmersiveMode().catch(() => {});
      setExitDialogOpen(false);
      return undefined;
    }

    activateImmersiveMode().catch(() => {});

    let listener;
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && !exitDialogOpenRef.current) {
        activateImmersiveMode().catch(() => {});
      }
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      listener?.remove?.();
      deactivateImmersiveMode().catch(() => {});
    };
  }, [enabled]);

  const resetTapSequence = useCallback(() => {
    tapCountRef.current = 0;
    tapWindowStartRef.current = 0;
  }, []);

  const registerThreeFingerTap = useCallback(() => {
    if (exitDialogOpenRef.current) return;

    const now = Date.now();
    if (
      tapCountRef.current === 0 ||
      now - tapWindowStartRef.current > TAP_SEQUENCE_MS
    ) {
      tapCountRef.current = 0;
      tapWindowStartRef.current = now;
    }

    tapCountRef.current += 1;
    if (tapCountRef.current >= REQUIRED_TAPS) {
      resetTapSequence();
      setExitDialogOpen(true);
    }
  }, [resetTapSequence]);

  useEffect(() => {
    if (!enabled) return undefined;

    function onPointerDown(event) {
      const pointers = pointersRef.current;
      if (pointers.size === 0) {
        gestureMaxFingersRef.current = 0;
        gestureStartRef.current = Date.now();
        maxTravelRef.current = 0;
        originsRef.current = new Map();
      }
      pointers.set(event.pointerId, true);
      originsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      gestureMaxFingersRef.current = Math.max(
        gestureMaxFingersRef.current,
        pointers.size,
      );
    }

    function onPointerMove(event) {
      const origin = originsRef.current.get(event.pointerId);
      if (!origin) return;
      const travel = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
      maxTravelRef.current = Math.max(maxTravelRef.current, travel);
    }

    function onPointerUp(event) {
      const origin = originsRef.current.get(event.pointerId);
      if (origin) {
        const travel = Math.hypot(
          event.clientX - origin.x,
          event.clientY - origin.y,
        );
        maxTravelRef.current = Math.max(maxTravelRef.current, travel);
      }

      const pointers = pointersRef.current;
      pointers.delete(event.pointerId);
      originsRef.current.delete(event.pointerId);

      if (pointers.size !== 0) return;

      const maxFingers = gestureMaxFingersRef.current;
      const duration = Date.now() - gestureStartRef.current;
      const travel = maxTravelRef.current;

      if (
        maxFingers === REQUIRED_FINGERS &&
        duration <= TAP_MAX_DURATION_MS &&
        travel <= TAP_MAX_MOVE_PX
      ) {
        registerThreeFingerTap();
      } else if (maxFingers > 0 && maxFingers !== REQUIRED_FINGERS) {
        resetTapSequence();
      }
    }

    function onPointerCancel(event) {
      pointersRef.current.delete(event.pointerId);
      originsRef.current.delete(event.pointerId);
      if (pointersRef.current.size === 0) {
        maxTravelRef.current = 0;
        resetTapSequence();
      }
    }

    const opts = { capture: true };
    window.addEventListener("pointerdown", onPointerDown, opts);
    window.addEventListener("pointermove", onPointerMove, opts);
    window.addEventListener("pointerup", onPointerUp, opts);
    window.addEventListener("pointercancel", onPointerCancel, opts);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, opts);
      window.removeEventListener("pointermove", onPointerMove, opts);
      window.removeEventListener("pointerup", onPointerUp, opts);
      window.removeEventListener("pointercancel", onPointerCancel, opts);
      pointersRef.current.clear();
      originsRef.current.clear();
      resetTapSequence();
    };
  }, [enabled, registerThreeFingerTap, resetTapSequence]);

  const handleCancel = useCallback(() => {
    setExitDialogOpen(false);
    activateImmersiveMode().catch(() => {});
  }, []);

  const handleExit = useCallback(async () => {
    setExitDialogOpen(false);
    resetTapSequence();
    try {
      await App.minimizeApp();
    } catch {
      // Ignore if minimize is unavailable
    }
  }, [resetTapSequence]);

  if (!exitDialogOpen) return null;

  return (
    <dialog
      className="modal modal-open"
      aria-labelledby="pos-immersive-exit-title"
    >
      <div className="modal-box max-w-sm">
        <h3
          id="pos-immersive-exit-title"
          className="text-lg font-bold text-gray-800"
        >
          Leave Order Manager?
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          Exit sends the app to the background so you can use the tablet home
          screen and system controls. Opening the app again returns to
          fullscreen.
        </p>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={handleCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleExit}>
            Exit
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={handleCancel}>
          close
        </button>
      </form>
    </dialog>
  );
}
