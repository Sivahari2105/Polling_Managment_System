'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface PasswordResetProps {
  role: 'student' | 'faculty' | 'hod'
  onBack: () => void
}

export default function PasswordReset({ role, onBack }: PasswordResetProps) {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [userData, setUserData] = useState<any>(null)

  const getRoleConfig = () => {
    switch (role) {
      case 'student':
        return {
          title: 'Student Password Reset',
          table: 'students',
          icon: '🎓',
          color: 'primary'
        }
      case 'faculty':
        return {
          title: 'Faculty Password Reset',
          table: 'staffs',
          filter: { designation: 'CA' },
          icon: '👨‍🏫',
          color: 'accent'
        }
      case 'hod':
        return {
          title: 'HOD Password Reset',
          table: 'staffs',
          filter: { designation: 'HOD' },
          icon: '👨‍💼',
          color: 'secondary'
        }
    }
  }

  const config = getRoleConfig()

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error('Please enter your email')
      return
    }

    setIsLoading(true)
    try {
      let query = supabase
        .from(config.table)
        .select('*')
        .like('email', `%${email.trim()}%`)

      // Apply role-specific filters
      if (config.filter) {
        Object.entries(config.filter).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }

      const { data: userRows, error } = await query.limit(10)

      const user = (userRows || []).find((u: any) => (u.email || '').trim().toLowerCase() === email.trim().toLowerCase()) || null

      if (error || !user) {
        toast.error(`${role.charAt(0).toUpperCase() + role.slice(1)} not found with this email`)
        return
      }

      setUserData(user)
      setStep('reset')
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newPassword) {
      toast.error('Please enter a new password')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from(config.table)
        .update({ password: newPassword })
        .eq('email', email)

      if (error) throw error
      
      toast.success('Password reset successfully! You can now login with your new password.')
      
      // Reset form and go back to email step
      setEmail('')
      setNewPassword('')
      setConfirmPassword('')
      setUserData(null)
      setStep('email')
    } catch (error) {
      toast.error('An error occurred while resetting password')
    } finally {
      setIsLoading(false)
    }
  }

  type ColorClasses = { bg: string; border: string; icon: string; button: string }

  const getColorClasses = (): ColorClasses => {
    switch (config.color) {
      case 'primary':
        return {
          bg: 'bg-primary-500/20',
          border: 'border-primary-500/30',
          icon: 'text-primary-400',
          button: 'btn-primary'
        }
      case 'accent':
        return {
          bg: 'bg-accent-500/20',
          border: 'border-accent-500/30',
          icon: 'text-accent-400',
          button: 'btn-accent'
        }
      case 'secondary':
        return {
          bg: 'bg-secondary-500/20',
          border: 'border-secondary-500/30',
          icon: 'text-secondary-400',
          button: 'btn-secondary'
        }
      default:
        return {
          bg: 'bg-primary-500/20',
          border: 'border-primary-500/30',
          icon: 'text-primary-400',
          button: 'btn-primary'
        }
    }
  }

  const colors = getColorClasses()

  return (
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
          <h2 className="text-xl font-semibold text-slate-300 mb-4">
            Poll Management System
          </h2>
          <div className={`w-16 h-16 ${colors.bg} rounded-full flex items-center justify-center mx-auto mb-4 border ${colors.border}`}>
            <span className="text-2xl">{config.icon}</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {config.title}
          </h3>
          <p className="text-slate-300">
            {step === 'email' 
              ? 'Enter your email to reset your password'
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
                  placeholder={`your.email@${role === 'student' ? 'citchennai.net' : 'gmail.com'}`}
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className={`${colors.button} w-full disabled:opacity-50`}
            >
              {isLoading ? 'Checking...' : 'Continue'}
            </button>

            <button
              type="button"
              onClick={onBack}
              className="btn-secondary w-full"
            >
              Back to Login
            </button>
          </motion.form>
        )}

        {/* Password Reset Step */}
        {step === 'reset' && (
          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handlePasswordReset}
            className="space-y-4"
          >
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-300">
                <strong>Email:</strong> {email}
              </p>
              <p className="text-sm text-slate-300 mt-1">
                <strong>Name:</strong> {userData?.name}
              </p>
              {userData?.department && (
                <p className="text-sm text-slate-300 mt-1">
                  <strong>Department:</strong> {userData.department}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-200 mb-2">
                New Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="input-field pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
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
            
            <button
              type="submit"
              disabled={isLoading}
              className={`${colors.button} w-full disabled:opacity-50`}
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email')
                setEmail('')
                setNewPassword('')
                setConfirmPassword('')
                setUserData(null)
              }}
              className="btn-secondary w-full"
            >
              Back to Email
            </button>
          </motion.form>
        )}
      </div>
    </motion.div>
  )
}
