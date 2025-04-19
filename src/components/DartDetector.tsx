import React, { useState, useRef, useEffect, useCallback } from 'react';
import cv from '@techstark/opencv-js';
import { Button } from './ui/button';

// Define types for calibration points and homography matrix
type Point = { x: number; y: number };
type CalibrationData = {
  imagePoints: Point[];
  worldPoints: Point[]; // Predefined points on a "perfect" dartboard image
  homographyMatrix: number[] | null; // OpenCV homography matrix
  sourceDimensions: { width: number; height: number }; // Dimensions when calibration was done
};

// Calibration constants
const CALIBRATION_TARGET_SIZE = 500;
const CALIBRATION_POINTS_REQUIRED = 4;
// Corresponding points on the ideal/canonical dartboard (500x500)
// Order: Top(D20), Right(D6), Bottom(D19), Left(D11) - Outer edge centers
const WORLD_POINTS_TARGET = [
  { x: CALIBRATION_TARGET_SIZE / 2, y: 10 },                       // D20 (Top)
  { x: CALIBRATION_TARGET_SIZE - 10, y: CALIBRATION_TARGET_SIZE / 2 }, // D6 (Right, 3 o'clock)
  { x: CALIBRATION_TARGET_SIZE / 2, y: CALIBRATION_TARGET_SIZE - 10 }, // D19 (Bottom)
  { x: 10, y: CALIBRATION_TARGET_SIZE / 2 },                       // D11 (Left, 9 o'clock)
];
const CALIBRATION_PROMPTS = [
  "Click the OUTER MIDDLE of DOUBLE 20 (Top)",
  "Click the OUTER MIDDLE of DOUBLE 6 (Right)",   // Corrected Point & Prompt
  "Click the OUTER MIDDLE of DOUBLE 19 (Bottom)",
  "Click the OUTER MIDDLE of DOUBLE 11 (Left)",    // Corrected Prompt (Point was already D11)
];

interface DartDetectorProps {
  onDetectionUpdate: (scores: { score: number; confidence: number }[]) => void;
  // We might need to pass game state related props later
}

const WS_URL = 'wss://localhost:8081'; // Changed to wss:// - Connect to the secure local relay server

// Function to find the dart tip (point furthest from contour centroid)
const findDartTip = (contour: cv.Mat): Point | null => {
  if (!contour || contour.rows === 0) return null;

  // Calculate moments to find centroid
  const M = cv.moments(contour, false);
  if (M.m00 === 0) return null; // Avoid division by zero if area is 0

  const cX = M.m10 / M.m00;
  const cY = M.m01 / M.m00;

  let furthestPoint: Point | null = null;
  let maxDistanceSq = -1;

  // Iterate through contour points to find the one furthest from the centroid
  for (let i = 0; i < contour.rows; ++i) {
    const point = { x: contour.data32S[i * 2], y: contour.data32S[i * 2 + 1] };
    const dx = point.x - cX;
    const dy = point.y - cY;
    const distanceSq = dx * dx + dy * dy;

    if (distanceSq > maxDistanceSq) {
      maxDistanceSq = distanceSq;
      furthestPoint = point;
    }
  }

  return furthestPoint;
};

// --- Scoring Logic ---

// Define segment scores in standard dartboard order (clockwise from top)
const segmentScores = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17,
  3, 19, 7, 16, 8, 11, 14, 9, 12, 5
];

// Define radii for the different scoring rings (in pixels, for 500x500 target)
// These might need fine-tuning based on the specific board image/warp
const radii = {
  doubleBull: 8,    // Radius of the inner bullseye (50 points)
  singleBull: 20,   // Radius of the outer bullseye (25 points)
  innerTriple: 120, // Inner radius of the triple ring
  outerTriple: 135, // Outer radius of the triple ring
  innerDouble: 200, // Inner radius of the double ring
  outerDouble: 215, // Outer radius of the double ring (edge of scoring area)
};

// Center of the 500x500 board
const boardCenterX = CALIBRATION_TARGET_SIZE / 2;
const boardCenterY = CALIBRATION_TARGET_SIZE / 2;

