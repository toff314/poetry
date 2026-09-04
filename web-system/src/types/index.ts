export interface Poem {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  content: string;
  slug?: string;
}

export interface Poet {
  name: string;
  dynasty: string;
  count: number;
}

export interface PoemSection {
  id: string;
  index: string;
  original: string;
  literal: string;
  analysis: string;
  image: string;
}

export interface AudioVoice {
  id: string;
  engine: string;
  voice: string;
  label: string;
  /** 场景(hero/scene-N) -> mp3 相对站点根路径 */
  scenes: Record<string, string>;
}

export interface PoemAudio {
  defaultVoiceId: string;
  voices: AudioVoice[];
}

export interface GeneratedPoem {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  content: string;
  kicker: string;
  definingLine: string;
  intro: string;
  heroImage: string;
  sections: PoemSection[];
  closing: string;
  audioUrl?: string;
  audioCues?: { scene: string; startMs: number; endMs: number }[];
  audio?: PoemAudio;
}
