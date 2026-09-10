export type EnvironmentMode = 'recording_studio' | 'live_stage';

export type InstrumentType =
  | 'voice'
  | 'acoustic_guitar'
  | 'electric_guitar'
  | 'bass_guitar'
  | 'kick_drum'
  | 'snare_drum'
  | 'tom_drum'
  | 'cymbals'
  | 'keyboard'
  | 'violin'
  | 'trumpet'
  | 'acoustic_piano'
  | 'saxophone'
  | 'cello'
  | 'double_bass'
  | 'flute'
  | 'choir';

export type GearCategory =
  | 'instrument'
  | 'microphone'
  | 'di_box'
  | 'amplifier'
  | 'stand'
  | 'accessory'
  | 'monitor_speaker'
  | 'acoustic_treatment';

export type MicTransducerType =
  | 'dynamic'
  | 'condenser_large'
  | 'condenser_small'
  | 'di'
  | 'none';

export type MicStandHeight =
  | 'amp_low'
  | 'seated_instrument'
  | 'standing_vocal'
  | 'drum_overhead'
  | 'clipped'
  | 'mounted';

export interface GearDefinition {
  id: string;
  name: string;
  model: string;
  category: GearCategory;
  transducerType: MicTransducerType;
  polarPattern?: 'Cardioid' | 'Supercardioid' | 'Omnidirectional' | 'Direct';
  requiresPhantomPower: boolean;
  idealSources: string[];
  unsuitableSources?: string[];
  defaultStandHeight?: MicStandHeight;
  description: string;
  specs: string;
  iconType: string;
  color: string;
  size: { width: number; height: number };
}

export interface PlacedGear {
  instanceId: string;
  gearId: string;
  x: number;
  y: number;
  rotation: number;
  label?: string;
  instrumentType?: InstrumentType;
  standHeight?: MicStandHeight;
  micPlacement?: string;
  hasPopFilter?: boolean;
  hasShockmount?: boolean;
  latchedSourceInstanceId?: string; // ID of instrument or amp that this mic/DI is capturing
  assignedChannel?: number; // 1 to 8
  isMuted?: boolean;
  gain?: number;
  customScale?: 'compact' | 'standard' | 'large';
  customWidth?: number;
  customHeight?: number;
}

export type CableType = 'xlr' | 'quarter_inch' | 'speaker';

export interface CableConnection {
  id: string;
  fromInstanceId: string;
  toInstanceId: string;
  fromPort?: string;
  toPort?: string;
  cableType: CableType;
  color: string;
}

export interface MixerChannelState {
  channelNumber: number;
  assignedGearInstanceId: string | null;
  label: string;
  phantomPower: boolean;
  gain: number; // 0 - 100
  fader: number; // 0 - 100
  pan: number; // -50 to +50
  solo: boolean;
  muted: boolean;
  meterValue: number; // 0 - 100 for visual animation
}

export interface MasterBusState {
  fader: number; // 0 - 100, 75 is Unity 0.0 dB
  gain: number; // 0 - 100, 50 is Unity 0.0 dB Preamp Trim
  pan: number; // -50 to +50, 0 is Center
  muted: boolean;
  dim: boolean; // -20 dB monitor pad
  mono: boolean; // sum to mono
}

export interface RubricCategoryScore {
  name: string;
  score: number;
  maxScore: number;
  passed: boolean;
  status: 'perfect' | 'warning' | 'error' | 'not_applicable';
  feedback: string;
  details?: string[];
}

export interface RubricEvaluation {
  totalScore: number;
  maxTotalScore: number;
  percentage: number;
  gradeLetter: string;
  gradePhrase: string; // "That's what I'm talking about!", "Just a few more things", "Getting there", "Long way to go", "Not good enough"
  categories: {
    minimumInputs: RubricCategoryScore;
    signalChain: RubricCategoryScore;
    micSelection: RubricCategoryScore;
    phantomPower: RubricCategoryScore;
    accessoriesAndStands: RubricCategoryScore;
    mixerRouting: RubricCategoryScore;
    monitorSetup?: RubricCategoryScore;
    paSpeakerSetup?: RubricCategoryScore;
    [key: string]: RubricCategoryScore | undefined;
  };
  criticalIssues: string[];
  suggestions: string[];
  positives: string[];
}

export interface ChallengeDefinition {
  id: string;
  title: string;
  subtitle: string;
  environment: EnvironmentMode;
  description: string;
  instruments: Array<{ gearId: string; x: number; y: number; label?: string }>;
  hint: string;
}

export interface StudioProjectState {
  id: string;
  version: number;
  title: string;
  studentName: string;
  studentId?: string;
  period?: string;
  className: string;
  teacherName?: string;
  environment: EnvironmentMode;
  activeChallengeId?: string | null;
  placedGear: PlacedGear[];
  connections: CableConnection[];
  mixerChannels: MixerChannelState[];
  masterBus?: MasterBusState;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiEvaluationResponse {
  mentorSummary: string;
  strengths: string[];
  improvementTips: string[];
  audioPhysicsNote: string;
  gradeVerdict?: string;
}
