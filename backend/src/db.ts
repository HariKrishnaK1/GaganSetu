import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

export type DbStatus = 'connected' | 'connecting' | 'disconnected' | 'unconfigured'

export function getDbStatus(): { status: DbStatus; message: string; host?: string; dbName?: string } {
  const uri = process.env.MONGODB_URI
  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    return {
      status: 'unconfigured',
      message: 'MongoDB Atlas URI not configured. Update MONGODB_URI in your .env file with your cluster credentials.',
    }
  }

  const readyState = mongoose.connection.readyState
  switch (readyState) {
    case 1:
      return {
        status: 'connected',
        message: 'Connected to MongoDB Atlas',
        host: mongoose.connection.host,
        dbName: mongoose.connection.name,
      }
    case 2:
      return { status: 'connecting', message: 'Connecting to MongoDB Atlas...' }
    default:
      return { status: 'disconnected', message: 'Disconnected from MongoDB Atlas' }
  }
}

export async function connectDb(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.warn('??  [MongoDB Atlas]: MONGODB_URI is not set or contains placeholders in .env.')
    console.warn('??  Add your real Atlas connection string to .env to enable cloud mission storage.')
    return
  }

  try {
    console.log('?? [MongoDB Atlas]: Connecting to cluster...')
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    })
    console.log(`? [MongoDB Atlas]: Connected successfully to database "${mongoose.connection.name}" at ${mongoose.connection.host}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('? [MongoDB Atlas]: Connection failed:', msg)
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('??  [MongoDB Atlas]: Connection lost.')
})

mongoose.connection.on('reconnected', () => {
  console.log('? [MongoDB Atlas]: Reconnected to cluster.')
})
