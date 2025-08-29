'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, GraduationCap, UserCheck } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'student' | 'faculty' | 'hod'>('student')

  const tabs = [
    { id: 'student', label: 'Student', icon: GraduationCap, color: 'bg-primary-500', hoverColor: 'hover:bg-primary-600' },
    { id: 'faculty', label: 'Faculty', icon: Users, color: 'bg-accent-500', hoverColor: 'hover:bg-accent-600' },
    { id: 'hod', label: 'HOD', icon: UserCheck, color: 'bg-secondary-500', hoverColor: 'hover:bg-secondary-600' },
  ]

  return (
    <div className="bg-slate-900 min-h-screen">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
      
      <div className="relative container mx-auto mobile-container py-8 sm:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mobile-mb"
        >
          
                                <h1 className="mobile-text-3xl sm:mobile-text-4xl lg:mobile-text-5xl font-bold text-white mobile-mb">
             Chennai Institute of Technology
           </h1>
           <h2 className="mobile-text-xl sm:mobile-text-2xl lg:mobile-text-3xl font-semibold text-primary-400 mobile-mb">
             Poll Management System
           </h2>

        </motion.div>

        {/* Login Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 mobile-p">
            {/* Tab Navigation */}
            <div className="grid grid-cols-3 gap-1 mobile-mb bg-slate-800 p-1 rounded-xl">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center justify-center space-x-2 py-3 px-2 sm:px-4 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base ${
                    activeTab === tab.id
                      ? 'bg-slate-700 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.charAt(0)}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="mobile-space-y">
              {activeTab === 'student' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-center"
                >
                  <div className="mobile-mb">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mobile-mb border border-primary-500/30">
                      <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-primary-400" />
                    </div>
                    <h2 className="mobile-text-lg sm:mobile-text-xl lg:mobile-text-2xl font-semibold text-white mobile-mb">
                      Student Login
                    </h2>
                    <p className="mobile-text-sm sm:mobile-text-base text-slate-300">
                      Access your dashboard and participate in polls
                    </p>
                  </div>
                  <div className="mobile-space-y">
                    <Link
                      href="/student/login"
                      className="btn-primary inline-block w-full max-w-md"
                    >
                      Login with College Email
                    </Link>
                    <p className="text-xs sm:text-sm text-slate-400">
                      First time? You'll be redirected to create a password
                    </p>
                  </div>
                </motion.div>
              )}

              {activeTab === 'faculty' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-center"
                >
                  <div className="mobile-mb">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-accent-500/20 rounded-full flex items-center justify-center mx-auto mobile-mb border border-accent-500/30">
                      <Users className="w-6 h-6 sm:w-8 sm:h-8 text-accent-400" />
                    </div>
                    <h2 className="mobile-text-lg sm:mobile-text-xl lg:mobile-text-2xl font-semibold text-white mobile-mb">
                      Faculty Login
                    </h2>
                    <p className="mobile-text-sm sm:mobile-text-base text-slate-300">
                      Create polls and view responses from your section
                    </p>
                  </div>
                  <div className="mobile-space-y">
                    <Link
                      href="/faculty/login"
                      className="btn-accent inline-block w-full max-w-md"
                    >
                      Login with Email
                    </Link>
                    <p className="text-xs sm:text-sm text-slate-400">
                      First time? You'll be redirected to create a password
                    </p>
                  </div>
                </motion.div>
              )}

              {activeTab === 'hod' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-center"
                >
                  <div className="mobile-mb">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-secondary-500/20 rounded-full flex items-center justify-center mx-auto mobile-mb border border-secondary-500/30">
                      <UserCheck className="w-6 h-6 sm:w-8 sm:h-8 text-secondary-400" />
                    </div>
                    <h2 className="mobile-text-lg sm:mobile-text-xl lg:mobile-text-2xl font-semibold text-white mobile-mb">
                      HOD Login
                    </h2>
                    <p className="mobile-text-sm sm:mobile-text-base text-slate-300">
                      View department-wide statistics and analytics
                    </p>
                  </div>
                  <div className="mobile-space-y">
                    <Link
                      href="/hod/login"
                      className="btn-secondary inline-block w-full max-w-md"
                    >
                      Login with Email
                    </Link>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Access department and year-level data
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        
      </div>
    </div>
  )
}
