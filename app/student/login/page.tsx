'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowLeft, KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'
import PasswordReset from '@/app/components/PasswordReset'



export default function StudentLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'password' | 'reset'>('email')
  const [studentData, setStudentData] = useState<any>(null)

  const router = useRouter()

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error('Please enter your email')
      return
    }

    setIsLoading(true)
    try {
      // Check if student exists
      const { data: studentRows, error } = await supabase
        .from('students')
        .select('*')
        .like('email', `%${email.trim()}%`)
        .limit(10)

      const student = (studentRows || []).find((s: any) => (s.email || '').trim().toLowerCase() === email.trim().toLowerCase()) || null

      if (error || !student) {
        toast.error('Student not found with this email')
        return
      }

      setStudentData(student)
      
      if (student.password) {
        // Student has password, go to password login
        setStep('password')
      } else {
        // Student needs to create password
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
    if (!studentData?.password && password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    // Only check password length for new password creation
    if (!studentData?.password && password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      if (!studentData.password) {
        // Create new password
        const { error } = await supabase
          .from('students')
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
        console.log('Comparing passwords:', { stored: studentData.password, input: password })
        if (studentData.password !== password) {
          toast.error('Incorrect password')
          return
        }
      }

      // Store student data in localStorage for current session only
      const sessionData = {
        ...studentData,
        sessionTimestamp: Date.now()
      }
      localStorage.setItem('studentData', JSON.stringify(sessionData))
      toast.success('Login successful! You\'ll stay logged in for this session')
      
      router.push('/student/dashboard')
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="dashboard-bg flex items-center justify-center mobile-p">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="card">
          {/* Header */}
          <div className="text-center mobile-mb">
            <h1 className="mobile-text-xl sm:mobile-text-2xl lg:mobile-text-3xl font-bold text-white mobile-mb text-center">
              Chennai Institute of Technology
            </h1>
            <h2 className="mobile-text-lg sm:mobile-text-xl font-semibold text-primary-400 mobile-mb">
              Poll Management System
            </h2>
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mobile-mb border border-primary-500/30">
              <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-primary-400" />
            </div>
            <h3 className="mobile-text-base sm:mobile-text-lg font-medium text-white mobile-mb">
              Student Login
            </h3>
            <p className="mobile-text-sm sm:mobile-text-base text-slate-300">
              {step === 'email' 
                ? 'Enter your college email to continue'
                : studentData?.password 
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
              className="mobile-space-y"
            >
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-200 mobile-mb">
                  College Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@citchennai.net"
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full disabled:opacity-50"
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
              className="mobile-space-y"
            >
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-200 mobile-mb">
                  {studentData?.password ? 'Password' : 'New Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={studentData?.password ? 'Enter password in dd/mm/yyyy' : 'Create a new password'}
                    className="input-field pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
              </div>

              {!studentData?.password && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200 mobile-mb">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
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
                      {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>
              )}


              
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {isLoading 
                  ? (studentData?.password ? 'Logging in...' : 'Creating password...')
                  : (studentData?.password ? 'Login' : 'Create Password')
                }
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setPassword('')
                  setConfirmPassword('')
                  setStudentData(null)

                }}
                className="btn-secondary w-full"
              >
                Back to Email
              </button>
            </motion.form>
          )}

          {/* Footer */}
          <div className="mt-6 sm:mt-8 text-center space-y-3">
            <div>
              <button
                type="button"
                onClick={() => setStep('reset')}
                className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 text-xs sm:text-sm transition-colors"
              >
                <KeyRound className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Forgot Password?</span>
              </button>
            </div>
            <div>
              <Link href="/" className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 text-xs sm:text-sm transition-colors">
                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Password Reset Modal */}
      {step === 'reset' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="relative w-full max-w-md">
            <PasswordReset 
              role="student" 
              onBack={() => setStep('email')} 
            />
          </div>
        </div>
      )}
    </div>
  )
}