const getScoreFromCoords = (point: Point | null): { score: number; confidence: number } => {
  if (!point) {
    return { score: 0, confidence: 0 }; // No point detected
  }

  const dx = point.x - boardCenterX;
  const dy = point.y - boardCenterY;
  const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

  // --- Bullseye Check ---
  if (distanceFromCenter <= radii.doubleBull) {
    return { score: 50, confidence: 1.0 }; // Double Bull
  }
  if (distanceFromCenter <= radii.singleBull) {
    return { score: 25, confidence: 1.0 }; // Single Bull
  }

  // --- Outside Board Check ---
  if (distanceFromCenter > radii.outerDouble) {
    return { score: 0, confidence: 1.0 }; // Outside scoring area
  }

  // --- Segment Calculation ---
  // Calculate angle relative to the top (0 degrees = 12 o'clock pointing up)
  // atan2 returns angle in radians from -PI to PI. We adjust it to be 0 to 2*PI, 
  // with 0 degrees pointing upwards (along negative Y axis in typical coordinate systems).
  let angleRad = Math.atan2(-dy, dx); // Note: -dy because Y increases downwards
  if (angleRad < 0) {
    angleRad += 2 * Math.PI; // Map to 0 - 2*PI range
  }
  // Adjust so 0 is straight up (12 o'clock), instead of right (3 o'clock)
  angleRad = (angleRad + Math.PI / 2) % (2 * Math.PI);

  // Convert to degrees (0-360), where 0 is top center
  const angleDeg = angleRad * (180 / Math.PI);

  // Determine the segment index (each segment is 18 degrees)
  // Offset by -9 degrees so the segment boundaries (0, 18, 36, ...) align correctly
  const segmentIndex = Math.floor((angleDeg + 9) % 360 / 18);
  const baseScore = segmentScores[segmentIndex];

  // --- Multiplier Check ---
  if (distanceFromCenter >= radii.innerDouble) {
    return { score: baseScore * 2, confidence: 1.0 }; // Double ring
  }
  if (distanceFromCenter >= radii.innerTriple && distanceFromCenter <= radii.outerTriple) {
    return { score: baseScore * 3, confidence: 1.0 }; // Triple ring
  }

  // --- Single Segment ---
  return { score: baseScore, confidence: 1.0 }; // Single segment
};

