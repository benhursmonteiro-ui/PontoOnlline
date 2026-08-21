
const FaceRecognition = (() => {
  const MODEL_URL = '/models/';

  let modelsLoaded = false;
  let currentStream = null;

  async function loadModels(onProgress) {
    if (modelsLoaded) return;

    if (onProgress) onProgress('Carregando detector de faces...');
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

    if (onProgress) onProgress('Carregando reconhecedor facial...');
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

    modelsLoaded = true;
    if (onProgress) onProgress('Modelos carregados!');
  }

  async function startCamera(videoElement) {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('getUserMedia não suportado neste navegador/origem.');
        return false;
      }

      videoElement.setAttribute('autoplay', '');
      videoElement.setAttribute('muted', '');
      videoElement.setAttribute('playsinline', '');

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
      } catch (e) {
        console.warn('Fallback to basic video constraint:', e);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      videoElement.srcObject = stream;
      currentStream = stream;

      await new Promise(resolve => {
        if (videoElement.readyState >= 2) {
          videoElement.play().catch(console.warn).finally(resolve);
        } else {
          videoElement.onloadeddata = () => {
            videoElement.play().catch(console.warn).finally(resolve);
          };
          
          setTimeout(resolve, 1000);
        }
      });

      return true;
    } catch (err) {
      console.error('Camera error:', err);
      return false;
    }
  }

  function stopCamera(videoElement) {
    if (videoElement && videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach(t => t.stop());
      videoElement.srcObject = null;
    }
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
  }

  function getDetectionOptions() {
    return new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5
    });
  }

  async function captureFaceDescriptor(videoElement) {
    if (!modelsLoaded) {
      await loadModels();
    }

    if (!videoElement || !videoElement.srcObject || videoElement.paused || videoElement.ended || !videoElement.videoWidth) {
      throw new Error('A câmera não está ativa ou pronta para vídeo.');
    }

    const detection = await faceapi
      .detectSingleFace(videoElement, getDetectionOptions())
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection) {
      return null;
    }

    return {
      descriptor: Array.from(detection.descriptor),
      box: detection.detection.box
    };
  }

  function capturePhoto(videoElement) {
    if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  function drawBox(videoElement, canvasElement, box, label = 'Amostra Capturada', isSuccess = true) {
    if (!videoElement || !canvasElement || !box) return;
    const displaySize = {
      width: videoElement.videoWidth || 640,
      height: videoElement.videoHeight || 480
    };
    faceapi.matchDimensions(canvasElement, displaySize);
    const resized = faceapi.resizeResults({ detection: { box } }, displaySize);
    const ctx = canvasElement.getContext('2d');
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    const rBox = resized.detection.box;
    ctx.strokeStyle = isSuccess ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(rBox.x, rBox.y, rBox.width, rBox.height);

    if (label) {
      ctx.fillStyle = isSuccess ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 68, 68, 0.85)';
      ctx.font = 'bold 14px Inter, sans-serif';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(rBox.x, rBox.y - 26, Math.max(textWidth + 16, rBox.width), 26);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, rBox.x + 6, rBox.y - 8);
    }

    setTimeout(() => {
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }, 2000);
  }

  function createMatcher(employeeDescriptors, threshold = 0.5) {
    if (!employeeDescriptors || employeeDescriptors.length === 0) return null;

    const labeledDescriptors = employeeDescriptors.map(emp => {
      const descriptors = emp.descriptors.map(d => new Float32Array(d));
      return new faceapi.LabeledFaceDescriptors(
        `${emp.id}::${emp.name}`,
        descriptors
      );
    });

    return new faceapi.FaceMatcher(labeledDescriptors, threshold);
  }

  function startDetectionLoop(videoElement, canvasElement, matcher, onMatch, onNoFace) {
    let running = true;
    let lastMatchTime = 0;
    const COOLDOWN = 5000; 

    const canvas = canvasElement;

    async function detect() {
      if (!running || videoElement.paused || videoElement.ended) return;

      const displaySize = {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight
      };

      faceapi.matchDimensions(canvas, displaySize);

      try {
        const detections = await faceapi
          .detectAllFaces(videoElement, getDetectionOptions())
          .withFaceLandmarks(true)
          .withFaceDescriptors();

        const resized = faceapi.resizeResults(detections, displaySize);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (resized.length === 0) {
          if (onNoFace) onNoFace();
          requestAnimationFrame(() => setTimeout(detect, 500));
          return;
        }

        for (const det of resized) {
          const box = det.detection.box;

          if (matcher) {
            const match = matcher.findBestMatch(det.descriptor);
            const isKnown = match.label !== 'unknown';
            const now = Date.now();

            ctx.strokeStyle = isKnown ? '#22c55e' : '#ef4444';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            const label = isKnown ? match.label.split('::')[1] : 'Desconhecido';
            const confidence = isKnown ? `${((1 - match.distance) * 100).toFixed(0)}%` : '';

            ctx.fillStyle = isKnown ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 68, 68, 0.85)';
            const textWidth = ctx.measureText(`${label} ${confidence}`).width;
            ctx.fillRect(box.x, box.y - 28, Math.max(textWidth + 20, box.width), 28);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.fillText(`${label} ${confidence}`, box.x + 6, box.y - 8);

            if (isKnown && (now - lastMatchTime > COOLDOWN)) {
              lastMatchTime = now;
              const [id, name] = match.label.split('::');
              onMatch({
                employeeId: parseInt(id),
                name: name,
                distance: match.distance
              });
            }
          } else {
            
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
          }
        }
      } catch (err) {
        console.warn('Detection error:', err);
      }

      requestAnimationFrame(() => setTimeout(detect, 500));
    }

    detect();

    return {
      stop() { running = false; },
      isRunning() { return running; }
    };
  }

  return {
    loadModels,
    startCamera,
    stopCamera,
    captureFaceDescriptor,
    capturePhoto,
    createMatcher,
    startDetectionLoop,
    drawBox
  };
})();
