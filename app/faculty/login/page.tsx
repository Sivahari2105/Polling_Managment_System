'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Mail, Lock, Eye, EyeOff, LogIn, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function FacultyLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'password'>('email')
  const [facultyData, setFacultyData] = useState<any>(null)
  const router = useRouter()

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error('Please enter your email')
      return
    }

    setIsLoading(true)
    try {
      // Check if faculty exists
      const { data: facultyRows, error } = await supabase
        .from('staffs')
        .select('*')
        .like('email', `%${email.trim()}%`)
        .eq('designation', 'CA')
        .limit(10)

      const faculty = (facultyRows || []).find((s: any) => (s.email || '').trim().toLowerCase() === email.trim().toLowerCase()) || null

      if (error || !faculty) {
        toast.error('Faculty not found with this email')
        return
      }

      setFacultyData(faculty)
      
      if (faculty.password) {
        // Faculty has password, go to password login
        setStep('password')
      } else {
        // Faculty needs to create password
        setStep('password')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password) {
      toast.error('Please enter a password')
      return
    }

    // Only check password confirmation for new password creation
    if (!facultyData?.password && password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    // Only check password length for new password creation
    if (!facultyData?.password && password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      if (!facultyData.password) {
        // Create new password
        const { error } = await supabase
          .from('staffs')
          .update({ password })
          .eq('email', email)

        if (error) throw error
        
        toast.success('Password created successfully! Please login again.')
        setPassword('')
        setConfirmPassword('')
        setStep('email')
        return
      } else {
        // Verify existing password
        if (facultyData.password !== password) {
          toast.error('Incorrect password')
          return
        }
      }

      // Store faculty data in localStorage for session management
      localStorage.setItem('facultyData', JSON.stringify(facultyData))
      toast.success('Login successful!')
      router.push('/faculty/dashboard')
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="dashboard-bg flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1),transparent_50%)]"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="card">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4 text-center">
              Chennai Institute of Technology
            </h1>
            <h2 className="text-xl font-semibold text-accent-400 mb-4">
              Poll Management System
            </h2>
            <div className="w-16 h-16 bg-accent-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-accent-500/30">
              <Users className="w-8 h-8 text-accent-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Faculty Login
            </h3>
            <p className="text-slate-300">
              {step === 'email' 
                ? 'Enter your email to continue'
                : facultyData?.password 
                  ? 'Enter your password to login'
                  : 'Create a new password for your account'
              }
            </p>
          </div>

          {/* Email Step */}
          {step === 'email' && (
            <motion.form
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleEmailSubmit}
              className="space-y-4"
            >
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@gmail.com"
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="btn-accent w-full disabled:opacity-50"
              >
                {isLoading ? 'Checking...' : 'Continue'}
              </button>
            </motion.form>
          )}

          {/* Password Step */}
          {step === 'password' && (
            <motion.form
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handlePasswordSubmit}
              className="space-y-4"
            >
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-2">
                  {facultyData?.password ? 'Password' : 'New Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={facultyData?.password ? 'Enter your password' : 'Create a new password'}
                    className="input-field pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {!facultyData?.password && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="input-field pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading}
                className="btn-accent w-full disabled:opacity-50"
              >
                {isLoading 
                  ? (facultyData?.password ? 'Logging in...' : 'Creating password...')
                  : (facultyData?.password ? 'Login' : 'Create Password')
                }
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setPassword('')
                  setConfirmPassword('')
                  setFacultyData(null)
                }}
                className="btn-secondary w-full"
              >
                Back to Email
              </button>
            </motion.form>
          )}

          {/* Footer */}
          <div className="mt-8 text-center">
            <div>
              <Link href="/" className="inline-flex items-center space-x-2 text-accent-400 hover:text-accent-300 text-sm transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
