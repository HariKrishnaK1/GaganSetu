import express from 'express'
import type { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDb, getDbStatus } from './db'
import { MissionRun } from './models/MissionRun'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5050

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Health & Database Status
app.get('/api/health', (_req: Request, res: Response) => {
  const db = getDbStatus()
  res.json({
    status: 'ok',
    service: 'GaganSetu UAM API Server',
    timestamp: new Date().toISOString(),
    database: db,
  })
})

// Save a simulation mission run to MongoDB Atlas
app.post('/api/runs', async (req: Request, res: Response) => {
  const db = getDbStatus()
  if (db.status !== 'connected') {
    return res.status(503).json({
      ok: false,
      error: 'MongoDB Atlas is not currently connected.',
      dbStatus: db,
      hint: 'Ensure your valid connection string is placed in .env as MONGODB_URI.',
    })
  }

  try {
    const { title, config, outcome, events, history, pnr, fleet } = req.body
    if (!config || !outcome) {
      return res.status(400).json({ ok: false, error: 'Missing required config or outcome fields.' })
    }

    const run = new MissionRun({
      title: title || `UAM Mission: ${config.origin} ? ${outcome.target || config.destination}`,
      config,
      outcome,
      events: events || [],
      history: history || [],
      pnr: pnr || null,
      fleet: fleet || [],
    })

    const saved = await run.save()
    return res.status(201).json({ ok: true, run: saved })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Error saving mission run to MongoDB Atlas:', msg)
    return res.status(500).json({ ok: false, error: msg })
  }
})

// List recent saved mission runs
app.get('/api/runs', async (_req: Request, res: Response) => {
  const db = getDbStatus()
  if (db.status !== 'connected') {
    return res.json({
      ok: true,
      runs: [],
      dbStatus: db,
      warning: 'MongoDB Atlas not connected. Stored runs unavailable.',
    })
  }

  try {
    const runs = await MissionRun.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-history') // Exclude coordinate history for faster list fetching
      .lean()

    return res.json({ ok: true, count: runs.length, runs })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Error fetching runs from MongoDB Atlas:', msg)
    return res.status(500).json({ ok: false, error: msg })
  }
})

// Get a single run by ID (includes complete coordinate history)
app.get('/api/runs/:id', async (req: Request, res: Response) => {
  const db = getDbStatus()
  if (db.status !== 'connected') {
    return res.status(503).json({ ok: false, error: 'MongoDB Atlas is not connected.' })
  }

  try {
    const run = await MissionRun.findById(req.params.id)
    if (!run) {
      return res.status(404).json({ ok: false, error: 'Mission run not found.' })
    }
    return res.json({ ok: true, run })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ ok: false, error: msg })
  }
})

// Delete a saved run
app.delete('/api/runs/:id', async (req: Request, res: Response) => {
  const db = getDbStatus()
  if (db.status !== 'connected') {
    return res.status(503).json({ ok: false, error: 'MongoDB Atlas is not connected.' })
  }

  try {
    const result = await MissionRun.findByIdAndDelete(req.params.id)
    if (!result) {
      return res.status(404).json({ ok: false, error: 'Mission run not found.' })
    }
    return res.json({ ok: true, message: 'Mission run deleted successfully.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ ok: false, error: msg })
  }
})

// Start server and connect to MongoDB Atlas
app.listen(PORT, async () => {
  console.log(`\n?? [GaganSetu Server]: API server running on http://localhost:${PORT}`)
  await connectDb()
})
