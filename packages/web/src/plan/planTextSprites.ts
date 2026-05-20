import * as THREE from 'three';

type SpriteUserData = Record<string, unknown>;

export type PlanTextSpriteOptions = {
  text: string;
  color: string;
  width?: number;
  height?: number;
  font?: string;
  textX?: number;
  textY?: number;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;
  scaleX: number;
  scaleY: number;
  xMm: number;
  yMm: number;
  sliceY: number;
  pickId?: string;
  userData?: SpriteUserData;
  drawBeforeText?: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void;
};

export function createPlanTextSprite({
  text,
  color,
  width = 256,
  height = 64,
  font = '28px sans-serif',
  textX = 4,
  textY = 32,
  textAlign = 'left',
  textBaseline = 'middle',
  scaleX,
  scaleY,
  xMm,
  yMm,
  sliceY,
  pickId,
  userData,
  drawBeforeText,
}: PlanTextSpriteOptions): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawBeforeText?.(ctx, canvas);
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.fillText(text, textX, textY);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.position.set(xMm / 1000, sliceY, yMm / 1000);
  Object.assign(sprite.userData, userData);
  if (pickId) sprite.userData.bimPickId = pickId;
  return sprite;
}
