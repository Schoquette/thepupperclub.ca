import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

interface Props {
  /** Source file picked by the user — we read this to a data URL for the cropper. */
  file: File;
  /** Output crop shape. Profile + pet photos are circular. */
  shape?: 'round' | 'rect';
  /** Output square size in pixels. Default 600 — large enough for retina avatars, small enough to upload fast. */
  outputSize?: number;
  /** Output filename for the resulting Blob (kept so the API logs a sensible name). */
  outputName?: string;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}

/**
 * Modal photo editor — pan, zoom, and rotate the picked photo until it
 * sits the way the user wants inside the circle. Outputs a square PNG
 * (rotation applied) that the caller can upload as-is.
 */
export default function PhotoCropper({
  file,
  shape = 'round',
  outputSize = 600,
  outputName,
  onCancel,
  onConfirm,
}: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Read the file into a data URL once, so the Cropper has something to render.
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setImageSrc(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => setError('Couldn’t read that image. Try a different file.');
    reader.readAsDataURL(file);
  }, [file]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    setError('');
    try {
      const blob = await renderCroppedImage(imageSrc, croppedAreaPixels, rotation, outputSize);
      const name = outputName ?? renameForOutput(file.name);
      const cropped = new File([blob], name, { type: 'image/png' });
      onConfirm(cropped);
    } catch {
      setError('Couldn’t apply that crop. Try a smaller image.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/60">
      <div className="min-h-full flex items-start sm:items-center justify-center px-4 py-6">
        <div className="bg-white rounded-2xl w-full max-w-lg p-6">
        <p className="label-caps text-blue mb-2">Adjust your photo</p>
        <h2 className="font-display text-xl text-espresso mb-4">Drag, zoom, and rotate to frame it.</h2>

        <div className="relative w-full bg-cream rounded-xl overflow-hidden" style={{ height: 320 }}>
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape={shape === 'round' ? 'round' : 'rect'}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-taupe">
              Loading photo...
            </div>
          )}
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="crop_zoom" className="label-caps text-espresso">Zoom</label>
              <span className="text-xs text-taupe">{zoom.toFixed(2)}x</span>
            </div>
            <input
              id="crop_zoom"
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-blue"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="crop_rotation" className="label-caps text-espresso">Rotate</label>
              <span className="text-xs text-taupe">{Math.round(rotation)}&deg;</span>
            </div>
            <input
              id="crop_rotation"
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full accent-blue"
            />
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => setRotation((r) => normaliseAngle(r - 90))}
                className="text-xs text-blue hover:underline"
              >
                Rotate left 90&deg;
              </button>
              <button
                type="button"
                onClick={() => setRotation(0)}
                className="text-xs text-taupe hover:text-espresso"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => normaliseAngle(r + 90))}
                className="text-xs text-blue hover:underline"
              >
                Rotate right 90&deg;
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onCancel} className="btn-text">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!croppedAreaPixels || saving}
            className="btn-blue disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Use this photo'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

function normaliseAngle(angle: number): number {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

function renameForOutput(original: string): string {
  const base = original.replace(/\.[^.]+$/, '');
  return `${base || 'photo'}-cropped.png`;
}

/**
 * Render the cropped, rotated region to a square PNG of `outputSize` x
 * `outputSize` pixels. Returns a Blob that the caller can wrap in a File
 * and POST to the upload endpoint.
 *
 * The trick: we draw the source image onto an oversize canvas that's
 * large enough to hold every pixel after rotation, then read back only
 * the user-selected crop rectangle (which react-easy-crop reports in
 * source-image coordinates *post*-rotation).
 */
async function renderCroppedImage(
  imageSrc: string,
  area: Area,
  rotation: number,
  outputSize: number,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const radians = (rotation * Math.PI) / 180;

  // Pixels needed to contain the rotated image.
  const { width: bboxW, height: bboxH } = rotatedBoundingBox(image.width, image.height, radians);

  const stage = document.createElement('canvas');
  stage.width = bboxW;
  stage.height = bboxH;
  const sCtx = stage.getContext('2d');
  if (!sCtx) throw new Error('Canvas 2D context unavailable.');

  sCtx.translate(bboxW / 2, bboxH / 2);
  sCtx.rotate(radians);
  sCtx.drawImage(image, -image.width / 2, -image.height / 2);

  // Pull just the crop region into a square output canvas.
  const out = document.createElement('canvas');
  out.width = outputSize;
  out.height = outputSize;
  const oCtx = out.getContext('2d');
  if (!oCtx) throw new Error('Canvas 2D context unavailable.');

  oCtx.drawImage(
    stage,
    area.x, area.y, area.width, area.height,
    0, 0, outputSize, outputSize,
  );

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob failed.'));
    }, 'image/png', 0.92);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load.'));
    img.src = src;
  });
}

function rotatedBoundingBox(w: number, h: number, radians: number): { width: number; height: number } {
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  return {
    width:  Math.ceil(w * cos + h * sin),
    height: Math.ceil(w * sin + h * cos),
  };
}
