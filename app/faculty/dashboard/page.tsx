'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, LogOut, Plus, BarChart3, UserCheck, Download, Eye, Edit, Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDate, formatCreatedAt, exportToExcel, exportToExcelWithMultipleSheets, getCurrentTime, isPollExpired, formatDeadline, formatRespondedAt } from '@/lib/utils'

interface Student {
  reg_no: string
  name: string
  email: string
  department: string
  section: string
}

interface Poll {
  id: number
  title: string
  created_at: string
  class_id: number
  poll_type?: 'text' | 'options'
  options?: string[]
  deadline?: string | null
}

interface PollResponse {
  id: number
  poll_id: number
  student_reg_no: string
  response: string
  responded_at: string
  student_name: string
}

export default function FacultyDashboard() {
  const [facultyData, setFacultyData] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [responses, setResponses] = useState<PollResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'polls' | 'responses'>('overview')
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [deletingPolls, setDeletingPolls] = useState<Set<number>>(new Set())
  const router = useRouter()

  useEffect(() => {
    const storedData = localStorage.getItem('facultyData')
    if (!storedData) {
      router.push('/faculty/login')
      return
    }

    const data = JSON.parse(storedData)
    setFacultyData(data)
    setLastRefreshed(new Date()) // Set initial refresh time
    fetchStudents(data)
    fetchPolls(data)

    // Add keyboard shortcut for refresh (Ctrl+R or Cmd+R)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()
        if (facultyData && !isRefreshing) {
          handleRefresh()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)

    // Set up real-time subscriptions
    const setupRealtimeSubscriptions = () => {
      // Subscribe to poll_responses changes
      const pollResponsesSubscription = supabase
        .channel('faculty_poll_responses_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'poll_responses'
          },
          () => {
            // Refresh data when responses change
            if (selectedPoll) {
              fetchResponses(selectedPoll.id)
            }
          }
        )
        .subscribe()

      // Subscribe to polls changes
      const pollsSubscription = supabase
        .channel('faculty_polls_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'polls'
          },
          () => {
            // Refresh data when polls change
            fetchPolls(data)
          }
        )
        .subscribe()

      // Subscribe to students changes
      const studentsSubscription = supabase
        .channel('faculty_students_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'students'
          },
          () => {
            // Refresh data when students change
            fetchStudents(data)
          }
        )
        .subscribe()

      // Return cleanup function
      return () => {
        pollResponsesSubscription.unsubscribe()
        pollsSubscription.unsubscribe()
        studentsSubscription.unsubscribe()
      }
    }

    const cleanup = setupRealtimeSubscriptions()

    // Cleanup on unmount
    return cleanup
  }, [router, selectedPoll])

  const fetchStudents = async (faculty: any) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('department', faculty.department)
        .eq('section', faculty.section)

      if (error) throw error
      setStudents(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
      toast.error('Failed to fetch students')
    }
  }

  const fetchPolls = async (faculty: any) => {
    try {
      console.log('Fetching polls for faculty:', faculty) // Debug: Log faculty data
      
      // First, let's check what tables exist and their structure
      console.log('Testing database connection...')
      
      // Test classes table
      const { data: classesTest, error: classesTestError } = await supabase
        .from('classes')
        .select('*')
        .limit(5)
      
      console.log('Classes table test:', { data: classesTest, error: classesTestError })
      
      // Test polls table
      const { data: pollsTest, error: pollsTestError } = await supabase
        .from('polls')
        .select('*')
        .limit(5)
      
      console.log('Polls table test:', { data: pollsTest, error: pollsTestError })
      
      // Get class ID for faculty's department and section
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('department', faculty.department)
        .eq('section', faculty.section)
        .single()

      console.log('Class data for polls:', classData) // Debug: Log class data
      console.log('Class error for polls:', classError) // Debug: Log any errors

      if (classError) throw classError

      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('class_id', classData.id)
        .order('created_at', { ascending: false })

      if (pollsError) throw pollsError
      setPolls(pollsData || [])
    } catch (error) {
      console.error('Error fetching polls:', error)
      toast.error('Failed to fetch polls')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchResponses = async (pollId: number) => {
    try {
      // First get the poll details to know which class it targets
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('class_id')
        .eq('id', pollId)
        .single()

      if (pollError) throw pollError

      // Get the class details
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('department, section')
        .eq('id', pollData.class_id)
        .single()

      if (classError) throw classError

      // Get students in this specific class
      const { data: classStudents, error: studentsError } = await supabase
        .from('students')
        .select('reg_no, name, email, department, section')
        .eq('department', classData.department)
        .eq('section', classData.section)

      if (studentsError) throw studentsError

      // Get responses for this poll
      const { data: responsesData, error: responsesError } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('poll_id', pollId)

      if (responsesError) throw responsesError

      // Match responses with student names
      const formattedResponses = responsesData.map((response: any) => {
        const student = classStudents.find(s => s.reg_no === response.student_reg_no)
        return {
        ...response,
          student_name: student?.name || 'Unknown'
        }
      })

      setResponses(formattedResponses)
      
      // Update students state to only show students from this class
      setStudents(classStudents || [])
    } catch (error) {
      console.error('Error fetching responses:', error)
      toast.error('Failed to fetch responses')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('facultyData')
    router.push('/')
    toast.success('Logged out successfully')
  }

  const exportStudentData = () => {
    const data = students.map(student => ({
      'Registration Number': student.reg_no,
      'Name': student.name,
      'Email': student.email,
      'Department': student.department,
      'Section': student.section
    }))
    
    exportToExcel(data, `students_${facultyData.department}_${facultyData.section}`)
    toast.success('Student data exported successfully!')
  }

  const exportPollResponses = (poll: Poll) => {
    if (responses.length === 0) {
      toast.error('No responses to export')
      return
    }

    // Get students who haven't responded
    const respondedRegNos = responses.map(r => r.student_reg_no)
    const nonResponders = students.filter(student => !respondedRegNos.includes(student.reg_no))
    
    // Export responded students
    const respondedData = responses.map(response => ({
      'Registration Number': response.student_reg_no,
      'Student Name': response.student_name,
      'Response': response.response,
              'Responded At': formatRespondedAt(response.responded_at),
      'Status': 'Responded'
    }))

    // Export non-responded students
    const nonRespondersData = nonResponders.map(student => ({
      'Registration Number': student.reg_no,
      'Name': student.name,
      'Email': student.email,
      'Department': student.department,
      'Section': student.section,
      'Status': 'Not Responded'
    }))

    // Use the utility function for multiple sheets
    exportToExcelWithMultipleSheets([
      { name: 'Responded Students', data: respondedData },
      { name: 'Non-Responded Students', data: nonRespondersData }
    ], `${sanitizeFilename(poll.title)}_${getTodayDDMM()}`)
    
    toast.success('Poll data exported successfully with separate sheets for responded and non-responded students!')
  }

  const handleRefresh = async () => {
    if (!facultyData) return
    
    setIsRefreshing(true)
    try {
      // Refresh all data
      await Promise.all([
        fetchStudents(facultyData),
        fetchPolls(facultyData),
        selectedPoll && fetchResponses(selectedPoll.id)
      ])
      
      setLastRefreshed(new Date())
      toast.success('Data refreshed successfully!')
    } catch (error) {
      console.error('Error refreshing data:', error)
      toast.error('Failed to refresh data')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDeletePoll = async (pollId: number) => {
    if (!window.confirm('Are you sure you want to delete this poll?')) {
      return
    }

    setDeletingPolls(prev => new Set(prev).add(pollId))
    try {
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId)

      if (error) throw error

      setPolls(polls.filter(poll => poll.id !== pollId))
      toast.success('Poll deleted successfully!')
    } catch (error) {
      console.error('Error deleting poll:', error)
      toast.error('Failed to delete poll')
    } finally {
      setDeletingPolls(prev => {
        const newSet = new Set(prev)
        newSet.delete(pollId)
        return newSet
      })
    }
  }

  const sanitizeFilename = (name: string) => {
    // Replace characters invalid on Windows file systems and trim spaces
    return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
  }

  const getTodayDDMM = () => {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    return `${dd}-${mm}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
              <Users className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6"
          >
            <h2 className="text-2xl font-bold text-white mb-2">Faculty Dashboard</h2>
            <p className="text-slate-300">Loading your workspace...</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex justify-center space-x-2"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-3 h-3 bg-primary-500 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              className="w-3 h-3 bg-accent-500 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              className="w-3 h-3 bg-secondary-500 rounded-full"
            />
          </motion.div>
        </div>
      </div>
    )
  }

  if (!facultyData) {
    return null
  }

  return (
    <div className="dashboard-bg">
      {/* Header */}
      <header className="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-accent-500/20 rounded-full flex items-center justify-center border border-accent-500/30">
                <Users className="w-6 h-6 text-accent-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  Faculty Dashboard
                </h1>
                <p className="text-sm text-slate-300">
                  {facultyData.name} • {facultyData.department} {facultyData.section}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-slate-400 text-sm">
                {lastRefreshed && (
                  <span title={`Last refreshed: ${lastRefreshed.toLocaleTimeString()}`}>
                    Last: {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-700"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-slate-800 p-1 rounded-xl shadow-lg">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'students', label: 'Students', icon: UserCheck },
            { id: 'polls', label: 'Polls', icon: BarChart3 },
            { id: 'responses', label: 'Responses', icon: Eye }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="grid md:grid-cols-3 gap-6">
                <div className="card text-center group cursor-pointer" onClick={handleRefresh}>
                  <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary-500/30 group-hover:bg-primary-500/30 transition-colors">
                    <UserCheck className="w-6 h-6 text-primary-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{students.length}</h3>
                  <p className="text-slate-300">Total Students</p>
                  <div className="mt-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to refresh
                  </div>
                </div>
                <div className="card text-center group cursor-pointer" onClick={handleRefresh}>
                  <div className="w-12 h-12 bg-accent-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-accent-500/30 group-hover:bg-accent-500/30 transition-colors">
                    <BarChart3 className="w-6 h-6 text-accent-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{polls.length}</h3>
                  <p className="text-slate-300">Active Polls</p>
                  <div className="mt-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to refresh
                  </div>
                </div>
                <div className="card text-center group cursor-pointer" onClick={handleRefresh}>
                  <div className="w-12 h-12 bg-secondary-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-secondary-500/30 group-hover:bg-secondary-500/30 transition-colors">
                    <Eye className="w-6 h-6 text-secondary-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {polls.reduce((total, poll) => {
                      const pollResponses = responses.filter(r => r.poll_id === poll.id)
                      return total + pollResponses.length
                    }, 0)}
                  </h3>
                  <p className="text-slate-300">Total Responses</p>
                  <div className="mt-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to refresh
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setShowCreatePoll(true)}
                    className="flex items-center justify-center space-x-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Create New Poll</span>
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="btn-primary flex items-center justify-center space-x-2 py-4"
                    title="Refresh all data"
                  >
                    <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh All Data'}</span>
                  </button>
                  <button
                    onClick={exportStudentData}
                    className="btn-secondary flex items-center justify-center space-x-2 py-4"
                  >
                    <Download className="w-5 h-5" />
                    <span>Export Student List</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Students Tab */}
          {activeTab === 'students' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">My Students</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="btn-accent flex items-center space-x-2"
                    title="Refresh students data"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={exportStudentData}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <Download className="w-5 h-5" />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="overflow-x-auto">
                  <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                    <table className="min-w-full">
                      <thead className="bg-gradient-to-r from-violet-600/90 via-purple-600/90 to-fuchsia-600/90">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            Registration No
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            Department
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            Section
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                        {students.map((student, index) => (
                          <tr key={student.reg_no} className={`hover:bg-gradient-to-r hover:from-violet-500/10 hover:to-fuchsia-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-violet-300 font-medium">
                              {student.reg_no}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-semibold">
                              {student.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                              {student.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-300 font-medium">
                              {student.department}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-300 font-medium">
                              {student.section}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Polls Tab */}
          {activeTab === 'polls' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">My Polls</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="btn-accent flex items-center space-x-2"
                    title="Refresh polls data"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => setShowCreatePoll(true)}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Create Poll</span>
                  </button>
                </div>
              </div>

              {polls.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No polls created yet</h3>
                  <p className="text-gray-600">Create your first poll to get started.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {polls.map((poll) => (
                    <div key={poll.id} className="card">
                      <div className="flex justify-between items-start">
                                                 <div className="flex-1">
                           <h3 className="text-lg font-semibold text-white mb-2">
                             {poll.title}
                           </h3>
                          <div className="flex items-center space-x-4 text-sm text-slate-300">
                            <span>Created: {formatCreatedAt(poll.created_at)}</span>
                            <span className="flex items-center space-x-1">
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                poll.poll_type === 'options' ? 'bg-blue-500' : 'bg-green-500'
                              }`}></span>
                              <span className={poll.poll_type === 'options' ? 'text-blue-400' : 'text-green-400'}>
                                {poll.poll_type === 'options' ? 'Multiple Choice' : 'Text Response'}
                              </span>
                            </span>
                            {poll.deadline && (
                              <span className="text-sm text-slate-300">
                                Deadline: {formatDeadline(poll.deadline)}
                                {isPollExpired(poll.deadline) && (
                                  <span className="ml-2 text-red-400 font-medium">(Expired)</span>
                                )}
                              </span>
                            )}
                          </div>
                          {poll.poll_type === 'options' && poll.options && poll.options.length > 0 && (
                            <div className="text-sm text-slate-300 mt-1">
                              <span className="font-medium">Options:</span> {poll.options?.join(', ') || ''}
                            </div>
                          )}
                         </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedPoll(poll)
                              fetchResponses(poll.id)
                              setActiveTab('responses')
                            }}
                            className="btn-secondary flex items-center space-x-2"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View Responses</span>
                          </button>
                          <button
                            onClick={() => handleDeletePoll(poll.id)}
                            disabled={deletingPolls.has(poll.id)}
                            className="btn-danger flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingPolls.has(poll.id) ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                />
                                <span>Deleting...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Responses Tab */}
          {activeTab === 'responses' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white">Poll Responses</h2>
                  {selectedPoll && (
                    <div className="mt-1">
                      <p className="text-slate-300">
                        Poll: {selectedPoll.title}
                      </p>
                    </div>
                  )}
                </div>
                {selectedPoll && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="btn-accent flex items-center space-x-2"
                      title="Refresh responses data"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                    <button
                      onClick={() => exportPollResponses(selectedPoll)}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      <Download className="w-5 h-5" />
                      <span>Export Data</span>
                    </button>
                    <div className="flex items-center space-x-2">
                      <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm">
                        Responded: {responses.length}
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm">
                        Not Responded: {students.length - responses.length}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!selectedPoll ? (
                <div className="text-center py-12">
                  <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a poll to view responses</h3>
                  <p className="text-gray-600">Go to the Polls tab and click "View Responses" on a poll.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">Response Summary</h3>
                    
                    {/* Response Statistics Summary - Side by Side */}
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-white mb-4">Response Overview</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Responded Students Card */}
                        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl border border-green-500/30 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/40">
                                <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center">
                                  <span className="text-white text-sm font-bold">✓</span>
                                </div>
                              </div>
                              <div>
                                <h5 className="text-lg font-semibold text-white">Responded</h5>
                                <p className="text-green-300 text-sm">Students who completed the poll</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-4xl font-bold text-green-400 mb-2">{responses.length}</div>
                            <div className="text-green-300 text-sm">
                              {students.length > 0 ? Math.round((responses.length / students.length) * 100) : 0}% of class
                            </div>
                          </div>
                        </div>

                        {/* Not Responded Students Card */}
                        <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl border border-red-500/30 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/40">
                                <div className="w-6 h-6 bg-red-400 rounded-full flex items-center justify-center">
                                  <span className="text-white text-sm font-bold">!</span>
                                </div>
                              </div>
                              <div>
                                <h5 className="text-lg font-semibold text-white">Not Responded</h5>
                                <p className="text-red-300 text-sm">Students who haven't completed the poll</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-4xl font-bold text-red-400 mb-2">{students.length - responses.length}</div>
                            <div className="text-red-300 text-sm">
                              {students.length > 0 ? Math.round(((students.length - responses.length) / students.length) * 100) : 0}% of class
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Additional Info Row */}
                      <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <span className="text-slate-300">Poll Title: </span>
                            <span className="text-white font-medium">{selectedPoll.title}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-slate-300">Total Students: </span>
                            <span className="text-white font-medium">{students.length}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-slate-300">Response Rate: </span>
                            <span className="text-white font-medium">
                              {students.length > 0 ? Math.round((responses.length / students.length) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Option Counts Summary */}
                    {selectedPoll.options && selectedPoll.options.length > 0 && (
                      <div className="mb-6 p-4 bg-slate-700 rounded-lg border border-slate-600">
                        <h4 className="text-md font-medium text-white mb-3">Option Counts</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {(() => {
                            // Calculate counts for each option
                            const optionCounts = selectedPoll.options?.map((option, index) => {
                              // Since option_index doesn't exist in PollResponse, we'll count responses that match the option text
                              const count = responses.filter(r => r.response === option).length
                              return { option, index, count }
                            }) || []
                            // Keep original option order
                            
                            return optionCounts.map(({ option, index, count }) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-slate-600 rounded-lg border border-slate-500">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                    {index + 1}
                                  </div>
                                  <span className="text-slate-200 font-medium">{option}</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-primary-400">{count}</div>
                                  <div className="text-xs text-slate-400">responses</div>
                                </div>
                              </div>
                            ))
                          })()}
                        </div>
                      </div>
                    )}
                    
                    <h3 className="text-lg font-semibold text-white mb-4">Individual Responses</h3>

                    {/* Side by Side Tables Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">
                      {/* Left Side: Responded Students */}
                      <div className="min-w-0">
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
                          Responded ({responses.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                            <table className="w-full">
                              <thead className="bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-indigo-600/90">
                                <tr>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                    Student
                                  </th>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                    Response
                                  </th>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                    Time
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                                {responses.map((response, index) => (
                                  <tr key={response.id} className={`hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-purple-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                                    <td className="px-6 py-4 text-sm text-white font-medium">
                                      {response.student_name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-200">
                                      {response.response}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-emerald-300">
                                      {formatRespondedAt(response.responded_at)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Non-Responders */}
                      <div className="min-w-0">
                        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <div className="w-3 h-3 bg-red-400 rounded-full mr-3"></div>
                          Not Responded ({students.length - responses.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                            <table className="w-full">
                              <thead className="bg-gradient-to-r from-rose-600/90 via-pink-600/90 to-red-600/90">
                                <tr>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/4">
                                    Student
                                  </th>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/4">
                                    Registration No
                                  </th>
                                  <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-2/4">
                                    Email
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                                {students
                                  .filter(student => !responses.some(r => r.student_reg_no === student.reg_no))
                                  .map((student, index) => (
                                    <tr key={student.reg_no} className={`hover:bg-gradient-to-r hover:from-rose-500/10 hover:to-pink-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                                      <td className="px-6 py-4 text-sm text-white font-medium">
                                        {student.name}
                                      </td>
                                      <td className="px-6 py-4 text-sm text-blue-300 font-mono">
                                        {student.reg_no}
                                      </td>
                                      <td className="px-6 py-4 text-sm text-slate-300 break-all">
                                        {student.email}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Create Poll Modal */}
      {showCreatePoll && (
        <CreatePollModal
          facultyData={facultyData}
          onClose={() => setShowCreatePoll(false)}
          onPollCreated={() => {
            setShowCreatePoll(false)
            handleRefresh() // Use the refresh function instead of just fetchPolls
            toast.success('Poll created successfully!')
          }}
        />
      )}
    </div>
  )
}

// Create Poll Modal Component
function CreatePollModal({ 
  facultyData, 
  onClose, 
  onPollCreated 
}: { 
  facultyData: any
  onClose: () => void
  onPollCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [pollCategory, setPollCategory] = useState<'General Poll' | 'Hackathon' | 'G-Form Poll'>('General Poll')
  const [options, setOptions] = useState(['Yes', 'No'])
  const [deadline, setDeadline] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, ''])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  // Reset options when category changes
  const handleCategoryChange = (category: 'General Poll' | 'Hackathon' | 'G-Form Poll') => {
    setPollCategory(category)
    if (category === 'General Poll') {
      setOptions(['Yes', 'No']) // Reset to default options for General Poll
    } else {
      setOptions(['Yes', 'No']) // Reset to default options for other categories
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      toast.error('Please enter a poll title')
      return
    }
    // Always validate options for all poll types
    const validOptions = options.filter(opt => opt.trim() !== '')
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options')
      return
    }
    if (pollCategory === 'G-Form Poll' && !linkUrl.trim()) {
      toast.error('Please provide the G-Form link')
      return
    }
    if (pollCategory === 'Hackathon' && !linkUrl.trim()) {
      toast.error('Please provide the hackathon link')
      return
    }

    setIsSubmitting(true)
    setIsCreating(true)
    try {
      const pollData = {
        title: title.trim(),
        staff_id: facultyData.id,
        class_id: facultyData.class_id,
        poll_type: 'options', // Always set to options since we always have radio buttons
        poll_category: pollCategory,
        options: options.filter(opt => opt.trim() !== ''),
        created_at: new Date().toTimeString().split(' ')[0], // Store as time only (HH:MM:SS)
        deadline: deadline || null, // Store only time (HH:MM:SS) or null
        link_url: linkUrl.trim() || null // Store the link if provided
      }

      const { data: insertResult, error } = await supabase
        .from('polls')
        .insert(pollData)
        .select()

      if (error) throw error

      setTitle('')
      setOptions(['Yes', 'No'])
      setPollCategory('General Poll')
      setDeadline('')
      setLinkUrl('')
      onPollCreated()
    } catch (error) {
      console.error('Error creating poll:', error)
      toast.error('Failed to create poll')
    } finally {
      setIsSubmitting(false)
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-slate-700"
      >
        <h2 className="text-xl font-semibold text-white mb-6">Create New Poll</h2>
        
        {/* Loading Overlay */}
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-900/80 rounded-2xl flex items-center justify-center z-10"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-white text-lg font-medium">Creating Poll...</p>
              <p className="text-slate-300 text-sm mt-2">Please wait while we set up your poll</p>
            </div>
          </motion.div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* First Row - Title and Category */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-200 mb-3">
                Poll Question
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Are you present for today's contest?"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-3">
                Poll Category
              </label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { value: 'General Poll', label: 'General Poll', color: 'bg-blue-500 hover:bg-blue-600' },
                  { value: 'Hackathon', label: 'Hackathon', color: 'bg-green-500 hover:bg-green-600' },
                  { value: 'G-Form Poll', label: 'G-Form Poll', color: 'bg-purple-500 hover:bg-purple-600' }
                ].map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => handleCategoryChange(category.value as 'General Poll' | 'Hackathon' | 'G-Form Poll')}
                    disabled={isSubmitting}
                    className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      pollCategory === category.value 
                        ? category.color 
                        : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Second Row - Link/Options and Deadline */}
          <div className="grid grid-cols-2 gap-4">
            {/* General Poll: Compact options editor on left; Others: link field */}
            {pollCategory === 'General Poll' ? (
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Poll Options
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400"
                        required
                        disabled={isSubmitting}
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          disabled={isSubmitting}
                          className="px-2 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 5 && (
                  <button
                    type="button"
                    onClick={addOption}
                    disabled={isSubmitting}
                    className="mt-2 w-full py-2 px-3 border-2 border-dashed border-slate-600 text-slate-300 hover:border-slate-500 hover:text-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + Add Option
                  </button>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="linkUrl" className="block text-sm font-medium text-slate-200 mb-2">
                  {pollCategory === 'Hackathon' ? 'Hackathon Link' : 'G-Form Link'}
                </label>
                <input
                  id="linkUrl"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder={pollCategory === 'Hackathon' ? 'https://hackathon-event.com' : 'https://forms.google.com/...'}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400"
                  required
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Deadline Time (Optional)
              </label>
              <input
                type="time"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                min={new Date().toTimeString().slice(0, 5)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Third Row - (removed for General Poll; options are above) */}

          {/* Fourth Row - Text Response Field for General Poll (compact preview) */}
          {pollCategory === 'General Poll' && (
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Text Response Field (Optional)
              </label>
              <input
                type="text"
                disabled
                placeholder="Students can add a text response (optional)"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-slate-600 text-slate-200 rounded-lg hover:bg-slate-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                  <span>Creating...</span>
                </>
              ) : (
                'Create Poll'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
