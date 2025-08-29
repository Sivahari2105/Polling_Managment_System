import { createClient } from '@supabase/supabase-js'

// Use environment variables for production, fallback to hardcoded values for development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bpfmvtjlabaujmlwegxc.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZm12dGpsYWJhdWptbHdlZ3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MjY1ODAsImV4cCI6MjA3MTEwMjU4MH0.kB1sZ73NIb7yKzAGcXqvURhswYke67-AV5lAgCIwcrc'

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

export type Database = {
  public: {
    Tables: {
      students: {
        Row: {
          reg_no: string
          name: string
          email: string
          password: string | null
          department: string
          section: string
        }
        Insert: {
          reg_no: string
          name: string
          email: string
          password?: string | null
          department: string
          section: string
        }
        Update: {
          reg_no?: string
          name?: string
          email?: string
          password?: string | null
          department?: string
          section?: string
        }
      }
      staffs: {
        Row: {
          id: number
          name: string
          email: string
          password: string | null
          designation: string
          department: string
          section: string | null
        }
        Insert: {
          id?: number
          name: string
          email: string
          password?: string | null
          designation: string
          department: string
          section?: string | null
        }
        Update: {
          id?: number
          name?: string
          email?: string
          password?: string | null
          designation?: string
          department?: string
          section?: string | null
        }
      }
      polls: {
        Row: {
          id: number
          staff_id: number
          class_id: number
          title: string
          options: string[]
          created_at: string
          poll_type: 'text' | 'options'
          deadline: string | null
          poll_category: 'General Poll' | 'Hackathon' | 'G-Form Poll'
          link_url: string | null
        }
        Insert: {
          id?: number
          staff_id: number
          class_id: number
          title: string
          options?: string[]
          created_at?: string
          poll_type?: 'text' | 'options'
          deadline?: string | null
          poll_category?: 'General Poll' | 'Hackathon' | 'G-Form Poll'
          link_url?: string | null
        }
        Update: {
          id?: number
          staff_id?: number
          class_id?: number
          title?: string
          options?: string[]
          created_at?: string
          poll_type?: 'text' | 'options'
          deadline?: string | null
          poll_category?: 'General Poll' | 'Hackathon' | 'G-Form Poll'
          link_url?: string | null
        }
      }
      poll_responses: {
        Row: {
          id: number
          poll_id: number
          student_reg_no: string
          response: string | null
          option_index: number | null
          responded_at: string
        }
        Insert: {
          id?: number
          poll_id: number
          student_reg_no: string
          response?: string | null
          option_index?: number | null
          responded_at?: string
        }
        Update: {
          id?: number
          poll_id?: number
          student_reg_no?: string
          response?: string | null
          option_index?: number | null
          responded_at?: string
        }
      }
      classes: {
        Row: {
          id: number
          department: string
          section: string | null
        }
        Insert: {
          id?: number
          department: string
          section?: string | null
        }
        Update: {
          id?: number
          department?: string
          section?: string | null
        }
      }
    }
  }
}
