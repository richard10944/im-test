// webp-generator.ts
import sharp from 'sharp';

interface WebPGenerationOptions {
  minSizeKB?: number;
  maxSizeKB?: number;
  width?: number;
  height?: number;
  quality?: number;
}

class WebPGenerator {
  private static readonly DEFAULT_MIN_SIZE_KB = 50;
  private static readonly DEFAULT_MAX_SIZE_KB = 200;
  private static readonly DEFAULT_WIDTH = 1200;
  private static readonly DEFAULT_HEIGHT = 900;
  private static readonly DEFAULT_QUALITY = 90;

  /**
   * 生成随机 WebP 图片
   */
  public static async generateRandomWebP(
    outputPath: string,
    options: WebPGenerationOptions = {}
  ): Promise<{
    filePath: string;
    sizeKB: number;
    dimensions: { width: number; height: number };
  }> {
    const {
      minSizeKB = this.DEFAULT_MIN_SIZE_KB,
      maxSizeKB = this.DEFAULT_MAX_SIZE_KB,
      width = this.DEFAULT_WIDTH,
      height = this.DEFAULT_HEIGHT,
      quality = this.DEFAULT_QUALITY,
    } = options;

    // 验证参数
    this.validateOptions(minSizeKB, maxSizeKB, width, height, quality);

    const targetSizeKB = this.getRandomSizeInRange(minSizeKB, maxSizeKB);
    
    console.log(`目标文件大小: ${targetSizeKB} KB`);
    
    // 生成图片
    const webpBuffer = await this.createWebPImageWithTargetSize(
      width,
      height,
      targetSizeKB
    );

    // 保存文件
    const result = await sharp(webpBuffer).toFile(outputPath);
    const fileSizeKB = Math.round(result.size / 1024);

    console.log(`最终文件大小: ${fileSizeKB} KB`);

    return {
      filePath: outputPath,
      sizeKB: fileSizeKB,
      dimensions: { width, height },
    };
  }

  /**
   * 创建达到目标大小的 WebP 图片
   */
  private static async createWebPImageWithTargetSize(
    width: number,
    height: number,
    targetSizeKB: number
  ): Promise<Buffer> {
    // 方法1: 使用复杂渐变和纹理
    let buffer = await this.createComplexGradientImage(width, height);
    let currentSizeKB = Math.round(buffer.length / 1024);

    console.log(`复杂渐变图片大小: ${currentSizeKB} KB`);

    // 如果还不够大，使用方法2: 添加高频率噪声
    if (currentSizeKB < targetSizeKB) {
      buffer = await this.addHighFrequencyNoise(buffer, targetSizeKB);
      currentSizeKB = Math.round(buffer.length / 1024);
      console.log(`添加噪声后大小: ${currentSizeKB} KB`);
    }

    // 如果还不够大，使用方法3: 嵌入随机数据
    if (currentSizeKB < targetSizeKB) {
      buffer = await this.embedRandomData(buffer, targetSizeKB);
      currentSizeKB = Math.round(buffer.length / 1024);
      console.log(`嵌入数据后大小: ${currentSizeKB} KB`);
    }

    return buffer;
  }

  /**
   * 创建复杂渐变图片
   */
  private static async createComplexGradientImage(
    width: number,
    height: number
  ): Promise<Buffer> {
    // 创建多个渐变层
    const layers: Buffer[] = [];

    // 基础渐变
    const baseGradient = await this.createGradientLayer(width, height, 5);
    layers.push(baseGradient);

    // 添加多个纹理层
    for (let i = 0; i < 8; i++) {
      const texture = await this.createTextureLayer(width, height, i);
      layers.push(texture);
    }

    // 合并所有层
    let composite = sharp(baseGradient);
    for (let i = 1; i < layers.length; i++) {
      composite = composite.composite([{ input: layers[i], blend: 'overlay' as const }]);
    }

    // 添加最终噪声
    const noiseLayer = await this.createNoiseLayer(width, height, 0.3);
    composite = composite.composite([{ input: noiseLayer, blend: 'soft-light' as const }]);

    return composite.webp({ quality: 90, effort: 0 }).toBuffer();
  }

