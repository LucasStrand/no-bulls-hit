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

// Function to find the dart tip (simplistic: highest y-value)
const findDartTip = (contour: cv.Mat): Point | null => {
  if (!contour || contour.rows === 0) return null;
  let tip = { x: 0, y: -1 }; // Initialize y low
  for (let i = 0; i < contour.rows; ++i) {
    const point = { x: contour.data32S[i * 2], y: contour.data32S[i * 2 + 1] };
    if (point.y > tip.y) { // Find point with highest y (lowest on screen)
      tip = point;
    }
  }
  return tip.y !== -1 ? tip : null;
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
  const justBecameStillRef = useRef<boolean>(false); // <<< Track if we just entered stillness
  const [detectedTip, setDetectedTip] = useState<Point | null>(null); // State for tip coords

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
        const blob = new Blob([event.data], { type: 'image/jpeg' });
        const objectUrl = URL.createObjectURL(blob);
        const img = imageRef.current; // Get the reference to the <img> element

        // Important: Define onload *before* setting src
        img.onload = () => {
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
    let diff = new cv.Mat();
    let gray = new cv.Mat();
    let thresh = new cv.Mat();
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    try {
      // 1. Difference
      cv.absdiff(frameAfter, frameBefore, diff);
      cv.cvtColor(diff, gray, cv.COLOR_RGBA2GRAY);

      // 2. Threshold
      cv.threshold(gray, thresh, 25, 255, cv.THRESH_BINARY);

      // 3. Find Contours
      cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // 4. Filter Contours (find largest by area)
      let largestContour = null;
      let maxArea = 0;
      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        if (area > maxArea && area > 50) { // Filter small noise, find largest significant change
          maxArea = area;
          largestContour?.delete(); // Delete previous largest if exists
          largestContour = contour.clone();
        } else {
          contour.delete(); // Delete contours we don't keep
        }
      }

      if (largestContour) {
        console.log("Potential dart contour found, area:", maxArea);

        // 5. Find Tip (using helper function)
        const tip = findDartTip(largestContour);

        if (tip) {
            console.log("Detected tip at:", tip);
            setDetectedTip(tip);
            // We'll draw this tip in the main processFrame loop
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
    }

    // Important: Update the 'before' frame reference for the *next* throw
    stillFrameBeforeDartRef.current?.delete();
    stillFrameBeforeDartRef.current = frameAfter.clone();

  }, []); // Empty dependency array for now is likely ok, relies on refs

  // --- Frame Processing ---
  const processFrame = useCallback(() => {
    processingScheduled.current = false;
    if (!cvLoaded || !isConnected || isCalibrating || !canvasRef.current || !imageRef.current.complete || imageRef.current.naturalHeight === 0) {
       // Ensure image element has loaded data before trying to read it
      return;
    }
    const now = performance.now();
    if (now - lastFrameTime.current < 200) {
      if (!processingScheduled.current) {
        if (processFrameRef.current) {
           requestAnimationFrame(processFrameRef.current);
           processingScheduled.current = true;
        }
      }
      return;
    }
    lastFrameTime.current = now;
    
    // --- Image Processing & Drawing --- 
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let src = null;
    let warpDst = null;
    let homographyMat = null;

    try {
      // 1. Get image from the loaded <img> element
      src = cv.imread(imageRef.current);

      // 2. Decide what to display based on state
      if (isCalibrating) {
        // DURING CALIBRATION: Always show the original source image
        cv.imshow(canvas, src);
        // The calibration points/prompts overlay is handled by the other useEffect
      }
      else if (calibrationData?.homographyMatrix) {
        // CALIBRATED & NOT CALIBRATING: Show warped image
        warpDst = new cv.Mat();
        homographyMat = cv.matFromArray(3, 3, cv.CV_64F, calibrationData.homographyMatrix);
        let dsize = new cv.Size(CALIBRATION_TARGET_SIZE, CALIBRATION_TARGET_SIZE);
        cv.warpPerspective(src, warpDst, homographyMat, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        
        // <<< Explicitly set canvas size for warped view >>>
        if (canvas.width !== CALIBRATION_TARGET_SIZE || canvas.height !== CALIBRATION_TARGET_SIZE) {
          canvas.width = CALIBRATION_TARGET_SIZE;
          canvas.height = CALIBRATION_TARGET_SIZE;
        }

        // --- Stillness Detection & Dart Detection Trigger ---
        let diff = null;
        let grayDiff = null;
        const STILLNESS_THRESHOLD = 2.0;

        if (prevWarpedFrameRef.current && !prevWarpedFrameRef.current.empty()) {
            diff = new cv.Mat();
            grayDiff = new cv.Mat();
            cv.absdiff(warpDst, prevWarpedFrameRef.current, diff);
            cv.cvtColor(diff, grayDiff, cv.COLOR_RGBA2GRAY);
            const meanDiff = cv.mean(grayDiff)[0];

            if (meanDiff < STILLNESS_THRESHOLD) {
                if (!isStill) {
                    setIsStill(true);
                    justBecameStillRef.current = true;
                    console.log("Scene became still.");
                    // Don't clone to beforeDart ref here, happens in detectDart
                    // Clone to afterDart ref
                    stillFrameAfterDartRef.current?.delete();
                    stillFrameAfterDartRef.current = warpDst.clone();

                    // <<< TRIGGER DETECTION >>>
                    if (stillFrameBeforeDartRef.current && !stillFrameBeforeDartRef.current.empty() && stillFrameAfterDartRef.current && !stillFrameAfterDartRef.current.empty()) {
                        detectDart(stillFrameAfterDartRef.current, stillFrameBeforeDartRef.current);
                    } else {
                        console.log("Need previous still frame to detect dart.");
                        // If this is the *first* still frame after launch/reset, capture it as the baseline
                        stillFrameBeforeDartRef.current?.delete();
                        stillFrameBeforeDartRef.current = warpDst.clone();
                    }

                } else {
                    justBecameStillRef.current = false;
                }
            } else {
                 if (isStill) setIsStill(false);
                 justBecameStillRef.current = false;
            }
            diff.delete();
            grayDiff.delete();
        } else {
             setIsStill(false);
             justBecameStillRef.current = false;
             // Capture first frame as baseline if none exists
             if (!stillFrameBeforeDartRef.current || stillFrameBeforeDartRef.current.empty()) {
                console.log("Capturing initial baseline frame.");
                stillFrameBeforeDartRef.current?.delete();
                stillFrameBeforeDartRef.current = warpDst?.clone(); // Clone if warpDst exists
             }
        }

        prevWarpedFrameRef.current?.delete();
        if (warpDst) prevWarpedFrameRef.current = warpDst.clone();

        // --- Display --- 
        cv.imshow(canvas, warpDst);
        
        // Draw stillness indicator
        ctx.font = '14px Arial';
        ctx.fillStyle = isStill ? 'lime' : 'red';
        ctx.textAlign = 'left';
        ctx.fillText(isStill ? 'Still' : 'Moving', 10, 20);
        
        // <<< Draw Detected Tip >>>
        if (detectedTip) {
             ctx.fillStyle = 'cyan';
             ctx.beginPath();
             ctx.arc(detectedTip.x, detectedTip.y, 5, 0, 2 * Math.PI);
             ctx.fill();
             ctx.strokeText(`Tip: (${detectedTip.x}, ${detectedTip.y})`, detectedTip.x + 8, detectedTip.y + 3);
        }

      } else {
        // NOT CALIBRATED & NOT CALIBRATING: Show original image + text
        // <<< Restore original canvas size if needed >>>
        if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
            canvas.width = dimensions.width;
            canvas.height = dimensions.height;
        }
        // Reset stillness state and refs if not calibrated
        if (isStill) setIsStill(false);
        prevWarpedFrameRef.current?.delete();
        prevWarpedFrameRef.current = null;
        stillFrameBeforeDartRef.current?.delete();
        stillFrameBeforeDartRef.current = null;
        stillFrameAfterDartRef.current?.delete();
        justBecameStillRef.current = false;
        if (detectedTip) setDetectedTip(null); // <<< Reset detected tip state

        cv.imshow(canvas, src);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.fillText('Calibration Required', canvas.width / 2, canvas.height / 2);
      }

      // 3. TODO: Future steps...
      
    } catch (err) {
      console.error("OpenCV processing error:", err);
      setError('Error during image processing.');
    } finally {
      // Clean up OpenCV Mats
      src?.delete();
      warpDst?.delete();
      homographyMat?.delete();
    }

  }, [cvLoaded, isConnected, isCalibrating, calibrationData, dimensions, isStill, detectDart, detectedTip]);

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