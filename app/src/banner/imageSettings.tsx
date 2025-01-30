export enum IdeogramImageResolution { // 16:9 = 1.77, 
  INSTAGRAM = 'RESOLUTION_1024_1024', // 1:1
  TWITTER = 'RESOLUTION_1280_720', // 16:9
  FACEBOOK = 'RESOLUTION_1344_704', // 21:11 = 1.91
  HASHNODE = 'RESOLUTION_1344_704', // 21:11 = 1.91
  LINKEDIN = 'RESOLUTION_1344_704', // 21:11 = 1.91
  MEDIUM = 'RESOLUTION_1408_704', // 2:1
  SUBSTACK = 'RESOLUTION_1408_704', // 2:1
  DEVTO = 'RESOLUTION_1536_640', // 2.4:1
}

export enum ImageStyle {
  PHOTOREALISTIC = 'photorealistic image',
  DIGITAL_ART = 'digital art',
  OIL_PAINTING = 'oil painting',
  WATERCOLOR = 'watercolor',
  ILLUSTRATION = 'illustration',
  PENCIL_SKETCH = 'pencil sketch',
  THREE_D_RENDER = '3D render',
  POP_ART = 'pop art image',
  MINIMALIST = 'minimalist image',
}

export enum ImageMood {
  DRAMATIC = 'dramatic',
  PEACEFUL = 'peaceful',
  ENERGETIC = 'energetic',
  MYSTERIOUS = 'mysterious',
  WHIMSICAL = 'whimsical',
  DARK = 'dark',
  BRIGHT = 'bright',
  NEUTRAL = 'neutral',
}

export enum ImageLighting {
  NATURAL = 'natural',
  STUDIO = 'studio',
  DRAMATIC = 'dramatic',
  SOFT = 'soft',
  NEON = 'neon',
  DARK = 'dark',
  BRIGHT = 'bright',
  CINEMATIC = 'cinematic',
}