  /**
   * 创建渐变层
   */
  private static async createGradientLayer(
    width: number,
    height: number,
    complexity: number
  ): Promise<Buffer> {
    const svg = `
      <svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${this.getRandomColor()};stop-opacity:1" />
            <stop offset="${Math.random() * 100}%" style="stop-color:${this.getRandomColor()};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${this.getRandomColor()};stop-opacity:1" />
          </linearGradient>
          <radialGradient id="grad2" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" style="stop-color:${this.getRandomColor()};stop-opacity:0.7" />
            <stop offset="100%" style="stop-color:${this.getRandomColor()};stop-opacity:0.3" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad1)" />
        <circle cx="${Math.random() * width}" cy="${Math.random() * height}" r="${width / 3}" fill="url(#grad2)" />
        ${this.generateAdditionalGradients(width, height, complexity)}
      </svg>
    `;

    return sharp(Buffer.from(svg))
      .webp({ quality: 100, effort: 0 })
      .toBuffer();
  }

  /**
   * 生成额外渐变
   */
  private static generateAdditionalGradients(
    width: number,
    height: number,
    count: number
  ): string {
    let svg = '';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * (width / 4) + 50;
      
      svg += `
        <radialGradient id="gradExtra${i}">
          <stop offset="0%" style="stop-color:${this.getRandomColor()};stop-opacity:0.5" />
          <stop offset="100%" style="stop-color:${this.getRandomColor()};stop-opacity:0.1" />
        </radialGradient>
        <circle cx="${x}" cy="${y}" r="${r}" fill="url(#gradExtra${i})" />
      `;
    }
    return svg;
  }

  /**
   * 创建纹理层
   */
  private static async createTextureLayer(
    width: number,
    height: number,
    index: number
  ): Promise<Buffer> {
    const textureSize = Math.max(width, height);
    const patternSize = 20 + index * 5;
    
    let svg = `<svg width="${textureSize}" height="${textureSize}">`;
    
    // 创建复杂图案
    for (let x = 0; x < textureSize; x += patternSize) {
      for (let y = 0; y < textureSize; y += patternSize) {
        if (Math.random() > 0.3) {
          svg += this.createPatternShape(x, y, patternSize, index);
        }
      }
    }
    
    svg += '</svg>';

    return sharp(Buffer.from(svg))
      .resize(width, height)
      .webp({ quality: 80, effort: 0 })
      .toBuffer();
  }

  /**
   * 创建图案形状
   */
  private static createPatternShape(
    x: number,
    y: number,
    size: number,
    complexity: number
  ): string {
    const types = ['circle', 'rect', 'polygon', 'lines'];
    const type = types[complexity % types.length];
    
    switch (type) {
      case 'circle':
        return `<circle cx="${x + size/2}" cy="${y + size/2}" r="${size/2}" 
                 fill="${this.getRandomColor()}" opacity="0.1" />`;
      
      case 'rect':
        return `<rect x="${x}" y="${y}" width="${size}" height="${size}" 
                 fill="${this.getRandomColor()}" opacity="0.08" />`;
      
      case 'polygon':
        return this.createComplexPolygon(x, y, size, complexity);
      
      case 'lines':
        return this.createLinePattern(x, y, size);
      
      default:
        return '';
    }
  }

  /**
   * 创建复杂多边形
   */
  private static createComplexPolygon(
    x: number,
    y: number,
    size: number,
    complexity: number
  ): string {
    const sides = 3 + (complexity % 5);
    const points: string[] = [];
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
      const radius = size / 2 * (0.7 + Math.random() * 0.3);
      const px = centerX + radius * Math.cos(angle);
      const py = centerY + radius * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    
    return `<polygon points="${points.join(' ')}" 
             fill="${this.getRandomColor()}" opacity="0.05" />`;
  }

  /**
   * 创建线条图案
   */
  private static createLinePattern(x: number, y: number, size: number): string {
    let lines = '';
    const lineCount = 5 + Math.floor(Math.random() * 10);
    
    for (let i = 0; i < lineCount; i++) {
      const x1 = x + Math.random() * size;
      const y1 = y + Math.random() * size;
      const x2 = x + Math.random() * size;
      const y2 = y + Math.random() * size;
      
      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
               stroke="${this.getRandomColor()}" stroke-width="1" opacity="0.03" />`;
    }
    
    return lines;
  }

  /**
   * 创建噪声层
   */
  private static async createNoiseLayer(
    width: number,
    height: number,
    intensity: number
  ): Promise<Buffer> {
    // 创建随机噪声图像
    const noiseData = Buffer.alloc(width * height * 4);
    
    for (let i = 0; i < noiseData.length; i += 4) {
      const value = Math.floor(Math.random() * 255 * intensity);
      noiseData[i] = value;     // R
      noiseData[i + 1] = value; // G
      noiseData[i + 2] = value; // B
      noiseData[i + 3] = 255;   // A
    }
    
    return sharp(noiseData, {
      raw: {
        width,
        height,
        channels: 4 as const
      }
    }).webp({ quality: 100, effort: 0 }).toBuffer();
  }

  /**
   * 添加高频噪声
   */
  private static async addHighFrequencyNoise(
    buffer: Buffer,
    targetSizeKB: number
  ): Promise<Buffer> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    // 创建高频噪声
    const noiseBuffer = await this.createHighFrequencyNoise(width, height);
    
    const resultBuffer = await image
      .composite([{ input: noiseBuffer, blend: 'overlay' as const }])
      .webp({ quality: 95, effort: 0 })
      .toBuffer();

    return resultBuffer;
  }

  /**
   * 创建高频噪声
   */
  private static async createHighFrequencyNoise(
    width: number,
    height: number
  ): Promise<Buffer> {
    const blockSize = 2;
    const blocksX = Math.ceil(width / blockSize);
    const blocksY = Math.ceil(height / blockSize);
    
    let svg = `<svg width="${width}" height="${height}">`;
    
    for (let x = 0; x < blocksX; x++) {
      for (let y = 0; y < blocksY; y++) {
        if (Math.random() > 0.5) {
          const color = Math.random() > 0.5 ? '#FFFFFF' : '#000000';
          const opacity = 0.05 + Math.random() * 0.1;
          
          svg += `<rect x="${x * blockSize}" y="${y * blockSize}" 
                   width="${blockSize}" height="${blockSize}" 
                   fill="${color}" opacity="${opacity}" />`;
        }
      }
    }
    
    svg += '</svg>';

    return sharp(Buffer.from(svg)).toBuffer();
  }

  /**
   * 嵌入随机数据（最后的手段）
   */
  private static async embedRandomData(
    buffer: Buffer,
    targetSizeKB: number
  ): Promise<Buffer> {
    const currentSizeKB = Math.round(buffer.length / 1024);
    const neededKB = targetSizeKB - currentSizeKB;
    
    if (neededKB <= 0) return buffer;

    // 作为备选方案，我们可以创建更大的图像
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // 通过增加尺寸来达到目标大小
    const scaleFactor = Math.sqrt(targetSizeKB / currentSizeKB);
    const newWidth = Math.floor(metadata.width! * scaleFactor);
    const newHeight = Math.floor(metadata.height! * scaleFactor);
    
    return image
      .resize(newWidth, newHeight, { kernel: 'nearest' as const })
      .webp({ quality: 100, effort: 0 })
      .toBuffer();
  }

  /**
   * 获取随机颜色
   */
  private static getRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2',
      '#A3E4D7', '#F9E79F', '#D2B4DE', '#A9CCE3', '#FAD7A0'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 获取指定范围内的随机大小
   */
  private static getRandomSizeInRange(minKB: number, maxKB: number): number {
    return Math.floor(Math.random() * (maxKB - minKB + 1)) + minKB;
  }

  /**
   * 验证选项参数
   */
  private static validateOptions(
    minSizeKB: number,
    maxSizeKB: number,
    width: number,
    height: number,
    quality: number
  ): void {
    if (minSizeKB < 1) {
      throw new Error('最小大小不能小于 1KB');
    }
    if (maxSizeKB < minSizeKB) {
      throw new Error('最大大小不能小于最小大小');
    }
    if (width < 100 || height < 100) {
      throw new Error('宽度和高度不能小于 100 像素');
    }
    if (quality < 1 || quality > 100) {
      throw new Error('质量参数必须在 1-100 之间');
    }
  }
}

export default WebPGenerator;