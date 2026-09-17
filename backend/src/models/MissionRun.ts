import mongoose, { Schema, Document } from 'mongoose'

export interface IMissionRun extends Document {
  title?: string
  createdAt: Date
  config: {
    origin: string
    destination: string
    scenario: 'normal' | 'closure'
    initialBattery: number
    speedKmh: number
    windSpeedKmh: number
    windDirectionDeg: number
    notificationDelay: number
    closureAt: number
    fleetMode: boolean
  }
  outcome: {
    status: string
    target: string
    durationSeconds: number
    distanceKm: number
    energyLeftKwh: number
    diverted: boolean
    failure: string | null
  }
  events: Array<{
    id?: number
    time: number
    type: string
    message: string
  }>
  history: Array<{
    lat: number
    lng: number
  }>
  pnr?: {
    distanceKm: number
    isPast: boolean
    marginAtPnr: number
    position: { lat: number; lng: number }
  } | null
  fleet?: Array<{
    id: string
    callsign: string
    status: string
    target: string
    energy: number
    distance: number
    diverted: boolean
    altitudeMeters: number
  }>
}

const MissionRunSchema: Schema = new Schema(
  {
    title: { type: String, trim: true, default: 'Simulated UAM Mission' },
    createdAt: { type: Date, default: Date.now, index: true },
    config: {
      origin: { type: String, required: true },
      destination: { type: String, required: true },
      scenario: { type: String, enum: ['normal', 'closure'], default: 'closure' },
      initialBattery: { type: Number, required: true },
      speedKmh: { type: Number, default: 120 },
      windSpeedKmh: { type: Number, default: 15 },
      windDirectionDeg: { type: Number, default: 90 },
      notificationDelay: { type: Number, default: 0 },
      closureAt: { type: Number, default: 135 },
      fleetMode: { type: Boolean, default: false },
    },
    outcome: {
      status: { type: String, required: true },
      target: { type: String, required: true },
      durationSeconds: { type: Number, required: true },
      distanceKm: { type: Number, required: true },
      energyLeftKwh: { type: Number, required: true },
      diverted: { type: Boolean, default: false },
      failure: { type: String, default: null },
    },
    events: [
      {
        id: Number,
        time: Number,
        type: { type: String },
        message: String,
      },
    ],
    history: [
      {
        lat: Number,
        lng: Number,
      },
    ],
    pnr: {
      distanceKm: Number,
      isPast: Boolean,
      marginAtPnr: Number,
      position: {
        lat: Number,
        lng: Number,
      },
    },
    fleet: [
      {
        id: String,
        callsign: String,
        status: String,
        target: String,
        energy: Number,
        distance: Number,
        diverted: Boolean,
        altitudeMeters: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
)

export const MissionRun = mongoose.model<IMissionRun>('MissionRun', MissionRunSchema)