const DartDetector: React.FC<DartDetectorProps> = ({ onDetectionUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const imageRef = useRef<HTMLImageElement>(new Image()); // Use an Image element to load received data
  const lastFrameTime = useRef<number>(0); // For throttling OpenCV processing
  const processingScheduled = useRef<boolean>(false);
  const processFrameRef = useRef<() => void>(); // Ref to hold the processing function
  const prevWarpedFrameRef = useRef<cv.Mat | null>(null); // <<< Store previous warped frame
  const stillFrameBeforeDartRef = useRef<cv.Mat | null>(null); // <<< RENAMED: Store the confirmed still frame BEFORE the dart
  const stillFrameAfterDartRef = useRef<cv.Mat | null>(null); // <<< ADDED: Store the confirmed still frame AFTER the dart
  const lastDetectionTimeRef = useRef<number>(0); // <<< ADDED: Timestamp of last detection
  const debugImageRef = useRef<cv.Mat | null>(null); // <<< ADDED: Ref to hold debug image
  const justBecameStillRef = useRef<boolean>(false); // <<< Track if we just entered stillness
  const [detectedTip, setDetectedTip] = useState<Point | null>(null); // State for tip coords
  const largestContourRef = useRef<cv.Mat | null>(null); // <<< ADDED: Store largest contour for drawing
  const contourCentroidRef = useRef<Point | null>(null); // <<< ADDED: Store centroid for drawing

  const [isConnected, setIsConnected] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isStill, setIsStill] = useState(false); // <<< Track stillness state
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);
  const [cvLoaded, setCvLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 }); // Default/initial dimensions
  const [clickedPoints, setClickedPoints] = useState<Point[]>([]); // <<< Store calibration clicks

  // Load OpenCV and Calibration
  useEffect(() => {
    const checkCv = setInterval(() => {
      if (cv.getBuildInformation) {
        console.log('OpenCV Loaded:', cv.getBuildInformation());
        setCvLoaded(true);
        clearInterval(checkCv);
        const savedCalibration = localStorage.getItem('dartboardCalibration');
        if (savedCalibration) {
          try {
            const parsedData = JSON.parse(savedCalibration);
            // Basic validation
            if (parsedData.imagePoints && parsedData.worldPoints && parsedData.homographyMatrix) {
              setCalibrationData(parsedData);
              console.log('Loaded calibration from storage.');
            } else {
              console.warn('Stored calibration data is invalid.');
              localStorage.removeItem('dartboardCalibration');
            }
          } catch (e) {
            console.error('Failed to parse stored calibration:', e);
            localStorage.removeItem('dartboardCalibration');
          }
        }
      }
    }, 100);
    return () => clearInterval(checkCv);
  }, []);

  // --- WebSocket Handling ---
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setError(null);
    console.log(`Attempting to connect to WebSocket: ${WS_URL}`);
    wsRef.current = new WebSocket(WS_URL);
    wsRef.current.binaryType = 'arraybuffer';

    wsRef.current.onopen = () => {
      console.log('WebSocket Connected');
      try {
        wsRef.current?.send(JSON.stringify({ type: 'client-init' }));
        console.log('Client handshake sent.');
        setIsConnected(true);
        setError(null);
      } catch (e) {
          console.error("Failed to send client handshake:", e);
          setError('Failed to send handshake to server.');
          wsRef.current?.close();
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      // Optional: Add retry logic here
      setError('Camera stream disconnected. Ensure phone sender is running and connected.');
    };

    wsRef.current.onerror = (event) => {
      console.error('WebSocket Error:', event);
      setIsConnected(false);
      setError('WebSocket connection error. Is the camera-stream-server.js running?');
    };

    wsRef.current.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        console.log("WebSocket message received (ArrayBuffer)");
        const blob = new Blob([event.data], { type: 'image/jpeg' });
        const objectUrl = URL.createObjectURL(blob);
        const img = imageRef.current; // Get the reference to the <img> element

        // Important: Define onload *before* setting src
        img.onload = () => {
          console.log("img.onload triggered");
          // console.log(`Image loaded into img element: ${img.naturalWidth}x${img.naturalHeight}`);
          if (dimensions.width !== img.naturalWidth || dimensions.height !== img.naturalHeight) {
            setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
          }
          // DO NOT DRAW TO CANVAS HERE - Just schedule processing
          if (!processingScheduled.current) {
            if (processFrameRef.current) {
              requestAnimationFrame(processFrameRef.current);
              processingScheduled.current = true;
            }
          }
          URL.revokeObjectURL(objectUrl);
        };

        img.onerror = (err) => {
          console.error("Error loading image from ArrayBuffer Blob URL into img element:", err);
          URL.revokeObjectURL(objectUrl);
        };

        // Set the src of the *hidden* <img> element to load the data
        img.src = objectUrl; 

      } else {
        console.warn("Received non-ArrayBuffer message:", typeof event.data, event.data);
      }
    };
  }, [dimensions]);

  const disconnectWebSocket = useCallback(() => {
    wsRef.current?.close();
  }, []);

  // --- Dart Detection Function ---
  const detectDart = useCallback((frameAfter: cv.Mat, frameBefore: cv.Mat) => {
    console.log("Attempting dart detection...");
    setDetectedTip(null); // Reset previous detection
    // Clear previous debug image and stored contour/centroid
    debugImageRef.current?.delete();
    debugImageRef.current = null;
    largestContourRef.current?.delete();
    largestContourRef.current = null;
    contourCentroidRef.current = null;

    const diff = new cv.Mat();
    const gray = new cv.Mat();
    const thresh = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      // 1. Difference
      cv.absdiff(frameAfter, frameBefore, diff);
      cv.cvtColor(diff, gray, cv.COLOR_RGBA2GRAY);

      // 2. Threshold
      cv.threshold(gray, thresh, 15, 255, cv.THRESH_BINARY);

      // 3. Find Contours
      cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // --- Debug: Draw all contours yellow onto a copy of thresh --- 
      const debugMat = new cv.Mat();
      cv.cvtColor(thresh, debugMat, cv.COLOR_GRAY2RGBA); // Convert thresh to RGBA for color drawing
      const yellow = new cv.Scalar(255, 255, 0, 255);
      for (let i = 0; i < contours.size(); i++) {
          cv.drawContours(debugMat, contours, i, yellow, 1, cv.LINE_8, hierarchy, 0);
      }
      // --- End Debug --- 

      // 4. Filter Contours (find largest by area)
      let largestContour: cv.Mat | null = null;
      let maxArea = 0;
      let largestContourIndex = -1; // Store index for potential drawing later
      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        if (area > 500 && area < 2000 && area > maxArea) { 
          maxArea = area;
          largestContour?.delete(); // Delete previous largest if exists
          largestContour = contour.clone();
          largestContourIndex = i;
        } else {
          contour.delete(); // Delete contours we don't keep
        }
      }

      // --- Store largest contour and calculate/store centroid for drawing --- 
      largestContourRef.current?.delete(); // Clear previous ref data
      largestContourRef.current = largestContour ? largestContour.clone() : null;
      contourCentroidRef.current = null; // Reset centroid
      // --- End store --- 

      if (largestContour) {
        console.log("Potential dart contour found, area:", maxArea);

        // --- Debug: Draw largest contour magenta ON the debug Mat --- 
        if(largestContourIndex !== -1) { // Check if we found one
            const magenta = new cv.Scalar(255, 0, 255, 255);
            // Draw the largest contour ON the debugMat using its index
            cv.drawContours(debugMat, contours, largestContourIndex, magenta, 2); // Thicker line
        }
        // Let's store debugMat in the ref for drawing in processFrame
        debugImageRef.current?.delete(); // Delete previous debug image
        debugImageRef.current = debugMat.clone(); // Store the image with yellow/magenta contours
        // --- End Debug --- 

        // 5. Find Tip (using helper function)
        const tip = findDartTip(largestContour);

        // --- Calculate and store centroid for drawing --- 
        const M = cv.moments(largestContour, false);
        if (M.m00 !== 0) {
            contourCentroidRef.current = { x: M.m10 / M.m00, y: M.m01 / M.m00 };
        }
        // --- End centroid --- 

        if (tip) {
            console.log("Detected tip at:", tip);
            setDetectedTip(tip);
            lastDetectionTimeRef.current = performance.now(); // Update last detection time

            // --- Calculate Score and Update Parent --- 
            const result = getScoreFromCoords(tip);
            console.log("Calculated Score:", result);
            onDetectionUpdate([result]); // Pass score up to parent component
            // --- End Score Calculation --- 

        } else {
            console.log("Could not determine tip from contour.");
        }
        largestContour.delete();
      } else {
        console.log("No significant dart contour found.");
      }

    } catch(e) {
        console.error("Error during dart detection:", e);
    } finally {
      // Cleanup
      diff.delete();
      gray.delete();
      thresh.delete();
      contours.delete();
      hierarchy.delete();
      // Keep debugMat alive via the ref, it will be cleaned up next detection or on unmount
    }

    // Important: Update the 'before' frame reference for the *next* throw
    stillFrameBeforeDartRef.current?.delete();
    stillFrameBeforeDartRef.current = frameAfter.clone();

  }, []); // Empty dependency array for now is likely ok, relies on refs

  // --- Frame Processing ---
  const processFrame = useCallback(() => {
    processingScheduled.current = false;
    console.log("processFrame called");

    if (!cvLoaded) { console.log("processFrame exiting: cv not loaded"); return; }
    if (!canvasRef.current) { console.log("processFrame exiting: canvasRef missing"); return; }
    if (!isConnected) { console.log("processFrame exiting: not connected"); return; }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current; // Use the loaded image

    if (!ctx) { console.log("processFrame exiting: no canvas context"); return; }
    if (img.naturalWidth === 0) { console.log("processFrame exiting: image naturalWidth is 0"); return; }

    // Check if source dimensions match calibration *only if* calibration exists
    if (calibrationData && 
        (calibrationData.sourceDimensions.width !== img.naturalWidth ||
         calibrationData.sourceDimensions.height !== img.naturalHeight)) {
        console.warn("Camera dimensions changed since calibration. Recalibration needed.");
        setError("Camera dimensions changed. Please recalibrate.");
        resetCalibration(); // Invalidate current calibration
        // Do not return here, allow raw feed to show
    }

    const startTime = performance.now();
    let src: cv.Mat | null = null;
    const dst: cv.Mat | null = null; // This likely should be removed or used if intended
    let M: cv.Mat | null = null;
    let warped: cv.Mat | null = null;
    let diffWarped: cv.Mat | null = null;
    let grayWarped: cv.Mat | null = null;

    try {
      // Read image from <img> into cv.Mat
      src = cv.imread(img);
      console.log("imread successful");

      // If calibrating, draw original feed and points
      if (isCalibrating) {
        console.log("Drawing raw feed (calibrating)");
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        cv.imshow(canvas, src);
        // Draw already clicked points
        ctx.fillStyle = 'red';
        clickedPoints.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
          ctx.fill();
        });

      } else if (calibrationData?.homographyMatrix) {
         console.log("Drawing warped feed (calibrated)");
        // Perform perspective correction
        M = cv.matFromArray(3, 3, cv.CV_64F, calibrationData.homographyMatrix);
        warped = new cv.Mat();
        const dsize = new cv.Size(CALIBRATION_TARGET_SIZE, CALIBRATION_TARGET_SIZE);
        cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

        // Display the warped image
        canvas.width = CALIBRATION_TARGET_SIZE;
        canvas.height = CALIBRATION_TARGET_SIZE;
        cv.imshow(canvas, warped);

        // Stillness Detection Logic (Using Mean Intensity Difference)
        const motionThreshold = 2.5; // <<< Lowered threshold
        const detectionCooldownMs = 1000; // <<< ADDED: Cooldown period (1 second)
        let currentIsStill = isStill; // Assume still unless proven otherwise or in cooldown

        // Only check for motion if not in cooldown
        const now = performance.now();
        if (now - lastDetectionTimeRef.current > detectionCooldownMs) {
            if (prevWarpedFrameRef.current) {
              diffWarped = new cv.Mat();
              grayWarped = new cv.Mat();
              cv.absdiff(warped, prevWarpedFrameRef.current, diffWarped);
              cv.cvtColor(diffWarped, grayWarped, cv.COLOR_RGBA2GRAY);
              const meanDiff = cv.mean(grayWarped)[0]; 
              const calculatedIsStill = meanDiff < motionThreshold; // Calculate actual stillness
              // console.log(`Stillness check: meanDiff = ${meanDiff.toFixed(2)}, threshold = ${motionThreshold.toFixed(2)}, currentIsStill = ${calculatedIsStill}`); // Can disable if noisy
              console.log(`[Stillness Check] meanDiff: ${meanDiff.toFixed(3)}, threshold: ${motionThreshold}, calculatedIsStill: ${calculatedIsStill}`); // <<< ADDED Always log

              // Only update state if it changed
              if (calculatedIsStill !== isStill) {
                  console.log(`Stillness state changing from ${isStill} to ${calculatedIsStill}`); 
                  setIsStill(calculatedIsStill);
                  currentIsStill = calculatedIsStill; // Update local variable for transition check
              } else {
                  currentIsStill = isStill; // Keep local var consistent if no change
              }
            }
            // No else needed - if no prev frame, it stays in initial state (usually still)
        } else {
            // console.log("In detection cooldown..."); // Optional log
            // If in cooldown, force currentIsStill to true to prevent re-triggering
            currentIsStill = true; 
            if (!isStill) {
                // If state somehow became false during cooldown, force it back to true
                 console.log("Stillness state forced to TRUE due to cooldown.");
                 setIsStill(true);
            }
        }

        // Dart detection triggering logic (Check state change, *not* local variable directly)
        // We use the updated isStill state from the previous step (or forced true during cooldown)
        if (currentIsStill && !isStill && (now - lastDetectionTimeRef.current > detectionCooldownMs)) { // Transitioned from NOT still to STILL (and not in cooldown)
          console.log("Transition: NOT Still -> STILL");
          if (stillFrameBeforeDartRef.current) {
             console.log("Calling detectDart... (Detected stillness after motion)");
             stillFrameAfterDartRef.current?.delete();
             stillFrameAfterDartRef.current = warped.clone(); // Capture frame AFTER throw
             detectDart(stillFrameAfterDartRef.current, stillFrameBeforeDartRef.current);
          } else {
            console.log("Board became still, but no 'before' frame captured yet. Storing this as the first still frame.");
            stillFrameBeforeDartRef.current?.delete(); // Ensure cleanup if somehow exists
            stillFrameBeforeDartRef.current = warped.clone(); // Store the first still frame
          }
        } else if (!currentIsStill && isStill) { // Transitioned from STILL to NOT still
          console.log("Transition: STILL -> NOT Still (Motion detected)");
          // If we had a valid 'before' frame, keep it. If not, capture this moment before motion.
          if (!stillFrameBeforeDartRef.current) {
            console.log("Capturing frame just before motion started as 'before' frame.");
            stillFrameBeforeDartRef.current?.delete();
            // Use the *previous* frame (the last known still one) as the 'before' frame
            stillFrameBeforeDartRef.current = prevWarpedFrameRef.current?.clone() || null; 
          } else {
              console.log("Motion detected, already have a 'before' frame.");
          }
        } else if (currentIsStill && isStill) {
             // console.log("Stillness continues..."); // Optional log, can be noisy
        } else { // !currentIsStill && !isStill
             // console.log("Motion continues..."); // Optional log, can be noisy
        }

        // Update previous frame reference *after* comparisons
        prevWarpedFrameRef.current?.delete();
        prevWarpedFrameRef.current = warped.clone();

        // --- Debug: Draw the debug image if it exists --- 
        if (debugImageRef.current && !debugImageRef.current.empty()) {
            // Blend the debug image (yellow contours) onto the canvas
            // We need to ensure canvas size matches debug image size (500x500)
            if (canvas.width !== CALIBRATION_TARGET_SIZE || canvas.height !== CALIBRATION_TARGET_SIZE) {
                 canvas.width = CALIBRATION_TARGET_SIZE;
                 canvas.height = CALIBRATION_TARGET_SIZE;
                 // May need to redraw warped here if canvas size changed
                 cv.imshow(canvas, warped);
            }
            
            // Draw the debug Mat onto a temporary canvas to get ImageData
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = debugImageRef.current.cols;
            tempCanvas.height = debugImageRef.current.rows;
            cv.imshow(tempCanvas, debugImageRef.current);
            const debugCtx = tempCanvas.getContext('2d');
            if (debugCtx) {
                const debugImageData = debugCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                // Make yellow pixels semi-transparent for blending
                const data = debugImageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    // If it's yellow (or close to it from drawing), reduce alpha
                    if (data[i] > 200 && data[i+1] > 200 && data[i+2] < 50) { 
                        data[i+3] = 150; // Semi-transparent alpha
                    }
                    // Keep black pixels fully transparent if desired (optional)
                    // if (data[i] === 0 && data[i+1] === 0 && data[i+2] === 0) { data[i+3] = 0; }
                }
                ctx.putImageData(debugImageData, 0, 0);
            }
        }
        // --- End Debug: Draw debug image ---

        // --- Draw Largest Contour Outline (Magenta) --- 
        if (largestContourRef.current && !largestContourRef.current.empty()) {
            const magenta = new cv.Scalar(255, 0, 255, 255); 
            // Create a temporary MatVector to draw the single contour
            const contourVec = new cv.MatVector();
            contourVec.push_back(largestContourRef.current);
            cv.drawContours(warped, contourVec, 0, magenta, 2); // Draw directly on warped image
            contourVec.delete();
        }
        // --- End Draw Largest Contour ---

        // --- Draw Centroid (Green) --- 
        if (contourCentroidRef.current) {
            ctx.fillStyle = 'lime'; // Bright green
            ctx.beginPath();
            ctx.arc(contourCentroidRef.current.x, contourCentroidRef.current.y, 5, 0, 2 * Math.PI);
            ctx.fill();
        }
        // --- End Draw Centroid ---

        // Draw detected tip
        if (detectedTip) {
          ctx.fillStyle = 'cyan';
          ctx.beginPath();
          ctx.arc(detectedTip.x, detectedTip.y, 5, 0, 2 * Math.PI);
          ctx.fill();
        }

      } else {
        // Connected, but not calibrating and not yet calibrated: Show raw feed
        console.log("Drawing raw feed (connected, not calibrated)");
        if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
            canvas.width = dimensions.width;
            canvas.height = dimensions.height;
        }
        cv.imshow(canvas, src);
        // Optional: Add text overlay indicating calibration is needed
        if (ctx) {
           ctx.font = '16px Arial';
           ctx.fillStyle = 'yellow';
           ctx.textAlign = 'center';
           ctx.fillText('Calibration Needed', canvas.width / 2, 30);
        }
         // Reset stillness state and refs if not calibrated
         if (isStill) setIsStill(false);
         prevWarpedFrameRef.current?.delete();
         prevWarpedFrameRef.current = null;
         stillFrameBeforeDartRef.current?.delete();
         stillFrameBeforeDartRef.current = null;
         stillFrameAfterDartRef.current?.delete();
         stillFrameAfterDartRef.current = null;
         justBecameStillRef.current = false;
         if (detectedTip) setDetectedTip(null); // Reset detected tip state
      }

    } catch (err) {
      console.error("OpenCV processing error:", err);
      setError('Error during image processing.');
    } finally {
      // Clean up OpenCV Mats
      src?.delete();
      dst?.delete(); // Cleanup, though it was never assigned
      M?.delete();
      warped?.delete();
      diffWarped?.delete();
      grayWarped?.delete();
    }

  }, [cvLoaded, isConnected, isCalibrating, calibrationData, dimensions, detectDart, detectedTip, clickedPoints, isStill]);

  // Update the ref whenever the memoized processFrame function changes
  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  // Connect/Disconnect WebSocket
  useEffect(() => {
    connectWebSocket();
    return () => disconnectWebSocket();
  }, [connectWebSocket, disconnectWebSocket]);

  // --- Calibration Logic (Largely unchanged, but operates on canvas) ---
  const startCalibration = () => {
    if (!isConnected) {
      setError('Connect to camera stream before calibrating.');
      return;
    }
    setClickedPoints([]); // Reset points
    setIsCalibrating(true);
    setError(null);
    console.log('Calibration started.');
  };

  const cancelCalibration = () => {
    setIsCalibrating(false);
    setClickedPoints([]);
    setError(null);
    console.log('Calibration cancelled.');
  };

  const resetCalibration = () => {
    setCalibrationData(null);
    localStorage.removeItem('dartboardCalibration');
    setError(null); // Clear any previous calibration errors
    setClickedPoints([]); // Ensure clicked points are cleared if reset mid-calibration
    setIsCalibrating(false); // Ensure calibration mode is off
    console.log('Calibration reset.');
  };

  const calculateAndStoreHomography = useCallback(() => {
    if (!cvLoaded || clickedPoints.length !== CALIBRATION_POINTS_REQUIRED) return;

    console.log('Calculating homography...');
    const imageCoords = clickedPoints.flatMap(p => [p.x, p.y]);
    const worldCoords = WORLD_POINTS_TARGET.flatMap(p => [p.x, p.y]);

    let srcPointsMat = null;
    let dstPointsMat = null;
    let homography = null;

    try {
      // Create OpenCV Mats from the coordinate arrays
      srcPointsMat = cv.matFromArray(CALIBRATION_POINTS_REQUIRED, 1, cv.CV_32FC2, imageCoords);
      dstPointsMat = cv.matFromArray(CALIBRATION_POINTS_REQUIRED, 1, cv.CV_32FC2, worldCoords);

      // Calculate the homography matrix
      homography = cv.findHomography(srcPointsMat, dstPointsMat, cv.RANSAC);

      if (homography && homography.rows === 3 && homography.cols === 3) {
        // Explicitly type the conversion from Float64Array to number[]
        const homographyArray = Array.from(homography.data64F) as number[];
        const newCalibration: CalibrationData = {
          imagePoints: clickedPoints,
          worldPoints: WORLD_POINTS_TARGET,
          homographyMatrix: homographyArray,
          sourceDimensions: { ...dimensions } // Store dimensions at time of calibration
        };
        setCalibrationData(newCalibration);
        localStorage.setItem('dartboardCalibration', JSON.stringify(newCalibration));
        console.log('Homography calculated and stored:', homographyArray);
        setIsCalibrating(false);
        setClickedPoints([]);
        setError(null);
      } else {
        console.error('Failed to calculate valid homography matrix.');
        setError('Calibration failed. Could not calculate perspective. Try clicking points again.');
        // Keep isCalibrating true, allow user to retry clicking?
        // Or cancel: cancelCalibration();
      }
    } catch (err) {
      console.error('OpenCV Homography Error:', err);
      setError('Error during calibration calculation.');
    } finally {
      // Clean up OpenCV Mats
      srcPointsMat?.delete();
      dstPointsMat?.delete();
      homography?.delete();
    }
  }, [cvLoaded, clickedPoints, dimensions]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCalibrating || clickedPoints.length >= CALIBRATION_POINTS_REQUIRED) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    const newPoint = { x, y };
    console.log(`Calibration point ${clickedPoints.length + 1} clicked:`, newPoint);
    setClickedPoints(prev => [...prev, newPoint]);

  }, [isCalibrating, clickedPoints]);

  // --- Effect to trigger calculation when enough points are clicked ---
  useEffect(() => {
    // Only run if calibrating and the required number of points have been clicked
    if (isCalibrating && clickedPoints.length === CALIBRATION_POINTS_REQUIRED) {
      calculateAndStoreHomography();
    }
    // Dependency array ensures this runs when clickedPoints changes or calibration starts/stops
  }, [isCalibrating, clickedPoints, calculateAndStoreHomography]);

  // --- Canvas Drawing Effect (for calibration points) ---
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Redraw the latest frame first if needed (or assume it's there from onmessage)
    // ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    // Draw clicked points during calibration
    if (isCalibrating) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.7)'; // Yellow circles
        clickedPoints.forEach((p, index) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI); // Draw a circle
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.fillText(`${index + 1}`, p.x + 7, p.y + 3); // Label
             ctx.fillStyle = 'rgba(255, 255, 0, 0.7)'; // Reset color
        });
    }
  }, [isCalibrating, clickedPoints, dimensions]); // Rerun when points/dimensions change

  // Cleanup debug image on unmount
  useEffect(() => {
      return () => {
          debugImageRef.current?.delete();
          largestContourRef.current?.delete(); // <<< ADDED Cleanup
      }
  }, []);

  // --- Render ---
  const currentPrompt = isCalibrating ? CALIBRATION_PROMPTS[clickedPoints.length] : null;

  return (
    <div className="dart-detector p-4 border rounded-lg relative">
      <h3 className="text-lg font-semibold mb-2">Dart Detector (Remote Camera)</h3>
      {!cvLoaded && <p>Loading OpenCV...</p>}
      {error && <p className="text-red-500 my-2">{error}</p>}
      <p>Status: {isConnected ? 'Connected to camera stream' : 'Disconnected'}</p>

      <div 
        className="relative mb-4 bg-gray-800 overflow-hidden mx-auto"
        style={
            calibrationData && !isCalibrating
            ? { width: `${CALIBRATION_TARGET_SIZE}px`, height: `${CALIBRATION_TARGET_SIZE}px` }
            : { aspectRatio: `${dimensions.width}/${dimensions.height}`, maxWidth: '100%' }
        }
      >
        <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 w-full h-full"
            onClick={handleCanvasClick} 
            style={{ cursor: isCalibrating ? 'crosshair' : 'default' }} 
        />

        {/* Calibration guides/prompts */}
        {isCalibrating && (
          <div className="absolute top-0 left-0 w-full h-full border-2 border-yellow-400 pointer-events-none flex flex-col justify-between">
            <p className="text-yellow-400 bg-black/70 p-2 text-center font-semibold">
              {currentPrompt || 'Calculating...'}
            </p>
             {/* You could add more sophisticated guides like lines/boxes here */}
             <p className="text-yellow-400 bg-black/70 p-1 text-xs text-center">
              Points clicked: {clickedPoints.length} / {CALIBRATION_POINTS_REQUIRED}
            </p>
          </div>
        )}
      </div>

      <div className="controls flex gap-2">
        <Button onClick={connectWebSocket} disabled={isConnected || !cvLoaded}>
          Reconnect Stream
        </Button>
        {!isCalibrating ? (
          <Button onClick={startCalibration} disabled={!isConnected || !cvLoaded}>
            {calibrationData ? 'Re-calibrate' : 'Calibrate'}
          </Button>
        ) : (
          <Button onClick={cancelCalibration} variant="secondary">
            Cancel Calibration
          </Button>
        )}
        {calibrationData && !isCalibrating && (
          <Button onClick={resetCalibration} variant="destructive" size="sm">
             Reset
          </Button>
        )}
      </div>
      {calibrationData ? (
        <p className="text-green-600 text-sm mt-2">✓ Board Calibrated</p>
      ) : (
         <p className="text-yellow-500 text-sm mt-2">Board not calibrated</p>
      )}
    </div>
  );
};

export default DartDetector; 